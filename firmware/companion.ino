// =============================================================================
// Puck — companion.ino
//
// Board: Adafruit Feather ESP32-S3 2MB PSRAM, arduino-esp32 3.3.11.
// Everything tunable lives in config.h. Everything that decides anything lives
// in state_machine.cpp / ui.cpp / leds.cpp, none of which touch hardware — this
// file is the only place that talks to a peripheral.
//
// Library versions (tags fetched from GitHub 2026-09-16, see LIBRARIES.md):
//   Adafruit_GFX 1.12.6 · Adafruit_GC9A01A 1.1.1 · Adafruit_NeoPixel 1.15.5
//   Adafruit_SHT4X 1.0.5 · Adafruit_VEML7700 2.1.6 · Adafruit_STHS34PF80 1.0.2
//   Adafruit_MAX1704X 1.0.3 · Adafruit_BusIO 1.17.4 · arduino-esp32 3.3.11
//
// The Claude usage page's receiver (WiFi + WebServer, both bundled with
// arduino-esp32 3.3.11) is compiled in only when CLAUDE_WIFI_ENABLED is 1.
// =============================================================================
#include <Adafruit_GC9A01A.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_SHT4x.h>
#include <Adafruit_STHS34PF80.h>
#include <Adafruit_VEML7700.h>
#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>

#include "config.h"
#include "leds.h"
#include "power.h"
#include "state_machine.h"
#include "ui.h"

#if CLAUDE_WIFI_ENABLED
// Both of these ship with arduino-esp32 3.3.11; nothing is added to the BOM of
// libraries. Verified at tag 3.3.11 by fetching the headers — see LIBRARIES.md.
#include <WebServer.h>
#include <WiFi.h>

#include "secrets.h"  // WIFI_SSID / WIFI_PASS — copy secrets.h.example
#endif

// --- Peripherals -------------------------------------------------------------
// Hardware SPI display. Adafruit_GC9A01A(cs, dc, rst) picks the default SPI
// bus; begin() with no argument uses SPI_DEFAULT_FREQ, which the library sets
// to 40 MHz for ESP32 (verified in Adafruit_GC9A01A.cpp @ 1.1.1).
static Adafruit_GC9A01A tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
static Adafruit_NeoPixel ring(LED_COUNT, PIN_RING_DIN, NEO_GRB + NEO_KHZ800);
static Adafruit_SHT4x sht4;
static Adafruit_VEML7700 veml;
static Adafruit_STHS34PF80 sths;

// --- State -------------------------------------------------------------------
static SM sm;
static Inputs in;
static Outputs out;
static UiModel model;
static UiModel modelDrawn;   // what is actually on the glass
static bool modelValid = false;

static uint32_t nextTickMs = 0;
static uint32_t lastSensorMs = 0;
static bool presenceLatch = false;   // output of the PRESENCE_ON/OFF hysteresis

// Survives deep sleep: the seconds counter that stands in for a real clock, and
// the flag that says "ext1 fired, treat the first tick as presence".
RTC_DATA_ATTR static uint32_t rtcSeconds = 0;
RTC_DATA_ATTR static bool rtcSeeded = false;

// --- Claude usage, pushed in over HTTP ---------------------------------------
// In RTC memory so a deep-sleep cycle does not throw the numbers away: the
// laptop may well be shut when the puck next wakes. The freshness stamp is the
// same rtcSeconds counter the clock uses, NOT the "ts" field in the payload —
// the device has no real time of day to compare a unix timestamp against, and
// what the page wants to say is "how long since this arrived", which is local.
// That means claudeAgeMin inherits the clock's drift (see CLOCK_TRIM_PPM) and
// under-counts sleep time on an ext1 wake, exactly like the hour ring does.
RTC_DATA_ATTR static float rtcClaudeUsd = 0.0f;
RTC_DATA_ATTR static uint32_t rtcClaudeIn = 0;
RTC_DATA_ATTR static uint32_t rtcClaudeOut = 0;
RTC_DATA_ATTR static int32_t rtcClaudeWindowPct = -1;
RTC_DATA_ATTR static uint32_t rtcClaudeAtSec = 0;  // rtcSeconds when it landed; 0 = never

// --- Encoder -----------------------------------------------------------------
// Full-step quadrature decode in an ISR. The classic 16-entry transition table:
// index = (prev << 2) | now, value = -1 / 0 / +1. Bounces produce table zeros,
// and a short debounce window throws away anything faster than the encoder can
// physically move.
static const int8_t QUAD_TABLE[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
static volatile uint8_t encPrev = 0;
static volatile int32_t encAccum = 0;       // quarter-steps
static volatile uint32_t encLastUs = 0;
static volatile bool encSwFlag = false;
static volatile uint32_t encSwLastMs = 0;

static void IRAM_ATTR encIsr() {
  uint32_t nowUs = micros();
  if ((nowUs - encLastUs) < ENC_DEBOUNCE_US) return;
  encLastUs = nowUs;
  uint8_t now = (uint8_t)((digitalRead(PIN_ENC_A) << 1) | digitalRead(PIN_ENC_B));
  encAccum += QUAD_TABLE[(encPrev << 2) | now];
  encPrev = now;
}

static void IRAM_ATTR encSwIsr() {
  uint32_t nowMs = millis();
  if ((nowMs - encSwLastMs) < ENC_SW_DEBOUNCE_MS) return;
  encSwLastMs = nowMs;
  if (digitalRead(PIN_ENC_SW) == LOW) encSwFlag = true;  // active low
}

// Detents, not quarter-steps: the PEC11R gives 4 quadrature edges per detent.
static int encTakeDelta() {
  noInterrupts();
  int32_t acc = encAccum;
  int32_t detents = acc / 4;
  encAccum = acc - detents * 4;
  interrupts();
  return (int)detents;
}

static bool encTakePress() {
  noInterrupts();
  bool p = encSwFlag;
  encSwFlag = false;
  interrupts();
  return p;
}

// --- Clock stand-in ----------------------------------------------------------
// rtcSeconds ticks in RTC memory so the hour survives deep sleep. On a timer
// wake we cannot know how long we were really out beyond T_SLEEP_POLL_S, which
// is exactly what we add.
static uint32_t nowSeconds() {
  return rtcSeconds + (millis() / 1000);
}

static float clockHour() {
  uint32_t secs = nowSeconds();
  double trimmed = (double)secs * (1.0 + (double)CLOCK_TRIM_PPM / 1000000.0);
  double hours = (double)CLOCK_START_HOUR + trimmed / 3600.0;
  while (hours >= 24.0) hours -= 24.0;
  return (float)hours;
}

// --- Claude usage receiver ---------------------------------------------------
// 65535 minutes = "never received", which is what ui_page_claude renders dim.
static uint16_t claudeAgeMin() {
  if (rtcClaudeAtSec == 0) return 65535;
  uint32_t age = nowSeconds() - rtcClaudeAtSec;
  uint32_t mins = age / 60u;
  return (mins > 65534u) ? 65534 : (uint16_t)mins;
}

#if CLAUDE_WIFI_ENABLED
// POWER: off by default, and the demo's power table assumes off. Turning it on
// means a station associated to an AP for as long as the device is awake, not a
// sleeping radio. The ESP32-S3 datasheet gives peaks only — Wi-Fi RX 88 mA —
// and what this code actually costs is the modem-sleep average of an idle
// associated station, which depends on the AP's DTIM and which I have NOT
// measured and did NOT find a datasheet figure for. UNVERIFIED. parts.json
// carries 20 mA as a placeholder for the awake modes, flagged the same way;
// budget against the 88 mA peak until someone puts a meter on it.
static WebServer claudeServer(CLAUDE_HTTP_PORT);
static bool claudeBegun = false;    // WiFi.begin() has been called this boot
static bool claudeServing = false;  // routes installed and listening

// Pull one number out of a flat JSON object. Five scalars, no nesting, no
// arrays, no escapes worth the trouble — strtod beats a 30 kB parser here.
// ponytail: naive key search, a key appearing inside a string value would fool
// it. Swap in ArduinoJson if the payload ever grows objects or strings.
static bool jsonNum(const String& body, const char* key, double* v) {
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return false;
  int c = body.indexOf(':', k + (int)pat.length());
  if (c < 0) return false;
  const char* p = body.c_str() + c + 1;
  char* end = NULL;
  double d = strtod(p, &end);
  if (end == p) return false;
  *v = d;
  return true;
}

// POST /claude  {"usd":4.2,"in":812000,"out":96000,"window_pct":37,"ts":...}
// "ts" is parsed by nobody: freshness is measured locally (see the RTC block).
static void claudeHandlePost() {
  String body = claudeServer.arg("plain");
  double usd = 0.0, tin = 0.0, tout = 0.0, wpct = -1.0;
  if (!jsonNum(body, "usd", &usd) || !jsonNum(body, "in", &tin) ||
      !jsonNum(body, "out", &tout)) {
    claudeServer.send(400, "text/plain", "want usd/in/out\n");
    return;
  }
  if (!jsonNum(body, "window_pct", &wpct)) wpct = -1.0;
  if (usd < 0.0) usd = 0.0;
  if (tin < 0.0) tin = 0.0;
  if (tout < 0.0) tout = 0.0;
  rtcClaudeUsd = (float)usd;
  rtcClaudeIn = (uint32_t)tin;
  rtcClaudeOut = (uint32_t)tout;
  rtcClaudeWindowPct = (wpct < 0.0) ? -1 : (int32_t)wpct;
  uint32_t at = nowSeconds();
  rtcClaudeAtSec = (at == 0) ? 1 : at;  // 0 is the "never" sentinel
  claudeServer.send(200, "text/plain", "ok\n");
}

// Called once per tick. Never blocks: association takes seconds and the tick
// budget is TICK_MS, so this only ever kicks things off and then polls.
static void claudeService(bool awake) {
  if (!awake) {  // SLEEP: radio down before power_enter_deep_sleep cuts the rest
    if (claudeBegun) {
      claudeServer.stop();
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      claudeBegun = false;
      claudeServing = false;
    }
    return;
  }
  if (!claudeBegun) {
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true);  // modem sleep between beacons; see the power note above
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    claudeBegun = true;
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    claudeServing = false;
    return;
  }
  if (!claudeServing) {
    claudeServer.on("/claude", HTTP_POST, claudeHandlePost);
    claudeServer.begin();
    claudeServing = true;
  }
  claudeServer.handleClient();
}
#else
static void claudeService(bool awake) {
  (void)awake;  // Wi-Fi compiled out entirely: no radio, no listener, no cost
}
#endif

// --- Model change detection --------------------------------------------------
// Redraw only when something a human could see has changed: temperature to
// 0.1 degC, humidity and battery to 1 %, the hour tick, page and state.
static bool modelChanged(const UiModel& a, const UiModel& b) {
  if ((int)(a.tempC * 10.0f) != (int)(b.tempC * 10.0f)) return true;
  if ((int)a.rh != (int)b.rh) return true;
  if ((int)a.hour != (int)b.hour) return true;
  if ((int)a.vbatPct != (int)b.vbatPct) return true;
  if (a.charging != b.charging) return true;
  if (a.page != b.page) return true;
  if (a.state != b.state) return true;
  if ((a.lux >= LUX_DAY) != (b.lux >= LUX_DAY)) return true;  // only the threshold matters
  // Claude page: cents, whole-percent window, and the stale/fresh flip only.
  if ((int)(a.claudeUsd * 100.0f) != (int)(b.claudeUsd * 100.0f)) return true;
  if (a.claudeInTok != b.claudeInTok) return true;
  if (a.claudeOutTok != b.claudeOutTok) return true;
  if (a.claudeWindowPct != b.claudeWindowPct) return true;
  if ((a.claudeAgeMin > CLAUDE_STALE_MIN) != (b.claudeAgeMin > CLAUDE_STALE_MIN)) return true;
  return false;
}

// =============================================================================
// setup
// =============================================================================
void setup() {
  // --- Power rails first, before anything can draw current through them ------
  pinMode(PIN_NEOPIXEL_POWER, OUTPUT);
  digitalWrite(PIN_NEOPIXEL_POWER, LOW);  // on-board pixel: never used, stays dark
  pinMode(PIN_RING_POWER, OUTPUT);
  digitalWrite(PIN_RING_POWER, HIGH);     // switched 3.3 V rail up so I2C/ring can init

  // --- Clock: seed on cold boot, advance by the poll interval on a timer wake -
  if (!rtcSeeded) {
    rtcSeconds = 0;
    rtcSeeded = true;
  } else if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER) {
    rtcSeconds += T_SLEEP_POLL_S;
  }

  // --- I2C bus: STHS34PF80 0x5A, SHT41 0x44, VEML7700 0x10, MAX17048 0x36 ----
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);

  // --- Environment sensor. Medium precision keeps the blocking read short ----
  sht4.begin(&Wire);
  sht4.setPrecision(SHT4X_MED_PRECISION);
  sht4.setHeater(SHT4X_NO_HEATER);

  // --- Light sensor. Fixed gain 1x / 100 ms integration: about 0.06 lx per
  //     count up to ~15 klx, which straddles LUX_NIGHT (5) and LUX_DAY (400)
  //     without the settling delay that auto-ranging costs on every read. -----
  veml.begin(&Wire);
  veml.setGain(VEML7700_GAIN_1);
  veml.setIntegrationTime(VEML7700_IT_100MS);
  veml.enable(true);

  // --- Presence sensor. INT is ACTIVE LOW + open drain so it can share the
  //     ext1 ANY_LOW wake group with the encoder switch (see power.cpp). ------
  sths.begin(I2C_ADDR_PRESENCE, &Wire);
  sths.setBlockDataUpdate(true);
  sths.setObjAveraging(STHS34PF80_AVG_TMOS_128);
  sths.setOutputDataRate(STHS34PF80_ODR_1_HZ);   // 10 uA at 1 Hz
  sths.setIntPolarity(true);                      // true = active low
  sths.setIntOpenDrain(true);
  sths.setIntLatched(false);
  sths.setIntMask(STHS34PF80_PRES_FLAG);          // only presence pulls INT
  sths.setIntSignal(STHS34PF80_INT_OR);

  // --- Fuel gauge (MAX17048 at 0x36) ----------------------------------------
  power_begin();

  // --- Encoder. Both phases and the switch are active low with pull-ups. -----
  pinMode(PIN_ENC_A, INPUT_PULLUP);
  pinMode(PIN_ENC_B, INPUT_PULLUP);
  pinMode(PIN_ENC_SW, INPUT_PULLUP);
  pinMode(PIN_PRESENCE_INT, INPUT_PULLUP);
  encPrev = (uint8_t)((digitalRead(PIN_ENC_A) << 1) | digitalRead(PIN_ENC_B));
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_A), encIsr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_B), encIsr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_SW), encSwIsr, FALLING);

  // --- Display. SPI pins bound explicitly; MISO unused (display is write-only)
  SPI.begin(PIN_SCK, -1, PIN_MOSI, -1);
  tft.begin();                 // 40 MHz on ESP32 by library default
  tft.setRotation(0);
  tft.fillScreen(COL_BG);
  ledcAttach(PIN_TFT_BL, BL_PWM_FREQ_HZ, BL_PWM_BITS);
  ledcWrite(PIN_TFT_BL, 0);    // stay dark until the state machine says otherwise

  // --- Ring. Rail is already up; keep every pixel dark until leds_compute. ---
  ring.begin();
  ring.setBrightness(255);     // the cap is applied in leds_compute, not here
  ring.clear();
  ring.show();

  // --- State machine --------------------------------------------------------
  sm_init(&sm);

  // --- Wake path: ext1 fired because presence (or the knob) went active, so
  //     force presence true for the first tick. Without this the first
  //     STHS read could land in the gap between frames and we would go
  //     straight back to sleep. ----------------------------------------------
  if (power_woke_from_deep_sleep() &&
      esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT1) {
    presenceLatch = true;
  }

  nextTickMs = millis();
}

// =============================================================================
// loop — one pass every TICK_MS
// =============================================================================
void loop() {
  uint32_t now = millis();
  if ((int32_t)(now - nextTickMs) < 0) return;
  nextTickMs += TICK_MS;

  // --- 1. Sensors. SHT41 and VEML7700 at 1 Hz; presence every tick because it
  //        is what decides whether the device is awake at all. ---------------
  static float tempC = 21.0f;
  static float rh = 45.0f;
  static float lux = 100.0f;
  if ((now - lastSensorMs) >= SENSOR_PERIOD_MS) {
    lastSensorMs = now;
    sensors_event_t hum, tmp;
    if (sht4.getEvent(&hum, &tmp)) {
      tempC = tmp.temperature;
      rh = hum.relative_humidity;
    }
    // _NOWAIT: gain and integration time are fixed in setup(), so there is no
    // settling delay to sit through. _CORRECTED applies the high-lux
    // non-linearity fit from the Vishay app note.
    lux = veml.readLux(VEML_LUX_CORRECTED_NOWAIT);
  }

  // --- 2. Presence hysteresis. The raw TPRESENCE count is signed; a warm body
  //        pushes it positive. Two thresholds so a person sitting still at the
  //        edge of the cone does not make the device blink on and off. -------
  int16_t praw = sths.readPresence();
  if (!presenceLatch && praw >= PRESENCE_ON_THRESH) {
    presenceLatch = true;
  } else if (presenceLatch && praw < PRESENCE_OFF_THRESH) {
    presenceLatch = false;
  }

  // --- 3. Assemble the inputs -----------------------------------------------
  in.presence = presenceLatch;
  in.lux = lux;
  in.tempC = tempC;
  in.rh = rh;
  in.hour = clockHour();
  in.encDelta = encTakeDelta();
  in.encPressed = encTakePress();
  in.vbatPct = power_pct();
  in.charging = power_charging();
  in.nowMs = now;

  // --- 4. The only decision point -------------------------------------------
  sm_step(&sm, &in, &out);

  // --- 4b. Claude usage receiver. Awake only: the radio goes down before the
  //         device sleeps, so the default power table is untouched (and with
  //         CLAUDE_WIFI_ENABLED 0 this compiles to nothing at all). ---------
  claudeService(sm.state != SLEEP);

  // --- 5. Backlight. LEDC at BL_PWM_BITS resolution. ------------------------
  uint32_t maxDuty = (1u << BL_PWM_BITS) - 1u;
  uint32_t duty = (uint32_t)(out.backlight * (float)maxDuty + 0.5f);
  if (duty > maxDuty) duty = maxDuty;
  ledcWrite(PIN_TFT_BL, duty);

  // --- 6. Ring. The rail is switched, not just the data: a dark 24-pixel ring
  //        still eats ~24 mA, so RING_OFF means the rail goes down. ----------
  static bool railUp = true;
  if (out.ringOn) {
    if (!railUp) {
      digitalWrite(PIN_RING_POWER, HIGH);
      delay(1);          // let the rail settle before clocking data at it
      ring.begin();      // re-arm the RMT/driver after a power cycle
      railUp = true;
    }
    uint8_t px[LED_COUNT][3];
    leds_compute(out.ringMode, now - out.stateEnteredMs, LED_MAX_BRIGHTNESS, px);
    for (int i = 0; i < LED_COUNT; i++) {
      ring.setPixelColor(i, px[i][0], px[i][1], px[i][2]);
    }
    ring.show();
  } else if (railUp) {
    ring.clear();
    ring.show();
    digitalWrite(PIN_RING_POWER, LOW);
    railUp = false;
  }

  // --- 7. Display. Redraw only when the model actually changed; a full 240x240
  //        repaint at 40 MHz is ~23 ms of SPI we do not want every tick. -----
  if (out.displayOn) {
    model.tempC = tempC;
    model.rh = rh;
    model.hour = in.hour;
    model.vbatPct = in.vbatPct;
    model.charging = in.charging;
    model.page = out.page;
    model.state = sm.state;
    model.lux = lux;
    model.claudeUsd = rtcClaudeUsd;
    model.claudeInTok = rtcClaudeIn;
    model.claudeOutTok = rtcClaudeOut;
    model.claudeWindowPct = (int)rtcClaudeWindowPct;
    model.claudeAgeMin = claudeAgeMin();
    if (!modelValid || modelChanged(model, modelDrawn)) {
      ui_draw(tft, model);
      modelDrawn = model;
      modelValid = true;
    }
  } else {
    modelValid = false;  // next wake always repaints
  }

  // --- 8. Sleep. The state machine has already cut the backlight and the ring
  //        in its outputs; power_enter_deep_sleep does the rest and never
  //        returns. -------------------------------------------------------
  if (sm.state == SLEEP) {
    rtcSeconds += millis() / 1000;
    power_enter_deep_sleep(tft);
  }
}
