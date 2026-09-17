// =============================================================================
// Puck — power.cpp
//
// Fuel gauge: Adafruit_MAX1704X 1.0.3 — class Adafruit_MAX17048, methods
// begin(TwoWire*), cellPercent(), cellVoltage(), chargeRate(). Verified by
// reading Adafruit_MAX1704X.h at tag 1.0.3.
// NOTE: older Feather ESP32-S3 revisions carry an LC709203F at 0x0B instead.
// That part is NOT supported here; swapping it in means Adafruit_LC709203F and
// a different percentage call.
//
// Deep sleep wake path, and why it is built this way:
//   ESP32-S3 does NOT define SOC_PM_SUPPORT_EXT1_WAKEUP_MODE_PER_PIN (checked
//   in esp-idf v5.5 components/soc/esp32s3/include/soc/soc_caps.h), so every
//   ext1 pin must share ONE trigger level. ENC_SW has a pull-up and idles HIGH,
//   so an ANY_HIGH group containing it would fire instantly. Therefore the
//   STHS34PF80 INT is configured ACTIVE LOW + open drain (setIntPolarity(true),
//   setIntOpenDrain(true) in companion.ino) with a pull-up, both pins idle HIGH,
//   and the group wakes on ANY_LOW.
//   Internal pull-ups die when RTC_PERIPH powers down, so RTC_PERIPH is pinned
//   ON and both pins get rtc_gpio_pullup_en(). That costs a few microamps and
//   buys not needing two external resistors.
// =============================================================================
#include "power.h"

#include <Adafruit_MAX1704X.h>
#include <Arduino.h>
#include <Wire.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>

#include "state_machine.h"

static Adafruit_MAX17048 g_fuel;
static bool g_fuelOk = false;

bool power_begin() {
  g_fuelOk = g_fuel.begin(&Wire);
  return g_fuelOk;
}

float power_pct() {
  if (!g_fuelOk) return 100.0f;  // no gauge: never nag about a battery we cannot read
  float p = g_fuel.cellPercent();
  if (p < 0.0f) p = 0.0f;
  if (p > 100.0f) p = 100.0f;
  return p;
}

bool power_charging() {
  if (!g_fuelOk) return false;
  return g_fuel.chargeRate() > 0.0f;
}

bool power_woke_from_deep_sleep() {
  esp_sleep_wakeup_cause_t c = esp_sleep_get_wakeup_cause();
  return (c == ESP_SLEEP_WAKEUP_EXT1) || (c == ESP_SLEEP_WAKEUP_TIMER);
}

void power_enter_deep_sleep(Adafruit_GC9A01A& tft) {
  // 1. Panel: backlight to zero first (so the fade to black is not visible),
  //    then the GC9A01A sleep-in command. Adafruit_GC9A01A 1.1.1 has no
  //    sleep() helper, but Adafruit_SPITFT::sendCommand() is public, and the
  //    library defines GC9A01A_SLPIN 0x10 / GC9A01A_DISPOFF 0x28.
  ledcWrite(PIN_TFT_BL, 0);
  tft.sendCommand(GC9A01A_DISPOFF);
  tft.sendCommand(GC9A01A_SLPIN);
  delay(10);  // datasheet asks for a pause after SLPIN before cutting clocks

  // 2. Ring: cut the switched 3.3 V rail. The 24 ring idles at ~24 mA dark,
  //    which is more than everything else on the board put together.
  digitalWrite(PIN_RING_POWER, LOW);
  digitalWrite(PIN_NEOPIXEL_POWER, LOW);  // on-board pixel stays dead too

  // 3. Keep the pull-ups alive through sleep so the two wake pins really do
  //    idle HIGH (see the header comment).
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
  rtc_gpio_pullup_en((gpio_num_t)PIN_PRESENCE_INT);
  rtc_gpio_pulldown_dis((gpio_num_t)PIN_PRESENCE_INT);
  rtc_gpio_pullup_en((gpio_num_t)PIN_ENC_SW);
  rtc_gpio_pulldown_dis((gpio_num_t)PIN_ENC_SW);

  // 4. Wake sources: presence INT or a knob press (both active LOW), plus a
  //    housekeeping timer so the gauge gets read even in an empty room.
  uint64_t mask = (1ULL << PIN_PRESENCE_INT) | (1ULL << PIN_ENC_SW);
  esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_LOW);
  esp_sleep_enable_timer_wakeup((uint64_t)T_SLEEP_POLL_S * 1000000ULL);

  // 5. Gone. Execution resumes in setup() on the next wake.
  esp_deep_sleep_start();
}
