// =============================================================================
// Puck — ui.cpp
//
// demo/src/ui.js is a line-for-line port of this file: same helpers, same
// order, same primitives. Rules that keep the two identical:
//   * text goes through print() only, default 5x7 glyphs, sizes 1..4
//   * numbers are formatted by hand (integer maths), never by %f, so C++ and
//     JS round the same way
//   * every angle/coordinate is computed in double and rounded with
//     floor(x + 0.5), which JS's Math.floor(x + 0.5) matches exactly
// =============================================================================
#include "ui.h"

#include <math.h>
#include <stdio.h>

// --- number formatting (integer maths, identical in JS) ----------------------

// v -> "23"   (round half up, non-negative values only)
static void ui_fmt0(char* buf, double v) {
  int n = (int)floor(v + 0.5);
  snprintf(buf, 8, "%d", n);
}

// v -> "22.4" (round half up, non-negative values only)
static void ui_fmt1(char* buf, double v) {
  int tenths = (int)floor(v * 10.0 + 0.5);
  snprintf(buf, 8, "%d.%d", tenths / 10, tenths % 10);
}

// 640 -> "640", 812000 -> "812K", 1240000 -> "1.2M" (integer maths, identical in JS)
static void ui_fmt_tok(char* buf, uint32_t v) {
  if (v < 1000u) {
    snprintf(buf, 8, "%u", (unsigned)v);
  } else if (v < 999500u) {   // above this the K form would round to "1000K"
    snprintf(buf, 8, "%uK", (unsigned)((v + 500u) / 1000u));
  } else {
    uint32_t tenths = (v + 50000u) / 100000u;
    snprintf(buf, 8, "%u.%uM", (unsigned)(tenths / 10u), (unsigned)(tenths % 10u));
  }
}

static int ui_strlen(const char* s) {
  int n = 0;
  while (s[n] != 0) n++;
  return n;
}

// --- colour ------------------------------------------------------------------

static uint16_t ui_accent(const UiModel& m) {
  if (m.tempC < TEMP_COMFORT_LO || m.tempC > TEMP_COMFORT_HI) return COL_AMBER;
  if (m.rh < RH_COMFORT_LO || m.rh > RH_COMFORT_HI) return COL_AMBER;
  return COL_GREEN;
}

// --- text --------------------------------------------------------------------

// Centre a string on cx. Adafruit advances 6*size per glyph, so the inked width
// of n glyphs is n*6*size - size (the last inter-character column is not drawn).
static void ui_print_centred(Adafruit_GFX& g, const char* s, int cx, int y, int size, uint16_t color) {
  int w = ui_strlen(s) * 6 * size - size;
  g.setTextSize(size);
  g.setTextColor(color);
  g.setCursor(cx - w / 2, y);
  g.print(s);
}

// Print at an explicit left edge and return the x just past the last glyph.
static int ui_print_at(Adafruit_GFX& g, const char* s, int x, int y, int size, uint16_t color) {
  g.setTextSize(size);
  g.setTextColor(color);
  g.setCursor(x, y);
  g.print(s);
  return x + ui_strlen(s) * 6 * size - size;
}

// --- the 24-tick hour ring ---------------------------------------------------

static void ui_hour_ring(Adafruit_GFX& g, const UiModel& m) {
  int cur = (int)m.hour;
  uint16_t spent = (m.lux >= LUX_DAY) ? COL_INK : COL_DIM;  // daylight: full contrast
  for (int i = 0; i < 24; i++) {
    double a = (-90.0 + 15.0 * (double)i) * M_PI / 180.0;
    double ca = cos(a);
    double sa = sin(a);
    int rIn = (i == cur) ? UI_TICK_R_IN_NOW : UI_TICK_R_IN;
    uint16_t col = COL_FAINT;
    if (i < cur) col = spent;
    if (i == cur) col = ui_accent(m);
    int x0 = (int)floor((double)SCREEN_CX + (double)UI_TICK_R_OUT * ca + 0.5);
    int y0 = (int)floor((double)SCREEN_CY + (double)UI_TICK_R_OUT * sa + 0.5);
    int x1 = (int)floor((double)SCREEN_CX + (double)rIn * ca + 0.5);
    int y1 = (int)floor((double)SCREEN_CY + (double)rIn * sa + 0.5);
    g.drawLine(x0, y0, x1, y1, col);
  }
}

// --- the tiny state glyph ----------------------------------------------------

static void ui_state_glyph(Adafruit_GFX& g, State s) {
  int cx = SCREEN_CX;
  int y = UI_GLYPH_Y;
  if (s == SLEEP) {
    g.drawFastHLine(cx - 4, y, 9, COL_FAINT);
  } else if (s == WAKE) {
    g.fillRect(cx - 3, y - 3, 7, 7, COL_INK);
  } else if (s == PRESENT) {
    g.fillCircle(cx, y, 3, COL_INK);
  } else if (s == NIGHT) {
    g.drawCircle(cx, y, 3, COL_DIM);
  } else if (s == ATTENTION) {
    g.fillTriangle(cx, y - 4, cx + 4, y + 3, cx - 4, y + 3, COL_AMBER);
  } else {  // AWAY_PENDING
    g.drawFastHLine(cx - 4, y, 9, COL_DIM);
  }
}

// --- the humidity bar --------------------------------------------------------

static void ui_rh_bar(Adafruit_GFX& g, const UiModel& m) {
  int x = SCREEN_CX - UI_BAR_W / 2;
  double v = m.rh;
  if (v < 0.0) v = 0.0;
  if (v > 100.0) v = 100.0;
  int w = (int)floor((double)UI_BAR_W * v / 100.0 + 0.5);
  uint16_t col = (m.rh < RH_COMFORT_LO || m.rh > RH_COMFORT_HI) ? COL_AMBER : COL_GREEN;
  g.fillRect(x, UI_BAR_Y, UI_BAR_W, UI_BAR_H, COL_FAINT);
  if (w > 0) g.fillRect(x, UI_BAR_Y, w, UI_BAR_H, col);
}

// --- the 2 px battery pip ----------------------------------------------------

static void ui_batt_pip(Adafruit_GFX& g, const UiModel& m) {
  int x = SCREEN_CX - UI_PIP_W / 2;
  double v = m.vbatPct;
  if (v < 0.0) v = 0.0;
  if (v > 100.0) v = 100.0;
  int w = (int)floor((double)UI_PIP_W * v / 100.0 + 0.5);
  uint16_t col = (m.vbatPct < VBAT_LOW_PCT) ? COL_RED : COL_DIM;
  g.fillRect(x, UI_PIP_Y, UI_PIP_W, 2, COL_FAINT);
  if (w > 0) g.fillRect(x, UI_PIP_Y, w, 2, col);
  // Charging: a small filled arrow to the right of the pip.
  if (m.charging) {
    int ax = x + UI_PIP_W + 6;
    g.fillTriangle(ax, UI_PIP_Y - 3, ax + 5, UI_PIP_Y + 1, ax, UI_PIP_Y + 5, COL_GREEN);
  }
}

// --- the 5-hour rate-limit window bar ----------------------------------------
// Same footprint as the humidity bar. An unknown percentage (-1, which is what
// the push script sends because the window is not derivable from the local
// transcripts) draws as an outline: the slot stays, the claim does not.
static void ui_claude_bar(Adafruit_GFX& g, int pct) {
  int x = SCREEN_CX - UI_BAR_W / 2;
  if (pct < 0) {
    g.drawFastHLine(x, UI_BAR_Y, UI_BAR_W, COL_FAINT);
    g.drawFastHLine(x, UI_BAR_Y + UI_BAR_H - 1, UI_BAR_W, COL_FAINT);
    g.drawFastVLine(x, UI_BAR_Y, UI_BAR_H, COL_FAINT);
    g.drawFastVLine(x + UI_BAR_W - 1, UI_BAR_Y, UI_BAR_H, COL_FAINT);
    return;
  }
  int v = pct;
  if (v > 100) v = 100;
  int w = (int)floor((double)UI_BAR_W * (double)v / 100.0 + 0.5);
  g.fillRect(x, UI_BAR_Y, UI_BAR_W, UI_BAR_H, COL_FAINT);
  if (w > 0) g.fillRect(x, UI_BAR_Y, w, UI_BAR_H, COL_CLAUDE);
}

// --- the degree mark (a 2 px ring, drawn not printed) ------------------------

static void ui_degree(Adafruit_GFX& g, int x, int y, uint16_t col) {
  g.drawCircle(x, y, 2, col);
}

// --- pages -------------------------------------------------------------------

// Glance: the temperature, rounded, and nothing else shouting.
static void ui_page_glance(Adafruit_GFX& g, const UiModel& m) {
  char buf[8];
  ui_fmt0(buf, m.tempC);
  int n = ui_strlen(buf);
  int wNum = n * 24 - 4;            // size 4: 24 px advance, 20 px inked
  int wUnit = 6 + 2 + 12 - 2;       // degree ring + gap + one size-2 glyph
  int left = SCREEN_CX - (wNum + 4 + wUnit) / 2;
  ui_print_at(g, buf, left, UI_BIG_Y, 4, COL_INK);
  int ux = left + wNum + 4;
  uint16_t acc = ui_accent(m);
  ui_degree(g, ux + 2, UI_BIG_Y + 3, acc);
  ui_print_at(g, "C", ux + 8, UI_BIG_Y + 2, 2, acc);
  ui_rh_bar(g, m);
  ui_batt_pip(g, m);
}

// Detail pages: a dim label, one value at size 3, and the matching indicator.
static void ui_page_temp(Adafruit_GFX& g, const UiModel& m) {
  char buf[8];
  ui_fmt1(buf, m.tempC);
  ui_print_centred(g, "TEMP", SCREEN_CX, UI_LABEL_Y, 1, COL_DIM);
  ui_print_centred(g, buf, SCREEN_CX, UI_BIG_Y + 4, 3, COL_INK);
  ui_print_centred(g, "DEG C", SCREEN_CX, UI_BAR_Y, 1, ui_accent(m));
  ui_batt_pip(g, m);
}

static void ui_page_rh(Adafruit_GFX& g, const UiModel& m) {
  char buf[8];
  ui_fmt0(buf, m.rh);
  ui_print_centred(g, "HUMIDITY", SCREEN_CX, UI_LABEL_Y, 1, COL_DIM);
  ui_print_centred(g, buf, SCREEN_CX, UI_BIG_Y, 4, COL_INK);
  ui_print_centred(g, "PCT RH", SCREEN_CX, UI_BAR_Y - 14, 1, COL_DIM);
  ui_rh_bar(g, m);
  ui_batt_pip(g, m);
}

static void ui_page_batt(Adafruit_GFX& g, const UiModel& m) {
  char buf[8];
  ui_fmt0(buf, m.vbatPct);
  ui_print_centred(g, "BATTERY", SCREEN_CX, UI_LABEL_Y, 1, COL_DIM);
  uint16_t col = (m.vbatPct < VBAT_LOW_PCT) ? COL_RED : COL_INK;
  ui_print_centred(g, buf, SCREEN_CX, UI_BIG_Y, 4, col);
  ui_print_centred(g, "PCT", SCREEN_CX, UI_BAR_Y - 14, 1, COL_DIM);
  ui_batt_pip(g, m);
}

// Claude: today's spend, the token split, and the 5-hour window. Everything on
// this page arrives by HTTP POST; when it is older than CLAUDE_STALE_MIN the
// numbers drop to the dim colour rather than disappearing — a stale number is
// still worth something, it just should not read as live.
static void ui_page_claude(Adafruit_GFX& g, const UiModel& m) {
  bool stale = (m.claudeAgeMin > CLAUDE_STALE_MIN);
  uint16_t ink = stale ? COL_DIM : COL_INK;

  ui_print_centred(g, "CLAUDE", SCREEN_CX, UI_LABEL_Y, 1, COL_DIM);

  // "$4.2" — one decimal, in the size-3 slot the temperature detail page uses.
  char buf[8];
  char money[10];
  ui_fmt1(buf, m.claudeUsd);
  money[0] = '$';
  int n = ui_strlen(buf);
  for (int i = 0; i < n; i++) money[1 + i] = buf[i];
  money[1 + n] = 0;
  ui_print_centred(g, money, SCREEN_CX, UI_BIG_Y + 4, 3, ink);

  // "IN 812K - OUT 96K". ASCII only, deliberately: a UTF-8 middot is two bytes
  // to C++'s print() and one code unit to JS's, so the two ports would diverge.
  char tin[8];
  char tout[8];
  char line[32];
  ui_fmt_tok(tin, m.claudeInTok);
  ui_fmt_tok(tout, m.claudeOutTok);
  snprintf(line, sizeof(line), "IN %s - OUT %s", tin, tout);
  ui_print_centred(g, line, SCREEN_CX, UI_BAR_Y - 14, 1, stale ? COL_FAINT : COL_DIM);

  ui_claude_bar(g, m.claudeWindowPct);
  ui_batt_pip(g, m);
}

// --- entry point -------------------------------------------------------------

void ui_draw(Adafruit_GFX& g, const UiModel& m) {
  g.fillScreen(COL_BG);
  ui_hour_ring(g, m);
  ui_state_glyph(g, m.state);
  if (m.page == PAGE_DETAIL_TEMP) {
    ui_page_temp(g, m);
  } else if (m.page == PAGE_DETAIL_RH) {
    ui_page_rh(g, m);
  } else if (m.page == PAGE_DETAIL_BATT) {
    ui_page_batt(g, m);
  } else if (m.page == PAGE_CLAUDE) {
    ui_page_claude(g, m);
  } else {
    ui_page_glance(g, m);
  }
}
