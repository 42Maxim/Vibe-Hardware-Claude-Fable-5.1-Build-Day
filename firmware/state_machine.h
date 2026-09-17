// =============================================================================
// Puck — state_machine.h
//
// Pure logic. NO Arduino, NO hardware, NO STL, no classes: C-style structs and
// two free functions, so demo/src/state_machine.js can be a mechanical
// line-for-line port. Everything tunable comes from config.h.
// =============================================================================
#ifndef PUCK_STATE_MACHINE_H
#define PUCK_STATE_MACHINE_H

#include <stdint.h>

#include "config.h"

// --- States ------------------------------------------------------------------
typedef enum {
  SLEEP = 0,        // display off, ring rail off, deep sleep
  WAKE = 1,         // 1.5 s greeting: full backlight + ring sweep
  PRESENT = 2,      // someone is at the desk, lit room
  NIGHT = 3,        // someone is at the desk, dark room
  ATTENTION = 4,    // hand on the knob
  AWAY_PENDING = 5  // presence dropped, fading out before sleep
} State;

// --- Ring animation modes ----------------------------------------------------
typedef enum {
  RING_OFF = 0,
  RING_WAKE_SWEEP = 1,
  RING_ATTENTION = 2,
  RING_LOW_BATT = 3
} RingMode;

// --- Display pages (the knob cycles these) -----------------------------------
typedef enum {
  PAGE_GLANCE = 0,
  PAGE_DETAIL_TEMP = 1,
  PAGE_DETAIL_RH = 2,
  PAGE_DETAIL_BATT = 3,
  PAGE_CLAUDE = 4   // today's Claude Code usage, pushed in over HTTP
} Page;

#define PAGE_COUNT 5

// --- Inputs: everything the world tells us, already conditioned --------------
typedef struct {
  bool presence;     // STHS presence flag AFTER the PRESENCE_ON/OFF hysteresis
  float lux;         // VEML7700 lux
  float tempC;       // SHT41 temperature, degC
  float rh;          // SHT41 relative humidity, %
  float hour;        // local hour of day, 0..23.999
  int encDelta;      // encoder detents since the last tick, signed
  bool encPressed;   // encoder push switch, EDGE (true for exactly one tick)
  float vbatPct;     // MAX17048 state of charge, 0..100
  bool charging;     // MAX17048 charge rate > 0
  uint32_t nowMs;    // millis()
} Inputs;

// --- Outputs: everything the hardware layer should apply ---------------------
typedef struct {
  bool displayOn;
  float backlight;   // 0..1, feed to LEDC
  bool ringOn;       // false => cut the switched rail (GPIO7 LOW)
  RingMode ringMode;
  Page page;
  uint32_t stateEnteredMs;
} Outputs;

// --- Transition log (one entry, the most recent) -----------------------------
typedef struct {
  State from;
  State to;
  const char* reason;
  uint32_t atMs;
} Transition;

// --- The machine -------------------------------------------------------------
typedef struct {
  State state;
  uint32_t stateEnteredMs;
  uint32_t lastInputMs;   // last tick that carried encoder activity
  Page page;
  bool nightLatch;        // hysteresised "the room is dark"
  Transition lastTransition;
} SM;

void sm_init(SM* sm);
void sm_step(SM* sm, const Inputs* in, Outputs* out);

// Exposed for logging/tests only; no hardware, no side effects.
const char* sm_state_name(State s);

#endif // PUCK_STATE_MACHINE_H
