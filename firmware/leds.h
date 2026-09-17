// =============================================================================
// Puck — leds.h
//
// Pure function: ring mode + time in state -> 24 RGB triples. No hardware, no
// Adafruit_NeoPixel, so demo/src/leds.js is a line-for-line port.
// The caller is responsible for the GRB byte order on the wire.
// =============================================================================
#ifndef PUCK_LEDS_H
#define PUCK_LEDS_H

#include <stdint.h>

#include "state_machine.h"  // RingMode

// out[i][0..2] = R,G,B for pixel i, already scaled by brightnessCap.
void leds_compute(RingMode mode, uint32_t msInState, float brightnessCap, uint8_t out[LED_COUNT][3]);

#endif // PUCK_LEDS_H
