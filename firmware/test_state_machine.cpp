// =============================================================================
// Puck — test_state_machine.cpp
//
// Plain C++, no Arduino, no framework:
//     c++ -std=c++17 -Wall -o /tmp/puck_sm firmware/test_state_machine.cpp \
//         firmware/state_machine.cpp && /tmp/puck_sm
//
// Drives one scripted scenario at TICK_MS and asserts the exact transition
// sequence, plus page and ring mode at a few instants. demo/src/PORT_CHECK.md's
// node check runs the SAME scenario through state_machine.js and must produce a
// byte-identical transition log.
// =============================================================================
#include <cassert>
#include <cstdio>
#include <cstring>

#include "state_machine.h"

// --- The scenario ------------------------------------------------------------
// Levels hold until the next change; edges fire on exactly one tick.
// KEEP IN SYNC with the same function in demo/src/PORT_CHECK.md's node check.
static void scenario(uint32_t t, Inputs* in) {
  // presence
  if (t >= 50000) in->presence = false;
  else if (t >= 47000) in->presence = true;
  else if (t >= 16000) in->presence = false;
  else if (t >= 15000) in->presence = true;
  else if (t >= 12000) in->presence = false;
  else if (t >= 100) in->presence = true;
  else in->presence = false;

  // lux
  if (t >= 46500) in->lux = 1.0f;
  else if (t >= 2500) in->lux = 200.0f;
  else if (t >= 2000) in->lux = 2.0f;
  else in->lux = 200.0f;

  // battery
  if (t >= 46500) in->vbatPct = 10.0f;
  else in->vbatPct = 80.0f;

  // edges
  in->encDelta = (t == 3000) ? 1 : 0;
  in->encPressed = (t == 49000);

  // constants for this run
  in->tempC = 22.4f;
  in->rh = 46.0f;
  in->hour = 14.5f;
  in->charging = false;
  in->nowMs = t;
}

// --- Expected transition log -------------------------------------------------
struct Expect {
  uint32_t t;
  State from;
  State to;
  const char* reason;
};

static const Expect EXPECTED[] = {
    {100, SLEEP, WAKE, "presence"},
    {1600, WAKE, PRESENT, "wake_done"},
    {2000, PRESENT, NIGHT, "lux_low"},
    {2500, NIGHT, PRESENT, "lux_high"},
    {3000, PRESENT, ATTENTION, "knob"},
    {11000, ATTENTION, PRESENT, "attention_idle"},
    {12000, PRESENT, AWAY_PENDING, "presence_lost"},
    {15000, AWAY_PENDING, PRESENT, "presence_back"},
    {16000, PRESENT, AWAY_PENDING, "presence_lost"},
    {46000, AWAY_PENDING, SLEEP, "away_timeout"},
    {47000, SLEEP, WAKE, "presence"},
    {48500, WAKE, NIGHT, "wake_done_dark"},
    {49000, NIGHT, ATTENTION, "knob"},
    {50000, ATTENTION, AWAY_PENDING, "presence_lost"},
    {80000, AWAY_PENDING, SLEEP, "away_timeout"},
};
static const int EXPECTED_N = (int)(sizeof(EXPECTED) / sizeof(EXPECTED[0]));

// --- Page cycle --------------------------------------------------------------
// The crown walks one ring of PAGE_COUNT pages. Separate from the scenario
// above because that one only ever turns the knob once.
static int page_cycle_test() {
  SM sm;
  Inputs in;
  Outputs out;
  sm_init(&sm);

  in.presence = true;
  in.lux = 200.0f;
  in.tempC = 22.0f;
  in.rh = 46.0f;
  in.hour = 12.0f;
  in.encDelta = 0;
  in.encPressed = false;
  in.vbatPct = 80.0f;
  in.charging = false;

  uint32_t t = 0;
  for (; t <= T_WAKE_MS + TICK_MS; t += TICK_MS) {  // sit through WAKE into PRESENT
    in.nowMs = t;
    sm_step(&sm, &in, &out);
  }

  int failures = 0;
  if (PAGE_COUNT != 5) {
    printf("  !! PAGE_COUNT is %d, expected 5\n", PAGE_COUNT);
    failures++;
  }

  // One full lap forward visits every page in order and lands back on GLANCE.
  const Page ORDER[5] = {PAGE_DETAIL_TEMP, PAGE_DETAIL_RH, PAGE_DETAIL_BATT, PAGE_CLAUDE,
                         PAGE_GLANCE};
  for (int i = 0; i < PAGE_COUNT; i++) {
    in.encDelta = 1;
    in.nowMs = t;
    sm_step(&sm, &in, &out);
    in.encDelta = 0;
    t += TICK_MS;
    if (out.page != ORDER[i]) {
      printf("  !! +1 detent #%d gave page %d, expected %d\n", i, (int)out.page, (int)ORDER[i]);
      failures++;
    }
  }

  // And one detent back from GLANCE wraps the other way, onto the last page.
  in.encDelta = -1;
  in.nowMs = t;
  sm_step(&sm, &in, &out);
  in.encDelta = 0;
  if (out.page != PAGE_CLAUDE) {
    printf("  !! -1 detent from GLANCE gave page %d, expected PAGE_CLAUDE (%d)\n", (int)out.page,
           (int)PAGE_CLAUDE);
    failures++;
  }

  printf("  page cycle: %d pages, one lap returns to GLANCE, -1 wraps to PAGE_CLAUDE\n",
         PAGE_COUNT);
  return failures;
}

int main() {
  SM sm;
  Inputs in;
  Outputs out;
  sm_init(&sm);

  int n = 0;
  int failures = page_cycle_test();

  for (uint32_t t = 0; t <= 80100; t += TICK_MS) {
    State before = sm.state;
    scenario(t, &in);
    sm_step(&sm, &in, &out);

    if (sm.state != before) {
      printf("  %6u ms  %-12s -> %-12s  (%s)\n", (unsigned)sm.lastTransition.atMs,
             sm_state_name(sm.lastTransition.from), sm_state_name(sm.lastTransition.to),
             sm.lastTransition.reason);
      if (n >= EXPECTED_N) {
        printf("    !! unexpected extra transition\n");
        failures++;
      } else {
        if (sm.lastTransition.atMs != EXPECTED[n].t || sm.lastTransition.from != EXPECTED[n].from ||
            sm.lastTransition.to != EXPECTED[n].to ||
            strcmp(sm.lastTransition.reason, EXPECTED[n].reason) != 0) {
          printf("    !! expected %u %s->%s (%s)\n", (unsigned)EXPECTED[n].t,
                 sm_state_name(EXPECTED[n].from), sm_state_name(EXPECTED[n].to), EXPECTED[n].reason);
          failures++;
        }
      }
      n++;
    }

    // Spot checks on the outputs at specific instants.
    if (t == 200) {
      if (out.ringMode != RING_WAKE_SWEEP) { printf("    !! t=200 ring != WAKE_SWEEP\n"); failures++; }
      if (out.backlight != (float)BL_ATTENTION) { printf("    !! t=200 backlight\n"); failures++; }
    }
    if (t == 3100) {
      if (out.page != PAGE_DETAIL_TEMP) { printf("    !! t=3100 page != DETAIL_TEMP\n"); failures++; }
      if (out.ringMode != RING_ATTENTION) { printf("    !! t=3100 ring != ATTENTION\n"); failures++; }
    }
    if (t == 47100) {
      if (out.ringMode != RING_LOW_BATT) { printf("    !! t=47100 ring != LOW_BATT\n"); failures++; }
    }
    if (t == 48400) {
      if (out.ringMode != RING_LOW_BATT) { printf("    !! t=48400 ring != LOW_BATT\n"); failures++; }
    }
    if (t == 49100) {
      if (out.page != PAGE_GLANCE) { printf("    !! t=49100 page != GLANCE\n"); failures++; }
    }
    if (t == 46100) {
      if (out.displayOn) { printf("    !! t=46100 display should be off\n"); failures++; }
      if (out.backlight != 0.0f) { printf("    !! t=46100 backlight should be 0\n"); failures++; }
    }
  }

  if (n != EXPECTED_N) {
    printf("  !! got %d transitions, expected %d\n", n, EXPECTED_N);
    failures++;
  }

  printf("\n%d transitions, %d failures\n", n, failures);
  assert(failures == 0);
  printf("PASS\n");
  return 0;
}
