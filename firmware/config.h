// =============================================================================
// Puck — config.h : every tunable, one per line.
//
// PARSED BY THE BUILD SCRIPT. Each line matching
//     #define ([A-Z0-9_]+) +([-0-9.]+)
// becomes FW.NAME in the browser demo. Keep values plain decimal (no 0x, no
// expressions, no parentheses) or the demo will not see them.
// Change a timing HERE, not in demo/src/*.js.
//
// Library versions this firmware is written against (tags verified on
// GitHub 2026-09-16 by fetching the file at that tag; see firmware/LIBRARIES.md):
//   Adafruit_GFX        1.12.6      Adafruit_GC9A01A   1.1.1
//   Adafruit_NeoPixel   1.15.5      Adafruit_SHT4X     1.0.5
//   Adafruit_VEML7700   2.1.6       Adafruit_STHS34PF80 1.0.2
//   Adafruit_MAX1704X   1.0.3       Adafruit_BusIO     1.17.4
//   arduino-esp32       3.3.11      (board: Adafruit Feather ESP32-S3 2MB PSRAM)
// =============================================================================
#ifndef PUCK_CONFIG_H
#define PUCK_CONFIG_H

// --- Pins (GPIO numbers, from arduino-esp32 3.3.11 -------------------------
// variants/adafruit_feather_esp32s3/pins_arduino.h, read at that tag) --------
#define PIN_SDA 3 // I2C data  — STHS34PF80 0x5A, SHT41 0x44, VEML7700 0x10, MAX17048 0x36
#define PIN_SCL 4 // I2C clock — same bus
#define PIN_RING_POWER 7 // I2C_POWER: switched 3.3 V rail, feeds ONLY the NeoPixel ring
#define PIN_SCK 36 // Display SCK
#define PIN_MOSI 35 // Display MOSI
#define PIN_TFT_CS 10 // Display chip select
#define PIN_TFT_DC 9 // Display data/command
#define PIN_TFT_RST 6 // Display reset
#define PIN_TFT_BL 5 // Display backlight, LEDC PWM
#define PIN_RING_DIN 11 // NeoPixel ring data in
#define PIN_ENC_A 18 // Encoder quadrature A (input pull-up)
#define PIN_ENC_B 17 // Encoder quadrature B (input pull-up)
#define PIN_ENC_SW 16 // Encoder push switch, ACTIVE LOW, pull-up, RTC GPIO (ext1 wake)
#define PIN_PRESENCE_INT 15 // STHS34PF80 INT, configured ACTIVE LOW open-drain, RTC GPIO (ext1 wake)
#define PIN_NEOPIXEL_POWER 21 // On-board single NeoPixel power — held LOW, we never use it

// --- I2C addresses ----------------------------------------------------------
#define I2C_ADDR_PRESENCE 90 // 0x5A STHS34PF80
#define I2C_ADDR_ENV 68 // 0x44 SHT41
#define I2C_ADDR_LUX 16 // 0x10 VEML7700 (fixed, no jumpers)
#define I2C_ADDR_FUEL 54 // 0x36 MAX17048. Older Feather revisions ship an LC709203F at 0x0B — not supported here.

// --- State machine timing (ms unless stated) --------------------------------
#define TICK_MS 100 // main loop period
#define T_WAKE_MS 1500 // WAKE dwell before PRESENT/NIGHT — the ring sweep runs in this window
#define T_AWAY_MS 30000 // AWAY_PENDING grace before deep sleep
#define T_ATTENTION_MS 8000 // idle after the last knob input before leaving ATTENTION
#define T_SLEEP_POLL_S 60 // deep-sleep timer wake, seconds (fuel gauge + lux housekeeping)
#define RING_LOWBATT_MS 2000 // low-battery warning window measured from entering WAKE

// --- Light thresholds (lux) -------------------------------------------------
#define LUX_NIGHT 5 // below this the room counts as night
#define LUX_HYST 3 // must climb above LUX_NIGHT+LUX_HYST to leave night
#define LUX_DAY 400 // above this the room is daylight-bright: UI uses full-contrast ticks

// --- Backlight duty (0..1) --------------------------------------------------
#define BL_PRESENT 0.40 // someone is there, quiet display
#define BL_NIGHT 0.10 // dark room, do not blind anybody
#define BL_ATTENTION 1.0 // hand on the knob, or waking up
#define BL_PWM_FREQ_HZ 20000 // LEDC frequency, above audible
#define BL_PWM_BITS 10 // LEDC resolution (0..1023)

// --- NeoPixel ring ----------------------------------------------------------
#define LED_COUNT 24 // NeoPixel Ring 24 (ADA1586), GRB
#define LED_MAX_BRIGHTNESS 0.20 // hard cap on every channel; ring draws ~312 mA at this cap
#define LED_SWEEP_MS 1200 // one full comet lap during WAKE
#define LED_SWEEP_FADE_MS 300 // comet fade-out after the lap (1200+300 = T_WAKE_MS)
#define LED_TAIL 6 // comet tail length in pixels
#define LED_BREATH_MS 2600 // ATTENTION breathing period
#define LED_BREATH_FLOOR 0.25 // ATTENTION dims to this fraction, never fully off
#define LED_PULSE_MS 400 // one low-battery pulse (on+off)
#define LED_PULSE_COUNT 3 // number of low-battery pulses, then dark
#define LED_WARM_R 255 // WAKE comet colour, warm white
#define LED_WARM_G 170 // WAKE comet colour
#define LED_WARM_B 90 // WAKE comet colour
#define LED_AMBER_R 255 // ATTENTION breathing colour
#define LED_AMBER_G 150 // ATTENTION breathing colour
#define LED_AMBER_B 40 // ATTENTION breathing colour
#define LED_RED_R 255 // LOW_BATT pulse colour
#define LED_RED_G 30 // LOW_BATT pulse colour
#define LED_RED_B 20 // LOW_BATT pulse colour

// --- Presence (raw STHS34PF80 TPRESENCE counts, signed LSB) -----------------
// UNVERIFIED: I did not open the ST datasheet, so these two are bench-tuning
// knobs, not datasheet values. Set them from the printed raw value at 0.8 m.
#define PRESENCE_ON_THRESH 250 // raw count that turns presence ON
#define PRESENCE_OFF_THRESH 150 // raw count it must fall below to turn OFF (hysteresis)

// --- Battery ----------------------------------------------------------------
#define VBAT_LOW_PCT 15 // below this the ring gives the low-battery pulses on wake

// --- Comfort band (drives the single colour accent) -------------------------
#define TEMP_COMFORT_LO 19 // degC
#define TEMP_COMFORT_HI 25 // degC
#define RH_COMFORT_LO 30 // %RH
#define RH_COMFORT_HI 60 // %RH

// --- Clock ------------------------------------------------------------------
// There is no RTC crystal and no network on this build, so "hour of day" is a
// counter seeded at boot and kept in RTC memory across deep sleep. It WILL
// drift on the internal RC oscillator — CLOCK_TRIM_PPM is the knob you turn
// after leaving it running for a day.
#define CLOCK_START_HOUR 9 // hour assumed at cold boot
#define CLOCK_TRIM_PPM 0 // positive speeds the clock up, parts per million

// --- Sensor cadence ---------------------------------------------------------
#define SENSOR_PERIOD_MS 1000 // SHT41 and VEML7700 are read at 1 Hz
#define ENC_DEBOUNCE_US 1500 // quadrature ISR debounce window, microseconds
#define ENC_SW_DEBOUNCE_MS 40 // encoder push-switch debounce

// --- Claude usage page ------------------------------------------------------
// The numbers are pushed to the device by tools/claude_usage_push.py; the puck
// never talks to Anthropic itself. Strings (WIFI_SSID / WIFI_PASS) live in
// firmware/secrets.h — NOT here, because the build script's regex only reads
// numeric defines and a quoted string would be silently skipped.
#define CLAUDE_STALE_MIN 15 // minutes; older than this and the numbers go dim
#define CLAUDE_WIFI_ENABLED 0 // 1 = keep the station up and run the receiver. OFF by default: an associated Wi-Fi station listening for POSTs costs battery continuously (see the estimate in companion.ino), and the power table in the demo assumes 0.
#define CLAUDE_HTTP_PORT 8080 // TCP port of the POST /claude receiver

// --- Display geometry -------------------------------------------------------
#define SCREEN_W 240 // GC9A01A panel width
#define SCREEN_H 240 // GC9A01A panel height
#define SCREEN_CX 120 // centre x
#define SCREEN_CY 120 // centre y
#define SCREEN_R 120 // active circle radius; anything outside is behind the bezel

// --- UI layout (px) ---------------------------------------------------------
#define UI_TICK_R_OUT 112 // hour-ring tick outer radius
#define UI_TICK_R_IN 102 // hour-ring tick inner radius
#define UI_TICK_R_IN_NOW 96 // the current hour's tick reaches further in
#define UI_BIG_Y 96 // top y of the big size-4 number
#define UI_LABEL_Y 66 // y of the small page label
#define UI_BAR_Y 152 // y of the humidity bar
#define UI_BAR_W 84 // humidity bar full width
#define UI_BAR_H 3 // humidity bar height
#define UI_PIP_Y 176 // y of the battery pip
#define UI_PIP_W 40 // battery pip full width
#define UI_GLYPH_Y 44 // y of the tiny state glyph

// --- Colours, RGB565 as DECIMAL so the build script can export them ---------
#define COL_BG 0 // 0x0000 black
#define COL_INK 65535 // 0xFFFF white — the one big number
#define COL_DIM 14823 // 0x39E7 grey (58,60,58) — labels, spent hour ticks
#define COL_FAINT 6371 // 0x18E3 near-black (24,28,24) — unspent hour ticks, bar track
#define COL_GREEN 15951 // 0x3E4F (60,200,120) — inside the comfort band
#define COL_AMBER 64902 // 0xFD86 (255,176,48) — outside the comfort band
#define COL_RED 57830 // 0xE1E6 (230,60,50) — low battery
#define COL_CLAUDE 56234 // 0xDBAA — warm terracotta orange. Picked from #D97757: r 217>>3=27, g 119>>2=29, b 87>>3=10, packed 27<<11|29<<5|10. Back through the panel's bit-replication expansion that is (222,116,82).

#endif // PUCK_CONFIG_H
