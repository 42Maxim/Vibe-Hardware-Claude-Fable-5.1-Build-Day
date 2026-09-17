# Port check — firmware ↔ demo

Three JS files are line-for-line ports of three C++ files. This is the map, and
the two checks that prove they still agree.

* `firmware/state_machine.cpp` → `demo/src/state_machine.js`
* `firmware/leds.cpp` → `demo/src/leds.js`
* `firmware/ui.cpp` → `demo/src/ui.js` (part 2; part 1 is the Adafruit_GFX shim)

Rule: **no number that exists in `firmware/config.h` is typed into a JS file.**
The build script turns every `#define NAME value` into `FW.NAME`. Change a
timing in `config.h` and both sides move together.

---

## 1. Functions

### state_machine

| C++ (`firmware/state_machine.cpp`) | line | JS (`demo/src/state_machine.js`) | line |
|---|---|---|---|
| `enum State` (in `state_machine.h`) | h:17 | `const SLEEP … AWAY_PENDING` | 11–16 |
| `enum RingMode` | h:27 | `const RING_OFF … RING_LOW_BATT` | 19–22 |
| `enum Page` | h:35 | `const PAGE_GLANCE … PAGE_CLAUDE` | 25–29 |
| `#define PAGE_COUNT 5` | h:42 | `const PAGE_COUNT = 5` | 32 |
| `sm_state_name` | 12 | `sm_state_name` | 38 |
| `sm_go` | 23 | `sm_go` | 49 |
| `sm_night` | 34 | `sm_night` | 60 |
| `sm_init` | 45 | `sm_init` | 71 |
| `sm_step` | 59 | `sm_step` | 82 |

`struct Inputs` / `Outputs` / `Transition` / `SM` (state_machine.h 44–78) are
plain JS objects with the same field names; only `reason` differs in type
(`const char*` vs string).

### leds

| C++ (`firmware/leds.cpp`) | line | JS (`demo/src/leds.js`) | line |
|---|---|---|---|
| `led_scale` | 12 | `led_scale` | 11 |
| `leds_compute` | 19 | `leds_compute` | 18 |

One deliberate difference, marked in the JS: the C signature takes
`float brightnessCap`, so the cap is narrowed to single precision before the
double maths. `leds.js` calls `Math.fround(brightnessCap)` to reproduce that.
Without it a handful of channels round one step low — the LED trace diff below
catches exactly that.

### ui

| C++ (`firmware/ui.cpp`) | line | JS (`demo/src/ui.js`) | line |
|---|---|---|---|
| — (Adafruit_GFX itself) | — | `GLCDFONT` (1280 bytes, machine copy of glcdfont.c @1.12.6) | 21 |
| — (Adafruit_GFX itself) | — | `class GFX` shim | 88 |
| `ui_fmt0` | 20 | `ui_fmt0` | 325 |
| `ui_fmt1` | 26 | `ui_fmt1` | 331 |
| `ui_fmt_tok` | 32 | `ui_fmt_tok` | 337 |
| `ui_strlen` | 43 | `ui_strlen` | 348 |
| `ui_accent` | 51 | `ui_accent` | 354 |
| `ui_print_centred` | 61 | `ui_print_centred` | 364 |
| `ui_print_at` | 70 | `ui_print_at` | 373 |
| `ui_hour_ring` | 80 | `ui_hour_ring` | 383 |
| `ui_state_glyph` | 101 | `ui_state_glyph` | 404 |
| `ui_rh_bar` | 121 | `ui_rh_bar` | 424 |
| `ui_batt_pip` | 134 | `ui_batt_pip` | 437 |
| `ui_claude_bar` | 154 | `ui_claude_bar` | 457 |
| `ui_degree` | 172 | `ui_degree` | 475 |
| `ui_page_glance` | 179 | `ui_page_glance` | 482 |
| `ui_page_temp` | 196 | `ui_page_temp` | 498 |
| `ui_page_rh` | 205 | `ui_page_rh` | 506 |
| `ui_page_batt` | 215 | `ui_page_batt` | 515 |
| `ui_page_claude` | 229 | `ui_page_claude` | 528 |
| `ui_draw` | 261 | `ui_draw` | 552 |

Two rounding rules keep the two identical and are followed everywhere:

* numbers are formatted with integer maths (`floor(v + 0.5)`, then `/10` and
  `%10`), never `%f` or `toFixed`, so C++ and JS round the same way;
* every coordinate is `floor(x + 0.5)` on a `double`, which
  `Math.floor(x + 0.5)` matches bit for bit.

One deliberate difference, the same one `leds.js` has: `ui_fmt0` / `ui_fmt1` in
the JS call `Math.fround(v)` first. Every field they format (`tempC`, `rh`,
`vbatPct`, `claudeUsd`) is a `float` in the C `UiModel`, so the C++ side rounds
a value already narrowed to single precision. The trace diff below found this:
`claudeUsd = 103.45` printed `$103.5` in JS and `$103.4` in C++ until the
`fround` went in.

`ui_page_claude`'s token line is ASCII (`IN 812K - OUT 96K`), not a middot. A
UTF-8 `·` is two bytes to C++'s `print()` and one code unit to JS's, so the two
ports would draw different glyphs from the same source character.

## 2. Constants

Every one of these is read from `FW.<NAME>` in the JS and from the `#define` in
`firmware/config.h` in the C++. The build-script regex is
`#define ([A-Z0-9_]+) +([-0-9.]+)`; 90 names currently match.

| Used by | `config.h` names |
|---|---|
| `sm_step` timing | `T_WAKE_MS`, `T_AWAY_MS`, `T_ATTENTION_MS`, `RING_LOWBATT_MS`, `TICK_MS` |
| `sm_night` | `LUX_NIGHT`, `LUX_HYST` |
| `sm_step` backlight | `BL_PRESENT`, `BL_NIGHT`, `BL_ATTENTION` |
| `sm_step` ring | `VBAT_LOW_PCT` |
| `leds_compute` | `LED_COUNT`, `LED_MAX_BRIGHTNESS`, `LED_SWEEP_MS`, `LED_SWEEP_FADE_MS`, `LED_TAIL`, `LED_BREATH_MS`, `LED_BREATH_FLOOR`, `LED_PULSE_MS`, `LED_PULSE_COUNT`, `LED_WARM_R/G/B`, `LED_AMBER_R/G/B`, `LED_RED_R/G/B` |
| `ui_accent`, `ui_rh_bar` | `TEMP_COMFORT_LO/HI`, `RH_COMFORT_LO/HI` |
| `ui_hour_ring` | `LUX_DAY`, `UI_TICK_R_OUT`, `UI_TICK_R_IN`, `UI_TICK_R_IN_NOW`, `SCREEN_CX`, `SCREEN_CY` |
| `ui_*` layout | `UI_BIG_Y`, `UI_LABEL_Y`, `UI_BAR_Y`, `UI_BAR_W`, `UI_BAR_H`, `UI_PIP_Y`, `UI_PIP_W`, `UI_GLYPH_Y` |
| `ui_page_claude`, `ui_claude_bar` | `CLAUDE_STALE_MIN`, `COL_CLAUDE` |
| colours (RGB565 as decimal so the regex sees them) | `COL_BG`, `COL_INK`, `COL_DIM`, `COL_FAINT`, `COL_GREEN`, `COL_AMBER`, `COL_RED`, `COL_CLAUDE` |
| firmware only (no JS use) | all `PIN_*`, `I2C_ADDR_*`, `BL_PWM_*`, `PRESENCE_ON/OFF_THRESH`, `SENSOR_PERIOD_MS`, `ENC_*`, `CLOCK_*`, `T_SLEEP_POLL_S`, `SCREEN_W/H/R`, `CLAUDE_WIFI_ENABLED`, `CLAUDE_HTTP_PORT` |

`build.py` prints a WARNING naming every firmware-only constant; the two
`CLAUDE_*` ones on that list are expected, like the `PIN_*` group.

Wi-Fi credentials are strings, so they cannot live in `config.h` (the regex
takes numbers only, and a password has no business in the published HTML).
They are in `firmware/secrets.h`, from `firmware/secrets.h.example`.

`PAGE_COUNT` is the one constant the JS declares itself — it lives in
`state_machine.h`, not `config.h`.

## 3. The checks

### C++ side

```
c++ -std=c++17 -Wall -Wextra -o /tmp/puck_sm \
    firmware/test_state_machine.cpp firmware/state_machine.cpp && /tmp/puck_sm
```

### JS side — same scenario, same expected log

Run from the repo root:

```
node -e '
const fs=require("fs"),vm=require("vm"),R=process.cwd();
const FW={};for(const l of fs.readFileSync(R+"/firmware/config.h","utf8").split("\n")){const m=l.match(/#define ([A-Z0-9_]+) +([-0-9.]+)/);if(m)FW[m[1]]=parseFloat(m[2]);}
const c=vm.createContext({FW,console,Math,String,Number,Object,Array,Uint8Array,Uint8ClampedArray});
for(const f of["state_machine.js","leds.js","ui.js"])vm.runInContext(fs.readFileSync(R+"/demo/src/"+f,"utf8"),c,{filename:f});
vm.runInContext("globalThis.api={sm_init,sm_step,sm_state_name,leds_compute,ui_draw,GFX,RING_WAKE_SWEEP,RING_ATTENTION,RING_LOW_BATT,PAGE_GLANCE,PAGE_DETAIL_TEMP}",c);
const A=c.api;
console.log("FW constants parsed from config.h:",Object.keys(FW).length);
function scen(t,i){i.presence=t>=50000?false:t>=47000?true:t>=16000?false:t>=15000?true:t>=12000?false:t>=100;
i.lux=t>=46500?1:t>=2500?200:t>=2000?2:200;i.vbatPct=t>=46500?10:80;
i.encDelta=t===3000?1:0;i.encPressed=t===49000;i.tempC=22.4;i.rh=46;i.hour=14.5;i.charging=false;i.nowMs=t;}
const EXP=[[100,"SLEEP","WAKE","presence"],[1600,"WAKE","PRESENT","wake_done"],[2000,"PRESENT","NIGHT","lux_low"],[2500,"NIGHT","PRESENT","lux_high"],[3000,"PRESENT","ATTENTION","knob"],[11000,"ATTENTION","PRESENT","attention_idle"],[12000,"PRESENT","AWAY_PENDING","presence_lost"],[15000,"AWAY_PENDING","PRESENT","presence_back"],[16000,"PRESENT","AWAY_PENDING","presence_lost"],[46000,"AWAY_PENDING","SLEEP","away_timeout"],[47000,"SLEEP","WAKE","presence"],[48500,"WAKE","NIGHT","wake_done_dark"],[49000,"NIGHT","ATTENTION","knob"],[50000,"ATTENTION","AWAY_PENDING","presence_lost"],[80000,"AWAY_PENDING","SLEEP","away_timeout"]];
const sm={},i={},o={};A.sm_init(sm);let n=0,f=0;
for(let t=0;t<=80100;t+=FW.TICK_MS){const b=sm.state;scen(t,i);A.sm_step(sm,i,o);
if(sm.state!==b){const L=sm.lastTransition,r=[L.atMs,A.sm_state_name(L.from),A.sm_state_name(L.to),L.reason];
console.log("  "+String(r[0]).padStart(6)+" ms  "+r[1].padEnd(12)+" -> "+r[2].padEnd(12)+"  ("+r[3]+")");
const e=EXP[n];if(!e||e.join()!==r.join()){console.log("    !! expected "+(e?e.join(" "):"<none>"));f++;}n++;}
if(t===3100&&(o.page!==A.PAGE_DETAIL_TEMP||o.ringMode!==A.RING_ATTENTION))f++;
if(t===47100&&o.ringMode!==A.RING_LOW_BATT)f++;
if(t===49100&&o.page!==A.PAGE_GLANCE)f++;
if(t===46100&&(o.displayOn||o.backlight!==0))f++;}
if(n!==EXP.length)f++;
console.log("\n"+n+" transitions, "+f+" failures");
if(f)process.exit(1);console.log("PASS");'
```

The C++ side prints one extra line first, from `page_cycle_test()` — a check
the JS scenario has no counterpart for, because it only ever turns the knob
once:

```
  page cycle: 5 pages, one lap returns to GLANCE, -1 wraps to PAGE_CLAUDE
```

Then both print the same 15 lines:

```
   100 ms  SLEEP        -> WAKE          (presence)
  1600 ms  WAKE         -> PRESENT       (wake_done)
  2000 ms  PRESENT      -> NIGHT         (lux_low)
  2500 ms  NIGHT        -> PRESENT       (lux_high)
  3000 ms  PRESENT      -> ATTENTION     (knob)
 11000 ms  ATTENTION    -> PRESENT       (attention_idle)
 12000 ms  PRESENT      -> AWAY_PENDING  (presence_lost)
 15000 ms  AWAY_PENDING -> PRESENT       (presence_back)
 16000 ms  PRESENT      -> AWAY_PENDING  (presence_lost)
 46000 ms  AWAY_PENDING -> SLEEP         (away_timeout)
 47000 ms  SLEEP        -> WAKE          (presence)
 48500 ms  WAKE         -> NIGHT         (wake_done_dark)
 49000 ms  NIGHT        -> ATTENTION     (knob)
 50000 ms  ATTENTION    -> AWAY_PENDING  (presence_lost)
 80000 ms  AWAY_PENDING -> SLEEP         (away_timeout)

15 transitions, 0 failures
PASS
```

### Trace diffs (stronger than the transition log)

Two extra checks were run outside the repo (they need a throwaway trace-only
`Adafruit_GFX` stub, which does not belong in `firmware/`):

* **`ui_draw`** — the C++ and JS versions were each given nine models (the five
  pages, one "everything else" model at 28.7 °C / 18 %RH / hour 6 / 9 % battery
  / charging / ATTENTION / 900 lux, and three more that walk PAGE_CLAUDE's
  branches: fresh + known window, never-received + unknown window, age exactly
  `CLAUDE_STALE_MIN`, and one stale) and made to log every primitive call.
  **371 calls, byte-identical** (after the `Math.fround` fix above).
* **`leds_compute`** — all four ring modes × t = 0…3000 ms in 50 ms steps ×
  24 pixels. **244 frames, byte-identical** (after the `Math.fround` fix).

## Known limits

* The ports agree on the *primitive calls*, and `ui.js`'s GFX shim is a
  faithful port of Adafruit_GFX 1.12.6's rasterisers, but nobody has diffed the
  browser's pixels against a photo of the real panel.
* `ui_fmt0` / `ui_fmt1` round half **up** and assume non-negative values. A
  sub-zero temperature would print wrong on both sides, identically.
* `PAGE_CLAUDE`'s numbers come from an HTTP push, and `claudeAgeMin` is measured
  against the same drifting RTC-memory second counter as the hour ring — the
  stale threshold is therefore approximate by the same amount the clock is.
