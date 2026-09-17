// ===== PORT BOUNDARY: mirrors firmware/state_machine.cpp — same functions, same order; edit config.h, not this file, to change timings =====
//
// Plain script. No modules, no imports, no libraries. Every tunable is read
// from the global FW object, which the build script generates by parsing
// firmware/config.h. If a number you need is not on FW, it belongs in
// config.h — do not type it here.
//
// Structure mirrors firmware/state_machine.h then .cpp, top to bottom.

// --- States (firmware/state_machine.h: enum State) ---------------------------
const SLEEP = 0;
const WAKE = 1;
const PRESENT = 2;
const NIGHT = 3;
const ATTENTION = 4;
const AWAY_PENDING = 5;

// --- Ring animation modes (enum RingMode) ------------------------------------
const RING_OFF = 0;
const RING_WAKE_SWEEP = 1;
const RING_ATTENTION = 2;
const RING_LOW_BATT = 3;

// --- Display pages (enum Page) -----------------------------------------------
const PAGE_GLANCE = 0;
const PAGE_DETAIL_TEMP = 1;
const PAGE_DETAIL_RH = 2;
const PAGE_DETAIL_BATT = 3;
const PAGE_CLAUDE = 4;   // today's Claude Code usage, pushed in over HTTP

// #define PAGE_COUNT 5 — lives in state_machine.h, not config.h
const PAGE_COUNT = 5;

// Inputs / Outputs / Transition / SM are plain objects here; the C structs are
// in firmware/state_machine.h with the same field names.

// --- helpers -----------------------------------------------------------------

function sm_state_name(s) {
  if (s === SLEEP) return "SLEEP";
  if (s === WAKE) return "WAKE";
  if (s === PRESENT) return "PRESENT";
  if (s === NIGHT) return "NIGHT";
  if (s === ATTENTION) return "ATTENTION";
  return "AWAY_PENDING";
}

// Record a transition and reset the dwell clock. Every state change goes
// through here so lastTransition is always the truth.
function sm_go(sm, to, reason, nowMs) {
  sm.lastTransition.from = sm.state;
  sm.lastTransition.to = to;
  sm.lastTransition.reason = reason;
  sm.lastTransition.atMs = nowMs;
  sm.state = to;
  sm.stateEnteredMs = nowMs;
}

// Schmitt trigger on lux: fall below LUX_NIGHT to latch night, climb above
// LUX_NIGHT + LUX_HYST to unlatch. Called once per tick, before the switch.
function sm_night(sm, lux) {
  if (!sm.nightLatch && lux < FW.LUX_NIGHT) {
    sm.nightLatch = true;
  } else if (sm.nightLatch && lux > (FW.LUX_NIGHT + FW.LUX_HYST)) {
    sm.nightLatch = false;
  }
  return sm.nightLatch;
}

// --- init --------------------------------------------------------------------

function sm_init(sm) {
  sm.state = SLEEP;
  sm.stateEnteredMs = 0;
  sm.lastInputMs = 0;
  sm.page = PAGE_GLANCE;
  sm.nightLatch = false;
  sm.lastTransition = {from: SLEEP, to: SLEEP, reason: "init", atMs: 0};
}

// --- step --------------------------------------------------------------------

function sm_step(sm, inp, out) {
  // 1. Fold the two knob inputs into one "the user touched it" signal, and
  //    apply the page change before the transitions, so entering ATTENTION
  //    already shows the page the detent selected.
  const anyInput = (inp.encDelta !== 0) || inp.encPressed;
  const awake = (sm.state !== SLEEP) && (sm.state !== WAKE);

  if (awake && inp.encDelta !== 0) {
    let p = sm.page + inp.encDelta;
    p = p % PAGE_COUNT;
    if (p < 0) p = p + PAGE_COUNT;  // C's % keeps the sign; JS's does too
    sm.page = p;
  }
  if (awake && inp.encPressed) {
    sm.page = PAGE_GLANCE;  // press is always "take me home"
  }
  if (awake && anyInput) {
    sm.lastInputMs = inp.nowMs;
  }

  // 2. Hysteresised darkness, evaluated every tick so the latch tracks the room
  //    even while we are in WAKE or AWAY_PENDING.
  const night = sm_night(sm, inp.lux);

  // 3. Transitions. Order inside each state matters: presence loss always wins,
  //    then knob input, then light.
  if (sm.state === SLEEP) {
    if (inp.presence) {
      sm_go(sm, WAKE, "presence", inp.nowMs);
    }

  } else if (sm.state === WAKE) {
    if ((inp.nowMs - sm.stateEnteredMs) >= FW.T_WAKE_MS) {
      if (night) {
        sm_go(sm, NIGHT, "wake_done_dark", inp.nowMs);
      } else {
        sm_go(sm, PRESENT, "wake_done", inp.nowMs);
      }
    }

  } else if (sm.state === PRESENT) {
    if (!inp.presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", inp.nowMs);
    } else if (anyInput) {
      sm_go(sm, ATTENTION, "knob", inp.nowMs);
    } else if (night) {
      sm_go(sm, NIGHT, "lux_low", inp.nowMs);
    }

  } else if (sm.state === NIGHT) {
    if (!inp.presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", inp.nowMs);
    } else if (anyInput) {
      sm_go(sm, ATTENTION, "knob", inp.nowMs);
    } else if (!night) {
      sm_go(sm, PRESENT, "lux_high", inp.nowMs);
    }

  } else if (sm.state === ATTENTION) {
    if (!inp.presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", inp.nowMs);
    } else if ((inp.nowMs - sm.lastInputMs) >= FW.T_ATTENTION_MS) {
      if (night) {
        sm_go(sm, NIGHT, "attention_idle", inp.nowMs);
      } else {
        sm_go(sm, PRESENT, "attention_idle", inp.nowMs);
      }
    }

  } else {  // AWAY_PENDING
    if (inp.presence) {
      if (night) {
        sm_go(sm, NIGHT, "presence_back", inp.nowMs);
      } else {
        sm_go(sm, PRESENT, "presence_back", inp.nowMs);
      }
    } else if ((inp.nowMs - sm.stateEnteredMs) >= FW.T_AWAY_MS) {
      sm_go(sm, SLEEP, "away_timeout", inp.nowMs);
    }
  }

  // 4. Outputs, derived only from the (possibly new) state. Recomputed every
  //    tick, never remembered.
  const msInState = inp.nowMs - sm.stateEnteredMs;

  out.displayOn = (sm.state !== SLEEP);
  out.page = sm.page;
  out.stateEnteredMs = sm.stateEnteredMs;

  // Backlight.
  if (sm.state === SLEEP) {
    out.backlight = 0.0;
  } else if (sm.state === WAKE || sm.state === ATTENTION) {
    out.backlight = FW.BL_ATTENTION;
  } else if (sm.state === NIGHT) {
    out.backlight = FW.BL_NIGHT;
  } else if (sm.state === AWAY_PENDING) {
    // Fade the level we were sitting at down to black across the grace window.
    const base = night ? FW.BL_NIGHT : FW.BL_PRESENT;
    let frac = msInState / FW.T_AWAY_MS;
    if (frac > 1.0) frac = 1.0;
    out.backlight = base * (1.0 - frac);
  } else {  // PRESENT
    out.backlight = FW.BL_PRESENT;
  }

  // Ring. Low battery shouts over the wake sweep for its first RING_LOWBATT_MS.
  if (sm.state === WAKE && inp.vbatPct < FW.VBAT_LOW_PCT && msInState < FW.RING_LOWBATT_MS) {
    out.ringMode = RING_LOW_BATT;
  } else if (sm.state === WAKE) {
    out.ringMode = RING_WAKE_SWEEP;
  } else if (sm.state === ATTENTION) {
    out.ringMode = RING_ATTENTION;
  } else {
    out.ringMode = RING_OFF;
  }
  out.ringOn = (out.ringMode !== RING_OFF);
}
