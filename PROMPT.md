# Build Day prompt — Breakthrough track

Paste as one message. Model: claude-fable-5-1, effort high.
Standing rules live in CLAUDE.md and load automatically.

---

Design a small physical device/object that lives on a desk, senses what is happening around
it, and responds — and prove the whole thing on screen, from first principles. You
have about two hours and limited credits; spend them on the object and the demo.

You choose what the object actually is. Below is a direction, not a spec.

The spirit: a Teenage Engineering–grade desk object. Restrained, intentional,
premium. Something I would leave out on a clean desk rather than hide in a drawer. It
should notice me, tell me one thing worth knowing at a glance, and otherwise stay
quiet. My starting sketch is a presence-aware ambient companion — a small display,
ambient light, a few environmental senses, one good physical control, battery, no
tether. The sketch is negotiable. The taste bar is not.

## 1. Survey the parts before you design anything

Browse. Read the actual supplier pages and the datasheets behind them. I am not
naming parts and I don't want a shopping list yet — I want to know what is really
available and what shape it comes in: board footprints, display sizes and aspect
ratios, LED ring diameters, battery thicknesses, sensor field-of-view cones, encoder
shaft depths, connector positions. Those dimensions are the real design constraints,
so get them before you draw anything.

## 2. Show me three or four concepts, then pick one

Each concept gets: a name, one line of character, the form described in words with
rough dimensions, and — this is the part I care about — **how the real parts arrange
inside that form, and which specific part dimension makes the form work or fight
back**. "A disc, because the LED ring is 60 mm and the display sits in its middle
without an offset" is the kind of reasoning I want. "A disc, because discs are
elegant" is not.

For each, tell me what the form makes easy, what it costs, and which BOM tier it
suits. Then recommend one and say plainly why it beats the others.

Do not wait for my approval. Present the concepts, commit to your recommendation,
keep going. I'll interrupt if I disagree — that's what Esc is for. Once committed,
don't revisit it.

## 3. Lock the BOM

Now the real shopping list for the chosen concept. For every part: exact module name,
supplier, a real link, current price, and one line on why that part over the obvious
alternative.

Budget is flexible — no fixed number. Give three tiers: lean, the balanced one you
recommend, and one where cost stops mattering. Total each, one line of trade-off
each. Then tell me which two or three parts are worth the money and which are a waste.

Off-the-shelf breakouts a moderately experienced maker can hand-solder. No custom PCB,
nothing on a long lead time.

## 4. One parametric source of truth for the geometry

Pick your own approach, including installing a CAD or mesh package if that is the
fastest route to a correct model. Whatever you choose, the enclosure geometry is defined once,
parametrically, and that same definition produces both the STL I would print and the
mesh the demo renders. A model drawn by hand for the demo that merely resembles the
case is precisely the thing I do not want. Component bodies placed at the dimensions
you read in step 1.

## 5. The demo: one self-contained HTML file

No external libraries, no CDN, no assets. It must open on a laptop with the wifi off
and work.

- Real-time 3D of the device, rotatable, rendered with WebGL you write yourself. No
  three.js. No library doing the hard part.
- Geometry inlined from the parametric source above.
- A toggle to see inside: shell goes translucent, the real components sit where they
  really sit.
- The device runs live: the display rendered at its true pixel resolution showing
  exactly what the firmware would draw, and the ambient lighting rendered as it would
  actually glow.
- Sliders for every sensed quantity — presence, light level, temperature, humidity,
  time of day — and the physical controls as clickable elements.
- Current state and the last transition that fired, shown live.
- Battery readout driven by the power budget below, not a number you picked.

## 6. The state machine in the browser is the firmware's state machine

Same states, same transitions, same timer constants, ported directly — not a second
implementation that behaves similarly. If I change a timeout in the firmware it should
be obvious which line in the page changes with it. Mark the port boundary in a comment.

## 7. Three computations that must actually compute

Each one a table, each ending in a verdict.

1. **Pin budget** — every pin assigned, every peripheral accounted for, conflicts and
   I2C address collisions flagged explicitly.
2. **Fit** — bounding box of every component against the internal volume, with
   clearances. Pass or fail. Visible in the 3D inside-view.
3. **Power** — per-part current draw per mode from the datasheets, totals, predicted
   runtime per mode on the chosen cell. If a mode cannot last a working day, say so and
   tell me what to change.

## 8. Also produce

Aesthetic direction (a short paragraph on look, material feel, personality). Mechanical
design: dimensions, internal layout, mounting, clearances. Wiring as a structured
pin-to-module list. Assembly guide, numbered, empty enclosure to finished device, with
the two or three steps most likely to go wrong called out. Complete commented firmware
with libraries named and versions verified. Quick start: flash, charge, use.

## Order of work

Ship in the order above. If the clock runs out, the tail is what is missing. Two items
are explicitly droppable — do them last, and drop them without asking me:

- An exploded assembly animation on a scrub bar.
- A concepts panel in the demo showing the forms you rejected in step 2.

## Done means

The HTML file opens with wifi off and runs with no console errors. The 3D renders and
rotates. Moving any slider visibly changes the display and the lighting. All three
tables pass. The geometry script runs and writes an STL. The BOM has a real total I
could order from tonight.
