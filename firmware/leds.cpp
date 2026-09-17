// =============================================================================
// Puck — leds.cpp
//
// Pure. Uses double maths throughout (not float) so demo/src/leds.js, which has
// only doubles, produces byte-identical output.
// =============================================================================
#include "leds.h"

#include <math.h>

// Scale one channel by v (0..1) and the global cap, then round to a byte.
static uint8_t led_scale(int channel, double v, double cap) {
  double x = (double)channel * v * cap;
  if (x < 0.0) x = 0.0;
  if (x > 255.0) x = 255.0;
  return (uint8_t)(x + 0.5);
}

void leds_compute(RingMode mode, uint32_t msInState, float brightnessCap, uint8_t out[LED_COUNT][3]) {
  double cap = (double)brightnessCap;
  double t = (double)msInState;

  if (mode == RING_WAKE_SWEEP) {
    // One warm-white comet lap in LED_SWEEP_MS, then the whole thing fades.
    double head = t / (double)LED_SWEEP_MS * (double)LED_COUNT;
    double fade = 1.0;
    if (head > (double)LED_COUNT) {
      head = (double)LED_COUNT;
      fade = 1.0 - (t - (double)LED_SWEEP_MS) / (double)LED_SWEEP_FADE_MS;
      if (fade < 0.0) fade = 0.0;
    }
    for (int i = 0; i < LED_COUNT; i++) {
      double d = head - (double)i;  // pixels behind the head, wrapped
      while (d < 0.0) d += (double)LED_COUNT;
      while (d >= (double)LED_COUNT) d -= (double)LED_COUNT;
      double v = 0.0;
      if (d <= (double)LED_TAIL) v = 1.0 - d / (double)LED_TAIL;
      v = v * fade;
      out[i][0] = led_scale(LED_WARM_R, v, cap);
      out[i][1] = led_scale(LED_WARM_G, v, cap);
      out[i][2] = led_scale(LED_WARM_B, v, cap);
    }

  } else if (mode == RING_ATTENTION) {
    // Whole ring breathing amber, never fully dark.
    double ph = fmod(t, (double)LED_BREATH_MS) / (double)LED_BREATH_MS;
    double s = 0.5 * (1.0 - cos(2.0 * M_PI * ph));
    double v = (double)LED_BREATH_FLOOR + (1.0 - (double)LED_BREATH_FLOOR) * s;
    for (int i = 0; i < LED_COUNT; i++) {
      out[i][0] = led_scale(LED_AMBER_R, v, cap);
      out[i][1] = led_scale(LED_AMBER_G, v, cap);
      out[i][2] = led_scale(LED_AMBER_B, v, cap);
    }

  } else if (mode == RING_LOW_BATT) {
    // LED_PULSE_COUNT red pulses, then dark for the rest of the window.
    int pulse = (int)(t / (double)LED_PULSE_MS);
    double v = 0.0;
    if (pulse < LED_PULSE_COUNT) {
      double ph = fmod(t, (double)LED_PULSE_MS) / (double)LED_PULSE_MS;
      v = 0.5 * (1.0 - cos(2.0 * M_PI * ph));
    }
    for (int i = 0; i < LED_COUNT; i++) {
      out[i][0] = led_scale(LED_RED_R, v, cap);
      out[i][1] = led_scale(LED_RED_G, v, cap);
      out[i][2] = led_scale(LED_RED_B, v, cap);
    }

  } else {  // RING_OFF
    for (int i = 0; i < LED_COUNT; i++) {
      out[i][0] = 0;
      out[i][1] = 0;
      out[i][2] = 0;
    }
  }
}
