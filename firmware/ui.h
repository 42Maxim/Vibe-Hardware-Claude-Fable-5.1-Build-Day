// =============================================================================
// Puck — ui.h
//
// One entry point. Everything is drawn with the restricted primitive set
// (fillScreen, fillCircle, drawCircle, fillRect, drawLine, fillTriangle,
// drawFastHLine, drawFastVLine, setCursor, setTextSize, setTextColor, print)
// so demo/src/ui.js can reproduce it pixel-for-pixel with a small GFX shim.
// No sensor reads, no timing: the caller hands in a finished model.
// =============================================================================
#ifndef PUCK_UI_H
#define PUCK_UI_H

#include <Adafruit_GFX.h>
#include <stdint.h>

#include "config.h"
#include "state_machine.h"

typedef struct {
  float tempC;
  float rh;
  float hour;      // 0..23.999
  float vbatPct;   // 0..100
  bool charging;
  Page page;
  State state;     // drives the tiny glyph at the top
  float lux;       // only used to pick full-contrast vs dim hour ticks
  // --- PAGE_CLAUDE: pushed in over HTTP, never computed on the device -------
  float claudeUsd;          // today's Claude Code spend, USD
  uint32_t claudeInTok;     // today's input tokens (incl. cache read + write)
  uint32_t claudeOutTok;    // today's output tokens
  int claudeWindowPct;      // 5-hour rate-limit window utilisation, 0..100; -1 = unknown
  uint16_t claudeAgeMin;    // minutes since the last push; 65535 = never received
} UiModel;

void ui_draw(Adafruit_GFX& g, const UiModel& m);

#endif // PUCK_UI_H
