#!/usr/bin/env node
/* Sanity checks for the library and generator. Run with: npm test */
const assert = require('assert');
const exercises = require('../lib/exercises.js');
const Gen = require('../lib/generator.js');

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL: ' + msg); };

// ---- library integrity
const ids = new Set();
for (const e of exercises) {
  if (ids.has(e.id)) fail('duplicate id ' + e.id);
  ids.add(e.id);
  if (!['single', 'lower', 'push', 'pull', 'core', 'cond'].includes(e.slot)) fail(`${e.id}: bad slot`);
  if (!Array.isArray(e.r) || e.r.length !== 3 || !(e.r[0] <= e.r[1] && e.r[1] <= e.r[2])) fail(`${e.id}: reps must be 3 ascending numbers`);
  if (!['reps', 'sec', 'steps'].includes(e.u)) fail(`${e.id}: bad unit`);
  if (!e.cue) fail(`${e.id}: missing cue`);
  e.eq.forEach((q) => { if (!Gen.EQUIPMENT.includes(q)) fail(`${e.id}: unknown equipment ${q}`); });
}

// ---- every phase / equipment combo has enough movements in every slot
const equipSets = [[], ['dumbbell'], ['kettlebell'], ['band'], ['step'], ['dumbbell', 'kettlebell', 'band', 'step']];
const minPool = { single: 4, core: 4, upper: 2, lower: 3, cond: 2 };
for (const phase of Gen.PHASES) {
  for (const equipment of equipSets) {
    const cfg = Gen.normalizeConfig({ phase, equipment });
    for (const [slot, min] of Object.entries(minPool)) {
      const n = Gen.slotPool(slot, exercises, cfg).length;
      if (n < min) fail(`${phase}/${equipment.join('+') || 'bodyweight'}: only ${n} movements for ${slot}`);
    }
  }
}

// ---- generate many workouts and check the rules
let total = 0, inWindow = 0, adjacentSame = 0;
const typeOf = (m) => (m.slot === 'push' || m.slot === 'pull' ? 'up' : m.slot === 'single' || m.slot === 'lower' ? 'leg' : m.slot);
for (const phase of Gen.PHASES) {
  for (const equipment of equipSets) {
    for (const movements of [4, 5]) {
      for (const doubleSingle of [false, true]) {
        for (const doubleCore of [false, true]) {
          const cfg = Gen.normalizeConfig({ phase, equipment, movements, doubleSingle, doubleCore });
          for (let s = 0; s < 25; s++) {
            const w = Gen.generate({ exercises, cfg, recent: {} }, `t|${s}|${Gen.cfgKey(cfg)}`);
            total++;
            const problems = Gen.validate(w, cfg, exercises);
            if (problems.length) fail(`${Gen.cfgKey(cfg)} seed ${s}: ${problems.join(', ')}`);
            if (w.roundSeconds >= Gen.ROUND_MIN && w.roundSeconds <= Gen.ROUND_MAX) inWindow++;
            for (let i = 1; i < w.moves.length; i++) if (typeOf(w.moves[i]) === typeOf(w.moves[i - 1])) adjacentSame++;
            if (phase === 'easing' && w.moves.some((m) => exercises.find((e) => e.id === m.id).imp > 0)) fail('impact movement in easing phase');

            // swapping any position must keep the rules intact
            for (let i = 0; i < w.moves.length; i++) {
              const sw = Gen.swap(w, i, { exercises, cfg, recent: {} }, 1);
              const p = Gen.validate(sw, cfg, exercises);
              if (p.length) fail(`swap ${i} in ${Gen.cfgKey(cfg)} seed ${s}: ${p.join(', ')}`);
            }
          }
        }
      }
    }
  }
}

// determinism
const cfg0 = Gen.normalizeConfig({ phase: 'building', equipment: ['dumbbell'] });
assert.deepStrictEqual(
  Gen.generate({ exercises, cfg: cfg0, recent: {} }, 'same-seed'),
  Gen.generate({ exercises, cfg: cfg0, recent: {} }, 'same-seed'),
  'same seed must give the same workout'
);

const pct = ((inWindow / total) * 100).toFixed(1);
console.log(`${total} workouts generated. Round time in target window: ${pct}%. Adjacent same-region neighbours: ${adjacentSame}.`);
if (inWindow / total < 0.9) fail(`only ${pct}% of workouts land in the round-time window`);

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed.');
