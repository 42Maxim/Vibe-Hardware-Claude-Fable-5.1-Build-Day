# 03 · BOM — Puck

Prices read on 2026-09-16 from the linked pages. AU = AUD inc GST, US = USD, Global = USD from the cheapest genuine listing I could open (AliExpress/Amazon pages could not be opened from here; those lines are marked **unverified** and priced from the listing title only).
Electrical data for every part lives in `parts/parts.json` — the page's pin and power tables are computed from that file.

## Balanced (recommended) — what I'd order tonight

| # | Part | Why this over the obvious alternative | AU | US | Global |
|---|---|---|---|---|---|
| 1 | **Adafruit ESP32-S3 Feather 4MB/2MB PSRAM** (ADA5477) | Only board surveyed with LiPo charger + fuel gauge + *switchable* STEMMA QT rail in one; the switch is what lets the ring and sensors be cut in sleep. XIAO is cheaper but has no gauge, no QT rail switch and needs its own charger wiring. | [$32.60 Core](https://core-electronics.com.au/adafruit-esp32-s3-feather-with-4mb-flash-2mb-psram-stemma-qt-qwiic.html) | [$17.50](https://www.adafruit.com/product/5477) | same |
| 2 | **Adafruit 1.28" round 240×240 GC9A01A + EYESPI** (ADA6178) | Round glass, 2 mounting holes 22.8 mm apart, 3.3 V regulator on board. Waveshare twin is cheaper but its round body (Ø37.5) has no mounting holes. | [$32.55 Core](https://core-electronics.com.au/adafruit-1-28-inch-round-tft-lcd-display-microsd-eyespi-gc9a01a.html) | [$17.50](https://www.adafruit.com/product/6178) | [Waveshare 1.28" LCD Module](https://www.waveshare.com/1.28inch-lcd-module.htm) — €15.90 at [welectron](https://www.welectron.com/Waveshare-19192-128inch-LCD-Module_1), waveshare.com price **unverified** |
| 3 | **NeoPixel Ring 24** (ADA1586) | The only ring whose 52.3 mm ID clears the display module. Genuine Adafruit = known LED type and 3.2 mm thickness; clones vary in thickness and LED (SK6812 vs WS2812B), which changes the lid recess. | [$33.90 Core](https://core-electronics.com.au/neopixel-ring-24-x-ws2812-5050-rgb-led-with-integrated-drivers.html) | [$16.95](https://www.adafruit.com/product/1586) | [AliExpress 24-LED WS2812B ring ~US$1.96](https://www.aliexpress.com/item/32808302785.html) **unverified** (thickness not stated) |
| 4 | **Adafruit STHS34PF80 IR presence** (ADA6426) | Lens-free, 80° cone, 10 µA, has an INT pin to wake the MCU. PIR needs a 13.8 mm dome and holds for only 2 s; mmWave needs 5 V. Core only lists the SparkFun version (out of stock), so AU is Little Bird. | [$29.05 Little Bird](https://littlebirdelectronics.com.au/products/adafruit-sths34pf80-ir-presence-motion-sensor-ada6426) | [$14.95](https://www.adafruit.com/product/6426) | same (no known clone) |
| 5 | **Adafruit SHT41** (ADA5776) | ±0.2 °C / ±1.8 %RH, 0.4 µA. AHT20 is $1.45 cheaper and ±0.3 °C / ±2 %RH — not worth the accuracy loss on a device whose one job is telling you the room. | [$10.50 Core](https://core-electronics.com.au/adafruit-sensirion-sht41-temperature-humidity-sensor-stemma-qt-qwiic.html) | [$5.95](https://www.adafruit.com/product/5776) | same |
| 6 | **Adafruit VEML7700** (ADA4162) | 0–140 klx with 0.0042 lx resolution, so it reads a dark room without saturating in sun; BH1750 tops out at 65 klx and has no power-save modes. | [$9.10 Core](https://core-electronics.com.au/adafruit-veml7700-lux-sensor-i2c-light-sensor.html) | [$4.95](https://www.adafruit.com/product/4162) | same |
| 7 | **Cell**: AU → Core CE04375 400 mAh 38 × 25 × 6 mm; US → Adafruit 500 mAh 36 × 29 × 4.75 mm (ADA1578) | The 500 mAh is retired at Core and out of stock at Little Bird, so the cell bay is cut 40 × 30 × 6.5 to take either. 1200 mAh does not fit the disc without a third layer. | [$5.55 Core](https://core-electronics.com.au/polymer-lithium-ion-battery-400mah-38456.html) | [$7.95](https://www.adafruit.com/product/1578) | same |
| 8 | **Bourns PEC11R-4220F-S0024** (20 mm D-shaft, switch, 24 detents) | Adafruit #377 is the same family but its shaft length is unstated; the crown needs the 20 mm shaft's 7 mm thread to pass a 3 mm wall with washer and nut. | [$3.92 DigiKey AU](https://www.digikey.com.au/en/products/detail/bourns-inc/PEC11R-4220F-S0024/4499660) | [$2.69 DigiKey](https://www.digikey.com/en/products/detail/bourns-inc/PEC11R-4220F-S0024/4499660) | same |
| 9 | STEMMA QT cables 50 mm × 3 (ADA4399) | Sensors chain without soldering. | ~$1.90 ea Core **unverified** | $0.95 ea **unverified** | same |
| 10 | M2 × 6 screws × 6, M2 heat-set inserts × 6, 22 AWG silicone wire | Hardware; any supplier. | ~$8 | ~$6 | ~$3 |
| | **Total** | | **≈ AU$171** (1–8 verified: $157.17; 9–10 estimated) | **≈ US$95** (1–8: $88.44) | **≈ US$70** (XIAO/Waveshare/AliExpress substitutions, mostly unverified) |

## Lean

Swap 1 → **Seeed XIAO ESP32-S3** ([$7.49](https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html); no fuel gauge, ring rail needs an external switch), 2 → Waveshare 1.28" (€15.90), 3 → AliExpress ring (unverified), 4 → **Mini PIR** ([$3.95](https://www.adafruit.com/product/4871), needs a Ø14 dome in the lid, 2 s hold), 5 → AHT20 ([$4.50](https://www.adafruit.com/product/4566)), 6 → keep VEML7700, 8 → Adafruit #377 ([$4.50](https://www.adafruit.com/product/377), knob included).
**Total ≈ US$50.** Trade-off: no battery gauge on screen, a PIR dome breaks the flat lid, and the XIAO's 11 GPIO leave zero spare pins.

## No-limit

Balanced plus: Feather → same (nothing better exists in this footprint with a gauge); ring → **NeoPixel Ring 24 RGBW natural white** ([ADA2862, Core](https://core-electronics.com.au/neopixel-ring-24-x-5050-rgbw-leds-w-integrated-drivers-natural-white-4500k.html), price unverified) for a true white halo; crown → machined aluminium knob (Adafruit #5093-class, unverified); add **DRV2605L haptic** ([$7.95](https://www.adafruit.com/product/2305)) + LRA — **but it shares 0x5A with the STHS34PF80**, so it only works if the presence sensor moves to the SparkFun mini board's SPI mode ([Core, out of stock](https://core-electronics.com.au/sparkfun-mini-human-presence-and-motion-sensor-sths34pf80-qwiic.html)); add a proper high-side load switch for the ring instead of the QT rail. Frosted ring in cast resin instead of printed PETG.
**Total ≈ US$130 / AU$230.** Trade-off: the haptic forces a second presence board and SPI wiring; the RGBW ring changes the LED library call.

## Worth the money / waste

- **Worth it:** the STHS34PF80 (a flat lid with no dome is the whole look), the Feather (fuel gauge + switched rail are what make the power table pass), the Bourns encoder with a known shaft length (the crown geometry depends on it).
- **Waste:** the microSD slots on the Adafruit display (never used, adds 5 mm to the module), the RGBW ring (you see it for 1.5 s), haptics (address collision for a buzz).
