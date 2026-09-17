# 04 · Design — Puck

Concept A, locked. Every dimension below comes from `parts/parts.json`, `docs/01-survey.md`,
`docs/03-bom.md` or the locked mechanical layout. Anything I could not derive from those is
written **unverified** rather than filled in. Coordinates: origin at the centre of the base
underside, z up, **−y front** (user), **+y rear** (USB), **+x right** (crown).

Geometry is the post-fit-check layout (cavity Ø72, outer Ø78). Two open items are marked **C1**
and **C2** in §2.4 — each names the problem and the minimum change that clears it.

---

## 1 · Aesthetic direction

A matte black disc the size of a coaster that sits still and says one thing. The top is two
surfaces: a flat rim and a shallow dish sunk 3 mm into it, with the round glass dead centre and
a frosted band of white light around the outside edge — a halo that is either off or holding one
steady colour. The only thing that moves is the crown on the right: a 16 mm knurled cylinder at
finger height, one click per detent, the kind of control you turn without looking down. Material
feel is matte PETG against frost against glass; no gloss, no chrome, no logo, no seam you can see
from a seated eye line. Personality: it notices you and then leaves you alone. It must never blink,
never breathe, never idle-animate, never show a menu, never ask for anything. If you are not
there, it is black and silent, and that is the state it should be in most of the day.

---

## 2 · Mechanical design

### 2.1 Overall

| Dimension | Value | Source |
|---|---|---|
| Outer diameter | Ø78 | layout |
| Cavity diameter | Ø72 (r 36) | layout |
| Total height (feet excluded) | 30 | layout |
| Wall thickness | 3 | layout |
| Floor thickness | 2 (cavity z 2…25) | layout |
| Lid | z 25…30; lip drops into a 1.4 wide × 1.5 deep rebate in the wall top, 0.3 clearance | layout |
| Lid fixing | 3 × M2 at **75° / 195° / 315°** from +x, CCW from above, bolt circle r 36.5; bosses Ø5 with Ø1.6 pilots; lid has M2 clearance holes with 1.5 deep head recesses | layout |
| Lid top rim | annulus r 25.5…39 at z 30 (outer radius follows the new Ø78 — derived) | derived |
| Lid centre dish | r < 22.5, surface at z 27, 45° transition to the rim, 2 thick | layout |
| Display window | Ø34 through the dish | layout |
| Ring pocket | cut from below, z 24…28.4, r 25.45…33.45 | layout |
| Frosted window | annulus r 28.5…32.5, z 28.4…30 | layout |
| IR window (presence) | Ø6 in the front wall at z 14.8 | layout |
| Light window (lux) | Ø3 through the wall at 45° (right-rear), z 14.8 | layout |
| Breathing holes | 4 × Ø2 through the floor under the SHT41, at ±4 from its centre | layout |
| Crown bushing hole | Ø7.2 at y +4, z 12; Ø18 × 1.5 knob dimple outside → 3.1 panel | layout |
| USB-C slot | 12 × 7 through the rear wall, centred z 12 — sized for the plug overmould (overmould size unverified) | layout |
| Feet | 3 × Ø8 silicone bumpers; **foot radius unverified** — keep them clear of the breathing holes | layout |

### 2.2 z-stack on the centreline

| z (mm) | What | Thickness |
|---|---|---|
| 0…2 | floor | 2 |
| 2…8 | LiPo cell (AU 400 mAh, 6 thick; US 500 mAh is 4.75 → 2…6.75) | 6 |
| 8…9 | air over the cell | 1.0 |
| 9…16.2 | ESP32-S3 Feather on 4 posts | 7.2 |
| 16.2…19.2 | wiring plenum | 3.0 |
| 19.2…24.6 | display module (glass top 2.4 below the dish surface at z 27) | 5.4 |
| 24.6…25.0 | gap to the dish underside — 0.4 standoff bosses | 0.4 |
| 25.0…30.0 | lid: ring 25.2…28.4, frost 28.4…30.0, pocket void 24…28.4 at r 25.45…33.45 | 5.0 |

Sum = 30.0. Ring top and frost underside now meet at 28.4 — the earlier 0.3 mm interference between
them is gone, and the LEDs bear straight on the diffuser, which is what you want optically.

### 2.3 Part-by-part mounting

| Part | Size (mm) | Placed at | How it is held |
|---|---|---|---|
| NeoPixel Ring 24 | OD 65.5 / ID 52.3 / 3.2 | lid pocket, z 25.2…28.4, LEDs up against the frost; 0.7 radial clearance each side (pocket r 25.45…33.45 vs ring r 26.15…32.75), 1.2 of pocket below the ring for leads and solder | 3 hot-glue dabs or 2 × M2 nylon screws into lid bosses (fixing method chosen, not in the layout) |
| Frosted window | r 28.5…32.5, 1.6 thick | lid top, z 28.4…30 | printed separately in natural PETG, bonded into the rebate |
| Display module | 42.4 × 36.2 × 5.4 | centred (0, 0), z 19.2…24.6 | 2 × M2 countersunk through the dish into the module's 2 holes, 22.8 apart, onto 0.4 standoff bosses; **hole positions on the PCB unverified** (parts.json) |
| Feather | 52.3 × 22.7 × 7.2 | centre (0, +1.5), long axis front-to-back (y −24.65…+27.65), PCB bottom z 9.0 | 4 posts Ø4 × 7 (M2 self-tap, Ø1.6 pilot — pilot chosen) at (±8.8, −22.1) and (±8.8, +25.1); pattern 17.6 × 47.2, consistent with a 2.5 edge inset, but the Feather's **hole inset is unverified** in the survey |
| LiPo cell | 38 × 25 × 6 (AU) / 36 × 29 × 4.75 (US) | floor, under the Feather, x ±12.5, y −17.5…+20.5, z 2…8 | 40 × 30 × 6.5 bay per BOM line 7, foam pad + one cable tie |
| STHS34PF80 | 25.5 × 17.6 × 4.7 | vertical on the front wall, y −31.5…−26.8, x ±12.75, z 6…23.6, element facing −y | 2 × M2 into ribs off the front wall; the wall is 4.5 off the board back at the centreline, so the ribs carry it |
| VEML7700 | 25.5 × 17.6 × 4.6 (parts.json, **PCB size unverified**) | **vertical** against the wall at 45° (right-rear): inner face r 28.5, outer r 33.1, 25.5 tangential, z 6…23.6, sensor facing out through the Ø3 window at z 14.8 | 2 × M2 into ribs off a flat pad at 45°; 2.9 of air behind the board at its centre |
| SHT41 | 25.5 × 17.6 × 4.8 | **flat on the floor**, left crescent, centred (−22, −2), 25.5 along y, z 2…6.8 | 2 × M2 posts off the floor, over the 4 breathing holes |
| Encoder PEC11R-4220F-S0024 | body 12.5 × 13.4 × 10.7, M7 × 0.75 bushing, 20 mm shaft, 7 mm thread | flat printed pad on the inside of the right wall, mounting face x 34.4; body x 23.7…34.4, y −2.25…+10.25, z 5.3…18.7 | M7 washer + nut outside in the dimple; panel 3.1 thick leaves 3.9 of thread proud |
| Knob | Ø16 × 12, seated in the Ø18 × 1.5 dimple | on the D-flat | grub screw; **part not selected — unverified** (printed or machined) |

### 2.4 Clearances (computed from the layout)

Cavity wall is r 36, so what matters is a part's worst **corner radius**, not its width.

| Pair | Clearance | Note |
|---|---|---|
| Display corners (r 27.88) ↔ cavity wall r 36 | 8.13 | corners at (±21.2, ±18.1) |
| Display active Ø32.5 ↔ window Ø34 | 0.75 radial | glass 38.1 × 35.6 overlapped by 2.05 (x) / 0.80 (y) of bezel |
| Display glass top 24.6 ↔ dish surface z 27 | 2.4 sunk | the dish shades the glass |
| Display top 24.6 ↔ dish underside 25.0 | 0.4 | standoff bosses; the 2 screws pull the module up to them |
| Display top 24.6 ↔ ring underside 25.2 | 0.6 | the module's half-diagonal 27.88 exceeds the ring's 26.15 ID radius, so display and ring are **not** coplanar — 0.6 is all that separates them |
| Display bottom 19.2 ↔ Feather top 16.2 | 3.0 | wiring plenum |
| Feather rear corners (±11.35, +26.65) ↔ wall | 7.51 | wall at y 34.16 for x ±11.35 |
| Feather front corners ↔ wall | 8.51 | |
| Feather PCB bottom 9.0 ↔ cell top 8.0 | 1.0 | 2.25 on the thinner US cell |
| Cell ↔ front / rear posts | 2.6 each | y −17.5 vs post face −20.1; y +20.5 vs +23.1 |
| Cell edge x −12.5 ↔ SHT41 edge x −13.2 | 0.7 | closest pair on the floor |
| Feather rear edge 27.65 ↔ inner wall face 36.0 | 8.35 | USB-C plug reach — the plug overmould enters through the 12 × 7 slot, **see C1** |
| STHS34PF80 back (y −31.5) ↔ wall at x ±12.75 (y −33.67) | 2.17 | 4.5 at the centreline |
| STHS34PF80 rear face −26.8 ↔ Feather front −25.65 | 1.15 | |
| STHS34PF80 rear face −26.8 ↔ front posts (face −25.1) | 1.70 | |
| STHS34PF80 top 23.6 ↔ lid underside 25.0 / ring 25.2 | 1.40 / 1.60 | its top corners sit at r 29.7…34.0, i.e. under the pocket mouth |
| VEML7700 inner face (r 28.5 at 45°) ↔ nearest display corner | **0.71** | display corner projects to 27.79 on the 45° ray |
| VEML7700 outer corners (r 35.47) ↔ cavity wall r 36 | 0.53 | tightest wall clearance in the device |
| VEML7700 ↔ encoder body | 4.33 tangential | encoder's nearest corner sits at t −17.08 on the 45° frame; board spans ±12.75 |
| VEML7700 outer corner ↔ 75° lid boss (Ø5 at r 36.5) | 3.20 | 195° and 315° bosses clear everything by ≥ 4.4 |
| SHT41 corners (r 34.15 / 32.79) ↔ wall | 1.85 / 3.21 | |
| SHT41 top 6.8 ↔ Feather bottom 9.0 | 2.20 | no plan overlap anyway |
| Encoder body top 18.7 ↔ display bottom 19.2 | **0.50** | tightest vertical pair |
| Encoder body ↔ display in plan | 2.50 lateral | body starts at x 23.7, display ends at 21.2 |
| Encoder body rear x 23.7 ↔ Feather x 11.35 | 12.35 | |
| Encoder body bottom 5.3 ↔ floor top 2.0 | 3.30 | |
| Ring pocket outer r 33.45 ↔ lid boss inner edge r 34.0 | 0.55 | the bosses only just miss the pocket |
| Ring OD r 32.75 ↔ lid outer skin r 39 | 6.25 of lid material | |

**Fit verdict: pass on a 0.5 mm rule.** The three closest pairs are encoder-to-display 0.50 (z),
VEML-to-display-corner 0.71, and SHT41-to-cell 0.70 — which matches the geometry fit check.
Two things still need a decision:

- **C1 — USB-C reach.** The Feather sits 1.5 mm rearward (rear edge 8.35 mm from the inner wall
  face; any further and its rear corner breaks the 0.5 mm rule against the 45° VEML board). The slot is
  12 × 7 through the full 3 mm wall so the plug's overmould passes into the cavity and seats on the port;
  nothing lies in that path (posts at x ±8.8, slot ±6). A USB-C plug shell is nominally 6.5 mm long and overmoulds are
  **unverified** (I did not open a connector spec), so **test-fit your actual cable in a printed
  coupon before committing the body print**; if it still does not seat, fit a short USB-C extension pigtail inside.
- **C2 — encoder shaft length.** With the body face at x 34.4, the 7 mm thread ends at x 41.4 —
  3.9 proud of the dimple floor (37.5) for washer and nut, which is right. But the 20 mm shaft ends
  at x 54.4, about 3.9 mm past the outer face of a 12 mm knob, so **cut the shaft to 16 mm** and
  deburr. The knob also needs a counterbore over the nut: depth ≈ 4, diameter **unverified**
  (M7 × 0.75 nut across-flats not read from a datasheet).

### 2.5 Tolerances, print orientation, settings

| Item | Value |
|---|---|
| Pockets (ring, frost rebate, sensor bays, cell bay) | +0.2 on each dimension |
| Lid rebate | 1.4 × 1.5 with +0.3 clearance on the lip (as specified) |
| Bushing hole | Ø7.2 for an M7 × 0.75 bushing |
| M2 self-tap pilots | Ø1.6 (posts and lid bosses) |
| M2 clearance holes | Ø2.4, 1.5 deep head recesses in the lid |
| Body print | floor down, no supports; the USB slot, the Ø6 and Ø3 windows bridge; the Ø7.2 bushing hole prints horizontal and is reamed |
| Lid print | rim face down on the plate, dish and pockets up; no supports |
| Frost print | flat, natural/clear PETG, **0.4 mm layers** (the layer lines are the diffuser) |
| Layers / nozzle | 0.2 mm / 0.4 mm for body and lid |
| Walls / infill | 3 perimeters, 30 % gyroid (chosen) |
| Material / colour | body matte black or warm grey PETG; **all interior surfaces white PETG** for light bounce; frost natural PETG |
| PETG profile | 240 °C / 80 °C bed, 40 mm/s outer wall (chosen defaults) |

### 2.6 Light path and sensing path

- **Halo.** 24 LEDs on a 29.45 pitch radius fire up into a 1.6 mm frost band at r 28.5…32.5, in
  contact with the diffuser — so the band reads as one continuous ring, not 24 dots. White interior
  walls pick up the spill through the open pocket mouth and keep the dish evenly lit from below.
- **Display.** Ø34 window over a Ø32.5 active area: 0.75 mm of bezel all round hides the glass edge
  and the FPC corners, and the glass sitting 2.4 mm below the dish surface shades it from overhead
  office lighting.
- **Presence.** The STHS34PF80 looks out through a Ø6 hole at z 14.8 — about 20 mm above a desk, so
  the 80° cone covers a seated torso at 0.5–1.5 m. Cover with 0.3 mm IR-transparent film or leave
  open; do **not** fill it with PETG, which is opaque in the far IR.
- **Light.** The VEML7700 now looks out sideways through a Ø3 window at 45° (right-rear), z 14.8 —
  no longer under the frost, so it no longer reads its own halo. Two consequences: the aperture is
  small and the view is directional, so absolute lux is wrong by a fixed factor and depends on which
  way the puck faces. **Calibration item:** one scale factor measured against a reference meter, and
  a note in the manual that the crown faces right. Leave the window open or fit clear film — frost
  in front of it would put the halo back into the reading.
- **Air.** Four Ø2 holes through the floor under the SHT41 let room air reach the sensor, so
  humidity tracks the room instead of the sealed case. Temperature still carries the Feather's
  self-heating: measure the offset after 30 min in ATTENTION and put it in `TEMP_OFFSET_C` (or, if
  the firmware has no such constant, calibrate against a reference thermometer and record it).
  Keep the silicone feet clear of the four holes.

---

## 3 · Wiring

One I2C bus, one SPI bus, four GPIO for the crown and the presence interrupt. Pin numbers from
`parts/parts.json` (`pins_src`: arduino-esp32 3.3.11
`variants/adafruit_feather_esp32s3/pins_arduino.h`). Wire colours are my choice — pick any, but
keep this table taped to the bench.

| Feather pin (GPIO) | Colour | Goes to | Note |
|---|---|---|---|
| 3V | red | SHT41 VIN, VEML7700 VIN, STHS34PF80 VIN | **always-on** 3.3 V rail |
| GND | black | every module GND, encoder C (common) | star from the Feather's GND pad |
| SDA (3) | blue | STHS34PF80 SDA → QT chain | bus shared by all sensors + fuel gauge |
| SCL (4) | yellow | STHS34PF80 SCL → QT chain | |
| I2C_POWER (7) | orange | NeoPixel Ring 24 VCC (+5V pad) | switched 3.3 V rail, **ring only** |
| SCK (36) | white | display SCK | SPI |
| MOSI (35) | grey | display SI | SPI; display SO / MISO (37) not connected |
| D10 (10) | violet | display TCS | chip select |
| D9 (9) | brown | display D/C | |
| D6 (6) | pink | display RST | |
| D5 (5) | pale blue | display Lite | backlight PWM (LEDC) |
| 3V / GND | red / black | display Vin / GND | module has its own 3.3 V regulator |
| D11 (11) | green | ring DIN | first pixel |
| A0 (18) | green/white | encoder A | input pull-up, RTC-capable |
| A1 (17) | yellow/white | encoder B | input pull-up, RTC-capable |
| A2 (16) | orange/white | encoder switch | other side to GND; ext1 wake source |
| A3 (15) | brown/white | STHS34PF80 INT | ext1 wake source |
| BAT | — | **nothing** | the ring does not run from VBAT |
| GPIO33 / GPIO21 | — | on-board NeoPixel + its power | unused, power held LOW |

The display's microSD pins (SDCS, SO, CD) are left unconnected — eight conductors go to the
display, not ten.

**STEMMA QT chain.** Feather 3V / GND / SDA / SCL by soldered header wires to the STHS34PF80's
header, then QT cables STHS34PF80 → SHT41 → VEML7700. The Feather's own QT socket is **not** used
for sensors.

| Device | Address |
|---|---|
| VEML7700 | 0x10 (fixed) |
| MAX17048 fuel gauge (on board) | 0x36 (0x0B on an older LC709203F revision) |
| SHT41 | 0x44 |
| STHS34PF80 | 0x5A |

No collisions. Two near misses recorded in `parts.json`: the DRV2605L haptic is also 0x5A (not
fitted) and the I2C QT rotary encoder breakout defaults to 0x36 (not fitted — the crown is wired to
GPIO instead).

**Two electrical compromises, flagged.**

1. **The ring runs below its datasheet minimum.** WS2812B VDD range is 3.5–5.3 V
   (datasheet, via `01-survey.md`); the switched QT rail is 3.3 V. It works in practice — colour
   mixing at low duty is what suffers — and brightness is capped at 20 % by `LED_MAX_BRIGHTNESS` in
   `config.h`, which is also what keeps the ring's on-current at the 312 mA in `parts.json`. The
   clean fix is a VBAT high-side load switch (BOM, no-limit tier), which costs a part and a GPIO.
2. **312 mA through the Feather's QT power switch.** The switch's current rating is **unverified**;
   the 20 % cap is what keeps this plausible. Same fix as above. Do not raise the cap without
   moving the ring to its own switch.
3. **The switched rail must never feed the sensors.** It is cut in SLEEP; the STHS34PF80 is the
   wake source and has to stay alive (10 µA). Sensors on 3V, ring on I2C_POWER — that separation is
   the whole power budget.

---

## 4 · Assembly guide

Empty printed enclosure → finished device. Roughly 2 hours, most of it soldering.

1. **Clean the prints.** Ream the Ø7.2 bushing hole, the Ø6 IR window, the Ø3 light window and the
   four Ø2 breathing holes with a drill bit turned by hand. Check the lid lip in its 1.4 × 1.5
   rebate — with 0.3 clearance it should drop in with finger pressure. Deburr the USB slot and
   test-fit your actual USB-C cable (**C1** — do this before you print the final body).
2. **Bond the frost.** Press the frosted annulus into the lid's top rebate, flush with the rim.
   Cyanoacrylate at three points on the outer edge only — glue in the light path frosts unevenly.
3. **Prepare the ring.** Cut three 120 mm leads (26 AWG) for VCC, GND, DIN. Tin the ring's three
   pads on the *back* face and solder the leads flat so they exit at one point. **Risk 1** below.
4. **Fit the ring.** Ring into the lid pocket (z 25.2…28.4), LEDs facing up against the frost, lead
   exit at **135°** — the widest gap between the 75° and 195° bosses, and clear of the crown (0°),
   the lux window (45°) and the display bundle (90°). Retain with two nylon M2 screws or three
   hot-glue dabs. Route the three leads inboard through the 1.2 mm of pocket below the ring.
5. **Fit the display.** Solder eight leads (150 mm) to Vin, GND, SCK, SI, TCS, D/C, RST, Lite.
   Mount the module to the dish underside with 2 × M2 countersunk screws from the top; the glass
   should sit centred in the Ø34 window with an even bezel. **Risk 3** below.
6. **Install the encoder.** Cut the shaft to 16 mm with a razor saw first and deburr (**C2**), or
   the knob will not seat. From inside, body face flat on the printed pad at x 34.4, bushing out
   through Ø7.2; washer then nut outside, in the Ø18 dimple. **Risk 2** below.
7. **Wire the encoder.** A → A0, B → A1, C → GND, switch → A2 and GND. Leave 60 mm of slack.
8. **Fit the sensor boards.** STHS34PF80 vertical on its front-wall ribs, element centred on the Ø6
   window at z 14.8. VEML7700 vertical on its 45° pad, sensor centred on the Ø3 window at z 14.8 —
   check it is looking *out*, not at the ring. SHT41 flat on its floor posts at (−22, −2), sensor
   side up, not covering the four breathing holes. Solder four header wires (3V, GND, SDA, SCL) to
   the STHS34PF80, then chain STHS34PF80 → SHT41 → VEML7700 with 50 mm QT cables; the SHT41 sits
   between them physically as well as electrically, so the short cable goes left first.
9. **Fit the cell.** Foam pad in the bay, cell in, leads dressed to the rear. Do not plug in yet.
10. **Mount the Feather.** Four M2 self-tap screws into the posts, USB-C aligned with the rear slot.
    Check that the port centre lands inside the slot before tightening.
11. **Solder the harness.** Work through the §3 table one row at a time and tick each off. Ring VCC
    to I2C_POWER — not to BAT, not to 3V.
12. **Smoke test with the lid loose.** Plug in USB-C. `I2C scan` should return 0x10, 0x36, 0x44,
    0x5A. Flash the firmware (§5) and confirm the display lights and the halo comes up white at 20 %.
13. **Plug in the cell.** Confirm the fuel gauge reports a sane percentage, then unplug USB and
    confirm the device still runs.
14. **Close up.** Dress all wiring below z 19 so nothing sits between the display top and the dish,
    and nothing crosses the encoder body (only 0.5 mm above it). Lid on, three M2 screws at
    75° / 195° / 315°, snug only — heads sit in the 1.5 mm recesses. Press on the knob into the
    dimple, grub screw on the D-flat. Three silicone feet at 120°, clear of the breathing holes.

**The three steps most likely to go wrong.**

- **Risk 1 — soldering the ring after it is in the pocket.** You cannot: the pads face down into a
  pocket whose mouth is 0.6 mm above the display, and the iron will melt the frost it is pressed
  against. *How to not:* solder all three leads before the ring goes anywhere near the lid, keep
  every joint under 1.2 mm proud of the PCB back (that is the whole pocket depth under the ring —
  tin the pad, tin the wire, one touch), and check the ring lies flat in the pocket on a flat
  surface before you commit glue.
- **Risk 2 — over-torquing the encoder nut on a 3.1 mm printed panel.** PETG creeps; a
  hard-tightened M7 nut will craze the dimple within a week and the crown will wobble. *How to not:*
  a washer under the nut, tighten by hand plus one-eighth turn with pliers, and use a drop of
  removable thread-lock to hold it instead of torque. Support the inside of the wall with a finger
  while you tighten.
- **Risk 3 — the display bundle fouling the lid.** Eight wires leave a module that is screwed to the
  lid, so they twist every time the lid is lifted, and there is only 3.0 mm of plenum, 0.4 mm over
  the module and 0.6 mm between the module's corners and the ring. *How to not:* leave 150 mm and
  dress the bundle as a flat ribbon of two rows of four exiting to the rear at x ≈ 0, tied down at
  z 18; never route it into the ring pocket or outboard of r 25.45, and check nothing is pinched by
  lifting the lid 40 mm before the final screw-down.

---

## 5 · Quick start

### Flash

Arduino IDE 2.x. Boards Manager: **esp32 by Espressif Systems, 3.3.11**. Board:
**Adafruit Feather ESP32-S3 2MB PSRAM** (string verified in that release's `boards.txt`).
Libraries (Library Manager) — every version below was verified today against the upstream
GitHub release:

| Library | Version |
|---|---|
| Adafruit GFX Library | 1.12.6 |
| Adafruit GC9A01A | 1.1.1 |
| Adafruit NeoPixel | 1.15.5 |
| Adafruit SHT4x | 1.0.5 |
| Adafruit VEML7700 | 2.1.6 |
| Adafruit STHS34PF80 | 1.0.2 |
| Adafruit MAX1704X | 1.0.3 |
| Adafruit BusIO | 1.17.4 |

Plug in USB-C, pick the port, upload. If the port does not appear, or the sketch left the chip in
deep sleep: hold **BOOT**, tap **RESET**, release BOOT — that is the ROM bootloader (it is a native
USB serial port, no adapter). Set `LED_MAX_BRIGHTNESS` and the two calibration constants — lux
scale for the Ø3 side window, and `TEMP_OFFSET_C` for self-heating — in `config.h` before the
first real use; if the firmware has no such constants, record both offsets against a reference
meter and apply them by hand.

### Charge

USB-C from any charger. Charging is built into the Feather and starts whenever USB is present; the
board has a **charge LED** next to the USB connector (Adafruit product page 5477). The exact LED
pattern for "full" and for "no battery attached" is **unverified** — the product page names the LED
but does not specify its behaviour. **Charge current is unverified** (not stated on the product
page). On the 400 mAh AU cell, expect a charge measured in low single-digit hours; the on-screen
percentage comes from the MAX17048, not from a timer. The device stays usable while charging.

### Use

Turn it on by sitting down. The STHS34PF80 wakes the Feather on its INT line.

| State | Screen | Halo | Meaning |
|---|---|---|---|
| SLEEP | off | off | nobody there for the idle timeout; ~0.1 mA |
| PRESENT | backlight 40 % | off | you are at the desk, the glance state |
| NIGHT | backlight 10 % | off | present, but the room is dark |
| ATTENTION | backlight 100 % | on | something wants you — the halo colour is the message |
| WAKE | backlight 100 % | on | you touched the crown; full brightness while you interact |

**The crown.** Turn to move between pages, one detent per page, no acceleration, no wrap-around
animation. Press to acknowledge whatever put the device in ATTENTION and drop straight back to
PRESENT. Press and hold to re-centre on page 1.

**The halo.** It is a single steady colour or it is off. Off means nothing needs you. A lit halo
means ATTENTION, and the colour is the whole vocabulary — it never pulses, chases or animates,
because a desk object that blinks is a desk object you turn face-down. Mapping of colour to
condition is firmware policy and lives in `config.h`.

**The three detail pages** (turn the crown from the home face):

1. **Room** — temperature and relative humidity from the SHT41, large numerals, with the trend over
   the last hour as a thin arc. Humidity breathes through the four floor holes; temperature carries
   a self-heating offset — see the §2.6 calibration note.
2. **Light** — lux from the VEML7700 and the day's curve, which is what decides NIGHT. Scaled by the
   calibration factor, because the sensor reads through a Ø3 window facing right-rear, not upward.
3. **Power** — battery percentage and voltage from the MAX17048, plus estimated runtime in the
   current state from the power table.

Home face is the clock and one line of whatever matters. Everything else is a page you have to ask
for, which is the point.
