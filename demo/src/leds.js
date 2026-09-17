// ===== PORT BOUNDARY: mirrors firmware/leds.cpp — same functions, same order; edit config.h, not this file, to change timings =====
//
// Plain script, no modules. Constants come from the global FW (generated from
// firmware/config.h). firmware/leds.cpp deliberately does all its maths in
// double, so these two produce byte-identical output.
//
// leds_compute returns an array of LED_COUNT [r,g,b] triples (the C version
// fills a caller-supplied uint8_t out[LED_COUNT][3]).

// Scale one channel by v (0..1) and the global cap, then round to a byte.
function led_scale(channel, v, cap) {
  let x = channel * v * cap;
  if (x < 0.0) x = 0.0;
  if (x > 255.0) x = 255.0;
  return Math.floor(x + 0.5);
}

function leds_compute(mode, msInState, brightnessCap, out) {
  // The C signature is `float brightnessCap`, so the value is narrowed to
  // single precision before the double maths starts. Math.fround reproduces
  // that narrowing exactly — without it the cap is a hair smaller here and a
  // handful of channels round one step differently.
  const cap = Math.fround(brightnessCap);
  const t = msInState;

  if (out === undefined) {
    out = [];
    for (let i = 0; i < FW.LED_COUNT; i++) out.push([0, 0, 0]);
  }

  if (mode === RING_WAKE_SWEEP) {
    // One warm-white comet lap in LED_SWEEP_MS, then the whole thing fades.
    let head = t / FW.LED_SWEEP_MS * FW.LED_COUNT;
    let fade = 1.0;
    if (head > FW.LED_COUNT) {
      head = FW.LED_COUNT;
      fade = 1.0 - (t - FW.LED_SWEEP_MS) / FW.LED_SWEEP_FADE_MS;
      if (fade < 0.0) fade = 0.0;
    }
    for (let i = 0; i < FW.LED_COUNT; i++) {
      let d = head - i;  // pixels behind the head, wrapped
      while (d < 0.0) d += FW.LED_COUNT;
      while (d >= FW.LED_COUNT) d -= FW.LED_COUNT;
      let v = 0.0;
      if (d <= FW.LED_TAIL) v = 1.0 - d / FW.LED_TAIL;
      v = v * fade;
      out[i][0] = led_scale(FW.LED_WARM_R, v, cap);
      out[i][1] = led_scale(FW.LED_WARM_G, v, cap);
      out[i][2] = led_scale(FW.LED_WARM_B, v, cap);
    }

  } else if (mode === RING_ATTENTION) {
    // Whole ring breathing amber, never fully dark.
    const ph = (t % FW.LED_BREATH_MS) / FW.LED_BREATH_MS;
    const s = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * ph));
    const v = FW.LED_BREATH_FLOOR + (1.0 - FW.LED_BREATH_FLOOR) * s;
    for (let i = 0; i < FW.LED_COUNT; i++) {
      out[i][0] = led_scale(FW.LED_AMBER_R, v, cap);
      out[i][1] = led_scale(FW.LED_AMBER_G, v, cap);
      out[i][2] = led_scale(FW.LED_AMBER_B, v, cap);
    }

  } else if (mode === RING_LOW_BATT) {
    // LED_PULSE_COUNT red pulses, then dark for the rest of the window.
    const pulse = Math.trunc(t / FW.LED_PULSE_MS);
    let v = 0.0;
    if (pulse < FW.LED_PULSE_COUNT) {
      const ph = (t % FW.LED_PULSE_MS) / FW.LED_PULSE_MS;
      v = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * ph));
    }
    for (let i = 0; i < FW.LED_COUNT; i++) {
      out[i][0] = led_scale(FW.LED_RED_R, v, cap);
      out[i][1] = led_scale(FW.LED_RED_G, v, cap);
      out[i][2] = led_scale(FW.LED_RED_B, v, cap);
    }

  } else {  // RING_OFF
    for (let i = 0; i < FW.LED_COUNT; i++) {
      out[i][0] = 0;
      out[i][1] = 0;
      out[i][2] = 0;
    }
  }
  return out;
}
