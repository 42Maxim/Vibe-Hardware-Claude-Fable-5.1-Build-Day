# 02 · Concepts

Four forms, each arranged from the parts in `01-survey.md` at their real dimensions.
Preview: `docs/02-concepts-canvas.html` (to-scale SVG sections, local file, open in a browser).

---

## A · Puck — "a hockey puck that knows you're there"

**Form.** Ø74 × 24 mm disc, flat top, 1 mm radius edge. Frosted ring inset in the top face, round display dead centre, an IR window on the front chamfer, and a knurled crown on the right side like a watch.

**Inside.** Top layer: Adafruit 1.28" round GC9A01 module (42.4 × 36.2 × 5.4) centred, NeoPixel Ring 24 (OD 65.5 / ID 52.3 / 3.2 thick) concentric around it under a 3 mm frosted PETG ring. Middle layer: ESP32-S3 Feather (52.3 × 22.7 × 7.2) running front-to-back with USB-C through the rear wall; SHT41 and VEML7700 lying flat in the left and right crescents beside it (VEML7700 reads ambient through the frosted ring). STHS34PF80 standing vertical against the front wall, element facing forward through a Ø6 window, its 80° cone covers a seated person at 0.5–1.5 m. Bottom layer: 500 mAh cell (36 × 29 × 4.75) under the Feather. PEC11R encoder (20 mm shaft, 7 mm thread) through the right wall.

**The dimension that makes it work.** The 24-ring's 52.3 mm inner diameter clears the display module's 42.4 × 36.2 outline with 5 mm to spare; the 16-ring's 31.7 mm ID does not even clear the 32.5 mm active area. That single number makes this a 24-LED object, fixes the inner cavity at Ø68, and the wall at 3 mm gives Ø74. The Feather's 52.3 mm length sits on a Ø68 chord only within ±11 mm of centre, which is why it runs through the middle and the sensors go in the crescents.
**Fights back.** Height: 2 + 4.75 + 7.2 + 5.4 + 3 with 0.5 mm gaps is 23.4 mm; nothing can be added vertically. The 24-ring idles at ~24 mA dark, so it needs its own high-side switch.

**Easy:** one focal point, symmetric, printable as two parts (body + lid). **Costs:** the 24-ring is the dearest LED option, the crown needs a good knob. **Tier:** balanced.

---

## B · Tile — "a standing card, the lean one"

**Form.** 32 × 16 × 62 mm standing tile in a shallow base, display landscape at eye level.

**Inside.** Adafruit ESP32-S3 Reverse TFT Feather (22.9 × 50.8, 240×135 display on its back face) standing vertically; the tile is the Feather plus 4.5 mm of wall on each side. 350 mAh cell (36 × 19.6 × 5.2) behind it. STHS34PF80 in the base facing forward. SHT41 in the base. No ring: the only ambient light is the Feather's single on-board NeoPixel glowing through the base — or a 12-ring (36.8 OD) laid flat in a Ø40 base as a floor glow.

**The dimension that makes it work.** The Feather's 22.9 mm width is the whole object's width; nothing else needs to fit beside it. **Fights back.** The 1.14" display is off-centre on the Feather (three buttons take the top 8 mm of the face), so the tile's window is asymmetric, and the 240×135 panel at 16 mm wide reads as a status bar, not a face. The three onboard buttons are the "one control" — tactile, not rotary.

**Easy:** cheapest, no display wiring, one board. **Costs:** the ambient light is an afterthought, the display is small. **Tier:** lean.

---

## C · Dial — "the knob is the object"

**Form.** 80 × 56 × 28 mm wedge, 12° top slope. A Ø30 knob rises 8 mm from the top right, a 16-LED ring glows in the annulus around it, a 1.3" square display sits to the left.

**Inside.** NeoPixel Ring 16 (44.5 OD / 31.7 ID / 6.7 thick) under a frosted annulus, PEC11R at its centre with a Ø28 knob (the 31.7 ID leaves 1.85 mm around a 28 mm knob). Adafruit 1.3" 240×240 ST7789 (35.8 × 35.8) at the left. Feather flat under both, 1200 mAh cell (62 × 34) flat under the Feather. STHS34PF80 on the front face.

**The dimension that makes it work.** The 16-ring's 31.7 mm ID is exactly a knob-sized hole; that ring only makes sense around a control. **Fights back.** The ring's 6.7 mm thickness plus the 12.5 mm encoder body under the knob stacks to 19 mm before the Feather, so the wedge is 28 mm tall and the two focal points (knob halo + display) compete.

**Easy:** great tactile feel, long battery (1200 mAh). **Costs:** two visual centres, largest footprint. **Tier:** no-limit (knob machined, ring + display + haptics).

---

## D · Wedge — "a tiny monitor with a halo on the desk"

**Form.** 76 × 50 × 32 mm, 25° sloped face, landscape display.

**Inside.** Adafruit 1.69" 280×240 (45.8 × 36.8) in the sloped face. NeoPixel Ring 12 (36.8 OD) mounted face-down in the base so the glow lands on the desk as an underglow halo. 1200 mAh cell lying flat under the slope. STHS34PF80 above the display. Encoder on the right end.

**The dimension that makes it work.** The 1.69" panel's 38 × 30 mm active area is the largest surveyed that fits a 50 mm-deep face at 25°. **Fights back.** The underglow depends on the desk finish (nothing on black), and the 62 mm cell forces the 76 mm length.

**Easy:** most legible display. **Costs:** the ambient light is indirect and surface-dependent; the form is a familiar "gadget" shape. **Tier:** balanced.

---

## Recommendation: A · Puck

The puck is the only form where every part sits where its dimension wants it: the 24-ring is concentric with the round display because 52.3 > 42.4, the Feather runs through the middle because 52.3 mm fits a Ø68 chord only there, the cell stacks under it because the disc has exactly one layer to spare, and the presence sensor's 80° cone faces the person through the front wall without a lens. One focal point, quiet when you are not there, a crown you can turn without looking. The tile (B) is cheaper but its light and display are compromises; the dial (C) has two centres; the wedge (D) is a shape you have already seen and its glow depends on the desk.

Committed: Puck. Concept previews in `02-concepts-canvas.html`.

**Post-fit note (geometry/device.py):** the concept sketch said Ø74 × 24. The exact fit check grew it to **Ø78 × 30**: the 24-ring cannot share a plane with the display module (the module's corners sit at r 27.9, inside the ring's 26.15 inner radius), so the ring moved up into the lid and the display sits in a 2.4 mm dish below it (+6 mm height); and the VEML7700 standing at 45° needs a Ø72 cavity to clear both the wall and the display corner by 0.5 mm (+4 mm diameter). The sketch's reasoning stands; the numbers in `build/geometry.json` are the truth.
