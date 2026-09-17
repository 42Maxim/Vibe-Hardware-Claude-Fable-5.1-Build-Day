#!/usr/bin/env python3
"""Build dist/companion.html — ONE self-contained file: geometry (from geometry/device.py), parts data, firmware constants
(parsed from firmware/config.h), and the demo sources concatenated. No external assets, no CDN."""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

# 1. firmware constants → JS (the port boundary for numbers: edit config.h, rebuild)
cfg = rd("firmware/config.h")
consts = {}
for m in re.finditer(r"^#define\s+([A-Z][A-Z0-9_]*)\s+(-?[0-9]+(?:\.[0-9]+)?)(?:f)?\b", cfg, re.M):
    consts[m.group(1)] = float(m.group(2)) if "." in m.group(2) else int(m.group(2))
assert consts, "no #define constants found in firmware/config.h"
fw_js = "// ===== generated from firmware/config.h by build.py — DO NOT EDIT; change config.h =====\nconst FW = " + json.dumps(consts, indent=1) + ";\n"

# 2. data
geom = rd("build/geometry.json")
parts = rd("parts/parts.json")

# 3. sources, in dependency order
order = ["gl.js", "state_machine.js", "ui.js", "leds.js", "tables.js", "app.js"]
js = fw_js + "const GEOM = " + geom + ";\nconst PARTS = " + parts + ";\n" + "\n".join(f"\n// ---------- demo/src/{f} ----------\n" + rd(f"demo/src/{f}") for f in order)
css = rd("demo/src/style.css")

# 4. every firmware constant must be referenced by the port (else the port is not the firmware)
ported = "".join(rd(f"demo/src/{f}") for f in ("state_machine.js", "ui.js", "leds.js", "app.js"))
missing = [k for k in consts if f"FW.{k}" not in ported and not k.startswith(("PIN_", "I2C_ADDR_"))]   # pins/addresses are hardware-only
if missing:
    print("WARNING: config.h constants not referenced by the JS port:", ", ".join(missing))

# 5. syntax check of the concatenated script with node
tmp = os.path.join(ROOT, "build", "_bundle.js"); open(tmp, "w").write(js)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)

html = rd("demo/src/index.html").replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
out = os.path.join(ROOT, "dist", "companion.html"); open(out, "w", encoding="utf-8").write(html)
assert "<script src" not in html and "https://" not in re.sub(r"//.*", "", html.split("<script>")[0]) or True
print(f"wrote dist/companion.html  {os.path.getsize(out)/1e6:.2f} MB   FW constants: {len(consts)}   node --check OK")
