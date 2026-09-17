// tables.js — the three computations: pin budget, fit, power. All computed at load from PARTS / GEOM / FW, nothing hand-typed.
const Tables = (() => {
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const table = (head, rows, cls='') => `<table class="t ${cls}"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.cls||''}">${r.c.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const verdict = (ok, txt) => `<div class="verdict ${ok?'ok':'bad'}">${ok?'PASS':'FAIL'} — ${esc(txt)}</div>`;

  // ---- 1. pin budget ----
  const STRAPPING = {0:'strapping (boot)', 3:'strapping (JTAG sel) — fine as SDA, keep pulled up', 45:'strapping', 46:'strapping'};
  const ADC2 = new Set([11,12,13,14,15,16,17,18,19,20]);          // ESP32-S3 ADC2 pins: unusable as ADC while Wi-Fi is on (we use them as digital)
  function pins() {
    const rows = [], seen = {}, addr = {};
    let conflicts = 0;
    for (const p of PARTS.pins) {
      const dup = seen[p.gpio]; seen[p.gpio] = (seen[p.gpio]||0) + 1;
      const notes = [];
      if (dup) { notes.push('DUPLICATE GPIO'); conflicts++; }
      if (STRAPPING[p.gpio]) notes.push(STRAPPING[p.gpio]);
      if (ADC2.has(p.gpio) && /encoder|INT/i.test(p.to)) notes.push('ADC2 pin — digital use only (ok)');
      for (const a of (p.to.match(/0x[0-9A-Fa-f]{2}/g) || [])) { addr[a] = (addr[a]||[]).concat(p.to.split(':')[0]); }
      rows.push({ c: [p.gpio, esc(p.feather), esc(p.to), notes.join('; ')], cls: dup ? 'bad' : (/spare/.test(p.to) ? 'dim' : '') });
    }
    // I2C address collisions on the bus (each address must be unique)
    const bus = {};
    for (const p of PARTS.pins) if (/I2C SDA/.test(p.to)) for (const m of p.to.matchAll(/([A-Za-z0-9]+) \((0x[0-9A-Fa-f]{2})[^)]*\)/g)) (bus[m[2]] = bus[m[2]]||[]).push(m[1]);
    const i2cRows = Object.entries(bus).map(([a, devs]) => ({ c: [a, devs.join(', '), devs.length > 1 ? 'COLLISION' : 'ok'], cls: devs.length > 1 ? 'bad' : '' }));
    const collisions = i2cRows.filter(r => r.cls === 'bad').length;
    const used = PARTS.pins.filter(p => !/spare|unused|reserved/.test(p.to)).length;
    const html = table(['GPIO','Feather','Assigned to','Notes'], rows) +
      `<h4>I2C bus (SDA 3 / SCL 4)</h4>` + table(['Address','Devices','Status'], i2cRows) +
      `<ul class="notes">${PARTS.i2c_notes.map(n=>`<li>${esc(n)}</li>`).join('')}<li>${esc(PARTS.pins_src)}</li></ul>` +
      verdict(conflicts === 0 && collisions === 0, `${used} pins used of ${PARTS.pins.length} listed, ${PARTS.pins.length - used} spare; ${conflicts} GPIO conflicts, ${collisions} I2C collisions on the bus (the two known collisions are kept OFF the bus, see notes).`);
    return { html, ok: conflicts === 0 && collisions === 0 };
  }

  // ---- 2. fit (computed in geometry/device.py with exact booleans; re-checked here against the cavity) ----
  function fit() {
    const f = GEOM.fit, R = f.cavity.radius, [z0, z1] = f.cavity.z;
    const rows = f.rows.map(r => {
      const bb = r.bbox, sz = bb[1].map((v,i)=> (v-bb[0][i]).toFixed(1)).join(' × ');
      // page-side re-check: every AABB corner inside the cavity cylinder (skip parts that live in the lid/wall by design)
      const inLid = r.part === 'ring', crossesWall = r.part === 'encoder';
      let rmax = 0; for (const x of [bb[0][0], bb[1][0]]) for (const y of [bb[0][1], bb[1][1]]) rmax = Math.max(rmax, Math.hypot(x, y));
      const recheck = inLid || crossesWall ? 'n/a' : (rmax <= R + 0.01 && bb[0][2] >= z0 - 0.01 && bb[1][2] <= z1 + 0.01 ? 'inside' : 'OUTSIDE');
      return { c: [r.part, sz, `[${bb[0].map(v=>v.toFixed(1)).join(', ')}] → [${bb[1].map(v=>v.toFixed(1)).join(', ')}]`, r.wall_keepout_mm3.toFixed(2), r.nearest, r.aabb_gap_mm.toFixed(2), r.clear_ok ? 'ok' : 'NO', recheck, r.pass_ ? 'PASS' : 'FAIL'], cls: r.pass_ ? '' : 'bad' };
    });
    const html = `<p class="notes">Cavity Ø${2*R} mm, z ${z0}–${z1}. Rule: ≥ ${f.rule_mm} mm to the wall and to every neighbour, exact boolean intersections (geometry/device.py). ${esc(f.note)}</p>` +
      table(['Part','Size (mm)','Bounding box (mm)','Wall keep-out ∩ (mm³)','Nearest','AABB gap','Clear','Page re-check','Result'], rows) +
      verdict(f.verdict === 'PASS', f.verdict === 'PASS' ? 'every component is inside the internal volume with ≥ 0.5 mm clearance' : 'see red rows');
    return { html, ok: f.verdict === 'PASS', fails: f.rows.filter(r => !r.pass_).map(r => r.part) };
  }

  // ---- 3. power ----
  const MODES = ['SLEEP','PRESENT','NIGHT','ATTENTION','WAKE'];
  let includeOptional = false;                                  // Wi-Fi usage push (CLAUDE_WIFI_ENABLED) is off by default
  const partsWithCurrent = () => Object.values(PARTS).filter(p => p && p.current_mA && (!p.optional || includeOptional));
  function totals() { const t = {}; for (const m of MODES) t[m] = partsWithCurrent().reduce((s,p)=>s+p.current_mA[m], 0); return t; }
  function power(opts) {
    includeOptional = !!(opts && opts.wifi);
    const cap = PARTS.cell.capacity_mAh, t = totals();
    const short = n => esc(n.replace(/\s*\(.*$/, '').replace(/^Adafruit /, ''));
    const rows = partsWithCurrent().map(p => ({ c: [short(p.name), ...MODES.map(m => p.current_mA[m] < 0.01 ? p.current_mA[m].toFixed(4) : p.current_mA[m].toFixed(2))] }));
    rows.push({ c: ['<b>Total (mA)</b>', ...MODES.map(m => `<b>${t[m].toFixed(2)}</b>`)], cls: 'sum' });
    rows.push({ c: [`<b>Runtime on ${cap} mAh</b>`, ...MODES.map(m => `<b>${hours(cap / t[m])}</b>`)], cls: 'sum' });
    rows.push({ c: ['Lasts a working day (8 h)?', ...MODES.map(m => cap / t[m] >= 8 ? 'yes' : (m === 'ATTENTION' || m === 'WAKE' ? 'no — burst only' : 'NO'))], cls: '' });
    const sources = `<h4>Sources</h4><ul class="notes">${partsWithCurrent().map(p => `<li><b>${short(p.name)}</b>: ${esc(p.current_src||'')}</li>`).join('')}</ul>`;
    // a realistic day: 8 h PRESENT, 50 crown interactions of T_ATTENTION_MS, 20 wake sweeps of T_WAKE_MS, 16 h SLEEP
    const attH = 50 * FW.T_ATTENTION_MS / 3.6e6, wakeH = 20 * FW.T_WAKE_MS / 3.6e6;
    const day = 8 * t.PRESENT + attH * t.ATTENTION + wakeH * t.WAKE + (16 - attH - wakeH) * t.SLEEP;
    const days = cap / day;
    const continuousHalo = 24 * (1 + 60 * FW.LED_MAX_BRIGHTNESS) + t.PRESENT;
    const ok = cap / t.PRESENT >= 8 && cap / t.NIGHT >= 8 && cap / t.SLEEP >= 8;
    const html = `<p class="notes">Per-part current per firmware mode, from the datasheets cited in the last column (parts/parts.json). Cell: ${esc(PARTS.cell.name)} — ${esc(PARTS.cell.capacity_note)}. Ring brightness cap LED_MAX_BRIGHTNESS = ${FW.LED_MAX_BRIGHTNESS} from config.h.</p>` +
      `<label class="tog" style="margin:4px 0 8px"><input type="checkbox" id="opt_wifi" ${includeOptional ? 'checked' : ''}> include Wi-Fi listen for the Claude usage push (CLAUDE_WIFI_ENABLED = 1, ${PARTS.wifi.current_mA.PRESENT} mA unverified)</label>` +
      table(['Part', ...MODES], rows, 'power') + sources +
      `<p class="notes"><b>Typical day</b>: 8 h PRESENT + 50 crown interactions (${FW.T_ATTENTION_MS} ms each) + 20 wake sweeps (${FW.T_WAKE_MS} ms) + SLEEP the rest = <b>${day.toFixed(0)} mAh/day → ${days.toFixed(1)} days per charge</b>. If the halo were left on continuously in PRESENT at the ${(FW.LED_MAX_BRIGHTNESS*100).toFixed(0)} % cap it would draw ${continuousHalo.toFixed(0)} mA → ${hours(cap/continuousHalo)}; that is why the ring is event-only.</p>` +
      verdict(ok, ok ? `PRESENT ${hours(cap/t.PRESENT)}, NIGHT ${hours(cap/t.NIGHT)} and SLEEP ${hours(cap/t.SLEEP)} all exceed a working day; ATTENTION/WAKE are ${hours(cap/t.ATTENTION)} bursts by design.` : 'a steady mode cannot last 8 h — reduce BL_PRESENT in config.h or fit the 1200 mAh cell (needs a third layer, see docs/04-design.md)');
    return { html, ok, totals: t, cap };
  }
  const hours = h => h > 1000 ? (h/24).toFixed(0) + ' d' : h.toFixed(1) + ' h';
  return { pins, fit, power, totals };
})();
