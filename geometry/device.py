#!/usr/bin/env python3
"""Puck — single parametric source of truth for the enclosure and component placement.

Run:  python3 geometry/device.py
Writes: build/enclosure.stl (body+lid+frost, printable), build/enclosure_{body,lid,frost}.stl,
        build/geometry.json (meshes + component bodies + fit table + concept shells) for the demo.

Coordinates: mm, origin at the centre of the base underside, z up. -y = FRONT (user), +y = REAR (USB), +x = RIGHT (crown).
Part dimensions come from parts/parts.json (docs/01-survey.md has the sources).
"""
import json, math, struct, os, sys
import numpy as np
from manifold3d import Manifold, OpType, set_circular_segments

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "parts", "parts.json")))
set_circular_segments(96)

# ---------------- parameters (edit here) ----------------
WALL = 3.0
CAV_R = 36.0            # cavity radius (Ø72) — sized so the 45° VEML board clears both the wall and the display corner by ≥0.5
OUT_R = CAV_R + WALL    # Ø77
FLOOR = 2.0
CAV_TOP = 25.0          # body wall top / lid underside
LID_TOP = 30.0          # overall height
DISH_R, DISH_Z, CHAMFER_R = 22.5, 27.0, 25.5   # sunken display dish
WINDOW_R = 17.0         # display window Ø34
FROST_R0, FROST_R1, FROST_Z0 = 28.5, 32.5, 28.4  # frosted annulus, 1.6 mm thick
REBATE_R, REBATE_Z = CAV_R + 1.4, 23.5           # rebate cut into the wall top (r 35.5..36.9, 1.5 deep); the lid lip drops into it
BOSS_ANGLES = (75, 195, 315)                     # lid screw bosses (deg from +x)
BOSS_R, BOSS_RAD = OUT_R - 1.5, 2.5              # M2 into Ø1.6 pilot
POST_H = 7.0            # Feather standoffs
CLEAR_MIN = 0.5         # fit rule (mm)

ring = P["ring"]; disp = P["display"]; mcu = P["mcu"]; cell = P["cell"]; pres = P["presence"]; env = P["env"]; lux = P["lux"]; enc = P["encoder"]
RING_RO, RING_RI, RING_T = ring["od"] / 2, ring["id_"] / 2, ring["thick"]
RING_Z0 = CAV_TOP + 0.2                          # ring sits in the lid pocket, LEDs up into the frost
LED_R = (RING_RO + RING_RI) / 2                  # 29.45
DISP_Z1 = CAV_TOP - 0.4                          # display glass 0.4 below the lid underside → well depth DISH_Z - DISP_Z1
DISP_Z0 = DISP_Z1 - disp["dims"][2]
MCU_Z0 = FLOOR + POST_H
MCU_Y = 1.5                                      # rearward as far as the 45° VEML board allows (0.5 mm rule); USB-C receptacle 8.35 mm from the inner wall, the 12 x 7 slot admits the plug overmould
MCU_HOLES = [(sx * (mcu["dims"][0] / 2 - 2.54), MCU_Y + sy * (mcu["dims"][1] / 2 - 2.54)) for sx in (-1, 1) for sy in (-1, 1)]
CELL_C = (0, MCU_Y)                              # 38 along y, centred between the Feather posts (2.6 mm to each)
PRES_Y1 = -26.8                                  # presence board rear face; stands vertical against the front wall
VEML_ANG, VEML_R0 = 45.0, 28.5                   # vertical against the wall at 45° (right-rear), inner face radius (display corner is at r 27.9)
SHT_C = (-22.0, -2.0)                            # flat on the floor, left crescent
ENC_C = (0, 4.0, 12.0)                           # crown: shaft along +x through the right wall, (y, z) of axis
ENC_PAD_X = CAV_R - 1.6                          # flat pad inside the curved wall for the encoder body (mounting face)
DIMPLE_R, DIMPLE_D = 9.0, 1.5                    # knob dimple on the outside → panel thickness 3.1 for the 7 mm thread
IR_WIN_R, LUX_WIN_R, WIN_Z = 3.0, 1.5, 14.8
USB_SLOT = (12.0, 7.0, 12.0)                     # w, h, z-centre in the rear wall — sized for the plug OVERMOULD so a normal cable reaches the recessed port (overmould size unverified; test-fit)

# ---------------- helpers ----------------
def cyl(r, h, z=0, r2=None):
    return Manifold.cylinder(h, r, r if r2 is None else r2).translate([0, 0, z])
def box(sx, sy, sz, cx=0, cy=0, z0=0):
    return Manifold.cube([sx, sy, sz]).translate([cx - sx / 2, cy - sy / 2, z0])
def annulus(r0, r1, h, z=0):
    return cyl(r1, h, z) - cyl(r0, h + 2, z - 1)
def polar(r, deg):
    return (r * math.cos(math.radians(deg)), r * math.sin(math.radians(deg)))

# ---------------- body ----------------
body = cyl(OUT_R, CAV_TOP) - cyl(CAV_R, CAV_TOP - FLOOR + 1, FLOOR)
body -= annulus(CAV_R - 0.01, REBATE_R, CAV_TOP - REBATE_Z + 1, REBATE_Z)          # rebate for the lid lip
for a in BOSS_ANGLES:                                                                # lid screw bosses
    x, y = polar(BOSS_R, a)
    body += cyl(BOSS_RAD, CAV_TOP - FLOOR, FLOOR).translate([x, y, 0]) ^ cyl(OUT_R, CAV_TOP)
    body -= cyl(0.8, 12, CAV_TOP - 10).translate([x, y, 0])
for x, y in MCU_HOLES:                                                               # Feather posts
    body += cyl(2.0, POST_H, FLOOR).translate([x, y, 0])
    body -= cyl(0.8, POST_H, FLOOR + 1).translate([x, y, 0])
body -= Manifold.cylinder(WALL * 2 + 2, IR_WIN_R).rotate([90, 0, 0]).translate([0, -CAV_R + 1, WIN_Z])       # IR window (front)
lx, ly = polar(CAV_R + WALL / 2, VEML_ANG)
body -= Manifold.cylinder(WALL * 2 + 2, LUX_WIN_R).rotate([90, 0, 0]).rotate([0, 0, VEML_ANG + 90]).translate([lx * 0.999, ly * 0.999, WIN_Z])  # lux window at 45°
body += box(CAV_R - ENC_PAD_X + 2, 16, 16, ENC_PAD_X + (CAV_R - ENC_PAD_X + 2) / 2, ENC_C[1], ENC_C[2] - 8) ^ cyl(OUT_R, CAV_TOP)  # flat pad for the encoder
body -= Manifold.cylinder(DIMPLE_D + 1, DIMPLE_R).rotate([0, 90, 0]).translate([OUT_R - DIMPLE_D, ENC_C[1], ENC_C[2]])   # knob dimple
body -= Manifold.cylinder(WALL * 3 + 2, 3.6).rotate([0, 90, 0]).translate([ENC_PAD_X - 1, ENC_C[1], ENC_C[2]])    # crown bushing Ø7.2
body -= box(USB_SLOT[0], WALL * 2 + 2, USB_SLOT[1], 0, CAV_R + WALL / 2, USB_SLOT[2] - USB_SLOT[1] / 2)     # USB-C slot (rear)
for dx, dy in ((-4, -4), (4, -4), (-4, 4), (4, 4)):                                                          # breathing holes under the SHT41
    body -= cyl(1.0, FLOOR + 2, -1).translate([SHT_C[0] + dx, SHT_C[1] + dy, 0])

# ---------------- lid ----------------
lid = cyl(OUT_R, LID_TOP - CAV_TOP, CAV_TOP)
lid += annulus(CAV_R + 0.3, REBATE_R - 0.3, CAV_TOP - REBATE_Z, REBATE_Z)                     # lip
lid -= annulus(RING_RI - 0.7, RING_RO + 0.7, (RING_Z0 + RING_T) - (CAV_TOP - 1), CAV_TOP - 1)  # ring pocket from below (z 24..28.4)
lid -= cyl(DISH_R, 5, DISH_Z)                                                                  # dish floor at z 27
lid -= Manifold.cylinder(LID_TOP - DISH_Z, DISH_R, CHAMFER_R).translate([0, 0, DISH_Z])       # 45° chamfer into the dish
lid -= cyl(WINDOW_R, 10, CAV_TOP - 5)                                                          # display window
lid -= annulus(FROST_R0, FROST_R1, 3, FROST_Z0)                                                # frost slot
for a in BOSS_ANGLES:
    x, y = polar(BOSS_R, a)
    lid -= cyl(1.1, 10, CAV_TOP - 1).translate([x, y, 0]) + cyl(2.2, 2, LID_TOP - 1.5).translate([x, y, 0])   # M2 clearance + head recess
frost = annulus(FROST_R0 + 0.1, FROST_R1 - 0.1, LID_TOP - FROST_Z0, FROST_Z0)

# ---------------- components (boxes at real dimensions) ----------------
def part(id_, name, m, color, explode, kind="component", **extra):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3].astype(np.float32)
    t = np.asarray(mesh.tri_verts).astype(np.uint32)
    bb = [v.min(0).round(3).tolist(), v.max(0).round(3).tolist()]
    return dict(id=id_, name=name, kind=kind, color=color, explode=explode, bbox=bb,
                verts=v.round(3).ravel().tolist(), tris=t.ravel().tolist(), **extra), m

comps = []
comps.append(part("cell", cell["name"], box(*cell["dims"], CELL_C[0], CELL_C[1], FLOOR), [0.16, 0.55, 0.36], [0, 0, 4]))
comps.append(part("mcu", mcu["name"], box(mcu["dims"][0], mcu["dims"][1], 1.6, 0, MCU_Y, MCU_Z0) + (box(mcu["dims"][0], mcu["dims"][1], mcu["dims"][2] - 1.6, 0, MCU_Y, MCU_Z0 + 1.6) ^ box(mcu["dims"][0] - 2, mcu["dims"][1] - 2, mcu["dims"][2], 0, MCU_Y, MCU_Z0))
                  + box(9, 7.5, 3.2, 0, MCU_Y + mcu["dims"][1] / 2 - 3.5, MCU_Z0 + 1.6),   # USB-C receptacle at the rear edge
                  [0.20, 0.45, 0.85], [0, 0, 10]))
comps.append(part("display", disp["name"], box(disp["dims"][0], disp["dims"][1], disp["dims"][2], 0, 0, DISP_Z0), [0.85, 0.35, 0.22], [0, 0, 18],
                  screen=dict(center=[0, 0, round(DISP_Z1, 3)], normal=[0, 0, 1], up=[0, 1, 0], radius=disp["active_diameter"] / 2, res=disp["res"])))
comps.append(part("ring", ring["name"], annulus(RING_RI, RING_RO, RING_T, RING_Z0), [0.10, 0.10, 0.11], [0, 0, 30],
                  ring=dict(center=[0, 0, round(RING_Z0 + RING_T, 3)], radius_led=round(LED_R, 2), leds=ring["leds"], start_angle_deg=90, normal=[0, 0, 1])))
pres_m = box(pres["dims"][0], pres["dims"][2], pres["dims"][1], 0, PRES_Y1 - pres["dims"][2] / 2, 6.0) + box(3.2, 1.5, 4.2, 0, PRES_Y1 - pres["dims"][2] - 0.75, WIN_Z - 2.1)
comps.append(part("presence", pres["name"], pres_m, [0.05, 0.65, 0.65], [0, -22, 0],
                  presence=dict(origin=[0, round(PRES_Y1 - pres["dims"][2] - 1.5, 2), WIN_Z], dir=[0, -1, 0], fov_deg=pres["fov_deg"], range_mm=pres["range_m"] * 1000)))
comps.append(part("env", env["name"], box(env["dims"][1], env["dims"][0], env["dims"][2], SHT_C[0], SHT_C[1], FLOOR), [0.76, 0.6, 0.17], [-18, 0, 0]))
veml = box(lux["dims"][0], lux["dims"][2], lux["dims"][1], 0, -(VEML_R0 + lux["dims"][2] / 2), 6.0).rotate([0, 0, VEML_ANG + 90])
comps.append(part("lux", lux["name"], veml, [0.9, 0.72, 0.2], [14, 14, 0]))
eb = enc["body"]
enc_m = (box(eb[2], eb[0], eb[1], ENC_PAD_X - eb[2] / 2, ENC_C[1], ENC_C[2] - eb[1] / 2)              # body against the pad
         + Manifold.cylinder(16.0, 3.0).rotate([0, 90, 0]).translate([ENC_PAD_X, ENC_C[1], ENC_C[2]])           # 20 mm shaft, cut to 16 so it does not pass the knob face
         + Manifold.cylinder(12, 8).rotate([0, 90, 0]).translate([OUT_R - DIMPLE_D + 1.0, ENC_C[1], ENC_C[2]]))           # knob Ø16 in the dimple (printed, unverified part)
comps.append(part("encoder", enc["name"] + " + Ø16 knob", enc_m, [0.5, 0.35, 0.9], [22, 0, 0]))

shells = [part("body", "Body (PETG, 3 mm wall)", body, [0.16, 0.15, 0.14], [0, 0, 0], kind="shell", explodeStage=0.0),
          part("lid", "Lid (PETG)", lid, [0.18, 0.17, 0.16], [0, 0, 40], kind="shell", explodeStage=0.0),
          part("frost", "Frosted halo window (natural PETG)", frost, [0.95, 0.93, 0.88], [0, 0, 52], kind="frost", alpha=0.85, explodeStage=0.0)]

# ---------------- fit check (exact booleans, not just bounding boxes) ----------------
def vol(m):
    return m.volume()
keepout = cyl(OUT_R + 30, 80, -20) - cyl(CAV_R - CLEAR_MIN, CAV_TOP - FLOOR, FLOOR)      # everything outside the cavity shrunk radially by the rule
keepout -= box(OUT_R - ENC_PAD_X + 2, 18, 18, (ENC_PAD_X + OUT_R) / 2 - 1, ENC_C[1], ENC_C[2] - 9)   # the crown pad is a flat mounting face: the encoder body sits against it by design
def aabb_gap(a, b):
    return max(max(b[0][i] - a[1][i], a[0][i] - b[1][i]) for i in range(3))
def dilated_box(bb):
    return box(bb[1][0] - bb[0][0] + 2 * CLEAR_MIN, bb[1][1] - bb[0][1] + 2 * CLEAR_MIN, bb[1][2] - bb[0][2] + 2 * CLEAR_MIN,
               (bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2, bb[0][2] - CLEAR_MIN)
rows = []
comp_dicts = [c for c, _ in comps]
for c, m in comps:
    bb = c["bbox"]
    if c["id"] == "ring":
        wall = vol(m ^ (cyl(OUT_R, 10, CAV_TOP - 2) - annulus(RING_RI - 0.7 + CLEAR_MIN, RING_RO + 0.7 - CLEAR_MIN, 10, CAV_TOP - 2)))  # pocket wall keep-out
        zok = bb[0][2] >= CAV_TOP - 1 and bb[1][2] <= FROST_Z0 + 1e-6
        shell_hit = vol(m ^ lid)
    elif c["id"] == "encoder":
        wall = vol((m ^ box(80, 80, 40, -40 + ENC_PAD_X, 0, 0)) ^ keepout)   # internal part only; the shaft is meant to cross the wall
        zok = bb[0][2] >= FLOOR and bb[1][2] <= CAV_TOP
        shell_hit = vol(m ^ body)
    else:
        wall = vol(m ^ keepout)
        zok = bb[0][2] >= FLOOR - 1e-6 and bb[1][2] <= CAV_TOP + 1e-6
        shell_hit = vol(m ^ body)
    near, gap, clear_ok = None, 1e9, True
    for d, dm in comps:
        if d is c: continue
        g = aabb_gap(bb, d["bbox"])
        if g < gap: near, gap = d["id"], g
        # exact: a is within CLEAR_MIN of b if a hits b's dilated AABB AND b hits a's dilated AABB (one of any pair is axis-aligned here, so this is exact)
        if g < CLEAR_MIN and vol(m ^ dilated_box(d["bbox"])) > 1e-6 and vol(dm ^ dilated_box(bb)) > 1e-6:
            clear_ok = False; near = d["id"]; gap = g
    ok = zok and wall < 1e-6 and clear_ok and shell_hit < 1e-6
    rows.append(dict(part=c["id"], bbox=bb, wall_keepout_mm3=round(wall, 3), nearest=near, aabb_gap_mm=round(gap, 2), clear_ok=clear_ok, z_ok=zok, shell_intersection_mm3=round(shell_hit, 3), pass_=ok))
fit = dict(cavity=dict(radius=CAV_R, z=[FLOOR, CAV_TOP]), rule_mm=CLEAR_MIN, rows=rows, verdict="PASS" if all(r["pass_"] for r in rows) else "FAIL",
           note="wall_keepout_mm3 = volume of the part inside the cavity wall shrunk by the rule (must be 0); clear_ok = exact boolean test against neighbours dilated by the rule; aabb_gap is the axis-aligned gap (negative for rotated parts is expected).")

# ---------------- detailed sub-part meshes (what you see in the 3D inside view) ----------------
# The fit check above runs on the surveyed ENVELOPES. These meshes are the same parts drawn with their real features
# (connectors, chips, headers, glass, tab, shaft, knob) so the inside view shows the off-the-shelf parts, not boxes.
# Feature positions that come from a datasheet are commented with the source; the rest are visual approximations
# inside the verified envelope and are marked "approx" — they never move the fit result.
def cylz(r, h, z=0, seg=24):
    return Manifold.cylinder(h, r, r, seg).translate([0, 0, z])
def rrect(w, h, t, r=1.0, z0=0, seg=12):                       # rounded-rectangle slab (PCB outline), centred at origin
    cs = [cylz(r, t, z0, seg).translate([sx * (w / 2 - r), sy * (h / 2 - r), 0]) for sx in (-1, 1) for sy in (-1, 1)]
    return Manifold.batch_hull(cs)
def hexnut(af, t, z0=0):                                         # across-flats af
    return Manifold.cylinder(t, af / math.sqrt(3), af / math.sqrt(3), 6).translate([0, 0, z0])
def annz(r0, r1, h, z=0, seg=24):                                # low-poly annulus for detail meshes
    return cylz(r1, h, z, seg) - cylz(r0, h + 2, z - 1, seg)
def ringpad(x, y, z0, ro=1.05, ri=0.5, t=0.07, seg=14):          # through-hole gold annular ring (no pin fitted)
    return annz(ri, ro, t, z0, seg).translate([x, y, 0])
def union(ms):
    return Manifold.batch_boolean(list(ms), OpType.Add)
# --- board-finish relief. Real thicknesses are ~15 um silkscreen / ~5 um ENIG; drawn 0.04-0.05 so they read at
#     render scale without touching any envelope ("approx" by construction — they are ink and plating, not parts).
SILK_T, PAD_T = 0.04, 0.05
def silk_frame(w, h, z0, t=0.35, r=0.0, seg=10):                  # hollow rectangle outline (component outline / board edge stripe)
    o = rrect(w, h, SILK_T, r, z0, seg) if r > 0 else box(w, h, SILK_T, 0, 0, z0)
    i = rrect(w - 2 * t, h - 2 * t, SILK_T + 2, max(r - t, 0.01), z0 - 1, seg) if r > 0 else box(w - 2 * t, h - 2 * t, SILK_T + 2, 0, 0, z0 - 1)
    return o - i
def silk_bar(w, h, x, y, z0):                                     # polarity bar / tick / label block
    return box(w, h, SILK_T, x, y, z0)
def silk_dot(x, y, z0, r=0.35, seg=10):                           # pin-1 / polarity dot
    return cylz(r, SILK_T, z0, seg).translate([x, y, 0])
def silk_plus(x, y, z0, s=1.1, t=0.26):                           # "+" marker
    return box(s, t, SILK_T, x, y, z0) + box(t, s, SILK_T, x, y, z0)
def silk_minus(x, y, z0, s=1.1, t=0.26):                          # "-" marker
    return box(s, t, SILK_T, x, y, z0)
def pad(w, h, x, y, z0, t=PAD_T):                                 # exposed-copper (ENIG) rectangle
    return box(w, h, t, x, y, z0)
def chip2t(w, h, t, x=0, y=0, z0=0, rot=0.0):
    """Two-terminal passive drawn as a real part: dark body + two tin end-caps.
    End-cap length taken as 0.22 x body length (approx; 0402/0603 end terminations run ~0.2-0.25 L)."""
    c = 0.22 * w
    bod = box(w - 2 * c, h, t, 0, 0, z0)
    cap = union([box(c, h * 1.02, t * 1.06, sx * (w / 2 - c / 2), 0, z0 - t * 0.03) for sx in (-1, 1)])
    mv = lambda m: m.rotate([0, 0, rot]).translate([x, y, 0])
    return mv(bod), mv(cap)
def fillet(x, y, z0, r0=0.42, r1=0.85, h=0.38, seg=8):            # solder fillet skirt at a through-hole pin / connector leg
    return Manifold.cylinder(h, r1, r0, seg).translate([x, y, z0])
def pcb_slab(w, h, t, r=1.5, z0=0, ch=0.25, seg=16):
    """Rounded-rect PCB with a chamfered top and bottom edge (routed FR4 edges break ~0.2-0.3 mm: approx).
    Convex, so one hull of three rounded-rect sections gives the bevel. Same w x h x t envelope as rrect()."""
    return Manifold.batch_hull([rrect(w - 2 * ch, h - 2 * ch, 0.002, max(r - ch, 0.3), z0, seg),
                                rrect(w, h, t - 2 * ch, r, z0 + ch, seg),
                                rrect(w - 2 * ch, h - 2 * ch, 0.002, max(r - ch, 0.3), z0 + t - 0.002, seg)])
def rot2(x, y, deg):                                              # rotate a point about z (for placing legs on a rotated connector)
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return (x * c - y * s, x * s + y * c)
def dome(r, hgt, z0, seg=20):                                     # shallow clear lens dome (LED / sensor optics)
    return (Manifold.sphere(1.0, seg).scale([r, r, hgt]) - box(4 * r, 4 * r, 2 * r, 0, 0, -2 * r)).translate([0, 0, z0])
COL = dict(pcb=[0.07, 0.075, 0.085], pcb_red=[0.55, 0.08, 0.10], metal=[0.74, 0.75, 0.77], black=[0.05, 0.05, 0.055],
           plastic=[0.86, 0.86, 0.84], white=[0.95, 0.95, 0.93], gold=[0.83, 0.68, 0.30], glass=[0.02, 0.02, 0.025],
           pouch=[0.72, 0.73, 0.76], kapton=[0.85, 0.66, 0.18], red=[0.8, 0.12, 0.1], lens=[0.88, 0.9, 0.86],
           anod=[0.17, 0.17, 0.19], screw=[0.62, 0.62, 0.64],
           led_amber=[1.0, 0.63, 0.10], led_green=[0.25, 0.85, 0.35], nylon=[0.93, 0.92, 0.87],
           silk=[0.82, 0.83, 0.80], fpc=[0.78, 0.58, 0.16], tan=[0.62, 0.55, 0.34])
SPEC = dict(pcb=0.30, metal=0.95, plastic=0.15, glass=1.0, pouch=0.55, anod=0.85, chip=0.5, lens=0.6,
            nylon=0.25, led=0.75, fpc=0.35)
STAGE_HW = 0.55          # fasteners / knob / nut / washer / buttons come off after the boards (viewer: (t-stage)/(1-stage))
# Renderer material contract. Every detail sub-part carries a "mat" from this closed set; "spec" stays as the fallback.
MATS = ("pcb", "silk", "gold", "tin", "steel", "alu_anod", "plastic_matte", "plastic_gloss", "epoxy_black",
        "ceramic", "glass", "lens", "diffuser", "pouch", "kapton", "fpc", "rubber")
MAT_BY_COL = {tuple(COL[k]): v for k, v in (("pcb", "pcb"), ("pcb_red", "pcb"), ("silk", "silk"), ("gold", "gold"),
              ("metal", "steel"), ("screw", "steel"), ("black", "epoxy_black"), ("plastic", "plastic_matte"),
              ("white", "plastic_gloss"), ("glass", "glass"), ("pouch", "pouch"), ("kapton", "kapton"),
              ("lens", "lens"), ("anod", "alu_anod"), ("nylon", "plastic_matte"), ("fpc", "fpc"),
              ("led_amber", "lens"), ("led_green", "lens"), ("red", "plastic_matte"), ("tan", "pcb"))}
MAT_BY_SPEC = {SPEC["pcb"]: "pcb", SPEC["metal"]: "steel", SPEC["plastic"]: "plastic_matte", SPEC["glass"]: "glass",
               SPEC["pouch"]: "pouch", SPEC["anod"]: "alu_anod", SPEC["chip"]: "epoxy_black", SPEC["lens"]: "lens",
               SPEC["nylon"]: "plastic_matte", SPEC["led"]: "lens", SPEC["fpc"]: "fpc"}
detail = []
def sub(group, name, m, color, spec, explode, stage=0.0, mat=None, **extra):
    d, _ = part(f"{group}.{len([x for x in detail if x['group'] == group])}", name, m, color, explode, **extra)
    mat = mat or MAT_BY_COL.get(tuple(color)) or MAT_BY_SPEC.get(spec, "plastic_matte")
    assert mat in MATS, f"{name}: unknown material {mat!r}"
    d["group"] = group; d["spec"] = spec; d["mat"] = mat; d["explodeStage"] = round(stage, 3); detail.append(d)
def scr_e(parent, axis, extra=8.0):      # a fastener leaves along its own axis, 6-10 mm past its parent's vector
    return [round(parent[i] + axis[i] * extra, 2) for i in range(3)]
def m2_screw(shaft=4.0, head=1.2, z0=0.0, r=0.95, rh=1.9, seg=24):
    """M2 pan-head screw pointing -z: shaft below z0, head sitting on z0 (z0 = the face the head lands on).
    Phillips cross recess + a chamfer under the head (approx: real pan heads have both)."""
    return (cylz(r, shaft + 0.2, z0 - shaft, seg) + Manifold.cylinder(0.3, r, rh * 0.85, seg).translate([0, 0, z0 - 0.3])
            + cylz(rh, head, z0, seg) - ph_cross(rh, z0 + head))
def ph_cross(rh, ztop, depth=0.55, w=0.42):                     # Phillips (PH0-ish) cross recess cut into a head top
    a = box(2 * rh * 0.74, w, depth + 0.1, 0, 0, ztop - depth) + box(w, 2 * rh * 0.74, depth + 0.1, 0, 0, ztop - depth)
    return a + Manifold.cylinder(depth + 0.1, w * 1.6, w * 0.5, 12).translate([0, 0, ztop - depth])   # tapered centre
def hex_recess(af, ztop, depth=0.7):                            # hex socket in a head top
    return hexnut(af, depth + 0.1, ztop - depth)

def header_row(n, pitch=2.54, z0=0, pin_h=2.5):                 # n square 0.64 mm header pins standing up (0.1 in strip, approx)
    return union([box(0.64, 0.64, pin_h, (i - (n - 1) / 2) * pitch, 0, z0) for i in range(n)])
def header_fillets(n, pitch=2.54, z0=0, r1=0.95):               # solder fillet at each pin root
    return union([fillet((i - (n - 1) / 2) * pitch, 0, z0, 0.45, r1, 0.4) for i in range(n)])
def jst_sh4(z0=0, cavity=True):   # STEMMA QT / JST SH 4-pin right-angle, 6.0 x 4.0 x 2.9 (unverified; JST SH SM04B-SRSS-TB class)
    m = box(6.0, 4.0, 2.9, 0, 0, z0)
    return m - box(4.8, 2.6, 1.6, 0, -0.8, z0 + 0.75) if cavity else m      # cable cavity, opening at -y
def jst_sh4_metal(z0=0):
    """JST SH shell detail: 4 x 0.5 mm contacts in the cavity + 2 solder-tab legs (1.0 pitch is the SH series pitch; rest approx)."""
    con = union([box(0.34, 2.2, 0.22, (i - 1.5) * 1.0, -0.6, z0 + 0.82) for i in range(4)])
    legs = union([box(1.3, 1.5, 0.22, sx * 2.55, 0.9, z0 - 0.02) for sx in (-1, 1)])
    return con + legs
def jst_ph2(z0=0):   # JST PH 2-pin top-entry S2B, ~7.9 x 4.5 x 6.0 (approx), with the latch ramp on the outer face
    m = box(7.9, 4.5, 6.0, 0, 0, z0) - box(5.5, 3.0, 4.5, 0, 0, z0 + 1.5)
    return m - box(3.2, 1.2, 2.6, 0, 2.3, z0 + 3.0)             # latch window (approx)
def usb_c(z0=0):     # USB-C receptacle shell ~8.94 x 7.35 x 3.26 (typical, unverified), rounded ends, mouth at +y
    sh = Manifold.batch_hull([cylz(1.6, 7.35, 0, 32).rotate([90, 0, 0]).translate([sx * (8.94 / 2 - 1.6), 7.35 / 2, z0 + 1.63]) for sx in (-1, 1)])
    mouth = Manifold.batch_hull([cylz(1.15, 3.1, 0, 24).rotate([90, 0, 0]).translate([sx * (8.94 / 2 - 1.75), 7.35 / 2 + 0.1, z0 + 1.63]) for sx in (-1, 1)])
    sh -= box(0.18, 5.4, 0.18, 0, 7.35 / 2 - 0.4, z0 + 3.26 - 0.09)         # drawn shell seam along the lid (approx)
    sh -= union([box(0.18, 0.18, 3.5, sx * (8.94 / 2 - 0.09), 7.35 / 2 - 1.2, z0) for sx in (-1, 1)])   # side seams (approx)
    return sh
def usb_c_shield_legs(z0=0):     # 4 through-hole shield legs, soldered to the board (approx)
    return union([box(0.9, 1.8, 1.9, sx * 4.1, 7.35 / 2 - sy * 4.2, z0 - 1.6) for sx in (-1, 1) for sy in (0, 1)])
def usb_c_tongue(z0=0):   # the moulded tongue inside the mouth, 0.7 thick (approx)
    return box(6.6, 2.4, 0.7, 0, 7.35 / 2 - 1.2, z0 + 1.28)
def usb_c_contacts(z0=0):  # 12 visible contact stripes on each tongue face, 0.5 mm pitch (USB-C spec pitch; layout approx)
    return union([box(0.28, 2.0, 0.06, (i - 5.5) * 0.5, 7.35 / 2 - 1.3, z0 + 1.28 + zt)
                  for i in range(12) for zt in (-0.06, 0.7)])

# --- MCU: Adafruit ESP32-S3 Feather. Board frame: 0.9" x 2.0" (22.86 x 50.8) [Feather spec]; local x across, y along, USB at +y.
# Header strips: 16-pin strip centred 1.0" from the USB end, 12-pin strip 1.2" from it, strips 0.8" apart [Feather spec].
W, L = 22.86, 50.8
mcu_pcb = pcb_slab(W, L, 1.6, 1.5)
for sx in (-1, 1):
    for sy in (-1, 1):
        mcu_pcb -= cylz(1.27, 4, -1, 20).translate([sx * (W / 2 - 2.54), sy * (L / 2 - 2.54), 0])   # 0.1" corner holes
place_mcu = lambda m: m.translate([0, MCU_Y, MCU_Z0])
E = [0, 0, 10]
sub("mcu", "Feather PCB 22.9 x 50.8 (0.9 x 2.0 in), chamfered edges", place_mcu(mcu_pcb), COL["pcb"], SPEC["pcb"], E)
HDR = ((16, -(0.8 * 25.4) / 2, L / 2 - 1.0 * 25.4), (12, +(0.8 * 25.4) / 2, L / 2 - 1.2 * 25.4))   # (n, x, y-centre) [Feather spec]
sub("mcu", "16-pin + 12-pin headers (Feather spec positions)", place_mcu(union(
    [header_row(n, z0=1.6).rotate([0, 0, 90]).translate([hx, hy, 0]) for n, hx, hy in HDR])), COL["gold"], SPEC["metal"], E, mat="gold")
sub("mcu", "Header solder fillets (28 pins)", place_mcu(union(
    [header_fillets(n).rotate([0, 0, 90]).translate([hx, hy, 1.58]) for n, hx, hy in HDR])), COL["metal"], SPEC["metal"], E, mat="tin")
USB_Y = L / 2 - 7.35 + 1.5
sub("mcu", "USB-C receptacle, drawn shell with lid + side seams (rear wall slot)", place_mcu(usb_c(1.6).translate([0, USB_Y, 0])), COL["metal"], SPEC["metal"], E, mat="steel")
sub("mcu", "USB-C shield legs + solder (approx)", place_mcu((usb_c_shield_legs(1.6) + union(
    [fillet(sx * 4.1, USB_Y + 7.35 / 2 - sy * 4.2, 1.58, 0.7, 1.15, 0.42) for sx in (-1, 1) for sy in (0, 1)]).translate([0, -USB_Y, 0])).translate([0, USB_Y, 0])), COL["metal"], SPEC["metal"], E, mat="tin")
sub("mcu", "USB-C tongue (approx)", place_mcu(usb_c_tongue(1.6).translate([0, USB_Y, 0])), COL["white"], SPEC["plastic"], E, mat="plastic_gloss")
sub("mcu", "USB-C tongue contacts, 24 at 0.5 mm pitch (USB-C pitch; layout approx)", place_mcu(usb_c_contacts(1.6).translate([0, USB_Y, 0])), COL["gold"], SPEC["metal"], E, mat="gold")
JST_Y = L / 2 - 0.425 * 25.4
JST_X = -W / 2 + 3.2
sub("mcu", "JST-PH 2-pin LiPo connector, 0.425 in from the USB end (Feather spec)", place_mcu(jst_ph2(1.6).rotate([0, 0, 90]).translate([JST_X, JST_Y, 0])), COL["plastic"], SPEC["plastic"], E, mat="plastic_matte")
sub("mcu", "JST-PH 2 contacts", place_mcu(union([box(0.6, 0.6, 3.2, JST_X, JST_Y + sy * 1.0, 3.0) for sy in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")
sub("mcu", "JST-PH solder fillets", place_mcu(union([fillet(JST_X, JST_Y + sy * 1.0, 1.58, 0.5, 1.0, 0.4) for sy in (-1, 1)])), COL["metal"], SPEC["metal"], E, mat="tin")
# ESP32-S3 module: shield can with a dimpled lid + castellated edge pads (module outline approx; castellation pitch 1.27 approx)
CAN_W, CAN_L, CAN_Y, MOD_T = 15.5, 20.5, -L / 2 + 13.5, 0.8          # module PCB 0.8 thick under the can (approx)
CAST = ([(sx * CAN_W / 2, CAN_Y + (i - 6) * 1.5, 90) for sx in (-1, 1) for i in range(13)] +
        [((i - 4) * 1.5, CAN_Y - CAN_L / 2, 0) for i in range(9)])       # 35 castellations, 1.5 mm pitch (approx)
mod = box(CAN_W, CAN_L, MOD_T, 0, CAN_Y, 1.6)
for cx, cy, _ in CAST:
    mod -= cylz(0.55, MOD_T + 0.2, 1.5, 12).translate([cx, cy, 0])       # half-round slots routed in the module edge
sub("mcu", "ESP32-S3 module PCB, castellated edge (approx)", place_mcu(mod), COL["pcb"], SPEC["pcb"], E, mat="pcb")
sub("mcu", "Module castellated edge plating, 35 pads at 1.5 mm pitch (approx)", place_mcu(union(
    [annz(0.4, 0.55, MOD_T, 1.6, 12).translate([cx, cy, 0]) for cx, cy, _ in CAST])), COL["gold"], SPEC["metal"], E, mat="gold")
sub("mcu", "Module castellation solder fillets", place_mcu(union(
    [fillet(cx, cy, 1.58, 0.55, 0.95, 0.35, 10) for cx, cy, _ in CAST])), COL["metal"], SPEC["metal"], E, mat="tin")
CAN_Z = 1.6 + MOD_T
can = box(CAN_W - 0.6, CAN_L - 0.6, 2.4, 0, CAN_Y, CAN_Z) - box(CAN_W - 2.6, CAN_L - 2.6, 0.12, 0, CAN_Y, CAN_Z + 2.4 - 0.12)   # recessed lid panel
for i in range(4):                                                       # dimples pressed into the lid (approx)
    for j in range(5):
        can -= cylz(0.5, 0.35, CAN_Z + 2.4 - 0.18, 12).translate([(i - 1.5) * 3.2, CAN_Y + (j - 2) * 3.6, 0])
sub("mcu", "ESP32-S3 module shield can, dimpled lid (14.9 x 19.9 x 2.4 approx)", place_mcu(can), COL["metal"], SPEC["metal"], E, mat="steel")
sub("mcu", "PCB antenna keep-out at the module end (no copper) (approx)", place_mcu(
    box(W - 0.8, 2.7, 0.08, 0, -L / 2 + 1.75, 1.6) - box(7.2, 6, 2, 0, -L / 2 + 2.2, 1.0)), COL["tan"], SPEC["pcb"], E, mat="pcb")
sub("mcu", "STEMMA QT connector (front end, unused rail)", place_mcu(jst_sh4(1.6).translate([0, -L / 2 + 2.2, 0])), COL["black"], SPEC["plastic"], E, mat="plastic_matte")
sub("mcu", "STEMMA QT contacts + solder tabs", place_mcu(jst_sh4_metal(1.6).translate([0, -L / 2 + 2.2, 0])), COL["gold"], SPEC["metal"], E, mat="gold")
# Tactile buttons: 3.0 sq body, round actuator, 4 gull-wing legs (3 x 3 SMD tact class; leg layout approx)
BTN = [(-6, L / 2 - 9), (6, L / 2 - 9)]        # reset + BOOT (approx)
sub("mcu", "Reset + BOOT tactile buttons, 3 x 3 body (approx)", place_mcu(union(
    [box(3, 3, 1.5, bx, by, 1.6) - box(3.2, 0.25, 0.25, bx, by + 1.5, 1.6 + 1.25) for bx, by in BTN])), COL["plastic"], SPEC["plastic"], E, mat="plastic_matte")
sub("mcu", "Tactile button legs + solder (4 each)", place_mcu(union(
    [box(0.9, 0.7, 0.2, bx + sx * 1.75, by + sy * 1.0, 1.6) for bx, by in BTN for sx in (-1, 1) for sy in (-1, 1)])), COL["metal"], SPEC["metal"], E, mat="tin")
sub("mcu", "Button actuators (approx)", place_mcu(union([cylz(0.85, 0.6, 3.1, 24).translate([bx, by, 0]) for bx, by in BTN])), COL["black"], SPEC["plastic"], [0, 0, 16], STAGE_HW, mat="rubber")
sub("mcu", "MAX17048 fuel gauge + charger ICs (approx)", place_mcu(box(3, 3, 0.9, -5, L / 2 - 15, 1.6) + box(3, 4, 0.9, 5, L / 2 - 16, 1.6)), COL["black"], SPEC["chip"], E, mat="epoxy_black")
sub("mcu", "IC gull-wing leads + solder (approx)", place_mcu(union(
    [box(0.5, 0.35, 0.18, cx + sx * 1.75, cy + (i - 1) * 0.95, 1.6) for cx, cy in ((-5, L / 2 - 15), (5, L / 2 - 16)) for sx in (-1, 1) for i in range(3)])), COL["metal"], SPEC["metal"], E, mat="tin")
sub("mcu", "On-board NeoPixel 2 mm (GPIO33) (approx)", place_mcu(box(2.0, 2.0, 0.9, -8.0, L / 2 - 20.0, 1.6)), COL["white"], SPEC["plastic"], E, mat="plastic_gloss")
sub("mcu", "On-board NeoPixel lens (approx)", place_mcu(dome(0.75, 0.3, 2.5, 16).translate([-8.0, L / 2 - 20.0, 0])), COL["lens"], SPEC["lens"], E, mat="lens")
sub("mcu", "Charge LED (0603, amber) + D13 user LED (0603, red) (approx)", place_mcu(
    box(1.6, 0.8, 0.5, 8.5, L / 2 - 12.0, 1.6) + box(1.6, 0.8, 0.5, 8.5, L / 2 - 20.0, 1.6)), COL["led_amber"], SPEC["led"], E, mat="lens")
sub("mcu", "32.768 kHz crystal, 3.2 x 2.5 ceramic can (approx)", place_mcu(
    box(3.2, 2.5, 0.9, -8.0, -2.0, 1.6) - box(3.4, 2.7, 0.1, -8.0, -2.0, 1.6 + 0.8)), COL["metal"], SPEC["metal"], E, mat="steel")
sub("mcu", "Crystal 4 corner pads (approx)", place_mcu(union(
    [pad(1.0, 0.8, -8.0 + sx * 1.1, -2.0 + sy * 0.85, 1.6) for sx in (-1, 1) for sy in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")
# 0402 / 0603 passives drawn as real two-terminal parts (dark body + tin end-caps), approx placement clear of the can and headers
PAS_ROWS = ((-9.4, -19.0, 5, 1.0, 0.5), (9.4, -19.0, 5, 1.0, 0.5), (-2.5, 4.0, 4, 1.6, 0.8), (2.5, 4.0, 4, 1.6, 0.8), (9.4, 6.0, 3, 1.0, 0.5))
pb, pc, pp = [], [], []
for px, py, n, w, h in PAS_ROWS:
    for i in range(n):
        b, c = chip2t(w, h, 0.45, px, py + i * 1.7, 1.6, rot=90)
        pb.append(b); pc.append(c)
        pp += [pad(h * 1.35, w * 0.4, px, py + i * 1.7 + sy * w * 0.38, 1.6) for sy in (-1, 1)]
sub("mcu", "0402 / 0603 passive bodies (approx placement)", place_mcu(union(pb)), COL["black"], SPEC["chip"], E, mat="ceramic")
sub("mcu", "Passive end-caps, tinned", place_mcu(union(pc)), COL["metal"], SPEC["metal"], E, mat="tin")
sub("mcu", "Passive pads (ENIG)", place_mcu(union(pp)), COL["gold"], SPEC["metal"], E, mat="gold")
sub("mcu", "Tantalum bulk cap, 3.2 x 1.6 with polarity stripe (approx)", place_mcu(
    box(3.2, 1.6, 1.6, -7.0, 9.0, 1.6)), COL["tan"], SPEC["chip"], E, mat="epoxy_black")
sub("mcu", "Tantalum anode stripe + end terminations", place_mcu(
    box(0.5, 1.62, 1.62, -8.3, 9.0, 1.6) + union([box(0.7, 1.7, 0.25, -7.0 + sx * 1.6, 9.0, 1.6) for sx in (-1, 1)])), COL["metal"], SPEC["metal"], E, mat="tin")
# --- Feather silkscreen (white ink): board edge stripe, component outlines, polarity marks. Positions follow the parts above (approx).
silk = [silk_frame(W - 1.0, L - 1.0, 3.2 - 1.6, 0.3, 1.2, 12)]                 # board outline stripe just inside the routed edge
silk.append(silk_frame(CAN_W + 0.8, CAN_L + 0.8, 1.6, 0.3, 0.0).translate([0, CAN_Y, 0]))
silk.append(silk_dot(-CAN_W / 2 - 0.9, CAN_Y + CAN_L / 2 - 0.9, 1.6, 0.4))      # module pin-1 dot
silk.append(silk_frame(9.6, 8.0, 1.6, 0.3, 0.0).translate([0, USB_Y, 0]))
silk.append(silk_frame(5.2, 8.6, 1.6, 0.3, 0.0).translate([JST_X, JST_Y, 0]))
silk += [silk_plus(JST_X + 2.9, JST_Y + 1.0, 1.6), silk_minus(JST_X + 2.9, JST_Y - 1.0, 1.6)]    # LiPo polarity at the JST-PH
silk.append(silk_frame(4.6, 4.2, 1.6, 0.3, 0.0).translate([0, -L / 2 + 2.2, 0]))
silk += [silk_frame(3.6, 3.6, 1.6, 0.3, 0.0).translate([bx, by, 0]) for bx, by in BTN]
silk += [silk_frame(3.9, 3.2, 1.6, 0.3, 0.0).translate([-8.0, -2.0, 0])]                          # crystal outline
for n, hx, hy in HDR:                                                                             # a tick inboard of every header pin (pin label block)
    for i in range(n):
        silk.append(silk_bar(1.5, 0.3, hx - math.copysign(2.2, hx), hy + (i - (n - 1) / 2) * 2.54, 1.6))
    silk.append(silk_bar(0.3, (n - 1) * 2.54 + 2.6, hx + math.copysign(1.1, hx), hy, 1.6))         # rule along the outboard edge of each strip
for px, py, n, w, h in PAS_ROWS:                                                                  # outline round each passive row
    silk.append(silk_frame(h + 0.9, (n - 1) * 1.7 + w + 0.9, 1.6, 0.26, 0.0).translate([px, py + (n - 1) * 1.7 / 2, 0]))
silk += [silk_plus(-5.4, 9.0, 1.6), silk_bar(3.9, 0.3, -7.0, 10.2, 1.6)]                          # tantalum "+" and outline rule
sub("mcu", "Silkscreen: outline, component outlines, pin ticks, polarity marks (approx)", place_mcu(union(silk)), COL["silk"], SPEC["pcb"], E, mat="silk")

# --- Display: Adafruit 1.28" round GC9A01A. PCB 42.4 x 36.2 [product page], glass 38.1 x 35.6 [product page], active Ø32.5,
#     2 mounting holes 22.8 apart [product page] (their exact position on the PCB: unverified, drawn on the rear edge), EYESPI 18-pin FPC on the back top edge [learn guide].
E = [0, 0, 18]
dw, dh = disp["dims"][0], disp["dims"][1]
dpcb = pcb_slab(dw, dh, 1.6, 2.0)
for sx in (-1, 1):
    dpcb -= cylz(1.27, 4, -1, 20).translate([sx * disp["holes_spacing"] / 2, dh / 2 - 3.0, 0])
place_disp = lambda m: m.translate([0, 0, DISP_Z0])
sub("display", "Display PCB 42.4 x 36.2, 2 x M2 holes 22.8 apart, chamfered edges", place_disp(dpcb), COL["pcb"], SPEC["pcb"], E)
sub("display", "Backlight + LCD stack (approx)", place_disp(rrect(disp["glass"][0], disp["glass"][1], 2.4, 2.0, 1.6)), COL["white"], SPEC["plastic"], E)
AA_R = disp["active_diameter"] / 2               # Ø32.5 active area [product page]
sub("display", "Cover glass 38.1 x 35.6, Ø32.5 active area", place_disp(
    rrect(disp["glass"][0], disp["glass"][1], disp["dims"][2] - 4.0, 2.0, 4.0) - cylz(AA_R, 0.5, 5.25, 96)), COL["glass"], SPEC["glass"], E,
    screen=dict(center=[0, 0, round(DISP_Z1, 3)], normal=[0, 0, 1], up=[0, 1, 0], radius=AA_R, res=disp["res"]))
sub("display", "Ø32.5 active area, recessed 0.15 into the glass", place_disp(cylz(AA_R, 0.12, 5.25, 96)), COL["black"], SPEC["glass"], E, mat="glass")
# EYESPI 18-pin 0.5 mm FPC connector with its flip-lock (0.5 mm is the EYESPI pitch [learn guide]; body sizes approx)
eye_y = dh / 2 - 4.5
sub("display", "EYESPI 18-pin FPC connector body, rear top edge (learn guide)", place_disp(
    box(12, 5.5, 1.6, 0, eye_y, -1.6) - box(9.6, 3.2, 0.9, 0, eye_y - 1.2, -1.6 + 0.7)), COL["plastic"], SPEC["plastic"], E, mat="plastic_matte")
sub("display", "EYESPI flip-lock actuator, closed", place_disp(
    box(11.4, 1.9, 0.85, 0, eye_y + 1.7, -1.35) + union([box(1.5, 1.6, 0.85, sx * 5.2, eye_y + 0.4, -1.35) for sx in (-1, 1)])), COL["black"], SPEC["plastic"], E, mat="plastic_matte")
sub("display", "EYESPI 18 contacts at 0.5 mm pitch + 2 anchor tabs", place_disp(
    union([box(0.28, 2.6, 0.12, (i - 8.5) * 0.5, eye_y - 1.3, -1.02) for i in range(18)] +
          [box(1.4, 1.6, 0.15, sx * 5.9, eye_y, -1.6) for sx in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")
# panel FPC tail: out of the glass stack at the rear edge, round the PCB edge and back under to the EYESPI connector (approx)
fpc = (box(13.0, 4.2, 0.2, 0, dh / 2 - 2.1, 3.8)                        # bonded under the glass, out of the stack
       + box(13.0, 0.25, 5.35, 0, dh / 2 - 0.12, -1.55)                 # fold down the rear edge
       + box(13.0, 4.6, 0.2, 0, dh / 2 - 2.3, -1.55))                   # back under to the connector
sub("display", "Panel FPC tail, folded under (approx)", place_disp(fpc), COL["fpc"], SPEC["fpc"], E)
sub("display", "FPC stiffener + polyimide cover lay (approx)", place_disp(
    box(11.6, 2.4, 0.2, 0, eye_y - 0.6, -1.75) + box(13.2, 1.0, 0.12, 0, dh / 2 - 3.6, 3.76)), COL["kapton"], SPEC["plastic"], E, mat="kapton")
sub("display", "microSD holder, back (position approx)", place_disp(
    box(14, 15, 1.9, 0, -4, -1.9) - box(11.5, 1.2, 1.2, 0, -4 - 7.5, -1.55)), COL["metal"], SPEC["metal"], E, mat="steel")
sub("display", "microSD holder solder tabs", place_disp(union(
    [box(1.4, 1.2, 0.2, sx * 6.4, -4 + sy * 6.0, -1.8) for sx in (-1, 1) for sy in (-1, 1)])), COL["metal"], SPEC["metal"], E, mat="tin")
sub("display", "18-pin header pads (approx)", place_disp(header_row(18, z0=-1.6 - 0.8, pin_h=0.8).translate([0, -dh / 2 + 1.5, 0])), COL["gold"], SPEC["metal"], E, mat="gold")
sub("display", "18-pin header solder fillets", place_disp(
    header_fillets(18, r1=0.8).rotate([180, 0, 0]).translate([0, -dh / 2 + 1.5, -1.6])), COL["metal"], SPEC["metal"], E, mat="tin")
sub("display", "4 corner pads on the exposed PCB margin (approx)", place_disp(
    union([ringpad(sx * (dw / 2 - 1.2), sy * (dh / 2 - 3.0), 1.6, 0.9, 0.45) for sx in (-1, 1) for sy in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")
dpb, dpc = [], []                                       # driver-side passives on the back of the PCB (approx placement)
for i in range(7):
    b, c = chip2t(1.6, 0.8, 0.45, -dw / 2 + 3.2, -10.0 + i * 2.2, -1.6 - 0.45, rot=90)
    dpb.append(b); dpc.append(c)
for i in range(5):
    b, c = chip2t(1.0, 0.5, 0.35, dw / 2 - 3.0, -8.0 + i * 2.0, -1.6 - 0.35, rot=90)
    dpb.append(b); dpc.append(c)
sub("display", "Back-side passives (approx placement)", place_disp(union(dpb)), COL["black"], SPEC["chip"], E, mat="ceramic")
sub("display", "Back-side passive end-caps", place_disp(union(dpc)), COL["metal"], SPEC["metal"], E, mat="tin")
# --- Display silkscreen, front margin + back (approx)
dsilk = [silk_frame(dw - 1.0, dh - 1.0, 1.6, 0.3, 1.6, 12),                                   # front board outline stripe
         silk_frame(dw - 1.0, dh - 1.0, -SILK_T, 0.3, 1.6, 12),                               # back board outline stripe
         silk_frame(12.8, 6.3, -1.6 - SILK_T, 0.3, 0.0).translate([0, eye_y, 0]),             # EYESPI outline
         silk_frame(14.8, 15.8, -1.6 - SILK_T, 0.3, 0.0).translate([0, -4, 0]),               # microSD outline
         silk_dot(-6.6, eye_y - 3.4, -1.6 - SILK_T, 0.35),                                    # EYESPI pin-1 dot
         silk_bar(18.0, 0.3, 0, -dh / 2 + 3.6, -1.6 - SILK_T)]                                # rule above the 18-pin strip
for i in range(18):                                                                           # pin ticks on the header strip
    dsilk.append(silk_bar(0.3, 1.2, (i - 8.5) * 2.54, -dh / 2 + 2.9, -1.6 - SILK_T))
for sx in (-1, 1):                                                                            # mounting-hole rings
    dsilk.append(annz(1.5, 1.85, SILK_T, 1.6, 16).translate([sx * disp["holes_spacing"] / 2, dh / 2 - 3.0, 0]))
sub("display", "Silkscreen: outlines, pin ticks, pin-1 dot (approx)", place_disp(union(dsilk)), COL["silk"], SPEC["pcb"], E, mat="silk")

# --- Ring: NeoPixel Ring 24. OD 65.5 / ID 52.3 / 3.2 thick [product page]; 24 x 5050 LEDs on the LED circle [WS2812B DS: 5.0 x 5.0 mm package].
E = [0, 0, 30]
sub("ring", "Ring PCB Ø65.5 / Ø52.3", annulus(RING_RI, RING_RO, 1.6, RING_Z0), COL["pcb"], SPEC["pcb"], E,
    ring=dict(center=[0, 0, round(RING_Z0 + RING_T, 3)], radius_led=round(LED_R, 2), leds=ring["leds"], start_angle_deg=90, normal=[0, 0, 1]))
PCB_TOP = RING_Z0 + 1.6
# --- WS2812B 5050. Package 5.0 x 5.0 [WorldSemi WS2812B DS p.2 "Mechanical Dimensions", top view]; height 1.6 (5050 family, unverified
#     on that page). Recommended solder pad 1.5 x 0.9 at the four corners on a 4.2 pad-row height with 3.4 between the inner edges
#     [same DS p.2, "Solder Pad" view]. Lens aperture Ø4.0, the 3 dies, the bond wires and the pin-1 corner chamfer are approx —
#     scaled off the DS top view / pin-configuration drawing, which are not dimensioned for them.
LED_H, LENS_R = 1.6, 2.0
led_body = (box(5.0, 5.0, LED_H, 0, 0, 0)
            - box(1.3, 1.3, LED_H + 0.2, 0, 0, -0.1).rotate([0, 0, 45]).translate([-2.5, 2.5, 0])        # pin-1 corner chamfer (approx)
            - cylz(LENS_R, LED_H, 0.55, 28))                                                             # reflector bowl (approx)
led_dies = union([box(0.62, 0.62, 0.17, dx, dy, 0.55) for dx, dy in ((-0.78, -0.42), (0.0, 0.52), (0.78, -0.42))])   # R/G/B dies (approx)
led_wire = union([Manifold.batch_hull([cylz(0.045, 0.02, 0.72, 6).translate([dx, dy, 0]),
                                       cylz(0.045, 0.02, 1.02, 6).translate([dx * 0.45, dy * 0.45 + 0.1, 0]),
                                       cylz(0.045, 0.02, 0.74, 6).translate([wx, wy, 0])])
                  for (dx, dy), (wx, wy) in ((( -0.78, -0.42), (-1.62, -1.15)), ((0.0, 0.52), (0.0, 1.62)), ((0.78, -0.42), (1.62, -1.15)))])
led_lens = cylz(LENS_R, 0.9, 0.55, 28) + dome(LENS_R, 0.15, 1.45, 20)     # silicone fill, crowned flush with the 1.6 package top
led_pads = union([box(1.5, 0.9, PAD_T, sx * 2.45, sy * 1.65, -PAD_T) for sx in (-1, 1) for sy in (-1, 1)])   # DS p.2 solder pad
led_sold = union([fillet(sx * 2.45, sy * 1.65, 0.0, 0.5, 0.95, 0.42, 8) for sx in (-1, 1) for sy in (-1, 1)])
bodies, dies, wires, lenses, ledpads, ledsold, cbod, ccap, cappads = [], [], [], [], [], [], [], [], []
for i in range(ring["leds"]):
    a = 90 + i * 360 / ring["leds"]
    x, y = polar(LED_R, a)
    put = lambda m: m.rotate([0, 0, a]).translate([x, y, PCB_TOP])
    bodies.append(put(led_body)); dies.append(put(led_dies)); wires.append(put(led_wire))
    lenses.append(put(led_lens)); ledpads.append(put(led_pads)); ledsold.append(put(led_sold))
    am = a + 7.5                                                                                        # decoupling cap between pixels (approx)
    xm, ym = polar(LED_R, am)
    b, c = chip2t(1.6, 0.8, 0.45, 0, 0, 0)
    cbod.append(b.rotate([0, 0, am + 90]).translate([xm, ym, PCB_TOP])); ccap.append(c.rotate([0, 0, am + 90]).translate([xm, ym, PCB_TOP]))
    cappads += [pad(1.0, 0.7, 0, sy * 0.72, -PAD_T).rotate([0, 0, am + 90]).translate([xm, ym, PCB_TOP]) for sy in (-1, 1)]
sub("ring", "24 x WS2812B 5050 housings, reflector bowl + pin-1 chamfer (DS p.2)", union(bodies), COL["white"], SPEC["plastic"], E, mat="plastic_gloss")
sub("ring", "72 LED dies (3 per pixel, approx)", union(dies), COL["black"], SPEC["chip"], E, mat="epoxy_black")
sub("ring", "Gold bond wires (3 per pixel, approx)", union(wires), COL["gold"], SPEC["metal"], E, mat="gold")
sub("ring", "Clear silicone lens domes", union(lenses), COL["lens"], SPEC["lens"], E, mat="lens")
sub("ring", "96 LED pads, 1.5 x 0.9 (WS2812B DS p.2 solder pad)", union(ledpads), COL["gold"], SPEC["metal"], E, mat="gold")
sub("ring", "96 LED solder fillets", union(ledsold), COL["metal"], SPEC["metal"], E, mat="tin")
sub("ring", "24 decoupling caps, 0603 (approx)", union(cbod), COL["black"], SPEC["chip"], E, mat="ceramic")
sub("ring", "Decoupling cap end-caps", union(ccap), COL["metal"], SPEC["metal"], E, mat="tin")
sub("ring", "48 decoupling-cap pads (approx)", union(cappads), COL["gold"], SPEC["metal"], E, mat="gold")
sub("ring", "DIN / VCC / GND pads (lead exit at 135°)", union(
    [cylz(1.0, PAD_T, PCB_TOP, 16).translate([*polar(RING_RI + 2.0, ang), 0]) for ang in (130, 135, 140)]), COL["gold"], SPEC["metal"], E, mat="gold")
# --- Ring silkscreen: edge stripes, a box round every pixel, the data-direction arrow and the pad legends (approx)
rsilk = [annz(RING_RO - 0.75, RING_RO - 0.35, SILK_T, PCB_TOP, 128), annz(RING_RI + 0.35, RING_RI + 0.75, SILK_T, PCB_TOP, 128)]
for i in range(ring["leds"]):
    a = 90 + i * 360 / ring["leds"]
    x, y = polar(LED_R, a)
    rsilk.append(silk_frame(5.8, 5.8, PCB_TOP, 0.28, 0.0).rotate([0, 0, a]).translate([x, y, 0]))
    rsilk.append(silk_bar(0.9, 0.28, 0, 0, PCB_TOP).rotate([0, 0, a]).translate(
        [*polar(LED_R + 3.0, a + 7.5 / 2), 0]))                                                    # index tick between pixels (on-board)
for ang, lbl in ((130, -1), (135, 0), (140, 1)):                                                   # arrow at the data entry + "+ / -" legends
    rsilk.append(silk_bar(1.4, 0.28, *polar(RING_RI + 4.2, ang), PCB_TOP) if lbl == 0 else
                 (silk_plus(*polar(RING_RI + 4.2, ang), PCB_TOP) if lbl < 0 else silk_minus(*polar(RING_RI + 4.2, ang), PCB_TOP)))
sub("ring", "Silkscreen: edge stripes, 24 pixel outlines, index dots, pad legends (approx)", union(rsilk), COL["silk"], SPEC["pcb"], E, mat="silk")

# --- STEMMA QT sensor boards (Adafruit form factor 25.5 x 17.6 with QT connectors on both short ends [product pages])
STEMMA_W, STEMMA_H = 25.5, 17.6
STEMMA_HOLES = [(sx * (STEMMA_W / 2 - 2.0), -STEMMA_H / 2 + 2.0) for sx in (-1, 1)]     # 2 mounting holes (approx)
def stemma_board(chip, chip_name, group, name, place, E):
    """Adafruit STEMMA QT breakout drawn as a real board: chamfered FR4, white silkscreen outlines and legends,
    ENIG pads under every part, two-terminal passives and solder fillets. Part positions are approx (the product
    photos are not dimensioned); only the 25.5 x 17.6 outline and the 0.1 in header pitch come from the product pages."""
    bw, bh = STEMMA_W, STEMMA_H
    pcb = pcb_slab(bw, bh, 1.6, 1.5)
    for hx, hy in STEMMA_HOLES:
        pcb -= cylz(1.27, 4, -1, 20).translate([hx, hy, 0])
    sub(group, name + ", chamfered edges", place(pcb), COL["pcb"], SPEC["pcb"], E)
    QT = ((-bw / 2 + 2.2, 1.5, -90), (bw / 2 - 2.2, 1.5, 90))
    sub(group, "2 x STEMMA QT (JST SH 4-pin) connectors, cable cavity outward", place(union(
        [jst_sh4(1.6).rotate([0, 0, rz]).translate([qx, qy, 0]) for qx, qy, rz in QT])), COL["black"], SPEC["plastic"], E, mat="plastic_matte")
    sub(group, "STEMMA QT contacts + solder tabs (JST SH 1.0 mm pitch)", place(union(
        [jst_sh4_metal(1.6).rotate([0, 0, rz]).translate([qx, qy, 0]) for qx, qy, rz in QT])), COL["gold"], SPEC["metal"], E, mat="gold")
    sub(group, "6-pin header pads (gold rings, no pins fitted — wired by QT cable)", place(
        union([ringpad((i - 2.5) * 2.54, bh / 2 - 1.8, 1.6) for i in range(6)])), COL["gold"], SPEC["metal"], E, mat="gold")
    sub(group, "3.3 V regulator + level shifter (approx)", place(box(2.9, 1.6, 1.0, -7, -4, 1.6) + box(2.0, 3.0, 0.9, 7, -4, 1.6)), COL["black"], SPEC["chip"], E, mat="epoxy_black")
    sub(group, "Regulator / shifter leads + pads (approx)", place(union(
        [box(0.55, 0.45, 0.16, -7 + sx * 1.6, -4 + sy * 0.5, 1.6) for sx in (-1, 1) for sy in (-1, 1)] +
        [box(0.45, 0.6, 0.16, 7 + sx * 1.15, -4 + (i - 1) * 0.95, 1.6) for sx in (-1, 1) for i in range(3)])), COL["metal"], SPEC["metal"], E, mat="tin")
    sub(group, "Power LED (0603, green) (approx)", place(box(1.6, 0.8, 0.5, -2.0, -5.5, 1.6)), COL["led_green"], SPEC["led"], E, mat="lens")
    sb, sc, sp = [], [], []                                        # pull-ups / decoupling round the chip (approx placement)
    for i, (px, py, rot) in enumerate(((-4.4, 4.6, 0), (-2.2, 4.6, 0), (2.2, 4.6, 0), (4.4, 4.6, 0), (-9.8, -1.0, 90), (9.8, -1.0, 90), (9.8, 2.0, 90))):
        b, c = chip2t(1.6, 0.8, 0.45, px, py, 1.6, rot=rot)
        sb.append(b); sc.append(c)
        sp += [box(0.62, 0.95, PAD_T, sx * 0.62, 0, 1.6).rotate([0, 0, rot]).translate([px, py, 0]) for sx in (-1, 1)]
    sub(group, "Decoupling / pull-up passives (approx placement)", place(union(sb)), COL["black"], SPEC["chip"], E, mat="ceramic")
    sub(group, "Passive end-caps, tinned", place(union(sc)), COL["metal"], SPEC["metal"], E, mat="tin")
    sub(group, "Passive + LED pads (ENIG)", place(union(sp + [pad(0.7, 0.95, -2.0 + sx * 0.62, -5.5, 1.6) for sx in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")
    sub(group, "Header + QT solder fillets", place(union(
        [fillet((i - 2.5) * 2.54, bh / 2 - 1.8, 1.58, 0.55, 1.0, 0.4) for i in range(6)] +
        [fillet(0, 0, 1.58, 0.7, 1.1, 0.35).translate([qx + rot2(sx * 2.55, 0.9, rz)[0], qy + rot2(sx * 2.55, 0.9, rz)[1], 0])
         for qx, qy, rz in QT for sx in (-1, 1)])), COL["metal"], SPEC["metal"], E, mat="tin")
    # silkscreen: board outline, connector + chip outlines, pin legend ticks, power-LED "+" and the mounting-hole rings
    sk = [silk_frame(bw - 1.0, bh - 1.0, 1.6, 0.3, 1.1, 12),
          silk_frame(4.0, 6.6, 1.6, 0.28, 0.0).translate([QT[0][0], QT[0][1], 0]),
          silk_frame(4.0, 6.6, 1.6, 0.28, 0.0).translate([QT[1][0], QT[1][1], 0]),
          silk_frame(6.4, 6.4, 1.6, 0.28, 0.0),                                        # sensor outline in the middle
          silk_dot(-3.6, 3.6, 1.6, 0.32),                                              # sensor pin-1 dot
          silk_bar(bw - 4.0, 0.3, 0, bh / 2 - 3.4, 1.6),                               # rule under the header strip
          silk_plus(-2.0, -7.0, 1.6, 0.9, 0.24),
          silk_frame(4.2, 2.6, 1.6, 0.26, 0.0).translate([-7, -4, 0]),
          silk_frame(3.2, 4.0, 1.6, 0.26, 0.0).translate([7, -4, 0])]
    sk += [silk_bar(0.3, 1.1, (i - 2.5) * 2.54, bh / 2 - 3.9, 1.6) for i in range(6)]
    sk += [annz(1.5, 1.85, SILK_T, 1.6, 16).translate([hx, hy, 0]) for hx, hy in STEMMA_HOLES]
    sub(group, "Silkscreen: outline, part outlines, pin ticks, pin-1 dot (approx)", place(union(sk)), COL["silk"], SPEC["pcb"], E, mat="silk")
    return chip
# presence: vertical against the front wall, sensor facing -y (local +z -> world -y after Rx(90))
E = [0, -22, 0]
place_pres = lambda m: m.rotate([90, 0, 0]).translate([0, PRES_Y1, 6.0 + 17.6 / 2])
stemma_board(None, None, "presence", "STHS34PF80 breakout PCB 25.5 x 17.6", place_pres, E)
sub("presence", "STHS34PF80 sensor, OLGA-10L 3.2 x 4.2 x 1.455 (Mouser datasheet title)", place_pres(
    box(3.2, 4.2, 1.455, 0, 0, 1.6) - cylz(0.85, 0.25, 1.6 + 1.455 - 0.25, 24)), COL["metal"], SPEC["metal"], E, mat="steel",
    presence=dict(origin=[0, round(PRES_Y1 - 1.6 - 1.5, 2), 6.0 + 17.6 / 2], dir=[0, -1, 0], fov_deg=pres["fov_deg"], range_mm=pres["range_m"] * 1000))
sub("presence", "IR window in the sensor lid + pin-1 dot (aperture approx)", place_pres(
    cylz(0.85, 0.2, 1.6 + 1.455 - 0.22, 24) + cylz(0.2, 0.06, 1.6 + 1.455, 8).translate([-1.2, 1.6, 0])), COL["black"], SPEC["chip"], E, mat="epoxy_black")
sub("presence", "OLGA-10 land pads (10, approx)", place_pres(union(
    [pad(0.5, 0.35, sx * 1.35, (i - 2) * 0.85, 1.6) for sx in (-1, 1) for i in range(5)])), COL["gold"], SPEC["metal"], E, mat="gold")
# env: SHT41 flat on the floor, long axis along y
E = [-18, 0, 0]
place_env = lambda m: m.rotate([0, 0, 90]).translate([SHT_C[0], SHT_C[1], FLOOR])
stemma_board(None, None, "env", "SHT41 breakout PCB 25.5 x 17.6", place_env, E)
sub("env", "SHT41 sensor 1.5 x 1.5 x 0.5 (approx, DFN) with the RH vent opening", place_env(
    box(1.5, 1.5, 0.5, 0, 0, 1.6) - box(0.7, 0.7, 0.18, 0, 0, 1.6 + 0.32)), COL["metal"], SPEC["chip"], E, mat="steel")
sub("env", "SHT41 land pads + sensor opening (approx)", place_env(
    box(0.66, 0.66, 0.14, 0, 0, 1.6 + 0.32) + union([pad(0.34, 0.26, sx * 0.58, (i - 1) * 0.5, 1.6) for sx in (-1, 1) for i in range(3)])), COL["gold"], SPEC["metal"], E, mat="gold")
# lux: VEML7700 vertical at 45°, sensor facing outward
E = [14, 14, 0]
place_lux = lambda m: m.rotate([90, 0, 0]).translate([0, -VEML_R0, 6.0 + 17.6 / 2]).rotate([0, 0, VEML_ANG + 90])
stemma_board(None, None, "lux", "VEML7700 breakout PCB 25.5 x 17.6", place_lux, E)
sub("lux", "VEML7700 6.8 x 2.35 x 3.0 (Vishay DS p.1), clear moulding", place_lux(box(6.8, 2.35, 3.0, 0, 0, 1.6)), COL["lens"], SPEC["lens"], E, mat="lens")
sub("lux", "VEML7700 optical dome + die (dome Ø2.0 approx, centred on the package)", place_lux(
    dome(1.0, 0.45, 1.6 + 3.0, 20) + box(1.1, 1.1, 0.16, 0, 0, 1.6 + 0.35)), COL["lens"], SPEC["lens"], E, mat="lens")
sub("lux", "VEML7700 lead frame, 6 leads (approx)", place_lux(union(
    [pad(0.6, 0.45, (i - 1) * 2.0, sy * 1.05, 1.6) for i in range(3) for sy in (-1, 1)])), COL["gold"], SPEC["metal"], E, mat="gold")

# --- Cell: pouch slab (rounded 1 mm), kapton tab, red/black leads to a JST-PH plug (Adafruit: 2-pin JST-PH)
E = [0, 0, 4]
cw, cl, ct = cell["dims"]
place_cell = lambda m: m.translate([CELL_C[0], CELL_C[1], FLOOR])
sub("cell", cell["name"], place_cell(rrect(cw - 0.6, cl - 0.6, ct, 1.0)), COL["pouch"], SPEC["pouch"], E)
sub("cell", "Pouch edge seam, 0.3 mm lip (approx)", place_cell(rrect(cw, cl, 0.3, 1.2, ct / 2 - 0.15) - rrect(cw - 1.2, cl - 1.2, 1.0, 1.0, ct / 2 - 0.5)), COL["pouch"], SPEC["pouch"], E)
sub("cell", "Kapton wrap over the front end (approx)", place_cell(
    rrect(cw, 7.0, ct, 1.0, 0).translate([0, -cl / 2 + 4.0, 0]) - rrect(cw - 0.5, 7.4, ct - 0.5, 1.0, 0.25).translate([0, -cl / 2 + 4.0, 0])), COL["kapton"], SPEC["plastic"], E)
sub("cell", "Protection PCB under the kapton (front end)", box(cw - 5, 5, 0.3, CELL_C[0], CELL_C[1] - cl / 2 + 3, FLOOR + ct - 0.55), COL["kapton"], SPEC["plastic"], E, mat="kapton")
lead_y0 = CELL_C[1] - cl / 2
# Nickel tabs out of the pouch seam onto the protection PCB, with the spot-weld dimple rows (tab 3.0 x 0.1: approx)
tabs, welds = [], []
for sx in (-1, 1):
    tx = CELL_C[0] + sx * 4.0
    tabs.append(box(3.0, 4.4, 0.12, tx, CELL_C[1] - cl / 2 + 2.2, FLOOR + ct - 0.62))
    welds += [cylz(0.35, 0.16, FLOOR + ct - 0.58, 10).translate([tx + dx * 0.85, CELL_C[1] - cl / 2 + 1.0 + dy * 1.0, 0])
              for dx in (-1, 1) for dy in (0, 1)]
sub("cell", "Nickel tabs onto the protection PCB (approx)", union(tabs), COL["metal"], SPEC["metal"], E, mat="steel")
sub("cell", "Spot-weld dimples on the tabs (8, approx)", union(welds), COL["metal"], SPEC["metal"], E, mat="steel")
leads = (Manifold.cylinder(14, 0.55, 0.55, 10).rotate([90, 0, 0]).translate([CELL_C[0] - 1.5, lead_y0, FLOOR + 1.5]) +
         Manifold.cylinder(14, 0.55, 0.55, 10).rotate([90, 0, 0]).translate([CELL_C[0] + 1.5, lead_y0, FLOOR + 1.5]))
sub("cell", "Leads (red / black) to JST-PH plug", leads, COL["red"], SPEC["plastic"], E)
sub("cell", "JST-PH 2-pin plug", box(6.0, 4.5, 4.5, CELL_C[0], lead_y0 - 14 - 2.25, FLOOR), COL["plastic"], SPEC["plastic"], E)

# --- Encoder: Bourns PEC11R. Body 12.5 x 13.4 [DS], 7.0 mm behind the mounting surface + 3.7 mm pins [DS], M7 x 0.75 bushing [DS],
#     shaft Ø6 with a flat (F = 10 mm on the 20 mm shaft) [DS], washer Ø12 x 0.5, nut 10 AF x 2 [DS hardware].
E = [22, 0, 0]
ex, ey, ez = ENC_PAD_X, ENC_C[1], ENC_C[2]
along_x = lambda m: m.rotate([0, 90, 0])                          # local +z -> world +x
# Body 12.5 x 13.4, bushing M7 x 0.75, shaft Ø6.0 +/-0.1, D-flat across 4.5 +0/-0.05, shaft-end chamfer C = 0.5,
# mounting-plate locating bosses on a 13.2 span (Ø2.6 mounting holes) — all from the Bourns PEC11R datasheet,
# "PEC11R-4xxxF-Sxxxx" product-dimensions drawing. Boss Ø2.5 (fits the 2.6 hole) and the seam groove are approx.
enc_body = box(7.0, 12.5, 13.4, ex - 3.5, ey, ez - 6.7)
enc_body -= box(0.35, 13.0, 13.9, ex - 3.5, ey, ez - 6.7)                                 # crimped detent-body seam, mid height
sub("encoder", "PEC11R body 12.5 x 13.4 x 7.0 (behind the panel), crimp seam", enc_body, COL["anod"], SPEC["chip"], E, mat="steel")
sub("encoder", "Mounting plate ears + 2 locating bosses, 13.2 span (DS)",
    box(0.5, 13.4, 7.5, ex - 0.25, ey, ez - 3.75) +
    union([along_x(cylz(1.25, 1.6, 0, 20)).translate([ex, ey + sy * 6.6, ez]) for sy in (-1, 1)]),
    COL["metal"], SPEC["metal"], E, mat="steel")
PC_PINS = [(-2.5, -6.0), (0.0, -6.0), (2.5, -6.0), (-2.0, 6.0), (2.0, 6.0)]               # 3 encoder + 2 switch pins, 5.0 pitch (DS)
sub("encoder", "Rear plastic + 3 + 2 PC pins (3.7 mm)", box(3.7, 11, 12, ex - 7.0 - 1.85, ey, ez - 6) +
    union([box(0.8, 0.5, 3.7, ex - 7.0 - 1.85, ey + py, ez + pz) for py, pz in PC_PINS]), COL["black"], SPEC["plastic"], E, mat="plastic_matte")
sub("encoder", "PC-pin solder fillets (5)", union(
    [along_x(fillet(0, 0, 0, 0.45, 0.95, 0.45, 10)).rotate([0, 0, 0]).translate([ex - 8.85, ey + py, ez + pz]) for py, pz in PC_PINS]),
    COL["metal"], SPEC["metal"], E, mat="tin")
sub("encoder", "M7 x 0.75 threaded bushing, 7 mm", along_x(cylz(3.5, 7.0, 0, 48) - union(
    [annz(3.28, 3.62, 0.28, 0.55 + i * 0.75, 48) for i in range(9)])).translate([ex, ey, ez]), COL["metal"], SPEC["metal"], E, mat="steel")
shaft = along_x(cylz(3.0, 16.0, 0, 48) - box(8, 8, 10, 0, 1.5 + 4.0, 6)                      # D flat: 4.5 across (DS), over the outer 10 mm
                - Manifold.cylinder(0.5, 3.05, 2.5, 48).translate([0, 0, 15.5]))             # 0.5 shaft-end chamfer (DS "C: 0.5")
sub("encoder", "Ø6 D-shaft, 4.5 across the flat, 0.5 end chamfer (DS)", shaft.translate([ex, ey, ez]), COL["metal"], SPEC["metal"], E, mat="steel")
E_HW = scr_e(E, [1, 0, 0], 8.0)                  # crown hardware comes off outward along +x, after the encoder body
WASH_Z = WALL + 0.1 + (CAV_R - ENC_PAD_X) - DIMPLE_D
sub("encoder", "Washer Ø12 x 0.5 (PEC11R hardware)", along_x(annz(3.6, 6.0, 0.5, WASH_Z, 48)).translate([ex, ey, ez]), COL["metal"], SPEC["metal"], E_HW, STAGE_HW, mat="steel")
sub("encoder", "M7 x 0.75 nut, 10 AF x 2 (PEC11R hardware)", along_x(hexnut(10, 2.0, WASH_Z + 0.5) - cylz(3.6, 3, WASH_Z + 0.4, 48)).translate([ex, ey, ez]), COL["metal"], SPEC["metal"], E_HW, STAGE_HW, mat="steel")
knob_x0 = OUT_R - DIMPLE_D + 1.0
bore = cylz(3.2, 9.0, -1, 48) - box(8, 8, 11, 0, 1.7 + 4.0, -1)                       # D bore, flat at 1.7 over the 1.5 shaft flat (0.2 clearance)
knob = cylz(8.0, 12.0, 0, 64) - bore - cylz(5.5, 4.0, -1, 6)                          # bore for the shaft, hex counterbore over the nut
for i in range(24):                                                                    # 24 shallow knurl grooves, 0.4 deep
    knob -= cylz(0.75, 12.4, -0.2, 6).translate([*polar(8.35, i * 15), 0])
knob -= cylz(9.0, 1.0, 11.0, 48) - Manifold.cylinder(1.0, 8.0, 7.0, 48).translate([0, 0, 11.0])   # chamfer on the outer edge
knob -= cylz(1.2, 1.0, 11.4, 12).translate([0, 5.5, 0])                                # indicator dot pocket
sub("encoder", "Knob Ø16 x 12, 24-groove knurl + chamfer (printed, unverified part)", along_x(knob).translate([knob_x0, ey, ez]), COL["anod"], SPEC["anod"], E_HW, STAGE_HW)
sub("encoder", "Knob indicator dot", along_x(cylz(1.1, 0.55, 11.45, 12).translate([0, 5.5, 0])).translate([knob_x0, ey, ez]), COL["white"], SPEC["plastic"], E_HW, STAGE_HW)

# --- Fasteners: every screw is its own sub-part so it leaves on its own axis, one stage after its parent.
UP = [0, 0, 1]
for a in BOSS_ANGLES:                                                     # lid: 3 x M2 x 6, recessed heads in the boss counterbores
    x, y = polar(BOSS_R, a)
    m = (cylz(1.0, 7.0, LID_TOP - 1.5 - 6.0, 24) + Manifold.cylinder(0.3, 1.0, 1.65, 24).translate([0, 0, LID_TOP - 1.8])
         + cylz(1.9, 1.3, LID_TOP - 1.5, 24) - hex_recess(2.0, LID_TOP - 0.2, 0.75)).translate([x, y, 0])   # M2 cap head, 2 mm A/F hex socket
    sub("screws", f"M2 x 6 lid screw, hex socket, boss at {a}°", m, COL["screw"], SPEC["metal"], scr_e([0, 0, 40], UP), STAGE_HW, mat="steel")
for sx in (-1, 1):                                                        # display: 2 x M2 countersunk, down through the dish into the module holes
    m = (cylz(1.0, 4.0, DISP_Z0 - 2.0, 24) + Manifold.cylinder(1.2, 1.0, 1.9, 24).translate([0, 0, DISH_Z - 1.2])
         - ph_cross(1.9, DISH_Z, 0.5)).translate([sx * disp["holes_spacing"] / 2, disp["dims"][1] / 2 - 3.0, 0])
    sub("screws", f"M2 countersunk display screw, Phillips, {'left' if sx < 0 else 'right'} (holes 22.8 apart)", m, COL["screw"], SPEC["metal"], scr_e([0, 0, 18], UP), STAGE_HW, mat="steel")
for i, (x, y) in enumerate(MCU_HOLES):                                    # Feather: 4 x M2 into the Ø1.6 pilots in the posts, heads on the PCB
    sub("screws", f"M2 x 6 Feather post screw {i + 1} of 4", m2_screw(5.0, 1.2, MCU_Z0 + 1.6).translate([x, y, 0]), COL["screw"], SPEC["metal"], scr_e([0, 0, 10], UP), STAGE_HW)
for grp, place, axis, pe, lbl in (("presence", place_pres, [0, -1, 0], [0, -22, 0], "presence"),
                                  ("env", place_env, [0, 0, 1], [-18, 0, 0], "SHT41"),
                                  ("lux", place_lux, [math.cos(math.radians(VEML_ANG)), math.sin(math.radians(VEML_ANG)), 0], [14, 14, 0], "VEML7700")):
    for i, (hx, hy) in enumerate(STEMMA_HOLES):                           # 2 x M2 per STEMMA board into its rib/pad, heads on the component side
        sub("screws", f"M2 x 5 {lbl} board screw {i + 1} of 2 (rib mount, approx)",
            place(m2_screw(3.0, 1.2, 1.6).translate([hx, hy, 0])), COL["screw"], SPEC["metal"], scr_e(pe, axis), STAGE_HW)
for i, a in enumerate((97.5, 277.5)):                                     # ring retention: 2 nylon M2 up into the lid, between pixels (approx)
    x, y = polar(27.0, a)
    sub("screws", f"Nylon M2 x 6 ring retention screw {i + 1} of 2 (approx position)",
        m2_screw(4.0, 1.2, 0).rotate([180, 0, 0]).translate([x, y, RING_Z0]), COL["nylon"], SPEC["nylon"], scr_e([0, 0, 30], UP), STAGE_HW)

# ---------------- concept shells (B, C, D) for the demo's concepts panel ----------------
def concept_B():
    sh = box(32, 16, 62, 0, 0, 0) - box(28, 12, 58, 0, 0, 2)
    return [part("b_shell", "Tile shell 32×16×62", sh, [0.16, 0.15, 0.14], [0, 0, 0], kind="shell")[0],
            part("b_mcu", "Reverse TFT Feather 22.9×50.8", box(22.9, 1.6, 50.8, 0, -3, 6), [0.2, 0.45, 0.85], [0, -20, 0])[0],
            part("b_cell", "350 mAh 36×19.6×5.2", box(19.6, 5.2, 36, 0, 2.5, 12), [0.16, 0.55, 0.36], [0, 20, 0])[0],
            part("b_pres", "STHS34PF80 25.5×17.6", box(25.5, 4.7, 17.6, 0, -3, 58 - 17.6 - 2), [0.05, 0.65, 0.65], [0, -20, 0])[0]]
def concept_C():
    sh = box(80, 56, 28, 0, 0, 0) - Manifold.cube([90, 70, 20]).rotate([0, -12, 0]).translate([-45, -35, 26])
    sh -= box(75, 51, 20, 0, 0, 2.5)
    return [part("c_shell", "Dial wedge 80×56×28", sh, [0.16, 0.15, 0.14], [0, 0, 0], kind="shell")[0],
            part("c_cell", "1200 mAh 62×34×5", box(62, 34, 5, 0, 0, 2.5), [0.16, 0.55, 0.36], [0, 0, 4])[0],
            part("c_mcu", "Feather 52.3×22.7", box(52.3, 22.7, 7.2, 0, 0, 8), [0.2, 0.45, 0.85], [0, 0, 10])[0],
            part("c_disp", "1.3\" ST7789 35.8×35.8", box(35.8, 35.8, 5.4, -18, 0, 16), [0.85, 0.35, 0.22], [0, 0, 18])[0],
            part("c_ring", "NeoPixel 16 Ø44.5", annulus(15.85, 22.25, 6.7, 16).translate([22, 0, 0]), [0.85, 0.2, 0.45], [0, 0, 24])[0],
            part("c_knob", "Ø28 knob + PEC11R", (cyl(14, 8, 24) + cyl(6, 8, 16)).translate([22, 0, 0]), [0.5, 0.35, 0.9], [0, 0, 34])[0]]
def concept_D():
    sh = box(76, 50, 32, 0, 0, 0) - Manifold.cube([100, 70, 30]).rotate([25, 0, 0]).translate([-50, -22, 30])
    sh -= box(71, 45, 22, 0, 0, 2.5)
    return [part("d_shell", "Wedge 76×50×32", sh, [0.16, 0.15, 0.14], [0, 0, 0], kind="shell")[0],
            part("d_cell", "1200 mAh 62×34×5", box(62, 34, 5, 0, 0, 2.5), [0.16, 0.55, 0.36], [0, 0, 4])[0],
            part("d_mcu", "Feather", box(52.3, 22.7, 7.2, 0, 4, 8), [0.2, 0.45, 0.85], [0, 0, 10])[0],
            part("d_disp", "1.69\" ST7789 45.8×36.8", box(45.8, 36.8, 5.4, 0, 0, 0).rotate([25, 0, 0]).translate([0, -6, 17]), [0.85, 0.35, 0.22], [0, -10, 14])[0],
            part("d_ring", "NeoPixel 12 Ø36.8 face-down", annulus(11.65, 18.4, 3.2, 3), [0.85, 0.2, 0.45], [0, 0, -10])[0]]
concepts = [dict(id="B", name="Tile", parts=concept_B()), dict(id="C", name="Dial", parts=concept_C()), dict(id="D", name="Wedge", parts=concept_D())]

# ---------------- export ----------------
def write_stl(path, manifolds):
    tris = []
    for m in manifolds:
        mesh = m.to_mesh(); v = np.asarray(mesh.vert_properties)[:, :3]; t = np.asarray(mesh.tri_verts)
        tris.append(v[t])
    T = np.concatenate(tris)
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    with open(path, "wb") as f:
        f.write(b"puck parametric enclosure".ljust(80, b"\0")); f.write(struct.pack("<I", len(T)))
        rec = np.zeros(len(T), dtype=[("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")])
        rec["n"] = n; rec["v"] = T.reshape(-1, 9); f.write(rec.tobytes())
    return len(T)
def watertight(m):
    t = np.asarray(m.to_mesh().tri_verts); e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
    fwd = set(map(tuple, e)); return all((b, a) in fwd for a, b in fwd)

os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
out = os.path.join(ROOT, "build")
n_all = write_stl(os.path.join(out, "enclosure.stl"), [body, lid, frost])
for nm, m in (("body", body), ("lid", lid), ("frost", frost)):
    write_stl(os.path.join(out, f"enclosure_{nm}.stl"), [m])
GROUP_LABEL = {"mcu": "ESP32-S3 Feather", "display": "1.28\" round display", "ring": "NeoPixel ring 24",
               "presence": "IR presence", "env": "SHT41 temp/RH", "lux": "VEML7700 lux", "cell": "LiPo cell",
               "encoder": "Crown encoder", "body": "Body", "lid": "Lid", "frost": "Frost window", "screws": "Fasteners"}
def bbox_of(ds):
    return [[round(min(d["bbox"][0][i] for d in ds), 3) for i in range(3)],
            [round(max(d["bbox"][1][i] for d in ds), 3) for i in range(3)]]
shell_dicts = [s for s, _ in shells]
groups = ([dict(id=c["id"], name=c["name"], label=GROUP_LABEL[c["id"]], bbox=c["bbox"]) for c in comp_dicts] +
          [dict(id=s["id"], name=s["name"], label=GROUP_LABEL[s["id"]], bbox=s["bbox"]) for s in shell_dicts] +
          [dict(id="screws", name="M2 fasteners (lid, display, Feather posts, sensor boards, ring)", label="Fasteners",
                bbox=bbox_of([d for d in detail if d["group"] == "screws"]))])
geom = dict(units="mm", device=dict(name="Puck", D=2 * OUT_R, H=LID_TOP, cavity_r=CAV_R),
            parts=shell_dicts + detail, fit=fit, concepts=concepts,
            groups=groups,
            params=dict(WALL=WALL, CAV_R=CAV_R, FLOOR=FLOOR, CAV_TOP=CAV_TOP, LID_TOP=LID_TOP, LED_R=LED_R, DISP_Z1=DISP_Z1, WIN_Z=WIN_Z))
json.dump(geom, open(os.path.join(out, "geometry.json"), "w"), separators=(",", ":"))

print(f"STL: build/enclosure.stl  {n_all} triangles; body {body.num_tri()} lid {lid.num_tri()} frost {frost.num_tri()}; detail sub-parts {len(detail)} = {sum(len(d['tris'])//3 for d in detail)} tris")
print(f"watertight: body={watertight(body)} lid={watertight(lid)} frost={watertight(frost)}   volumes mm3: body={body.volume():.0f} lid={lid.volume():.0f}")
print(f"FIT ({fit['verdict']}), rule ≥{CLEAR_MIN} mm:")
print(f"{'part':10s} {'wall∩keepout':>12s} {'nearest':10s} {'aabb gap':>9s} {'clear':>6s} {'z':>4s} {'shell∩':>9s}  pass")
for r in rows:
    print(f"{r['part']:10s} {r['wall_keepout_mm3']:12.3f} {r['nearest']:10s} {r['aabb_gap_mm']:9.2f} {'ok' if r['clear_ok'] else 'NO':>6s} {'ok' if r['z_ok'] else 'NO':>4s} {r['shell_intersection_mm3']:9.3f}  {'PASS' if r['pass_'] else 'FAIL'}")
per_group = {}
for d in detail:
    per_group[d["group"]] = per_group.get(d["group"], 0) + len(d["tris"]) // 3
print("detail triangles per group:")
for g, n in sorted(per_group.items(), key=lambda kv: -kv[1]):
    print(f"  {GROUP_LABEL.get(g, g):22s} {n:6d}  ({sum(1 for d in detail if d['group'] == g)} sub-parts)")
det_tris = sum(per_group.values())
shell_tris = sum(len(s["tris"]) // 3 for s in shell_dicts)
print(f"  {'TOTAL detail':22s} {det_tris:6d}  ({len(detail)} sub-parts)")
print(f"  {'+ shells (body/lid/frost)':22s} {shell_tris:6d}")
print(f"  {'= geometry.json total':22s} {det_tris + shell_tris:6d}")
mats = {}
for d in detail:
    mats[d["mat"]] = mats.get(d["mat"], 0) + 1
print("materials: " + ", ".join(f"{k} x{v}" for k, v in sorted(mats.items())))
BUDGET_TRIS, BUDGET_BYTES = 250_000, 6 * 1024 * 1024
jb = os.path.getsize(os.path.join(out, "geometry.json"))
print(f"budget: detail {det_tris} / {BUDGET_TRIS} tris ({'OK' if det_tris <= BUDGET_TRIS else 'OVER'});"
      f"  build/geometry.json {jb / 1e6:.2f} MB / 6.00 MiB ({'OK' if jb <= BUDGET_BYTES else 'OVER'})")
for f in ("enclosure.stl", "enclosure_body.stl", "enclosure_lid.stl", "enclosure_frost.stl"):
    print(f"  build/{f:22s} {os.path.getsize(os.path.join(out, f)) / 1e6:.3f} MB")
sys.exit(0 if fit["verdict"] == "PASS" and det_tris <= BUDGET_TRIS and jb <= BUDGET_BYTES else 1)
