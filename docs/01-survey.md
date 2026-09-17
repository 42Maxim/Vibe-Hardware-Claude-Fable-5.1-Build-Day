# 01 · Parts survey — what is really available, and what shape it comes in

Every number below was read from the linked supplier page or datasheet on 2026-09-16.
"unverified" = I could not open a source that states it; treat as a hole, not a fact.
Prices are the supplier's list price in USD on the day (AU/US/global pricing is in the BOM).

## MCU boards (all ESP32-S3, all have USB-C, LiPo charger, deep sleep)

| Board | Footprint (mm) | Sleep current | Notable | Price | Source |
|---|---|---|---|---|---|
| Adafruit ESP32-S3 Feather 4MB/2MB PSRAM (#5477) | 52.3 × 22.7 × 7.2, 6.3 g | ~100 µA deep sleep (from LiPo) | STEMMA QT with switchable power, MAX17048 fuel gauge, JST-PH LiPo 0.425" from left edge, USB-C centre-left | $17.50 | [adafruit.com/product/5477](https://www.adafruit.com/product/5477), [Feather spec 0.9" × 2.0"](https://learn.adafruit.com/adafruit-feather/feather-specification) |
| Adafruit ESP32-S3 Reverse TFT Feather (#5691) | Feather outline 0.9" × 2.0" = 22.9 × 50.8 (height unverified) | 40–50 µA deep sleep | 1.14" 240×135 ST7789 IPS on the back face, 3 tactile buttons, STEMMA QT, MAX17048 | $24.95 | [adafruit.com/product/5691](https://www.adafruit.com/product/5691) |
| Seeed XIAO ESP32-S3 | 21 × 17.8 | 14 µA deep sleep | Charge 50 mA fast / 3.8 mA trickle, 11 GPIO, battery pads on the underside (position unverified), no fuel gauge, no QT connector | $7.49 | [seeedstudio.com](https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html), [wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |

ESP32-S3 chip currents (Espressif datasheet v2.2, Table 5-9 / 5-10, 3.3 V, 25 °C):
modem-sleep 80 MHz WAITI 22.0 mA · 80 MHz dual core 32-bit 33.1 mA · 240 MHz WAITI 32.9 mA · 240 MHz dual core 66.2 mA · light-sleep 240 µA · deep-sleep RTC mem 8 µA · Wi-Fi TX peak 283–340 mA · Wi-Fi RX 88 mA · BLE RX 93 mA.
Source: [esp32-s3_datasheet_en.pdf](https://documentation.espressif.com/esp32-s3_datasheet_en.pdf) pp. 66–68.

## Displays

| Display | Module (mm) | Active area | Res / driver | Power | Price | Source |
|---|---|---|---|---|---|---|
| Adafruit 1.28" round TFT + microSD (#6178) | 42.4 × 36.2 × 5.4, glass 38.1 × 35.6, 2 holes 22.8 apart | Ø32.5 (1.28" diag) | 240×240 GC9A01A, 220 ppi, IPS | backlight unverified (Waveshare twin below: 31.2 mA whole module) | $17.50 | [adafruit.com/product/6178](https://www.adafruit.com/product/6178) |
| Waveshare 1.28" LCD Module (GC9A01) | 40.4 × 37.5, round body Ø37.5 | Ø32.4, 0.135 mm pixel | 240×240 GC9A01, IPS, SPI | 31.2 mA @ 3.3 V (module, backlight on) | see BOM | [waveshare wiki](https://www.waveshare.com/wiki/1.28inch_LCD_Module) |
| Adafruit 1.3" square TFT + microSD (#4313) | 35.8 × 35.8 × 5.3, 4 holes 33 × 30 | 26 × 26 | 240×240 ST7789, 260 ppi, IPS | backlight unverified | $16.95 | [adafruit.com/product/4313](https://www.adafruit.com/product/4313) |
| Adafruit 1.69" round-rect TFT (#5206) | 45.8 × 36.8 × 5.4 | 38 × 30 | 280×240 ST7789, IPS | backlight unverified | $17.50 | [adafruit.com/product/5206](https://www.adafruit.com/product/5206) |
| Adafruit SHARP Memory 1.3" (#3502) | 40 × 39 × 4.6, 4 holes | 24.5 × 21 | 168×144 mono, SPI write-only | 4 µA @ 1 Hz refresh, no backlight | $24.95 | [adafruit.com/product/3502](https://www.adafruit.com/product/3502) |
| Reverse TFT Feather built-in | on the MCU board | 1.14" | 240×135 ST7789 | unverified | incl. | above |

Shape lesson: the round 1.28" panels are the only ones whose *glass* is round; every other panel is a rectangle with a rectangular FPC tail, so a round face needs a bezel that hides corners.

## Ambient LED rings (WS2812B / SK6812 5050, Adafruit NeoPixel)

| Ring | OD / ID (mm) | Thickness | LEDs | Price | Source |
|---|---|---|---|---|---|
| NeoPixel Ring 12 (#1643) | 36.8 / 23.3 | 6.7 | 12 | $8.95 | [adafruit.com/product/1643](https://www.adafruit.com/product/1643) |
| NeoPixel Ring 16 (#1463) | 44.5 / 31.7 | 6.7 | 16 | $9.95 | [adafruit.com/product/1463](https://www.adafruit.com/product/1463) |
| NeoPixel Ring 24 (#1586) | 65.5 / 52.3 | 3.2 | 24 | $16.95 | [adafruit.com/product/1586](https://www.adafruit.com/product/1586) |

LED current: ~18 mA per colour channel constant-current (Adafruit), 60 mA/pixel full white ([Überguide](https://learn.adafruit.com/adafruit-neopixel-uberguide/powering-neopixels)); measured "just under 1 mA per LED when just sitting there dark" ([PJRC measurement](https://www.pjrc.com/how-much-current-do-ws2812-neopixel-leds-really-use/)) — the dark current is the number that matters for battery life, so the ring must be power-switched.
Package 5.0 × 5.0 mm, VDD absolute range 3.5–5.3 V ([WS2812B datasheet](https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf)) — on a 3.7 V cell they run at cell voltage, which works in practice and is marginal on the datasheet.

The ring geometry is the design driver: the 16-ring's 31.7 mm ID is *smaller* than the 1.28" panel's Ø32.5 active area, so the ring cannot sit around the round display in the same plane. The 24-ring's 52.3 mm ID clears the whole 42.4 × 36.2 display module with 5 mm to spare. The 12-ring's 23.3 mm ID fits nothing but a knob.

## Batteries (Adafruit LiPo, 2-pin JST-PH, protected)

| Cell | L × W × T (mm) | Weight | Price | Source |
|---|---|---|---|---|
| 350 mAh (#2750) | 36 × 19.6 × 5.2 | 8.2 g | $6.95 | [adafruit.com/product/2750](https://www.adafruit.com/product/2750) |
| 500 mAh (#1578) | 36 × 29 × 4.75 | 10.5 g | $7.95 | [adafruit.com/product/1578](https://www.adafruit.com/product/1578) |
| 1200 mAh (#258) | 62 × 34 × 5 | 23 g | $9.95 | [adafruit.com/product/258](https://www.adafruit.com/product/258) |
| 2000 mAh (#2011) | 60 × 36 × 7 | 34 g | $12.50 | [adafruit.com/product/2011](https://www.adafruit.com/product/2011) |

All are 5–7 mm thick slabs; the 1200 mAh at 62 mm long is longer than a Feather (50.8 mm).

## Presence sensing

| Sensor | Field of view | Range | Interface / address | Current | Size | Price | Source |
|---|---|---|---|---|---|---|---|
| STHS34PF80 IR presence (Adafruit #6426) | 80° | up to 4 m, no lens needed | I2C **0x5A**, INT pin | 10 µA @ 1 Hz ODR, 1.5 µA power-down | 25.5 × 17.6 × 4.7 | $14.95 | [product](https://www.adafruit.com/product/6426), [pinouts](https://learn.adafruit.com/adafruit-sths34pf80-ir-presence-motion-sensor/pinouts), [SparkFun hookup guide (current)](https://docs.sparkfun.com/SparkFun_Qwiic_Human_Presence_Sensor-STHS34PF80/hardware_overview/) |
| Mini PIR (Adafruit #4871) | 100° | 2–5 m | digital out, 2 s hold | unverified | lens Ø13.8 | $3.95 | [product](https://www.adafruit.com/product/4871) |
| Hi-Link LD2410C 24 GHz mmWave | ±60° | 5 m, 0.75 m resolution | UART + GPIO, **5–12 V supply** | unverified | unverified (vendor: "16 × 22 mm" class) | see BOM | [hlktech](https://www.hlktech.net/index.php?id=1095) |

The STHS34PF80 needs no Fresnel lens and no window cut-out beyond an IR-transparent aperture, which is why it wins for a clean face. The PIR needs a 13.8 mm dome; the mmWave needs 5 V.

## Environment and light

| Sensor | Address | Current | Size | Price | Source |
|---|---|---|---|---|---|
| SHT41 temp/RH (Adafruit #5776) | 0x44 | 80 nA idle, 0.4 µA @ 1 Hz | 25.5 × 17.6 × 4.8 | $5.95 | [product](https://www.adafruit.com/product/5776) |
| AHT20 temp/RH (Adafruit #4566) | 0x38 | unverified | unverified | $4.50 | [product](https://www.adafruit.com/product/4566) |
| VEML7700 lux (Adafruit #4162) | **0x10 fixed** | 2–45 µA operating (PSM), 0.5 µA shutdown; 0–140 klx | PCB unverified (STEMMA QT class) | $4.95 | [product](https://www.adafruit.com/product/4162), [Vishay datasheet](https://www.vishay.com/docs/84286/veml7700.pdf) p.2, p.6 |
| BME280 on Feather variant | 0x77 | — | on-board | — | not surveyed |

## Physical control

| Part | Key dimensions | Interface | Price | Source |
|---|---|---|---|---|
| Bourns PEC11R 12 mm encoder | body 12.5 × 13.4, bushing M7 × 0.75 (7 mm behind panel with switch), shaft L = 15/20/25/30 mm, threaded LB = 5 (15 mm) or 7 mm, D-flat F = 7/10/12 mm; 12/18/24 detents; push switch 0.5 mm travel | quadrature A/B/C + switch | see BOM | [PEC11R datasheet](https://www.bourns.com/docs/product-datasheets/pec11r.pdf) |
| Adafruit I2C QT Rotary Encoder breakout + NeoPixel (#4991) | 25.6 × 25.3 × 4.6, takes PEC11-pinout encoder | I2C 0x36 (–0x3D via jumpers) | $5.95 | [product](https://www.adafruit.com/product/4991) |
| Adafruit ANO nav encoder (#5001) + QT adapter (#5740) | adapter 40.7 × 35.8 × 4.8; knob diameter unverified | I2C seesaw, 16 addresses | $8.95 + $4.95 | [5001](https://www.adafruit.com/product/5001), [5740](https://www.adafruit.com/product/5740) |
| DRV2605L haptic driver (Adafruit #2305) | 25.8 × 17.8 × 4.6 | I2C **0x5A — collides with STHS34PF80** | $7.95 | [product](https://www.adafruit.com/product/2305), [pinouts](https://learn.adafruit.com/adafruit-drv2605-haptic-controller-breakout/pinouts) |

Encoder lesson: with a 15 mm shaft only 5 mm is threaded, so the panel it passes through can be at most ~3.5 mm thick after the washer and nut. A 20 mm shaft has 7 mm of thread and leaves 13 mm for a knob.

## Constraints these dimensions impose (carried into the concepts)

1. A round display + LED ring in one plane forces the 24-pixel ring (65.5 mm OD). The 16-ring only works stacked *under* a smaller display or around the knob.
2. Every board is a STEMMA QT rectangle of about 25.5 × 17.6 mm; four of them plus a Feather need ~1200 mm² of floor, or two stacked layers.
3. Cells are 5 mm slabs; 500 mAh (36 × 29) fits beside a Feather in a 60 mm footprint, 1200 mAh (62 × 34) does not without going under.
4. STHS34PF80 and DRV2605L both sit at 0x5A: pick one, or give the haptic its own bus.
5. Ring dark current ≈ 1 mA/LED means a 24-ring idles at ~24 mA — more than the rest of the device combined. It must be on a switched rail (the Feather's STEMMA QT power switch is 3.3 V only; the ring wants VBAT so it needs its own high-side switch).
