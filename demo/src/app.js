// app.js — wires the page: sliders → firmware inputs → sm_step (ported) → ui_draw / leds_compute (ported) → viewer.
// Battery readout is integrated from the power table (Tables.totals) at the current firmware mode; nothing here is a hand-picked number.
(() => {
  const $ = id => document.getElementById(id);
  // ---------- viewer ----------
  const glCanvas = $('gl');
  const viewer = createViewer(glCanvas, GEOM);
  $('dD').textContent = GEOM.device.D; $('dH').textContent = GEOM.device.H;
  for (const c of GEOM.concepts) { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.id} · ${c.name} (rejected)`; $('concept').appendChild(o); }
  $('inside').onchange = e => viewer.setInside(e.target.checked);
  $('concept').onchange = e => viewer.setConcept(e.target.value || null);
  $('studio').onchange = e => { document.documentElement.dataset.theme = e.target.checked ? 'light' : ''; viewer.setBackground(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()); };
  $('studio').onchange({ target: $('studio') });   // studio light is the default look; sync the viewer background to it at start
  // zoom slider (scroll wheel drives the explode amount inside the viewer)
  let explodeT = 0;
  const setExplode = t => { explodeT = Math.max(0, Math.min(1, t)); viewer.setExplode(explodeT); $('explodeval').textContent = Math.round(explodeT * 100) + '%'; };
  if (viewer.onExplode) viewer.onExplode(t => { explodeT = t; $('explodeval').textContent = Math.round(t * 100) + '%'; });
  const setZoom = t => { $('zoom').value = t; if (viewer.setZoom) viewer.setZoom(+t); };
  $('zoom').oninput = e => viewer.setZoom && viewer.setZoom(+e.target.value);
  if (viewer.setZoom) viewer.setZoom(+$('zoom').value);

  // ---------- parts list + callouts ----------
  const fmtSize = bb => bb[1].map((v, i) => (v - bb[0][i]).toFixed(1)).join(' × ') + ' mm';
  const groups = GEOM.groups.some(g => g.id === 'screws') ? GEOM.groups : GEOM.groups.concat([{ id: 'screws', name: 'Fasteners', label: 'Fasteners', bbox: null }]);
  const labelOf = g => g.label || (PARTS[g.id] ? PARTS[g.id].name.replace(/\s*\(.*$/, '').replace(/^Adafruit /, '') : g.name);
  $('partlist').innerHTML = groups.filter(g => !['body', 'lid', 'frost'].includes(g.id)).map(g => `<button data-g="${g.id}">${labelOf(g)}<span class="dim">${g.bbox ? fmtSize(g.bbox) : 'M2 hardware'}</span></button>`).join('');
  let selected = null;
  function select(id) {
    selected = id;
    document.querySelectorAll('#partlist button').forEach(x => x.classList.toggle('on', x.dataset.g === selected));
    viewer.setHighlight(selected);
    const g = groups.find(x => x.id === selected), pd = selected && PARTS[selected];
    const subs = selected ? GEOM.parts.filter(p => p.group === selected).map(p => p.name) : [];
    $('callout').hidden = !selected;
    if (selected) $('callout').innerHTML = `<b>${pd ? pd.name : (g ? g.name : selected)}</b>` + (g && g.bbox ? `<span class="dim">envelope ${fmtSize(g.bbox)} · fit ${(GEOM.fit.rows.find(r => r.part === selected) || {}).pass_ ? 'PASS' : '—'}</span>` : '') +
      (pd && pd.price ? `<span class="dim">AU$${pd.price.AU} · US$${pd.price.US}</span>` : '') + (pd && pd.i2c ? `<span class="dim">I2C ${typeof pd.i2c === 'string' ? pd.i2c : Object.values(pd.i2c).join(', ')}</span>` : '') +
      `<span class="dim">${subs.join(' · ')}</span>`;
  }
  $('partlist').onclick = e => { const b = e.target.closest('button'); if (!b) return; select(selected === b.dataset.g ? null : b.dataset.g); if (selected && !$('inside').checked) { $('inside').checked = true; viewer.setInside(true); } };
  if (viewer.onHover) viewer.onHover(g => { if (!selected) viewer.setHighlight(g); document.querySelectorAll('.lbl').forEach(l => l.classList.toggle('on', l.dataset.g === (g || selected))); });

  // ---------- floating labels (fade in with the explode amount) ----------
  const labelEls = {};
  for (const g of groups) { const el = document.createElement('span'); el.className = 'lbl'; el.dataset.g = g.id; el.textContent = labelOf(g); $('labels').appendChild(el); labelEls[g.id] = el; }
  function placeLabels() {
    const show = !$('concept').value && viewer.anchors && (explodeT > 0.08 || selected);
    const anchors = show ? viewer.anchors() : [];
    const seen = new Set();
    for (const a of anchors) { const el = labelEls[a.group]; if (!el) continue; seen.add(a.group);
      const vis = a.visible && (explodeT > 0.08 || a.group === selected);
      el.style.opacity = vis ? (a.group === selected ? 1 : Math.min(1, (explodeT - 0.08) / 0.25)) : 0;
      el.style.left = a.x + 'px'; el.style.top = (a.y - Math.min(a.r || 0, 60) - 6) + 'px'; el.style.zIndex = Math.round(1000 - (a.depth || 0)); }
    for (const id in labelEls) if (!seen.has(id)) labelEls[id].style.opacity = 0;
  }

  // ---------- tables (computed) ----------
  const pins = Tables.pins(), fit = Tables.fit();
  let power = Tables.power({ wifi: false });
  $('tab-pins').innerHTML = pins.html; $('tab-fit').innerHTML = fit.html;
  const renderPower = () => { $('tab-power').innerHTML = power.html; $('opt_wifi').onchange = e => { power = Tables.power({ wifi: e.target.checked }); renderPower(); }; };
  renderPower();
  viewer.setFitFails(fit.fails);
  $('fwconsts').innerHTML = '<table class="t"><thead><tr><th>config.h</th><th>value</th></tr></thead><tbody>' + Object.entries(FW).map(([k, v]) => `<tr><td class="mono">${k}</td><td class="mono">${v}</td></tr>`).join('') + '</tbody></table>';
  document.querySelectorAll('.tabs nav button').forEach(b => b.onclick = () => { document.querySelectorAll('.tabs nav button').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab)); });

  // ---------- firmware port ----------
  const sm = {}; sm_init(sm);
  const out = {};
  const screen = $('screen'), sctx = screen.getContext('2d', { willReadFrequently: true });
  const gfx = new GFX(sctx);                                       // Adafruit_GFX shim from ui.js (pixel-exact 5x7 font)
  const leds = Array.from({ length: FW.LED_COUNT }, () => [0, 0, 0]);
  let simMs = 0, lastReal = performance.now(), lastTickMs = 0, lastDrawMs = -1e9, lastDrawKey = '';
  let presenceState = false, encDelta = 0, encPressed = false;
  const CLAUDE_IN_SHARE = 0.88, CLAUDE_RATE_IN = 10, CLAUDE_RATE_OUT = 50;   // demo pricing: Claude Fable 5.1, USD per 1M tokens (the real device gets USD from the push script)
  const vals = () => ({ presence: +$('presence').value, lux: Math.round(Math.pow(10, +$('lux').value) - 1), temp: +$('temp').value, rh: +$('rh').value, hour: +$('hour').value, charging: $('charging').checked, speed: +$('speed').value,
    cwin: +$('cwin').value, ctok: +$('ctok').value * 1000 });
  const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const claudeOf = v => { const inT = Math.round(v.ctok * CLAUDE_IN_SHARE), outT = v.ctok - inT; return { claudeUsd: (inT * CLAUDE_RATE_IN + outT * CLAUDE_RATE_OUT) / 1e6, claudeInTok: inT, claudeOutTok: outT, claudeWindowPct: v.cwin, claudeAgeMin: 3 }; };
  function refreshLabels() { const v = vals(); $('v_presence').textContent = v.presence + ' raw (on ≥ ' + FW.PRESENCE_ON_THRESH + ', off ≤ ' + FW.PRESENCE_OFF_THRESH + ')'; $('v_lux').textContent = v.lux + ' lx'; $('v_temp').textContent = v.temp.toFixed(1) + ' °C'; $('v_rh').textContent = v.rh + ' %'; $('v_hour').textContent = fmtHour(v.hour);
    const c = claudeOf(v); $('v_cwin').textContent = v.cwin + ' %'; $('v_ctok').textContent = (v.ctok / 1000).toFixed(0) + 'k → $' + c.claudeUsd.toFixed(2); }
  document.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', refreshLabels)); refreshLabels();
  $('cw').onclick = () => { encDelta += 1; }; $('ccw').onclick = () => { encDelta -= 1; }; $('press').onclick = () => { encPressed = true; };
  window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') encDelta++; if (e.key === 'ArrowLeft') encDelta--; if (e.key === 'Enter') encPressed = true; });

  // ---------- battery: integrated from the power table at the live firmware mode ----------
  const cap = power.cap; let mAh = cap * 0.82;                      // starts at 82 % so the low-battery path is reachable by draining at 20×
  const modeOf = st => ({ SLEEP: 'SLEEP', WAKE: 'WAKE', PRESENT: 'PRESENT', NIGHT: 'NIGHT', ATTENTION: 'ATTENTION', AWAY_PENDING: 'PRESENT' })[st] || 'PRESENT';
  const stateName = s => sm_state_name(s);
  const ringModeName = m => ({ [RING_OFF]: 'off', [RING_WAKE_SWEEP]: 'wake sweep', [RING_ATTENTION]: 'attention', [RING_LOW_BATT]: 'low battery' })[m];
  const pageName = p => ({ [PAGE_GLANCE]: 'glance', [PAGE_DETAIL_TEMP]: 'temperature', [PAGE_DETAIL_RH]: 'humidity', [PAGE_DETAIL_BATT]: 'battery', [typeof PAGE_CLAUDE !== 'undefined' ? PAGE_CLAUDE : -1]: 'claude' })[p];

  // presence hysteresis — mirrors companion.ino (PRESENCE_ON_THRESH / PRESENCE_OFF_THRESH on the raw STHS34PF80 presence count)
  function presenceHyst(raw) { if (!presenceState && raw >= FW.PRESENCE_ON_THRESH) presenceState = true; else if (presenceState && raw <= FW.PRESENCE_OFF_THRESH) presenceState = false; return presenceState; }

  function tick(nowMs) {
    const v = vals();
    if (wantKnob && sm.state !== SLEEP && sm.state !== WAKE) { encDelta += 1; wantKnob = false; }
    if (wantPage !== null && sm.state !== SLEEP && sm.state !== WAKE) { const N = typeof PAGE_COUNT !== 'undefined' ? PAGE_COUNT : 4; if (sm.page !== wantPage) encDelta += ((wantPage - sm.page) % N + N) % N; else wantPage = null; }
    const inp = { presence: presenceHyst(v.presence), lux: v.lux, tempC: v.temp, rh: v.rh, hour: v.hour, encDelta, encPressed, vbatPct: Math.round(100 * mAh / cap), charging: v.charging, nowMs };
    encDelta = 0; encPressed = false;
    sm_step(sm, inp, out);
    const st = stateName(sm.state);
    const model = Object.assign({ tempC: v.temp, rh: v.rh, hour: v.hour, vbatPct: inp.vbatPct, charging: v.charging, page: out.page, state: sm.state, lux: v.lux }, claudeOf(v));
    const key = out.displayOn ? JSON.stringify([model.tempC.toFixed(1), model.rh, Math.floor(model.hour * 60), model.vbatPct, model.charging, model.page, st, model.claudeUsd.toFixed(2), model.claudeWindowPct]) : 'off';
    if (key !== lastDrawKey || nowMs - lastDrawMs >= 1000) {
      if (out.displayOn) { ui_draw(gfx, model); gfx.flush(); } else { sctx.fillStyle = '#000'; sctx.fillRect(0, 0, 240, 240); }
      lastDrawKey = key; lastDrawMs = nowMs; viewer.setScreen(screen); viewer.screenDirty = true;
    }
    viewer.setBacklight && viewer.setBacklight(out.displayOn ? out.backlight : 0);
    if (out.ringOn) leds_compute(out.ringMode, nowMs - out.stateEnteredMs, FW.LED_MAX_BRIGHTNESS, leds); else for (const l of leds) l[0] = l[1] = l[2] = 0;
    viewer.setLeds(leds);
    $('state').textContent = st; $('tins').textContent = ((nowMs - out.stateEnteredMs) / 1000).toFixed(1) + ' s';
    const t = sm.lastTransition; $('trans').textContent = t && t.to !== undefined ? `${stateName(t.from)} → ${stateName(t.to)}  (${t.reason})  @ ${(t.atMs / 1000).toFixed(1)} s` : '— (no transition yet)';
    $('outs').textContent = `display ${out.displayOn ? 'on ' + Math.round(out.backlight * 100) + '%' : 'off'} · ring ${out.ringOn ? ringModeName(out.ringMode) : 'off (rail cut)'} · page ${pageName(out.page)}`;
  }

  function battery(dtMs) {
    const mode = modeOf(stateName(sm.state)), I = power.totals[mode];
    if ($('charging').checked) mAh = Math.min(cap, mAh + 100 * dtMs / 3.6e6);       // charger current unverified (Adafruit default 100 mA class) — display only
    else mAh = Math.max(0, mAh - I * dtMs / 3.6e6);
    const pct = 100 * mAh / cap, hrs = mAh / I;
    $('batt').textContent = `${pct.toFixed(1)} %  · ${mAh.toFixed(0)} / ${cap} mAh`;
    $('battbar').style.width = pct + '%'; $('battbar').style.background = pct < FW.VBAT_LOW_PCT ? 'var(--bad)' : 'var(--ok)';
    $('battnote').textContent = $('charging').checked ? 'charging over USB-C' : `${I.toFixed(2)} mA in ${mode} → ${hrs > 48 ? (hrs / 24).toFixed(1) + ' days' : hrs.toFixed(1) + ' h'} left at this rate`;
  }

  // ---------- the story: a guided tour of the device's features ----------
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
  const setChk = (id, v) => { if ($(id).checked !== v) { $(id).checked = v; $(id).dispatchEvent(new Event('change')); } };
  let wantPage = null, wantKnob = false;                                            // the tour asks for a page; the crown turns are fed once the firmware is awake (it ignores the knob in SLEEP/WAKE)
  const gotoPage = p => { wantPage = p; };
  const cam = (yaw, pitch, dist) => viewer.camera && viewer.camera({ yaw, pitch, dist });
  const tot = power.totals, dayMah = 8 * tot.PRESENT + 50 * FW.T_ATTENTION_MS / 3.6e6 * tot.ATTENTION + 20 * FW.T_WAKE_MS / 3.6e6 * tot.WAKE + 16 * tot.SLEEP;
  const chapters = [
    { kicker: '01 · the object', title: 'Puck', line: `A Ø${GEOM.device.D} × ${GEOM.device.H} mm disc that lives on the desk, notices you, and otherwise stays quiet.`, facts: [[GEOM.device.D + ' mm', 'diameter'], [GEOM.device.H + ' mm', 'height'], ['8', 'bought modules'], ['3', 'printed parts']],
      apply() { setChk('inside', false); setExplode(0); select(null); cam(0.62, 0.46, 0); setZoom(0.35); } },
    { kicker: '02 · presence', title: 'It notices you.', line: 'A lens-free IR sensor behind a Ø6 window in the front wall wakes the puck when someone sits down.', facts: [[PARTS.presence.fov_deg + '°', 'field of view'], [PARTS.presence.range_m + ' m', 'range'], ['10 µA', 'always on'], [FW.T_WAKE_MS + ' ms', 'wake sweep']],
      apply() { set('presence', 400); set('lux', 2.5); setChk('inside', true); setExplode(0); select('presence'); cam(1.35, 0.25, 0); setZoom(0.25); } },
    { kicker: '03 · the glance', title: 'One thing worth knowing.', line: 'A round 240 × 240 display in a shallow dish shows the room in one number; the hour ring and comfort colour do the rest.', facts: [['240 × 240', 'pixels'], ['1.28″', 'GC9A01A'], [Math.round(FW.BL_PRESENT * 100) + ' %', 'backlight, present'], [Math.round(FW.BL_NIGHT * 100) + ' %', 'at night']],
      apply() { set('presence', 400); setChk('inside', false); setExplode(0); select(null); cam(0.2, 1.1, 0); setZoom(0.2); gotoPage(PAGE_GLANCE); } },
    { kicker: '04 · the halo', title: 'A halo, only when it matters.', line: 'Twenty-four LEDs under a frosted ring sweep once when you arrive and breathe while you turn the crown. Otherwise the rail is cut.', facts: [[PARTS.ring.leds, 'LEDs'], [Math.round(FW.LED_MAX_BRIGHTNESS * 100) + ' %', 'brightness cap'], [PARTS.ring.current_mA.ATTENTION + ' mA', 'while lit'], ['0 mA', 'idle']],
      apply() { set('presence', 400); setChk('inside', false); setExplode(0); select(null); cam(0.5, 0.5, 0); setZoom(0.3); wantKnob = true; } },
    { kicker: '05 · the crown', title: 'One good control.', line: 'A Bourns encoder through the right wall. Turn to page through detail, press to come back. Nothing else to learn.', facts: [['24', 'detents'], ['20 → 16 mm', 'shaft, cut'], ['M7', 'bushing'], [FW.T_ATTENTION_MS / 1000 + ' s', 'then back to glance']],
      apply() { set('presence', 400); setChk('inside', true); setExplode(0); select('encoder'); cam(-0.2, 0.3, 0); setZoom(0.2); wantKnob = true; } },
    { kicker: '06 · claude', title: 'Your Claude usage, on the desk.', line: 'A page the crown reaches: today\'s Claude Code spend and your 5-hour window, pushed from your Mac by a small script. No keys on the device.', facts: [['$/day', 'from local transcripts'], ['5 h', 'rate-limit window'], ['HTTP POST', 'tools/claude_usage_push.py'], [FW.CLAUDE_STALE_MIN !== undefined ? FW.CLAUDE_STALE_MIN + ' min' : '—', 'stale after']],
      apply() { set('presence', 400); setChk('inside', false); setExplode(0); select(null); cam(0.2, 1.1, 0); setZoom(0.2); if (typeof PAGE_CLAUDE !== 'undefined') gotoPage(PAGE_CLAUDE); } },
    { kicker: '07 · power', title: 'Days, not hours.', line: `A ${PARTS.cell.capacity_mAh} mAh cell under the Feather. The display is the only steady load; everything else sleeps.`, facts: [[(cap / tot.PRESENT).toFixed(0) + ' h', 'present, continuous'], [(cap / dayMah).toFixed(1) + ' d', 'typical day'], [(cap / tot.SLEEP / 24).toFixed(0) + ' d', 'asleep'], [tot.PRESENT.toFixed(1) + ' mA', 'present']],
      apply() { setChk('inside', true); setExplode(0.35); select('cell'); cam(0.9, 0.6, 0); setZoom(0.3); } },
    { kicker: '08 · inside', title: 'Every part comes out.', line: 'Scroll to explode. Boards first, then screws, nut and knob. Every part is the off-the-shelf module at its real size.', facts: [[GEOM.parts.filter(p => p.kind !== 'shell' && p.kind !== 'frost').length, 'sub-parts drawn'], [GEOM.fit.rows.length, 'parts fit-checked'], [GEOM.fit.verdict, 'fit'], ['0.5 mm', 'clearance rule']],
      apply() { set('presence', 0); setChk('inside', true); setExplode(1); select(null); cam(0.62, 0.5, 0); setZoom(0.55); } },
  ];
  let chapter = -1, playing = false, playTimer = 0;
  $('s_dots').innerHTML = chapters.map((c, i) => `<i data-i="${i}" title="${c.title}"></i>`).join('');
  function showChapter(i) {
    chapter = (i + chapters.length) % chapters.length; const c = chapters[chapter]; wantPage = null; wantKnob = false;
    $('s_kicker').textContent = c.kicker; $('s_title').textContent = c.title; $('s_line').textContent = c.line;
    $('s_facts').innerHTML = c.facts.map(([v, l]) => `<li><b>${v}</b><span>${l}</span></li>`).join('');
    document.querySelectorAll('#s_dots i').forEach(d => d.classList.toggle('on', +d.dataset.i === chapter));
    c.apply();
  }
  $('s_prev').onclick = () => showChapter(chapter - 1); $('s_next').onclick = () => showChapter(chapter + 1);
  $('s_dots').onclick = e => { if (e.target.dataset.i !== undefined) showChapter(+e.target.dataset.i); };
  $('s_play').onclick = () => { playing = !playing; $('s_play').textContent = playing ? '❚❚' : '▶'; clearInterval(playTimer); if (playing) { showChapter(chapter + 1); playTimer = setInterval(() => showChapter(chapter + 1), 7000); } };
  showChapter(0);

  function advance(dtReal) {                                       // one simulation step of dtReal real-ms (× sim speed)
    const v = vals(); simMs += dtReal * v.speed;
    while (simMs - lastTickMs >= FW.TICK_MS) { lastTickMs += FW.TICK_MS; tick(lastTickMs); }
    battery(dtReal * v.speed);
    viewer.render(simMs);
    placeLabels();
  }
  function frame(real) {
    const dt = Math.min(real - lastReal, 100); lastReal = real;   // a hidden tab pauses the sim instead of jumping
    advance(dt);
    requestAnimationFrame(frame);
  }
  window.__puck = { advance, sm, out, leds, viewer, showChapter, setExplode };   // deterministic hook for the end-to-end check (no UI)
  window.addEventListener('resize', () => viewer.resize()); viewer.resize();
  requestAnimationFrame(frame);
})();
