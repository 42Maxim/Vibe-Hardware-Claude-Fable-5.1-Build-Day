// =============================================================================
// Puck — power.h : fuel gauge reads and the deep-sleep exit.
// This file DOES touch hardware; nothing here is ported to the demo.
// =============================================================================
#ifndef PUCK_POWER_H
#define PUCK_POWER_H

#include <Adafruit_GC9A01A.h>
#include <stdint.h>

#include "config.h"

bool power_begin();            // MAX17048 over the shared I2C bus
float power_pct();             // 0..100, state of charge
bool power_charging();         // chargeRate() > 0
bool power_woke_from_deep_sleep();  // true if this boot came from ext1/timer

// Cuts the ring rail and the backlight, puts the panel to sleep, arms the wake
// sources and does not return.
void power_enter_deep_sleep(Adafruit_GC9A01A& tft);

#endif // PUCK_POWER_H
