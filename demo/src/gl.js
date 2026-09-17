/* =============================================================================
 * gl.js — self-contained WebGL1 viewer for the Puck demo.
 *
 * No modules, no imports, no libraries. Everything here: the mat4/vec3 math,
 * the three shaders, the turntable camera, the LED glow model.
 *
 * Global entry point:  const v = createViewer(canvasEl, GEOM)
 * See the API block at the bottom of createViewer() for the returned object.
 *
 * Conventions
 *   - World units are millimetres, z is up, the device sits on z = 0 and the
 *     viewer's "front" is -y (so the default camera looks along +y).
 *   - Matrices are column-major Float32Array(16), same layout WebGL wants, so
 *     uniformMatrix4fv is always called with transpose = false.
 *   - Parts are only ever *translated* (the explode offset), never rotated or
 *     scaled, so there is no model matrix: a vec3 uniform does the job and the
 *     normals never need an inverse-transpose.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ===========================================================================
   * 1. Math — vec3 and the three mat4 operations this viewer actually needs.
   * ========================================================================= */

  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function v3cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }
  function v3norm(a) {
    var l = Math.sqrt(v3dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  /* Right-handed perspective, OpenGL clip space (z in [-1, 1]). */
  function m4perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  /* Right-handed look-at. Columns are the camera basis, last row the
   * translation into eye space (-dot(axis, eye)). */
  function m4lookAt(eye, target, up) {
    var z = v3norm(v3sub(eye, target));     // camera looks down -z
    var x = v3norm(v3cross(up, z));
    var y = v3cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -v3dot(x, eye), -v3dot(y, eye), -v3dot(z, eye), 1
    ]);
  }

  /* out = a * b, both column-major. */
  function m4mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3;
      }
    }
    return o;
  }

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function smoothstep(x) { return x * x * (3 - 2 * x); }
  /* Perceptual-ish luma, used only to decide "is the page light?" */
  function luma(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

  /* ===========================================================================
   * 2. Shaders
   *
   * Three programs, as specified:
   *   LIT    — every triangle mesh (components, shells, frost, ground, bezel)
   *   SCREEN — the round display disc
   *   GLOW   — flat radial/angular discs: the LED halo, the desk light pool
   *            and (with plain alpha blending and a black colour) the contact
   *            shadow blob.
   * ========================================================================= */

  /* Shared GLSL: samples the 24-LED ring by angle with a Gaussian angular
   * kernel, so one lit LED reads as a soft blob and a comet tail reads as a
   * bright arc that fades. Sum (not weighted mean) on purpose — a mean would
   * paint the nearest LED's colour at full strength everywhere.
   *
   * LOWUNI is defined when the GPU reports too few fragment uniform vectors to
   * hold vec3[24]; then uLeds[0] carries the ring average and the glow loses
   * its angular detail but still lights up. */
  var GLSL_LEDS = [
    'uniform vec3  uLeds[24];',   // 0..1 linear-ish, already brightness capped
    'uniform vec2  uRingC;',      // ring centre in the same space as the vertex
    'uniform float uStart;',      // angle of LED 0, radians
    'uniform float uSigma;',      // angular sigma of one LED, radians
    'uniform float uGain;',       // normalisation so a full ring peaks at ~1
    'const float TAU = 6.2831853;',
    'const float STEP = TAU / 24.0;',
    'vec3 ledAt(vec2 p) {',
    '#ifdef LOWUNI',
    '  return uLeds[0] * uGain;',
    '#else',
    '  vec2 d0 = p - uRingC;',
    '  float ang = atan(d0.y, d0.x);',
    '  vec3 c = vec3(0.0);',
    '  for (int i = 0; i < 24; i++) {',
    '    float a = uStart + float(i) * STEP;',
    '    float d = ang - a;',
    '    d = d - TAU * floor(d / TAU + 0.5);',   // wrap into [-pi, pi]
    '    c += uLeds[i] * exp(-(d * d) / (uSigma * uSigma));',
    '  }',
    '  return c * uGain;',
    '#endif',
    '}'
  ].join('\n');

  var VS_LIT = [
    'attribute vec3 aPos;',
    'attribute vec3 aNrm;',
    'uniform mat4 uVP;',
    'uniform vec4 uOffset;',      // xyz explode translation, w = the part's own bbox floor
    'varying vec3 vW;',           // world position
    'varying vec4 vL;',           // xyz un-exploded local position (LED angle), w = contact AO
    'varying vec3 vN;',
    'void main() {',
    // Contact occlusion: darken toward the part's own base plane, so things
    // sitting on the board look seated. w = -1e6 opts a mesh out (desk, bezel).
    '  vL = vec4(aPos, 1.0 - 0.38 * exp(-max(aPos.z - uOffset.w, 0.0) * 0.85));',
    '  vW = aPos + uOffset.xyz;',
    '  vN = aNrm;',
    '  gl_Position = uVP * vec4(vW, 1.0);',
    '}'
  ].join('\n');

  /* Lighting: one warm key from front-left-above, one cool fill from behind-
   * right-below, a hemispheric ambient (sky above / bounce below), and a cheap
   * environment reflection weighted by Fresnel. Normals are crease-averaged (see
   * buildMesh) and flipped toward the eye, which makes the shading independent
   * of triangle winding.
   *
   * Surface response is a GGX-ish microfacet lobe on the key light, driven by
   * uMat (roughness / metalness / sheen / detail id) and uF0 (the Fresnel
   * reflectance at normal incidence — a metal's tinted mirror colour, or ~0.04
   * for a dielectric). Metals kill the diffuse term and tint the specular, which
   * is the whole difference between a brass screw and a beige plastic one. */
  var FS_LIT = [
    'precision mediump float;',
    'varying vec3 vW;',
    'varying vec4 vL;',
    'varying vec3 vN;',
    'uniform vec3  uCam;',
    'uniform vec3  uColor;',
    'uniform float uAlpha;',
    'uniform vec4  uTint;',       // rgb + amount (fit-fail red, hover highlight)
    'uniform vec3  uFogColor;',
    'uniform float uFogDens;',
    'uniform float uEmissive;',   // 1.0 = frost window, lit by the LED ring
    'uniform vec4  uMat;',        // x roughness, y metalness, z sheen, w detail id
    'uniform vec3  uF0;',         // specular colour at normal incidence
    'uniform float uStudio;',     // 0 = dark theme, 1 = light "product visual" key/fill/ambient
    GLSL_LEDS,
    // Value noise, 4 taps of a sin hash. Cheap enough for the matte materials
    // and the brushed streak; nothing else samples it.
    'float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),',
    '             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    'void main() {',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(uCam - vW);',
    '  if (dot(N, V) < 0.0) N = -N;',                   // two-sided
    '  float rough = uMat.x;',
    '  if (uMat.w > 0.5 && uMat.w < 1.5) {',            // 1: matte breakup (soldermask, ink, matte plastic)
    '    rough += (vnoise(vL.xy * 7.0 + vL.z * 2.0) - 0.5) * 0.24;',
    '  } else if (uMat.w > 1.5 && uMat.w < 2.5) {',     // 2: brushed metal (anodised knob)
    '    rough += (vnoise(vec2(dot(vL.xy, vec2(6.0, -6.0)), vL.z * 0.6)) - 0.5) * 0.28;',
    // 5: laminated pouch foil - soft two-octave dents, NOT a brushed streak. A
    // single directional streak at this scale reads as corrugated cardboard.
    '  } else if (uMat.w > 4.5) {',
    '    float d = vnoise(vL.xy * 1.6 + vL.z * 0.9) * 0.66 + vnoise(vL.xy * 5.0) * 0.34;',
    '    rough += (d - 0.5) * 0.13;',
    '    N = normalize(N + vec3(vL.y, -vL.x, 0.0) * (d - 0.5) * 0.02);',
    '  } else if (uMat.w > 3.5) {',                     // 4: FDM print — 0.2 mm layers, 0.45 mm beads
    // Side walls show stacked layer lines (period in z); top/bottom faces show
    // the concentric extrusion beads of the solid layer (period in radius).
    '    float wall = 1.0 - abs(N.z);',
    '    float lay  = cos(vL.z * 31.416);',             // 2*pi / 0.2 mm layer height
    '    float bead = cos(length(vL.xy) * 13.963);',    // 2*pi / 0.45 mm bead width
    '    float ridge = mix(bead, lay, wall);',
    '    rough += ridge * 0.10 + (vnoise(vL.xy * 3.0 + vL.z * 9.0) - 0.5) * 0.18;',
    '    N = normalize(N + vec3(0.0, 0.0, wall * ridge * 0.055)',
    '                  + normalize(vec3(vL.xy, 0.0001)) * (1.0 - wall) * ridge * 0.045);',
    '  }',
    '  rough = clamp(rough, 0.055, 1.0);',
    '  vec3 key  = normalize(vec3(-0.45, -0.75, 0.85));',
    '  vec3 fill = normalize(vec3( 0.70,  0.55, -0.15));',
    '  float kd = max(dot(N, key), 0.0);',
    '  float fd = max(dot(N, fill), 0.0);',
    '  float NoV = max(dot(N, V), 1e-4);',
    // Contact occlusion (vertex term) x a hemisphere term: downward faces see
    // less of the sky. Applied to ambient and environment only, never to the
    // direct lights, which is what makes it read as a crevice and not as paint.
    '  float ao = vL.w * mix(0.70, 1.0, N.z * 0.5 + 0.5);',
    // Studio (light page): the key comes down ~25 %, the fill comes up and the
    // hemispheric ambient brightens, which is what a softbox + bounce card does.
    '  vec3 amb = mix(mix(vec3(0.16, 0.16, 0.18), vec3(0.34, 0.35, 0.40),',
    '                     N.z * 0.5 + 0.5),',
    '                 mix(vec3(0.28, 0.28, 0.30), vec3(0.44, 0.45, 0.48),',
    '                     N.z * 0.5 + 0.5), uStudio) * ao;',   // hemispheric
    '  vec3 base = mix(uColor, uTint.rgb, uTint.a);',
    '  vec3 F0 = mix(uF0, uTint.rgb, uTint.a * 0.5);',  // keep fit-fail red visible on metal
    '  vec3 lit = base * (1.0 - uMat.y) *',             // metals have no diffuse
    '             (amb + vec3(1.00, 0.96, 0.88) * kd * mix(0.95, 0.70, uStudio)',
    '                  + vec3(0.55, 0.62, 0.80) * fd * mix(0.30, 0.46, uStudio));',
    // GGX (Trowbridge-Reitz) D with Kelemen visibility and Schlick Fresnel: one
    // light, no loops, ~15 instructions.
    '  vec3 H = normalize(key + V);',
    '  float NoH = max(dot(N, H), 0.0);',
    '  float LoH = max(dot(key, H), 1e-3);',
    '  float a2 = rough * rough; a2 = a2 * a2;',
    '  float dn = NoH * NoH * (a2 - 1.0) + 1.0;',
    '  float D = a2 / (3.14159 * dn * dn + 1e-5);',
    '  vec3 F = F0 + (1.0 - F0) * pow(1.0 - LoH, 5.0);',
    // A point key with no area blows out on smooth materials, so the lobe gets
    // a Reinhard roll-off (saturates near 3) instead of a hard clamp to white.
    '  float sp = D * 0.25 / (LoH * LoH) * kd;',
    '  lit += (sp / (1.0 + sp * 0.32)) * F * vec3(1.0, 0.98, 0.94);',
    // Environment: one sky colour reflected by Fresnel, sharpened as roughness
    // drops. This is what gives metals a body and glass its rim.
    '  vec3 env = mix(vec3(0.20, 0.22, 0.27), vec3(0.58, 0.60, 0.66), uStudio);',
    '  float fres = pow(1.0 - NoV, 4.0);',
    '  lit += env * (F0 + (1.0 - F0) * fres) * mix(0.18, 0.85, 1.0 - rough) * ao;',
    '  if (uMat.w > 2.5) lit += env * fres * 0.40;',     // 3: glass / lens, strong rim
    '  lit += vec3(1.0) * uMat.z * pow(1.0 - NoV, 3.0) * (0.35 + kd * 0.5) * ao;',  // waxy sheen
    '  float a = uAlpha;',
    '  if (uEmissive > 0.5) {',
    '    vec3 g = ledAt(vL.xy);',
    '    lit = lit * 0.45 + g * 1.15;',                  // frost: diffuse + LEDs
    '    a = clamp(uAlpha + max(max(g.r, g.g), g.b) * 0.5, 0.0, 1.0);',
    '  }',
    '  float d = length(uCam - vW) * uFogDens;',
    '  lit = mix(lit, uFogColor, 1.0 - exp(-d * d));',   // exp2 distance fog
    '  gl_FragColor = vec4(lit, a);',
    '}'
  ].join('\n');

  /* The display disc: a flat circle textured with the live 240x240 canvas.
   * uv is in [0,1]; anything outside the inscribed circle is discarded so the
   * square texture reads as round glass. */
  var VS_SCREEN = [
    'attribute vec3 aPos;',
    'attribute vec2 aUV;',
    'uniform mat4 uVP;',
    'uniform vec3 uOffset;',
    'varying vec2 vUV;',
    'varying vec3 vW;',
    'void main() {',
    '  vUV = aUV;',
    '  vW = aPos + uOffset;',
    '  gl_Position = uVP * vec4(vW, 1.0);',
    '}'
  ].join('\n');

  var FS_SCREEN = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'varying vec3 vW;',
    'uniform sampler2D uTex;',
    'uniform float uOn;',        // 0 = dark glass, 1 = live pixels
    'uniform vec3  uCam;',
    'uniform vec3  uNrm;',       // disc facing direction
    'void main() {',
    '  vec2 p = vUV * 2.0 - 1.0;',
    '  float r = length(p);',
    '  if (r > 1.0) discard;',                            // clip to the circle
    '  vec3 N = normalize(uNrm);',
    '  vec3 V = normalize(uCam - vW);',
    '  vec3 key = normalize(vec3(-0.45, -0.75, 0.85));',
    '  vec3 H = normalize(key + V);',
    '  float spec = pow(max(dot(N, H), 0.0), 90.0);',
    '  vec3 glass = vec3(0.020, 0.021, 0.026) + vec3(0.9) * spec * 0.30;',
    '  vec3 px = texture2D(uTex, vUV).rgb;',
    '  vec3 c = mix(glass, px + vec3(0.9) * spec * 0.06, uOn);',
    '  c *= 1.0 - smoothstep(0.93, 1.0, r) * 0.55;',      // edge vignette
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  /* Flat disc used three ways (see GLOW above). Local xy is the position in the
   * disc plane relative to its centre, which is what both the radial profile
   * and the LED angle are computed from. */
  var VS_GLOW = [
    'attribute vec3 aPos;',
    'uniform mat4 uVP;',
    'uniform vec3 uOffset;',
    'uniform vec3 uScale;',      // per-axis stretch; lets one unit disc be any ellipse
    'varying vec2 vP;',
    'void main() {',
    '  vP = aPos.xy;',           // profile is evaluated pre-scale, so uRadius stays in disc units
    '  gl_Position = uVP * vec4(aPos * uScale + uOffset, 1.0);',
    '}'
  ].join('\n');

  var FS_GLOW = [
    'precision mediump float;',
    'varying vec2 vP;',
    'uniform float uRadius;',
    'uniform float uBandR;',     // > 0: glow concentrated on a ring of this radius
    'uniform float uBandW;',
    'uniform float uFall;',      // falloff exponent for the plain radial case
    'uniform vec3  uColor;',
    'uniform float uAmp;',
    'uniform float uUseLeds;',
    GLSL_LEDS,
    'void main() {',
    '  float r = length(vP);',
    '  float prof;',
    '  if (uBandR > 0.0) {',
    '    float t = (r - uBandR) / uBandW;',
    '    prof = exp(-t * t);',                            // soft annulus
    '  } else {',
    '    float k = clamp(1.0 - r / uRadius, 0.0, 1.0);',
    '    prof = pow(k, uFall);',                          // soft pool
    '  }',
    '  vec3 c = uUseLeds > 0.5 ? ledAt(vP) : uColor;',
    '  float a = prof * uAmp;',
    '  gl_FragColor = vec4(c * a, a);',
    '}'
  ].join('\n');

  /* ===========================================================================
   * 3. GL plumbing
   * ========================================================================= */

  function compile(gl, type, src, tag) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(tag + ': ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function program(gl, vs, fs, tag) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, tag + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, tag + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(tag + ': ' + gl.getProgramInfoLog(p));
    }
    // Cache every active uniform and attribute location up front.
    p.u = {}; p.a = {};
    var i, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < n; i++) {
      var nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      p.u[nm] = gl.getUniformLocation(p, nm);
    }
    n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < n; i++) {
      var an = gl.getActiveAttrib(p, i).name;
      p.a[an] = gl.getAttribLocation(p, an);
    }
    return p;
  }

  function buffer(gl, data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }

  /* ===========================================================================
   * 4. Mesh building
   * ========================================================================= */

  /* Shading normals: angle-weighted averaging with a crease threshold. A corner
   * averages only the faces meeting it whose normal is within CREASE of its own
   * face, so cylinders, domes, lenses and knobs read round while box edges and
   * chamfers stay hard. Vertices are welded by position first (the generator
   * duplicates them per face in places, which would defeat the averaging), and
   * the triangle list is de-indexed at the end so each corner owns its vertex —
   * the draw path is plain drawArrays, exactly as before.
   *
   * The source file is never trusted for normals; they are always derived here.
   * ponytail: O(corners x vertex degree) one-off at upload, no half-edge
   * structure — the biggest part is ~9k triangles, it does not need one. */
  var CREASE_COS = Math.cos(35 * Math.PI / 180);

  function buildMesh(verts, tris) {
    var nv = verts.length / 3, nf = tris.length / 3, i, f, c, o;

    /* 1. Weld by quantised position (1 um), so co-located corners share. */
    var weld = new Int32Array(nv), seen = {}, key, w;
    for (i = 0; i < nv; i++) {
      key = Math.round(verts[i * 3] * 1000) + ',' +
            Math.round(verts[i * 3 + 1] * 1000) + ',' +
            Math.round(verts[i * 3 + 2] * 1000);
      w = seen[key];
      if (w === undefined) { seen[key] = i; w = i; }
      weld[i] = w;
    }

    /* 2. Face normals and the interior angle at each corner (the weight). */
    var fn = new Float32Array(nf * 3), ang = new Float32Array(nf * 3);
    var p = [0, 0, 0], e1 = [0, 0, 0], e2 = [0, 0, 0];
    for (f = 0; f < nf; f++) {
      for (c = 0; c < 3; c++) p[c] = tris[f * 3 + c] * 3;
      for (c = 0; c < 3; c++) {
        var cur = p[c], nx1 = p[(c + 1) % 3], pr = p[(c + 2) % 3], k;
        for (k = 0; k < 3; k++) { e1[k] = verts[nx1 + k] - verts[cur + k]; e2[k] = verts[pr + k] - verts[cur + k]; }
        var l1 = Math.sqrt(v3dot(e1, e1)) || 1, l2 = Math.sqrt(v3dot(e2, e2)) || 1;
        ang[f * 3 + c] = Math.acos(clamp(v3dot(e1, e2) / (l1 * l2), -1, 1));
        if (c === 0) {
          var n = v3cross(e1, e2), ln = Math.sqrt(v3dot(n, n)) || 1;
          fn[f * 3] = n[0] / ln; fn[f * 3 + 1] = n[1] / ln; fn[f * 3 + 2] = n[2] / ln;
        }
      }
    }

    /* 3. Vertex -> corner adjacency, CSR style (corner = face * 3 + c). */
    var start = new Int32Array(nv + 1);
    for (i = 0; i < tris.length; i++) start[weld[tris[i]] + 1]++;
    for (i = 0; i < nv; i++) start[i + 1] += start[i];
    var fill = start.slice(0, nv), adj = new Int32Array(tris.length);
    for (f = 0; f < nf; f++) {
      for (c = 0; c < 3; c++) adj[fill[weld[tris[f * 3 + c]]]++] = f * 3 + c;
    }

    /* 4. De-index, averaging each corner over its crease-compatible neighbours. */
    var pos = new Float32Array(tris.length * 3);
    var nrm = new Float32Array(tris.length * 3);
    for (f = 0; f < nf; f++) {
      for (c = 0; c < 3; c++) {
        var vi = tris[f * 3 + c], fo = f * 3;
        var ax = fn[fo], ay = fn[fo + 1], az = fn[fo + 2];
        var sx = 0, sy = 0, sz = 0, v = weld[vi];
        for (i = start[v]; i < start[v + 1]; i++) {
          var g = (adj[i] / 3) | 0, go = g * 3;
          if (fn[go] * ax + fn[go + 1] * ay + fn[go + 2] * az >= CREASE_COS) {
            var wgt = ang[adj[i]];
            sx += fn[go] * wgt; sy += fn[go + 1] * wgt; sz += fn[go + 2] * wgt;
          }
        }
        var ls = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (ls < 1e-8) { sx = ax; sy = ay; sz = az; ls = 1; }
        o = (fo + c) * 3;
        pos[o] = verts[vi * 3]; pos[o + 1] = verts[vi * 3 + 1]; pos[o + 2] = verts[vi * 3 + 2];
        nrm[o] = sx / ls; nrm[o + 1] = sy / ls; nrm[o + 2] = sz / ls;
      }
    }
    return { pos: pos, nrm: nrm, count: tris.length };
  }

  /* Triangle-fan disc in the xy plane at z = 0, centred on the origin,
   * as a plain triangle list (WebGL1 has no primitive restart worth using). */
  function discMesh(radius, segs) {
    var pos = new Float32Array(segs * 9);
    var nrm = new Float32Array(segs * 9);
    for (var i = 0; i < segs; i++) {
      var a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      var o = i * 9;
      pos[o] = 0; pos[o + 1] = 0; pos[o + 2] = 0;
      pos[o + 3] = Math.cos(a0) * radius; pos[o + 4] = Math.sin(a0) * radius; pos[o + 5] = 0;
      pos[o + 6] = Math.cos(a1) * radius; pos[o + 7] = Math.sin(a1) * radius; pos[o + 8] = 0;
      for (var k = 0; k < 3; k++) { nrm[o + k * 3 + 2] = 1; }
    }
    return { pos: pos, nrm: nrm, count: segs * 3 };
  }

  /* Annulus in an arbitrary plane: used for the display bezel. `right`/`up` are
   * the in-plane basis, `c` the centre. */
  function annulusMesh(c, right, up, r0, r1, segs) {
    var pos = new Float32Array(segs * 6 * 3);
    var nrm = new Float32Array(segs * 6 * 3);
    var n = v3norm(v3cross(right, up));
    var o = 0;
    function put(r, a) {
      var ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      pos[o] = c[0] + right[0] * ca + up[0] * sa;
      pos[o + 1] = c[1] + right[1] * ca + up[1] * sa;
      pos[o + 2] = c[2] + right[2] * ca + up[2] * sa;
      nrm[o] = n[0]; nrm[o + 1] = n[1]; nrm[o + 2] = n[2];
      o += 3;
    }
    for (var i = 0; i < segs; i++) {
      var a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      put(r0, a0); put(r1, a0); put(r1, a1);
      put(r0, a0); put(r1, a1); put(r0, a1);
    }
    return { pos: pos, nrm: nrm, count: segs * 6 };
  }

  /* The display disc with texture coordinates. `up` is projected onto the disc
   * plane so the image is upright; v is flipped because canvas y runs down. */
  function screenMesh(center, normal, up, radius, segs) {
    var n = v3norm(normal);
    var u = v3sub(up, [n[0] * v3dot(up, n), n[1] * v3dot(up, n), n[2] * v3dot(up, n)]);
    if (v3dot(u, u) < 1e-9) u = Math.abs(n[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    u = v3norm(u);
    var r = v3norm(v3cross(u, n));          // right-hand: n=+z, up=+y -> r=+x
    var pos = new Float32Array(segs * 9);
    var uv = new Float32Array(segs * 6);
    var o = 0, k = 0;
    function put(cx, cy) {                  // cx, cy in [-1, 1] disc units
      pos[o] = center[0] + r[0] * cx * radius + u[0] * cy * radius;
      pos[o + 1] = center[1] + r[1] * cx * radius + u[1] * cy * radius;
      pos[o + 2] = center[2] + r[2] * cx * radius + u[2] * cy * radius;
      uv[k] = 0.5 + 0.5 * cx; uv[k + 1] = 0.5 - 0.5 * cy;
      o += 3; k += 2;
    }
    for (var i = 0; i < segs; i++) {
      var a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      put(0, 0);
      put(Math.cos(a0), Math.sin(a0));
      put(Math.cos(a1), Math.sin(a1));
    }
    return { pos: pos, uv: uv, count: segs * 3, right: r, up: u, n: n };
  }

  /* ===========================================================================
   * 5. Colour helpers
   * ========================================================================= */

  /* Parse any CSS colour by letting the 2D canvas do it. Returns [r,g,b] 0..1.
   * Falls back to the given default if the string is not a colour. */
  var parseCanvas = null;
  function cssToRGB(css, fallback) {
    try {
      if (!parseCanvas) {
        parseCanvas = document.createElement('canvas');
        parseCanvas.width = parseCanvas.height = 1;
      }
      var c = parseCanvas.getContext('2d');
      c.fillStyle = '#000';
      c.fillStyle = css;
      var s = c.fillStyle;                  // normalised to #rrggbb or rgba()
      if (s.charAt(0) === '#') {
        return [parseInt(s.substr(1, 2), 16) / 255,
                parseInt(s.substr(3, 2), 16) / 255,
                parseInt(s.substr(5, 2), 16) / 255];
      }
      var m = s.match(/([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    } catch (e) { /* fall through */ }
    return fallback;
  }

  /* ===========================================================================
   * 5b. Materials
   *
   * r     roughness, 0 mirror .. 1 chalk
   * m     metalness, 0 dielectric / 1 conductor (kills diffuse, tints specular)
   * f0    reflectance at normal incidence: a conductor's mirror colour, or the
   *       ~0.04-0.06 of a dielectric. Measured-ish values, not the part colour.
   * s     sheen: a grazing-angle whitish veil (soldermask wax, moulded plastic)
   * id    fragment detail branch: 1 matte breakup, 2 brushed streak, 3 glass
   *
   * A part names one of these in geometry.json as `mat`. Parts that do not
   * (older geometry) fall back to matFromSpec() below, which keeps the old
   * single-float look.
   * ========================================================================= */
  var DIEL = [0.045, 0.045, 0.048];
  var MATERIALS = {
    pcb:           { r: 0.62, m: 0, f0: [0.050, 0.052, 0.050], s: 0.10, id: 1 },
    silk:          { r: 0.90, m: 0, f0: DIEL,                  s: 0.03, id: 1 },
    gold:          { r: 0.26, m: 1, f0: [1.00, 0.78, 0.34],    s: 0,    id: 0 },
    tin:           { r: 0.44, m: 1, f0: [0.79, 0.79, 0.81],    s: 0,    id: 0 },
    steel:         { r: 0.27, m: 1, f0: [0.81, 0.82, 0.84],    s: 0,    id: 0 },
    alu_anod:      { r: 0.40, m: 1, f0: [0.66, 0.67, 0.70],    s: 0,    id: 2 },
    plastic_matte: { r: 0.74, m: 0, f0: DIEL,                  s: 0.06, id: 1 },
    plastic_gloss: { r: 0.20, m: 0, f0: [0.050, 0.050, 0.052], s: 0.03, id: 0 },
    epoxy_black:   { r: 0.34, m: 0, f0: [0.052, 0.052, 0.055], s: 0.05, id: 0 },
    ceramic:       { r: 0.30, m: 0, f0: [0.060, 0.060, 0.062], s: 0.04, id: 0 },
    glass:         { r: 0.045, m: 0, f0: [0.055, 0.055, 0.058], s: 0,   id: 3 },
    lens:          { r: 0.07, m: 0, f0: [0.050, 0.050, 0.053], s: 0,    id: 3 },
    diffuser:      { r: 0.82, m: 0, f0: DIEL,                  s: 0.14, id: 1 },
    pouch:         { r: 0.38, m: 1, f0: [0.74, 0.75, 0.77],    s: 0,    id: 5 },
    kapton:        { r: 0.28, m: 0, f0: [0.055, 0.052, 0.045], s: 0.08, id: 0 },
    fpc:           { r: 0.46, m: 0, f0: [0.050, 0.050, 0.048], s: 0.06, id: 1 },
    rubber:        { r: 0.86, m: 0, f0: [0.038, 0.038, 0.040], s: 0.02, id: 1 },
    // FDM-printed PETG: 0.2 mm layers, 0.45 mm beads, faintly translucent-looking
    // semi-matte. Used for the three printed shells, which carry no `mat`.
    petg_print:    { r: 0.52, m: 0, f0: [0.052, 0.052, 0.054], s: 0.11, id: 4 }
  };

  /* Fallback for geometry without `mat`: the old uSpec float, 0 matte .. 1
   * mirror, mapped onto roughness. Anything that shiny in the old data was a
   * metal (screws, gold plating, cans), so treat >= 0.85 as one and use the
   * part colour as its mirror tint — a heuristic, not a measurement. */
  function matFromSpec(spec, color) {
    var s = (typeof spec === 'number') ? clamp(spec, 0, 1) : 0.22;
    var metal = s >= 0.85 ? 1 : 0;
    return {
      r: clamp(0.95 - 0.78 * s, 0.06, 1),
      m: metal,
      f0: metal ? [color[0], color[1], color[2]] : DIEL,
      s: 0.05 * (1 - s),
      id: s < 0.35 ? 1 : 0
    };
  }

  /* ===========================================================================
   * 6. The viewer
   * ========================================================================= */

  function createViewer(canvas, GEOM) {
    var gl = null;
    try {
      var opts = { antialias: true, alpha: false, depth: true, premultipliedAlpha: true };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) { gl = null; }

    /* --- graceful degradation: no WebGL, no throw, just a message ---------- */
    if (!gl) {
      var stub = {
        ok: false, error: 'webgl-unavailable', screenDirty: false,
        setInside: function () {}, setExplode: function () {},
        setConcept: function () {}, setScreen: function () {},
        setLeds: function () {}, setFitFails: function () {},
        setHighlight: function () {}, setBackground: function () {},
        camera: function () {}, dispose: function () {},
        setZoom: function () {}, getZoom: function () { return 0; },
        onExplode: function () {}, onHover: function () {},
        anchors: function () { return []; },
        resize: function () { drawMessage(); },
        render: function () {}
      };
      function drawMessage() {
        var c2 = null;
        try { c2 = canvas.getContext('2d'); } catch (e) { return; }
        if (!c2) return;
        var w = canvas.clientWidth || 400, h = canvas.clientHeight || 300;
        canvas.width = w; canvas.height = h;
        c2.fillStyle = '#14130f';
        c2.fillRect(0, 0, w, h);
        c2.fillStyle = '#b9b3a4';
        c2.font = '14px system-ui, -apple-system, Segoe UI, sans-serif';
        c2.textAlign = 'center';
        c2.fillText('WebGL is unavailable in this browser.', w / 2, h / 2 - 8);
        c2.fillText('The 3D view cannot be shown.', w / 2, h / 2 + 12);
      }
      drawMessage();
      return stub;
    }

    /* --- device metrics --------------------------------------------------- */
    var dev = GEOM.device || {};
    var D = dev.D || 74, H = dev.H || 24;
    var target = [0, 0, H / 2];

    /* --- programs --------------------------------------------------------- */
    // vec3[24] needs 24 fragment uniform vectors on its own; a few GPUs only
    // guarantee 16 in total. Detect and fall back to a single average colour.
    var maxFU = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    var LOWUNI = maxFU < 48;
    var def = LOWUNI ? '#define LOWUNI 1\n' : '';
    var pLit, pScr, pGlow;
    try {
      pLit = program(gl, VS_LIT, def + FS_LIT, 'lit');
      pScr = program(gl, VS_SCREEN, FS_SCREEN, 'screen');
      pGlow = program(gl, VS_GLOW, def + FS_GLOW, 'glow');
    } catch (e) {
      // Shaders are the only thing here that can fail on exotic drivers.
      // Report instead of throwing, same contract as the no-WebGL path.
      if (global.console) console.error('[gl.js] shader error', e);
      return {
        ok: false, error: String(e && e.message || e), screenDirty: false,
        setInside: function () {}, setExplode: function () {},
        setConcept: function () {}, setScreen: function () {},
        setLeds: function () {}, setFitFails: function () {},
        setHighlight: function () {}, setBackground: function () {},
        setZoom: function () {}, getZoom: function () { return 0; },
        onExplode: function () {}, onHover: function () {},
        anchors: function () { return []; },
        resize: function () {}, render: function () {}, dispose: function () {}
      };
    }

    /* --- static geometry: ground, shadow blob, glow discs, light pool ------ */
    var groundR = D * 26;
    var gMesh = discMesh(groundR, 96);
    var gGround = { pos: buffer(gl, gMesh.pos), nrm: buffer(gl, gMesh.nrm), count: gMesh.count };

    // One unit-ish disc reused by every flat effect; radius is applied by the
    // mesh itself, so each effect gets its own (they are tiny).
    function glowDisc(radius, segs) {
      var m = discMesh(radius, segs || 72);
      return { buf: buffer(gl, m.pos), count: m.count, radius: radius };
    }
    var dShadow = glowDisc(D * 0.78, 64);
    var dUnit = glowDisc(1, 48);        // scaled per part for the studio shadows
    var dPool = glowDisc(D * 2.3, 80);
    var dHalo = null;   // built when a ring part is found (needs its radius)

    /* --- part upload ------------------------------------------------------ */
    function uploadPart(p) {
      var m = buildMesh(p.verts, p.tris);
      var bb = p.bbox;
      var cen = bb ? [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2, (bb[0][2] + bb[1][2]) / 2]
                   : [0, 0, 0];
      // Half extents + floor height drive the contact shadow; radius is the
      // bounding-sphere radius used by the cheap hover pick.
      var hx = bb ? (bb[1][0] - bb[0][0]) / 2 : 1;
      var hy = bb ? (bb[1][1] - bb[0][1]) / 2 : 1;
      var hz = bb ? (bb[1][2] - bb[0][2]) / 2 : 1;
      return {
        id: p.id, group: p.group || p.id, kind: p.kind || 'component', name: p.name,
        color: p.color || [0.7, 0.7, 0.7],
        spec: (typeof p.spec === 'number') ? p.spec : null,   // legacy per-part specular float
        // Named material wins; otherwise derive one from the old spec float.
        mat: MATERIALS[p.mat] || (p.kind === 'shell' ? MATERIALS.petg_print
                                 : matFromSpec(p.spec, p.color || [0.7, 0.7, 0.7])),
        alpha: (typeof p.alpha === 'number') ? p.alpha : 1,
        explode: p.explode || [0, 0, 0],
        // Optional staging: this part only starts moving once the global
        // explode amount passes `explodeStage` (screws and knobs last).
        stage: clamp(+p.explodeStage || 0, 0, 0.98),
        // Optional smoothstep easing on the part's own 0..1 amount.
        curve: (p.explodeCurve === true || p.explodeCurve === 'smoothstep'),
        screen: p.screen || null, ring: p.ring || null, presence: p.presence || null,
        center: cen, hx: hx, hy: hy, base: bb ? bb[0][2] : 0,
        radius: Math.sqrt(hx * hx + hy * hy + hz * hz),
        pos: buffer(gl, m.pos), nrm: buffer(gl, m.nrm), count: m.count,
        tris: m.count / 3
      };
    }

    /* A "set" is the device or one concept: its parts plus the derived screen,
     * bezel and halo geometry. Concepts are uploaded lazily on first use. */
    function buildSet(parts) {
      var set = { parts: [], screen: null, bezel: null, ring: null, halo: null, tris: 0 };
      for (var i = 0; i < parts.length; i++) {
        var gp = uploadPart(parts[i]);
        set.parts.push(gp);
        set.tris += gp.tris;
        if (gp.screen && !set.screen) {
          var s = gp.screen;
          var sm = screenMesh(s.center, s.normal || [0, 0, 1], s.up || [0, 1, 0],
                              s.radius, 72);
          // Lift the glass a hair along its normal so it wins the depth test
          // against the shell face it sits in.
          for (var k = 0; k < sm.pos.length; k += 3) {
            sm.pos[k] += sm.n[0] * 0.06;
            sm.pos[k + 1] += sm.n[1] * 0.06;
            sm.pos[k + 2] += sm.n[2] * 0.06;
          }
          set.screen = {
            owner: gp, n: sm.n, count: sm.count,
            pos: buffer(gl, sm.pos), uv: buffer(gl, sm.uv)
          };
          var bz = annulusMesh([s.center[0] + sm.n[0] * 0.03,
                                s.center[1] + sm.n[1] * 0.03,
                                s.center[2] + sm.n[2] * 0.03],
                               sm.right, sm.up, s.radius * 0.995, s.radius * 1.10, 72);
          set.bezel = { owner: gp, pos: buffer(gl, bz.pos), nrm: buffer(gl, bz.nrm), count: bz.count };
        }
        if (gp.ring && !set.ring) {
          set.ring = { owner: gp, r: gp.ring };
          var R = gp.ring.radius_led;
          // Halo quad: a disc wide enough to hold the bloom either side of the
          // LED circle, sitting just above the frost.
          var hm = discMesh(R * 2.2, 96);
          set.halo = { buf: buffer(gl, hm.pos), count: hm.count, R: R };
        }
      }
      return set;
    }

    var deviceSet = buildSet(GEOM.parts || []);
    var conceptSets = {};     // id -> set, built on demand
    var activeSet = deviceSet;

    /* --- screen texture --------------------------------------------------- */
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 0, 255]));
    // 240x240 is not a power of two: clamp + linear, never mipmap.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    /* --- state ------------------------------------------------------------ */
    var st = {
      inside: false,
      explode: 0,
      screenCanvas: null,
      leds: new Float32Array(72),        // 24 x vec3, 0..1
      ledMax: 0,
      ledAvg: [0, 0, 0],
      explodeTarget: 0,                  // wheel writes here; st.explode eases toward it
      fitFails: {},
      highlight: null,
      hover: null,                       // group under the pointer (cheap pick)
      bg: cssToRGB(
        (global.getComputedStyle
          ? getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
          : ''),
        cssToRGB('#14130f', [0.078, 0.075, 0.059])),
      time: 0
    };
    var studio = luma(st.bg) > 0.5 ? 1 : 0;   // light page -> product-visual lighting
    var cbExplode = [], cbHover = [];
    function fire(list, a) {
      for (var i = 0; i < list.length; i++) {
        try { list[i](a); } catch (e) { if (global.console) console.error('[gl.js] callback', e); }
      }
    }

    /* --- camera ----------------------------------------------------------- */
    // Turntable: yaw around world z, pitch clamped short of the poles so the
    // up vector never degenerates. Front of the device is -y, so yaw = 0 means
    // the camera sits on -y looking along +y.
    var geoR = Math.max(D, H) * 0.75;
    var cam = {
      yaw: 0.62, pitch: 0.46,
      dist: geoR / Math.sin(0.5) * 1.35,
      fov: 38 * Math.PI / 180
    };
    var camHome = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    var minDist = geoR * 1.05, maxDist = geoR * 14;

    // setZoom/getZoom map 0..1 onto "tight" (the device just fills the frame)
    // .. "far" (3x that). Geometric, so equal steps of t feel equal on screen.
    var tightDist = clamp(geoR / Math.tan(cam.fov / 2) * 1.02, minDist, maxDist);
    var ZOOM_SPAN = 3;
    function zoomToDist(t) {
      return clamp(tightDist * Math.pow(ZOOM_SPAN, clamp(+t || 0, 0, 1)), minDist, maxDist);
    }
    function distToZoom(d) {
      return clamp(Math.log(d / tightDist) / Math.log(ZOOM_SPAN), 0, 1);
    }

    function camPos() {
      var cp = Math.cos(cam.pitch);
      return [target[0] + cam.dist * Math.sin(cam.yaw) * cp,
              target[1] - cam.dist * Math.cos(cam.yaw) * cp,
              target[2] + cam.dist * Math.sin(cam.pitch)];
    }

    /* --- interaction ------------------------------------------------------ */
    var pointers = {}, pinchStart = 0, pinchDist = 0, dragLast = null, npointers = 0;

    function pList() {
      var a = [];
      for (var k in pointers) if (pointers.hasOwnProperty(k)) a.push(pointers[k]);
      return a;
    }
    function onDown(e) {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      npointers++;
      dragLast = { x: e.clientX, y: e.clientY };
      if (npointers === 2) {
        var p = pList();
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
        pinchStart = cam.dist;
      }
      e.preventDefault();
    }
    function setHover(g) {
      if (g === st.hover) return;
      st.hover = g;
      fire(cbHover, g);
    }
    function onMove(e) {
      // Hover pick: mouse only, and never while dragging the turntable.
      if (e.pointerType !== 'touch' && !dragLast) {
        var rect = canvas.getBoundingClientRect();
        setHover(pickAt(e.clientX - rect.left, e.clientY - rect.top));
      }
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;
      if (npointers >= 2) {
        var p = pList();
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
        cam.dist = clamp(pinchStart * (pinchDist / d), minDist, maxDist);
      } else if (dragLast) {
        var dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y;
        cam.yaw += dx * 0.0085;
        cam.pitch = clamp(cam.pitch + dy * 0.0085, -0.25, 1.45);
        dragLast = { x: e.clientX, y: e.clientY };
      }
      e.preventDefault();
    }
    function onUp(e) {
      if (pointers[e.pointerId]) { delete pointers[e.pointerId]; npointers--; }
      if (npointers < 1) dragLast = null;
      if (npointers === 1) dragLast = { x: pList()[0].x, y: pList()[0].y };
    }
    /* Wheel / trackpad scroll drives the EXPLODE amount, not zoom (pinch still
     * zooms, and so does setZoom/camera). deltaMode 1 is lines, 2 is pages. */
    function onWheel(e) {
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      var t = clamp(st.explodeTarget + d * 0.0016, 0, 1);   // down = explode more
      if (t !== st.explodeTarget) { st.explodeTarget = t; fire(cbExplode, t); }
      e.preventDefault();
    }
    function onDbl() {
      cam.yaw = camHome.yaw; cam.pitch = camHome.pitch; cam.dist = camHome.dist;
    }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDbl);
    function onLeave() { setHover(null); }
    canvas.addEventListener('pointerleave', onLeave);

    /* --- resize ----------------------------------------------------------- */
    var vpW = 1, vpH = 1;
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round((canvas.clientWidth || 640) * dpr));
      var h = Math.max(1, Math.round((canvas.clientHeight || 400) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      vpW = w; vpH = h;
      gl.viewport(0, 0, w, h);
      anchorCache = null;
    }
    resize();

    /* --- anchors: screen positions of the exploded group centres -----------
     * Computed at most once per frame and only if someone asks (the label
     * layer and the hover pick share the same cache). CSS pixels, origin at
     * the canvas top-left. */
    var anchorCache = null;

    function viewProj(eye) {
      var proj = m4perspective(cam.fov, vpW / vpH, Math.max(0.5, cam.dist * 0.02),
                               cam.dist + groundR * 2.2);
      return m4mul(proj, m4lookAt(eye, target, [0, 0, 1]));
    }

    function computeAnchors() {
      var eye = CAM || camPos();
      var vp = VP || viewProj(eye);
      var cw = canvas.clientWidth || vpW, ch = canvas.clientHeight || vpH;
      var parts = activeSet.parts, map = {}, list = [], i, k, p, a;

      for (i = 0; i < parts.length; i++) {          // 1. average the part centres
        p = parts[i];
        var off = partOffset(p);
        a = map[p.group];
        if (!a) {
          a = { group: p.group, name: p.name || p.group, n: 0, c: [0, 0, 0], pts: [] };
          map[p.group] = a; list.push(a);
        }
        var wc = [p.center[0] + off[0], p.center[1] + off[1], p.center[2] + off[2]];
        for (k = 0; k < 3; k++) a.c[k] += wc[k];
        a.n++; a.pts.push(wc); a.pts.push(p.radius);
      }

      var kPx = (ch * 0.5) / Math.tan(cam.fov / 2);   // world units -> px, at depth 1
      var out = [];
      for (i = 0; i < list.length; i++) {
        a = list[i];
        var c = [a.c[0] / a.n, a.c[1] / a.n, a.c[2] / a.n];
        var r = 0;                                    // bounding sphere about the centre
        for (k = 0; k < a.pts.length; k += 2) {
          var q = a.pts[k], dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2];
          r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz) + a.pts[k + 1]);
        }
        var cx = vp[0] * c[0] + vp[4] * c[1] + vp[8] * c[2] + vp[12];
        var cy = vp[1] * c[0] + vp[5] * c[1] + vp[9] * c[2] + vp[13];
        var cwp = vp[3] * c[0] + vp[7] * c[1] + vp[11] * c[2] + vp[15];
        var behind = cwp <= 1e-6;
        var sx = behind ? 0 : (cx / cwp * 0.5 + 0.5) * cw;
        var sy = behind ? 0 : (0.5 - cy / cwp * 0.5) * ch;
        out.push({
          group: a.group, name: a.name,
          x: sx, y: sy,
          visible: !behind && sx >= 0 && sx <= cw && sy >= 0 && sy <= ch,
          depth: behind ? Infinity : cwp,
          r: behind ? 0 : r * kPx / cwp          // projected radius, px (pick + label size)
        });
      }
      anchorCache = out;
      return out;
    }

    function anchors() { return anchorCache || computeAnchors(); }

    /* Cheap pick: pointer vs the groups' projected bounding spheres, tightest
     * fit wins so a screw beats the shell it sits in.
     * ponytail: no ray-mesh test; upgrade to an id-buffer pass if this ever
     * has to be pixel accurate. */
    function pickAt(px, py) {
      var a = anchors(), best = null, bestScore = 1;
      for (var i = 0; i < a.length; i++) {
        var q = a[i];
        if (!q.visible) continue;
        var rad = Math.max(q.r * 0.85, 12);
        var d = Math.hypot(px - q.x, py - q.y);
        var s = d / rad;
        if (s < bestScore || (s === bestScore && best && q.depth < best.depth)) {
          bestScore = s; best = q;
        }
      }
      return best ? best.group : null;
    }

    /* --- draw helpers ----------------------------------------------------- */
    var VP = null, CAM = null;

    function bindLitAttribs(pos, nrm) {
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.vertexAttribPointer(pLit.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, nrm);
      gl.vertexAttribPointer(pLit.a.aNrm, 3, gl.FLOAT, false, 0, 0);
    }

    /* Push the LED uniforms into whichever program is current. */
    function setLedUniforms(p, ringCenterXY, startDeg) {
      if (!p.u.uLeds) return;
      if (LOWUNI) {
        // Lift the mean toward the peak, or a comet reads as a dim smear.
        gl.uniform3fv(p.u.uLeds, new Float32Array(
          [st.ledAvg[0] * 3, st.ledAvg[1] * 3, st.ledAvg[2] * 3]));
      } else {
        gl.uniform3fv(p.u.uLeds, st.leds);
      }
      gl.uniform2f(p.u.uRingC, ringCenterXY[0], ringCenterXY[1]);
      gl.uniform1f(p.u.uStart, (startDeg || 0) * Math.PI / 180);
      gl.uniform1f(p.u.uSigma, 0.2356);     // 0.9 x the 15 degree LED pitch
      gl.uniform1f(p.u.uGain, 0.63);        // so a fully lit ring peaks at ~1
    }

    /* `mat` is a MATERIALS entry; `base` is the local z the contact occlusion
     * fades up from (NO_AO opts a mesh out: the desk and the bezel ring). */
    var NO_AO = -1e6;
    // Desk: chalky, no detail noise (the disc is metres across — any procedural
    // frequency that reads on a part aliases into moire out there).
    var MAT_DESK = { r: 0.92, m: 0, f0: [0.04, 0.04, 0.042], s: 0, id: 0 };
    function drawLit(part, colorOverride, alpha, tint, emissive, mat, offset, base) {
      var c = colorOverride || part.color;
      gl.uniform3f(pLit.u.uColor, c[0], c[1], c[2]);
      gl.uniform1f(pLit.u.uAlpha, alpha);
      gl.uniform4f(pLit.u.uTint, tint[0], tint[1], tint[2], tint[3]);
      gl.uniform1f(pLit.u.uEmissive, emissive);
      gl.uniform4f(pLit.u.uMat, mat.r, mat.m, mat.s, mat.id);
      gl.uniform3f(pLit.u.uF0, mat.f0[0], mat.f0[1], mat.f0[2]);
      gl.uniform4f(pLit.u.uOffset, offset[0], offset[1], offset[2],
                   (typeof base === 'number') ? base : NO_AO);
      bindLitAttribs(part.pos, part.nrm);
      gl.drawArrays(gl.TRIANGLES, 0, part.count);
    }

    /* The part's own 0..1 progress: it waits until the global amount passes its
     * stage, then runs the rest of the way (optionally eased). */
    function partAmount(p) {
      var a = p.stage > 0 ? clamp((st.explode - p.stage) / (1 - p.stage), 0, 1) : st.explode;
      return p.curve ? smoothstep(a) : a;
    }

    function partOffset(p) {
      var e = p.explode, t = partAmount(p);
      return [e[0] * t, e[1] * t, e[2] * t];
    }

    /* tint for a part: pulsing red for a fit failure, a soft lift for hover. */
    function tintFor(p) {
      if (st.fitFails[p.id] || st.fitFails[p.group]) {
        var pulse = 0.30 + 0.22 * Math.sin(st.time * 0.006);
        return [1.0, 0.16, 0.12, pulse];
      }
      if (st.highlight === p.id || st.highlight === p.group) return [1.0, 0.92, 0.70, 0.22];
      if (st.hover === p.group || st.hover === p.id) return [1.0, 0.95, 0.80, 0.12];
      return [0, 0, 0, 0];
    }

    function drawGlowDisc(disc, center, radius, bandR, bandW, fall, color, amp,
                          useLeds, startDeg, scale) {
      gl.uniform3f(pGlow.u.uOffset, center[0], center[1], center[2]);
      if (scale) gl.uniform3f(pGlow.u.uScale, scale[0], scale[1], 1);
      else gl.uniform3f(pGlow.u.uScale, 1, 1, 1);
      gl.uniform1f(pGlow.u.uRadius, radius);
      gl.uniform1f(pGlow.u.uBandR, bandR);
      gl.uniform1f(pGlow.u.uBandW, bandW);
      gl.uniform1f(pGlow.u.uFall, fall);
      gl.uniform3f(pGlow.u.uColor, color[0], color[1], color[2]);
      gl.uniform1f(pGlow.u.uAmp, amp);
      gl.uniform1f(pGlow.u.uUseLeds, useLeds ? 1 : 0);
      if (useLeds) setLedUniforms(pGlow, [0, 0], startDeg);
      gl.bindBuffer(gl.ARRAY_BUFFER, disc.buf);
      gl.vertexAttribPointer(pGlow.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, disc.count);
    }

    /* --- the frame -------------------------------------------------------- */
    function render(nowMs) {
      st.time = nowMs || 0;
      var set = activeSet;

      // Ease toward the wheel's explode target (setExplode writes both, so it
      // still lands instantly).
      if (st.explode !== st.explodeTarget) {
        var de = st.explodeTarget - st.explode;
        st.explode = Math.abs(de) < 0.002 ? st.explodeTarget : st.explode + de * 0.22;
      }

      var eye = camPos();
      CAM = eye;
      VP = viewProj(eye);
      anchorCache = null;              // positions move every frame; recompute on demand

      gl.clearColor(st.bg[0], st.bg[1], st.bg[2], 1);
      gl.clearDepth(1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* 1. Desk plane — matte, a little lighter than the background, fading
       *    into the background with distance so it has no visible edge. */
      gl.useProgram(pLit);
      gl.enableVertexAttribArray(pLit.a.aPos);
      gl.enableVertexAttribArray(pLit.a.aNrm);
      gl.uniformMatrix4fv(pLit.u.uVP, false, VP);
      gl.uniform3f(pLit.u.uCam, eye[0], eye[1], eye[2]);
      gl.uniform3f(pLit.u.uFogColor, st.bg[0], st.bg[1], st.bg[2]);
      gl.uniform1f(pLit.u.uFogDens, 1.0 / (D * 5.0));
      gl.uniform1f(pLit.u.uStudio, studio);
      setLedUniforms(pLit, [0, 0], 0);
      var deskC = [st.bg[0] * 0.55 + 0.135, st.bg[1] * 0.55 + 0.132, st.bg[2] * 0.55 + 0.125];
      drawLit(gGround, deskC, 1, [0, 0, 0, 0], 0, MAT_DESK, [0, 0, 0]);

      /* 2. Contact shadow — a soft dark disc, alpha blended, no depth write.
       *    Cheaper and calmer than a shadow map at this scale. */
      gl.useProgram(pGlow);
      gl.enableVertexAttribArray(pGlow.a.aPos);
      gl.uniformMatrix4fv(pGlow.u.uVP, false, VP);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      if (!studio) {
        drawGlowDisc(dShadow, [0, 0, 0.05], dShadow.radius, 0, 1, 2.2,
                     [0, 0, 0], 0.55, false, 0);
      } else {
        // Studio: the one blob hands over to a soft shadow per part as things
        // lift. Higher parts get a wider, lighter ellipse — same as real light.
        var e = smoothstep(clamp(st.explode * 1.6, 0, 1));
        if (e < 0.999) {
          drawGlowDisc(dShadow, [0, 0, 0.05], dShadow.radius, 0, 1, 2.2,
                       [0, 0, 0], 0.34 * (1 - e), false, 0);
        }
        if (e > 0.001) {
          var hMax = H * 2.2, pad = H * 0.10;
          for (var si = 0; si < set.parts.length; si++) {
            var sp = set.parts[si], so = partOffset(sp);
            var hN = clamp((sp.base + so[2]) / hMax, 0, 1);
            var spread = 1 + hN * 0.95;
            drawGlowDisc(dUnit, [sp.center[0] + so[0], sp.center[1] + so[1], 0.06],
                         1, 0, 1, 2.4 - 0.8 * hN, [0, 0, 0],
                         0.40 * (1 - hN * 0.70) * e, false, 0,
                         [(sp.hx + pad) * spread, (sp.hy + pad) * spread]);
          }
        }
      }

      /* 3. Light pool — the summed LED colour spilling onto the desk. */
      if (st.ledMax > 0.001) {
        gl.blendFunc(gl.ONE, gl.ONE);       // additive
        drawGlowDisc(dPool, [0, 0, 0.12], dPool.radius, 0, 1, 2.6,
                     st.ledAvg, Math.min(1, st.ledMax) * 0.55, false, 0);
      }

      /* 4. Opaque geometry: all components, plus shells when closed. */
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.useProgram(pLit);
      gl.uniformMatrix4fv(pLit.u.uVP, false, VP);
      gl.uniform3f(pLit.u.uCam, eye[0], eye[1], eye[2]);
      gl.uniform3f(pLit.u.uFogColor, st.bg[0], st.bg[1], st.bg[2]);
      gl.uniform1f(pLit.u.uFogDens, 1.0 / (D * 5.0));
      gl.uniform1f(pLit.u.uStudio, studio);

      var i, p, frosts = [], shells = [];
      for (i = 0; i < set.parts.length; i++) {
        p = set.parts[i];
        if (p.kind === 'frost') { frosts.push(p); continue; }
        if (p.kind === 'shell') {
          if (st.inside) { shells.push(p); continue; }
          drawLit(p, null, 1, tintFor(p), 0, p.mat, partOffset(p), p.base);
        } else {
          drawLit(p, null, 1, tintFor(p), 0, p.mat, partOffset(p), p.base);
        }
      }

      /* 5. Display: dark bezel ring, then the live glass. */
      if (set.bezel) {
        drawLit(set.bezel, [0.055, 0.055, 0.06], 1, [0, 0, 0, 0], 0,
                MATERIALS.plastic_matte, partOffset(set.bezel.owner));
      }
      if (set.screen) {
        var off = partOffset(set.screen.owner);
        gl.useProgram(pScr);
        gl.enableVertexAttribArray(pScr.a.aPos);
        gl.enableVertexAttribArray(pScr.a.aUV);
        gl.uniformMatrix4fv(pScr.u.uVP, false, VP);
        gl.uniform3f(pScr.u.uOffset, off[0], off[1], off[2]);
        gl.uniform3f(pScr.u.uCam, eye[0], eye[1], eye[2]);
        gl.uniform3f(pScr.u.uNrm, set.screen.n[0], set.screen.n[1], set.screen.n[2]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Re-upload the 240x240 canvas. Set v.screenDirty = false to skip.
        if (st.screenCanvas && api.screenDirty !== false) {
          try {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
                          st.screenCanvas);
          } catch (e) { /* tainted or zero-sized canvas: keep the last frame */ }
        }
        gl.uniform1i(pScr.u.uTex, 0);
        gl.uniform1f(pScr.u.uOn, st.screenCanvas ? 1 : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, set.screen.pos);
        gl.vertexAttribPointer(pScr.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, set.screen.uv);
        gl.vertexAttribPointer(pScr.a.aUV, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, set.screen.count);
        gl.disableVertexAttribArray(pScr.a.aUV);
      }

      /* 6. Frost window: translucent and emissive, sampled from the LED ring. */
      gl.useProgram(pLit);
      gl.enableVertexAttribArray(pLit.a.aPos);
      gl.enableVertexAttribArray(pLit.a.aNrm);
      gl.uniformMatrix4fv(pLit.u.uVP, false, VP);
      gl.uniform3f(pLit.u.uCam, eye[0], eye[1], eye[2]);
      if (frosts.length) {
        var rc = set.ring ? set.ring.r.center : [0, 0, 0];
        var sa = set.ring ? (set.ring.r.start_angle_deg || 0) : 0;
        setLedUniforms(pLit, [rc[0], rc[1]], sa);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (i = 0; i < frosts.length; i++) {
          p = frosts[i];
          drawLit(p, null, p.alpha, tintFor(p), 1, MATERIALS.diffuser, partOffset(p), p.base);
        }
        gl.depthMask(true);
      }

      /* 7. Translucent shell in inside-mode: back faces culled, drawn last of
       *    the solid passes, sorted back-to-front (there are only a couple). */
      if (shells.length) {
        shells.sort(function (a, b) {
          var da = 0, db = 0, k;
          for (k = 0; k < 3; k++) {
            da += (a.center[k] - eye[k]) * (a.center[k] - eye[k]);
            db += (b.center[k] - eye[k]) * (b.center[k] - eye[k]);
          }
          return db - da;
        });
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.depthMask(false);
        for (i = 0; i < shells.length; i++) {
          p = shells[i];
          drawLit(p, null, 0.18, tintFor(p), 0, p.mat, partOffset(p), p.base);
        }
        gl.disable(gl.CULL_FACE);
        gl.depthMask(true);
      }

      /* 8. The halo: one additive ring-shaped billboard above the frost, using
       *    the same angular LED sampling, so a comet sweep leaves a bright arc
       *    hanging in the air over the window. */
      if (set.halo && st.ledMax > 0.001) {
        var owner = set.ring.owner;
        var oc = set.ring.r.center, oo = partOffset(owner);
        gl.useProgram(pGlow);
        gl.enableVertexAttribArray(pGlow.a.aPos);
        gl.uniformMatrix4fv(pGlow.u.uVP, false, VP);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);
        var R = set.halo.R;
        // Two passes: a tight core and a wide bloom.
        drawGlowDisc(set.halo, [oc[0] + oo[0], oc[1] + oo[1], oc[2] + oo[2] + 0.6],
                     R * 2.2, R, R * 0.30, 2, [0, 0, 0], 0.55, true,
                     set.ring.r.start_angle_deg || 0);
        drawGlowDisc(set.halo, [oc[0] + oo[0], oc[1] + oo[1], oc[2] + oo[2] + 1.6],
                     R * 2.2, R, R * 0.85, 2, [0, 0, 0], 0.22, true,
                     set.ring.r.start_angle_deg || 0);
        gl.depthMask(true);
      }

      gl.disable(gl.BLEND);
    }

    /* =========================================================================
     * API
     * ======================================================================= */
    var api = {
      ok: true,
      /* Set false to stop re-uploading the display texture every frame; set
       * true again whenever the 240x240 canvas has been redrawn. */
      screenDirty: true,
      triangles: deviceSet.tris,

      setInside: function (b) { st.inside = !!b; },

      // Unchanged contract: the amount lands immediately (the target is kept in
      // step so the wheel's easing does not drag it back).
      setExplode: function (t) { st.explode = st.explodeTarget = clamp(+t || 0, 0, 1); },

      setConcept: function (id) {
        anchorCache = null;                       // different parts, different anchors
        if (!id) { activeSet = deviceSet; api.triangles = deviceSet.tris; return; }
        if (!conceptSets[id]) {
          var list = GEOM.concepts || [];
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { conceptSets[id] = buildSet(list[i].parts || []); break; }
          }
        }
        activeSet = conceptSets[id] || deviceSet;
        api.triangles = activeSet.tris;
      },

      setScreen: function (c) { st.screenCanvas = c || null; api.screenDirty = true; },

      /* arr: 24 x [r,g,b] with components 0..255. */
      setLeds: function (arr) {
        var mx = 0, sr = 0, sg = 0, sb = 0;
        for (var i = 0; i < 24; i++) {
          var c = (arr && arr[i]) || [0, 0, 0];
          var r = (c[0] || 0) / 255, g = (c[1] || 0) / 255, b = (c[2] || 0) / 255;
          st.leds[i * 3] = r; st.leds[i * 3 + 1] = g; st.leds[i * 3 + 2] = b;
          sr += r; sg += g; sb += b;
          mx = Math.max(mx, r, g, b);
        }
        st.ledMax = mx;
        // The mean drives the desk light pool, and stands in for the whole ring
        // on GPUs without enough fragment uniforms for the per-LED array.
        st.ledAvg = [sr / 24, sg / 24, sb / 24];
      },

      setFitFails: function (ids) {
        st.fitFails = {};
        for (var i = 0; ids && i < ids.length; i++) st.fitFails[ids[i]] = true;
      },

      setHighlight: function (id) { st.highlight = id || null; },

      setBackground: function (css) {
        st.bg = cssToRGB(css, st.bg);
        studio = luma(st.bg) > 0.5 ? 1 : 0;   // a light page switches to the studio look
      },

      resize: resize,
      render: render,

      /* --- zoom: 0 = tight (the device fills the frame), 1 = ~3x further ---- */
      setZoom: function (t) { cam.dist = zoomToDist(t); },
      getZoom: function () { return distToZoom(cam.dist); },

      /* Explode amount changed by the wheel (not by setExplode). */
      onExplode: function (cb) { if (typeof cb === 'function') cbExplode.push(cb); },

      /* Hovered group id, or null. Fires only on change. */
      onHover: function (cb) { if (typeof cb === 'function') cbHover.push(cb); },

      /* Label anchors for the current set: one per group (part.group || part.id,
       * shells included), at the exploded group centre.
       * [{ group, name, x, y, visible, depth, r }] — x/y in CSS px from the
       * canvas top-left, depth in mm along the view axis (sort descending to
       * draw back-to-front), r the projected radius in px. Cached per frame. */
      anchors: anchors,

      /* Escape hatches the page may want; not required by the spec. */
      camera: function (o) {
        if (!o) return { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
        if (typeof o.yaw === 'number') cam.yaw = o.yaw;
        if (typeof o.pitch === 'number') cam.pitch = clamp(o.pitch, -0.25, 1.45);
        if (typeof o.dist === 'number') cam.dist = clamp(o.dist, minDist, maxDist);
        return null;
      },
      resetView: onDbl,
      dispose: function () {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('dblclick', onDbl);
        canvas.removeEventListener('pointerleave', onLeave);
      }
    };

    api.setLeds(null);       // start dark
    return api;
  }

  global.createViewer = createViewer;
})(window);
