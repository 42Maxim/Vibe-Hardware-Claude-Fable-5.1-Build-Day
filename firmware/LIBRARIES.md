# Puck firmware — pinned library versions

Every version below is the latest GitHub release as of **2026-09-16**, read from
`GET /repos/{owner}/{repo}/releases/latest` (via `gh api`) and then confirmed by
fetching the actual header at that tag from `raw.githubusercontent.com`. No
version here was recalled from memory.

| Library | Version | Released | Verified how |
|---|---|---|---|
| [Adafruit_GFX](https://github.com/adafruit/Adafruit-GFX-Library) | 1.12.6 | 2026-04-09 | `releases/latest`; fetched `Adafruit_GFX.h`, `Adafruit_GFX.cpp`, `Adafruit_SPITFT.h`, `glcdfont.c` at tag `1.12.6` |
| [Adafruit_GC9A01A](https://github.com/adafruit/Adafruit_GC9A01A) | 1.1.1 | 2023-06-07 | `releases/latest`; fetched `Adafruit_GC9A01A.h/.cpp` at tag `1.1.1` |
| [Adafruit_NeoPixel](https://github.com/adafruit/Adafruit_NeoPixel) | 1.15.5 | 2026-05-12 | `releases/latest`; fetched `Adafruit_NeoPixel.h` at tag `1.15.5` |
| [Adafruit_SHT4X](https://github.com/adafruit/Adafruit_SHT4X) | 1.0.5 | 2024-07-30 | `releases/latest`; fetched `Adafruit_SHT4x.h` at tag `1.0.5` |
| [Adafruit_VEML7700](https://github.com/adafruit/Adafruit_VEML7700) | 2.1.6 | 2024-02-06 | `releases/latest`; fetched `Adafruit_VEML7700.h` at tag `2.1.6` |
| [Adafruit_STHS34PF80](https://github.com/adafruit/Adafruit_STHS34PF80) | 1.0.2 | 2025-11-04 | `releases/latest`; fetched `Adafruit_STHS34PF80.h` at tag `1.0.2` |
| [Adafruit_MAX1704X](https://github.com/adafruit/Adafruit_MAX1704X) | 1.0.3 | 2024-03-25 | `releases/latest`; fetched `Adafruit_MAX1704X.h` at tag `1.0.3` |
| [Adafruit_BusIO](https://github.com/adafruit/Adafruit_BusIO) | 1.17.4 | 2025-09-22 | `releases/latest` (transitive dependency of the sensor libraries) |
| [arduino-esp32](https://github.com/espressif/arduino-esp32) | 3.3.11 | 2026-07-22 | `releases/latest`; fetched `package.json`, `cores/esp32/esp32-hal-ledc.h`, `variants/adafruit_feather_esp32s3/pins_arduino.h`, `idf_component.yml` at tag `3.3.11` |

Board: **Adafruit Feather ESP32-S3 2MB PSRAM** (product ADA5477).

## API calls checked against the headers, not guessed

| Call in this firmware | Where it is declared |
|---|---|
| `Adafruit_SHT4x::begin(TwoWire*)`, `setPrecision(sht4x_precision_t)`, `setHeater(sht4x_heater_t)`, `getEvent(sensors_event_t*, sensors_event_t*)` | `Adafruit_SHT4x.h` @1.0.5 lines 116–125 |
| `SHT4X_MED_PRECISION`, `SHT4X_NO_HEATER` | same header, lines 53–66 |
| `Adafruit_VEML7700::begin(TwoWire*)`, `setGain(uint8_t)`, `setIntegrationTime(uint8_t, bool)`, `enable(bool)`, `readLux(luxMethod)` | `Adafruit_VEML7700.h` @2.1.6 lines 86–114 |
| `VEML7700_GAIN_1`, `VEML7700_IT_100MS`, `VEML_LUX_CORRECTED_NOWAIT` | same header, lines 38–48, 72–76 |
| `Adafruit_STHS34PF80::begin(uint8_t, TwoWire*)`, `setBlockDataUpdate`, `setObjAveraging`, `setOutputDataRate`, `setIntPolarity(bool active_low)`, `setIntOpenDrain`, `setIntLatched`, `setIntMask`, `setIntSignal`, `readPresence()` | `Adafruit_STHS34PF80.h` @1.0.2, class declaration |
| `STHS34PF80_ODR_1_HZ`, `STHS34PF80_AVG_TMOS_128`, `STHS34PF80_PRES_FLAG`, `STHS34PF80_INT_OR` | same header |
| `Adafruit_MAX17048::begin(TwoWire*)`, `cellPercent()`, `chargeRate()` | `Adafruit_MAX1704X.h` @1.0.3 lines 60–71 |
| `Adafruit_GC9A01A(cs, dc, rst)`, `begin(uint32_t freq = 0)`, `setRotation` | `Adafruit_GC9A01A.h` @1.1.1 lines 104–120 |
| `GC9A01A_SLPIN` = 0x10, `GC9A01A_DISPOFF` = 0x28 | same header, lines 36 and 42 |
| `Adafruit_SPITFT::sendCommand(uint8_t, const uint8_t* = NULL, uint8_t = 0)` — **public** | `Adafruit_SPITFT.h` @1.12.6 line 215 (`public:` at line 133, `protected:` not until line 378) |
| Default SPI clock 40 MHz on ESP32 | `Adafruit_GC9A01A.cpp` @1.1.1, `#define SPI_DEFAULT_FREQ 40000000` under `#elif defined(ESP8266) || defined(ESP32)` |
| `Adafruit_NeoPixel(n, pin, NEO_GRB + NEO_KHZ800)`, `begin`, `setPixelColor(n,r,g,b)`, `setBrightness`, `clear`, `show` | `Adafruit_NeoPixel.h` @1.15.5 lines 88, 131, 223–236 |
| `ledcAttach(pin, freq, resolution)`, `ledcWrite(pin, duty)` | `cores/esp32/esp32-hal-ledc.h` @3.3.11 lines 89 and 111 (the 3.x pin-based API; the 2.x `ledcSetup`/`ledcAttachPin` pair no longer exists) |
| `esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_LOW)`, `esp_sleep_enable_timer_wakeup(us)` | esp-idf `esp_sleep.h`; arduino-esp32 3.3.11's `idf_component.yml` pins `idf: ">=5.3,<6.2"` |
| `WiFi.mode(WIFI_STA)`, `WiFi.setSleep(bool)` | `libraries/WiFi/src/WiFiGeneric.h` @3.3.11 lines 106 and 112 (`WiFiGenericClass::mode`, `setSleep`) |
| `WiFi.begin(const char* ssid, const char* pass)`, `WiFi.status()`, `WiFi.disconnect(bool)` | `libraries/WiFi/src/WiFiSTA.h` @3.3.11 lines 147, 182, 166 |
| `WIFI_STA`, `WIFI_OFF`, `WL_CONNECTED` | `libraries/WiFi/src/WiFiType.h` @3.3.11 lines 35, 34, 49 |
| `WebServer(int port)`, `begin()`, `handleClient()`, `stop()`, `on(uri, HTTPMethod, fn)`, `arg(const String&)`, `send(int, const char*, const String&)` | `libraries/WebServer/src/WebServer.h` @3.3.11 lines 105, 108, 110, 113, 154, 187, 215 |
| `HTTP_POST` | `libraries/WebServer/src/HTTP_Method.h` @3.3.11: `typedef enum http_method HTTPMethod`, i.e. the http_parser enum |
| A POST body with a non-form content type lands in `arg("plain")` | `libraries/WebServer/src/Parsing.cpp` @3.3.11 lines 227–230 (`arg.key = F("plain")`) |

## JSON on the device: no library

`POST /claude` carries five flat numbers. `companion.ino` pulls them out with
`String::indexOf` + `strtod` (`jsonNum`, ~12 lines) rather than adding a parser.
**ArduinoJson 7.4.3** (released 2026-03-02, read from
`GET /repos/bblanchon/ArduinoJson/releases/latest` via the GitHub API on
2026-09-16) is the upgrade path if the payload ever grows nesting, arrays or
string values — it is *not* a dependency of this firmware today.

The parser was exercised on the host against the real payload
`tools/claude_usage_push.py --dry-run` emits, plus a truncated and a non-JSON
body: the two valid ones parse, the two bad ones are rejected (HTTP 400).

## Wi-Fi is off by default

`CLAUDE_WIFI_ENABLED` is `0`, and everything above is inside `#if
CLAUDE_WIFI_ENABLED`, so by default the radio is never initialised and the
power table is unchanged. See the estimate in `companion.ino`: the ESP32-S3
datasheet's 88 mA Wi-Fi RX figure is a peak, and the modem-sleep average for an
associated idle station is **unverified** here.

## Two facts that shaped the design, both read from source

1. **ESP32-S3 has no per-pin ext1 wake level.** `SOC_PM_SUPPORT_EXT1_WAKEUP_MODE_PER_PIN`
   is not defined in `components/soc/esp32s3/include/soc/soc_caps.h` (only
   `SOC_PM_SUPPORT_EXT1_WAKEUP` is). All ext1 pins therefore share one trigger
   level. `ENC_SW` idles HIGH on its pull-up, so the group cannot be ANY_HIGH.
   The STHS34PF80 INT is configured active-low open-drain instead and the group
   wakes on **ANY_LOW** — see `power.cpp`.
2. **Every GPIO in `config.h` is the variant's own number**, taken from
   `variants/adafruit_feather_esp32s3/pins_arduino.h` at tag 3.3.11:
   `SDA 3, SCL 4, I2C_POWER 7, MOSI 35, SCK 36, MISO 37, PIN_NEOPIXEL 33,
   NEOPIXEL_POWER 21`.

## Not verified

* **`PRESENCE_ON_THRESH` / `PRESENCE_OFF_THRESH`** — I did not open the ST
  STHS34PF80 datasheet, so the raw TPRESENCE counts in `config.h` are bench
  knobs, not datasheet values. Print `sths.readPresence()` with a person at
  0.8 m and set them from what you see.
* **The GC9A01A post-SLPIN delay** in `power.cpp` is a conventional 10 ms; the
  exact minimum is in the panel datasheet, which I did not open.
* **The Wi-Fi power cost when `CLAUDE_WIFI_ENABLED` is 1.** The ESP32-S3
  88 mA Wi-Fi RX figure is quoted second-hand — I did **not** open the ESP32-S3
  datasheet to confirm it. And even taken at face value it is a peak, not the
  average of an associated station in modem sleep, which is what this code
  actually does; that average I neither found nor measured. Both numbers are
  holes, not estimates.
* **Nothing in this directory has been compiled by `arduino-cli`** — no ESP32
  toolchain or library set is installed here. What *has* been compiled and run
  on this machine with `c++ -std=c++17` is the hardware-free part:
  `state_machine.cpp` (against `test_state_machine.cpp`) and `ui.cpp` (against a
  trace-only `Adafruit_GFX` stub). `power.cpp` and `companion.ino` are unbuilt.
