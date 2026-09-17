// =============================================================================
// Puck — state_machine.cpp
//
// Pure logic, no hardware. demo/src/state_machine.js is a line-for-line port of
// this file: same function names, same order, same if/else branches. If you
// change a branch here, change the same branch there.
// =============================================================================
#include "state_machine.h"

// --- helpers -----------------------------------------------------------------

const char* sm_state_name(State s) {
  if (s == SLEEP) return "SLEEP";
  if (s == WAKE) return "WAKE";
  if (s == PRESENT) return "PRESENT";
  if (s == NIGHT) return "NIGHT";
  if (s == ATTENTION) return "ATTENTION";
  return "AWAY_PENDING";
}

// Record a transition and reset the dwell clock. Every state change goes
// through here so lastTransition is always the truth.
static void sm_go(SM* sm, State to, const char* reason, uint32_t nowMs) {
  sm->lastTransition.from = sm->state;
  sm->lastTransition.to = to;
  sm->lastTransition.reason = reason;
  sm->lastTransition.atMs = nowMs;
  sm->state = to;
  sm->stateEnteredMs = nowMs;
}

// Schmitt trigger on lux: fall below LUX_NIGHT to latch night, climb above
// LUX_NIGHT + LUX_HYST to unlatch. Called once per tick, before the switch.
static bool sm_night(SM* sm, float lux) {
  if (!sm->nightLatch && lux < LUX_NIGHT) {
    sm->nightLatch = true;
  } else if (sm->nightLatch && lux > (LUX_NIGHT + LUX_HYST)) {
    sm->nightLatch = false;
  }
  return sm->nightLatch;
}

// --- init --------------------------------------------------------------------

void sm_init(SM* sm) {
  sm->state = SLEEP;
  sm->stateEnteredMs = 0;
  sm->lastInputMs = 0;
  sm->page = PAGE_GLANCE;
  sm->nightLatch = false;
  sm->lastTransition.from = SLEEP;
  sm->lastTransition.to = SLEEP;
  sm->lastTransition.reason = "init";
  sm->lastTransition.atMs = 0;
}

// --- step --------------------------------------------------------------------

void sm_step(SM* sm, const Inputs* in, Outputs* out) {
  // 1. Fold the two knob inputs into one "the user touched it" signal, and
  //    apply the page change before the transitions, so entering ATTENTION
  //    already shows the page the detent selected.
  bool anyInput = (in->encDelta != 0) || in->encPressed;
  bool awake = (sm->state != SLEEP) && (sm->state != WAKE);

  if (awake && in->encDelta != 0) {
    int p = (int)sm->page + in->encDelta;
    p = p % PAGE_COUNT;
    if (p < 0) p = p + PAGE_COUNT;  // C's % keeps the sign; JS's does too
    sm->page = (Page)p;
  }
  if (awake && in->encPressed) {
    sm->page = PAGE_GLANCE;  // press is always "take me home"
  }
  if (awake && anyInput) {
    sm->lastInputMs = in->nowMs;
  }

  // 2. Hysteresised darkness, evaluated every tick so the latch tracks the room
  //    even while we are in WAKE or AWAY_PENDING.
  bool night = sm_night(sm, in->lux);

  // 3. Transitions. Order inside each state matters: presence loss always wins,
  //    then knob input, then light.
  if (sm->state == SLEEP) {
    if (in->presence) {
      sm_go(sm, WAKE, "presence", in->nowMs);
    }

  } else if (sm->state == WAKE) {
    if ((in->nowMs - sm->stateEnteredMs) >= T_WAKE_MS) {
      if (night) {
        sm_go(sm, NIGHT, "wake_done_dark", in->nowMs);
      } else {
        sm_go(sm, PRESENT, "wake_done", in->nowMs);
      }
    }

  } else if (sm->state == PRESENT) {
    if (!in->presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", in->nowMs);
    } else if (anyInput) {
      sm_go(sm, ATTENTION, "knob", in->nowMs);
    } else if (night) {
      sm_go(sm, NIGHT, "lux_low", in->nowMs);
    }

  } else if (sm->state == NIGHT) {
    if (!in->presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", in->nowMs);
    } else if (anyInput) {
      sm_go(sm, ATTENTION, "knob", in->nowMs);
    } else if (!night) {
      sm_go(sm, PRESENT, "lux_high", in->nowMs);
    }

  } else if (sm->state == ATTENTION) {
    if (!in->presence) {
      sm_go(sm, AWAY_PENDING, "presence_lost", in->nowMs);
    } else if ((in->nowMs - sm->lastInputMs) >= T_ATTENTION_MS) {
      if (night) {
        sm_go(sm, NIGHT, "attention_idle", in->nowMs);
      } else {
        sm_go(sm, PRESENT, "attention_idle", in->nowMs);
      }
    }

  } else {  // AWAY_PENDING
    if (in->presence) {
      if (night) {
        sm_go(sm, NIGHT, "presence_back", in->nowMs);
      } else {
        sm_go(sm, PRESENT, "presence_back", in->nowMs);
      }
    } else if ((in->nowMs - sm->stateEnteredMs) >= T_AWAY_MS) {
      sm_go(sm, SLEEP, "away_timeout", in->nowMs);
    }
  }

  // 4. Outputs, derived only from the (possibly new) state. Recomputed every
  //    tick, never remembered.
  uint32_t msInState = in->nowMs - sm->stateEnteredMs;

  out->displayOn = (sm->state != SLEEP);
  out->page = sm->page;
  out->stateEnteredMs = sm->stateEnteredMs;

  // Backlight.
  if (sm->state == SLEEP) {
    out->backlight = 0.0f;
  } else if (sm->state == WAKE || sm->state == ATTENTION) {
    out->backlight = BL_ATTENTION;
  } else if (sm->state == NIGHT) {
    out->backlight = BL_NIGHT;
  } else if (sm->state == AWAY_PENDING) {
    // Fade the level we were sitting at down to black across the grace window.
    float base = night ? (float)BL_NIGHT : (float)BL_PRESENT;
    float frac = (float)msInState / (float)T_AWAY_MS;
    if (frac > 1.0f) frac = 1.0f;
    out->backlight = base * (1.0f - frac);
  } else {  // PRESENT
    out->backlight = BL_PRESENT;
  }

  // Ring. Low battery shouts over the wake sweep for its first RING_LOWBATT_MS.
  if (sm->state == WAKE && in->vbatPct < VBAT_LOW_PCT && msInState < RING_LOWBATT_MS) {
    out->ringMode = RING_LOW_BATT;
  } else if (sm->state == WAKE) {
    out->ringMode = RING_WAKE_SWEEP;
  } else if (sm->state == ATTENTION) {
    out->ringMode = RING_ATTENTION;
  } else {
    out->ringMode = RING_OFF;
  }
  out->ringOn = (out->ringMode != RING_OFF);
}
