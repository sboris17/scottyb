#!/usr/bin/env node
/**
 * Static validator for docs/course-holes.json.
 *
 * Checks the geometry of all eighteen holes without needing a physics engine:
 * tee and cup sit on playable surface, no line passes through a solid, every
 * mid-line bend happens at a real wall and obeys the reflection law, water is
 * only crossed where a hole is meant to carry it, risers are only crossed by a
 * ramp, and no hole's intended route needs more strokes than its par.
 *
 * Usage: node scripts/validate-holes.mjs [--json]
 * Exit code 1 if any ERROR is reported.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(readFileSync(join(ROOT, "docs/course-holes.json"), "utf8"));

/* tolerances, metres and degrees */
const T = {
  onWall: 0.12,      // how close a bend must be to a wall to count as a bounce
  reflectDeg: 12,    // allowed departure from a true mirror bounce
  inside: 0.05,      // how deep into a solid a sample must be to count as a hit
  step: 0.02,        // sampling step along a line
  endSkip: 0.06,     // ignore this much at each end of a segment (bends sit on faces)
  coincide: 0.02,    // tee/cup must match the route ends this closely
  cupCapture: 0.25,
};

/* ---------- geometry ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };

const rectPoly = r => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];

function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const l2 = dot(ab, ab);
  const t = l2 ? Math.max(0, Math.min(1, dot(ap, ab) / l2)) : 0;
  return { d: len(sub(p, add(a, mul(ab, t)))), t, a, b };
}

function polyEdges(poly) {
  const e = [];
  for (let i = 0; i < poly.length; i++) e.push([poly[i], poly[(i + 1) % poly.length]]);
  return e;
}

const distToPoly = (p, poly) =>
  Math.min(...polyEdges(poly).map(([a, b]) => distToSeg(p, a, b).d));

/* strictly inside by a margin, so a point resting on a face is not "inside" */
const deepInside = (p, poly, m) => pointInPoly(p, poly) && distToPoly(p, poly) > m;

/* ---------- build a collision world for one hole ---------- */
function world(hole) {
  const solids = [], water = [], turfOver = [], risers = [], ramps = [], movers = [];
  for (const s of hole.shapes || []) {
    if (s.t === "rect") {
      const poly = rectPoly(s);
      if (s.k === "mass") solids.push(poly);
      else if (s.k === "water") water.push(poly);
      else if (s.k === "turf") turfOver.push(poly);
      else if (s.k === "ramp") ramps.push(s);
    } else if (s.t === "poly") {
      if (s.k === "mass") solids.push(s.pts);
      else if (s.k === "water") water.push(s.pts);
      else if (s.k === "turf") turfOver.push(s.pts);
    } else if (s.t === "riser") risers.push(s);
    else if (s.t === "mover") movers.push(s);
  }
  const pad = [[0, 0], [12, 0], [12, 12], [0, 12]];
  const walls = [...polyEdges(pad)];
  for (const s of solids) walls.push(...polyEdges(s));
  return { solids, water, turfOver, risers, ramps, movers, pad, walls };
}

const inWater = (p, w) =>
  w.water.some(q => pointInPoly(p, q)) && !w.turfOver.some(q => pointInPoly(p, q));
const inSolid = (p, w, m = T.inside) => w.solids.some(q => deepInside(p, q, m));
const onPad = p => p[0] >= -1e-9 && p[0] <= 12 && p[1] >= -1e-9 && p[1] <= 12;

/* nearest wall to a point, for classifying a bend */
function nearestWall(p, w) {
  let best = null;
  for (const [a, b] of w.walls) {
    const r = distToSeg(p, a, b);
    if (!best || r.d < best.d) best = r;
  }
  return best;
}

/* ---------- checks ---------- */
function checkHole(hole) {
  const w = world(hole);
  const issues = [];
  const say = (level, msg) => issues.push({ level, msg });

  /* 1. tee and cup sit on playable surface */
  for (const [name, p] of [["tee", hole.tee], ["cup", hole.cup]]) {
    if (!onPad(p)) say("ERROR", `${name} ${fmt(p)} is outside the 12x12 pad`);
    if (inSolid(p, w)) say("ERROR", `${name} ${fmt(p)} is inside a solid`);
    if (inWater(p, w)) say("ERROR", `${name} ${fmt(p)} is in water`);
  }

  const routes = [["intended_line", hole.intended_line], ["alt_line", hole.alt_line]];
  const report = {};

  for (const [label, path] of routes) {
    if (!path) continue;
    const r = { bounces: 0, stops: 0, strokes: 1, carry_m: 0, vertices: [] };

    /* 2. the route must actually start at the tee and finish at the cup */
    if (len(sub(path[0], hole.tee)) > T.coincide)
      say("ERROR", `${label} starts at ${fmt(path[0])}, not the tee ${fmt(hole.tee)}`);
    if (len(sub(path[path.length - 1], hole.cup)) > T.cupCapture)
      say("ERROR", `${label} ends at ${fmt(path[path.length - 1])}, not the cup ${fmt(hole.cup)}`);

    /* 3. no segment may pass through a solid; measure water crossed */
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], d = sub(b, a), L = len(d);
      if (L < 1e-6) { say("WARN", `${label} has a zero-length segment at index ${i}`); continue; }
      const u = norm(d);
      let hit = null, wet = 0;
      for (let s = T.endSkip; s <= L - T.endSkip; s += T.step) {
        const p = add(a, mul(u, s));
        if (!hit && inSolid(p, w)) hit = p;
        if (inWater(p, w)) wet += T.step;
      }
      if (hit) say("ERROR", `${label} segment ${i + 1} passes through a solid at ${fmt(hit)}`);
      r.carry_m += wet;

      /* 4. a riser may only be crossed where a ramp bridges it */
      for (const ri of w.risers) {
        const cross = segCrossHoriz(a, b, ri.y, ri.x, ri.x + ri.w);
        if (cross !== null) {
          const onRamp = w.ramps.some(rp => cross >= rp.x - 0.01 && cross <= rp.x + rp.w + 0.01);
          if (!onRamp)
            say("ERROR", `${label} crosses the 0.6 m riser at x=${cross.toFixed(2)} with no ramp there`);
        }
      }
    }

    /* 5. classify every bend: a real bounce, or the end of a stroke */
    for (let i = 1; i < path.length - 1; i++) {
      const P = path[i - 1], V = path[i], N = path[i + 1];
      const nw = nearestWall(V, w);
      if (nw.d <= T.onWall) {
        const d1 = norm(sub(V, P)), d2 = norm(sub(N, V));
        const edge = norm(sub(nw.b, nw.a));
        const n = [-edge[1], edge[0]];
        const expect = sub(d1, mul(n, 2 * dot(d1, n)));
        const errDeg = Math.acos(Math.max(-1, Math.min(1, dot(norm(expect), d2)))) * 180 / Math.PI;
        r.vertices.push({ at: V, kind: "bounce", reflect_error_deg: +errDeg.toFixed(1) });
        r.bounces++;
        if (errDeg > T.reflectDeg)
          say("ERROR", `${label} bend at ${fmt(V)} sits on a wall but is off a true bounce by ${errDeg.toFixed(0)}deg`);
      } else {
        if (inWater(V, w))
          say("ERROR", `${label} stroke ends at ${fmt(V)}, which is in water`);
        r.vertices.push({ at: V, kind: "stop", wall_dist_m: +nw.d.toFixed(2) });
        r.stops++;
      }
    }
    r.strokes = 1 + r.stops;
    r.carry_m = +r.carry_m.toFixed(2);

    /* 6. the route must be playable inside par */
    if (r.strokes > hole.par)
      say("ERROR", `${label} needs ${r.strokes} strokes but the hole is par ${hole.par}`);

    /* 7. water is only for holes designed to carry it */
    if (r.carry_m > 0.1 && hole.archetype !== "carry")
      say("WARN", `${label} crosses ${r.carry_m} m of water on a ${hole.archetype} hole`);

    report[label] = r;
  }
  return { issues, report };
}

/* x where segment a-b crosses the horizontal line y=Y within [x0,x1], else null */
function segCrossHoriz(a, b, Y, x0, x1) {
  if ((a[1] - Y) * (b[1] - Y) >= 0) return null;
  const t = (Y - a[1]) / (b[1] - a[1]);
  const x = a[0] + t * (b[0] - a[0]);
  return x >= x0 - 0.01 && x <= x1 + 0.01 ? x : null;
}

const fmt = p => `(${p[0]}, ${p[1]})`;

/* ---------- run ---------- */
const asJson = process.argv.includes("--json");
let errors = 0, warns = 0;
const out = [];

for (const hole of DATA.holes) {
  const { issues, report } = checkHole(hole);
  errors += issues.filter(i => i.level === "ERROR").length;
  warns += issues.filter(i => i.level === "WARN").length;
  out.push({ hole: hole.hole, cell: hole.cell, archetype: hole.archetype, par: hole.par, issues, report });
}

if (asJson) {
  console.log(JSON.stringify({ errors, warnings: warns, holes: out }, null, 2));
} else {
  for (const h of out) {
    const ok = h.issues.length === 0;
    const line = h.report.intended_line;
    const bits = line
      ? `${line.strokes} stroke${line.strokes > 1 ? "s" : ""}, ${line.bounces} bounce${line.bounces === 1 ? "" : "s"}` +
        (line.carry_m > 0.1 ? `, ${line.carry_m} m carry` : "")
      : "no line";
    console.log(`${ok ? "  ok " : " FAIL"}  hole ${String(h.hole).padStart(2)}  ${h.cell.padEnd(3)} ${h.archetype.padEnd(7)} par ${h.par}   ${bits}`);
    for (const i of h.issues) console.log(`        ${i.level}: ${i.msg}`);
  }
  console.log(`\n${DATA.holes.length} holes, ${errors} error(s), ${warns} warning(s)`);
}
process.exit(errors ? 1 : 0);
