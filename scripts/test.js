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
  if (!['single', 'lower', 'push', 'pull', 'core', 'cond', 'stab'].includes(e.slot)) fail(`${e.id}: bad slot`);
  if (!Array.isArray(e.r) || e.r.length !== 3 || !(e.r[0] <= e.r[1] && e.r[1] <= e.r[2])) fail(`${e.id}: reps must be 3 ascending numbers`);
  if (!['reps', 'sec', 'steps'].includes(e.u)) fail(`${e.id}: bad unit`);
  if (!e.cue) fail(`${e.id}: missing cue`);
  if (typeof e.pw !== 'boolean') fail(`${e.id}: pw must be a boolean`);
  e.eq.forEach((q) => { if (!Gen.EQUIPMENT.includes(q)) fail(`${e.id}: unknown equipment ${q}`); });
}

// ---- every movement on the coach's list is in the library
const REQUIRED = [
  'a-skip', 'air-squat', 'bear-crawl', 'bent-knee-calf-raise', 'bicycle-crunch', 'bird-dog', 'bounding',
  'bulgarian-split-squat', 'calf-raise', 'clamshell', 'copenhagen-plank-knee', 'curtsy-lunge', 'dead-bug',
  'bent-over-row', 'farmer-carry', 'flutter-kick', 'plank', 'glute-bridge', 'good-morning', 'hamstring-slider',
  'hamstring-walkout', 'heel-tap', 'high-knee-march', 'hip-airplane', 'hollow-hold', 'jump-squat',
  'banded-lateral-walk', 'lateral-lunge', 'lateral-step-down', 'alternating-jump-lunge', 'lying-leg-lower',
  'monster-walk', 'mountain-climber', 'nordic-curl', 'pallof-press', 'plank-shoulder-tap', 'double-pogo',
  'single-leg-pogo', 'prone-ytw', 'push-up', 'renegade-row', 'reverse-crunch', 'reverse-lunge', 'russian-twist',
  'shadow-boxing', 'short-foot', 'side-plank', 'side-plank-hip-dip', 'side-lying-leg-raise', 'single-arm-row',
  'single-leg-balance', 'single-leg-balance-challenge', 'single-leg-box-squat', 'single-leg-calf-raise',
  'single-leg-glute-bridge', 'single-leg-hop', 'single-leg-rdl', 'skater-hop', 'slow-mountain-climber',
  'split-squat', 'squat-calf-raise', 'standing-calf-raise', 'psoas-march', 'step-jack', 'step-up',
  'suitcase-carry', 'sumo-squat', 'superman', 'tibialis-raise', 'tibialis-wall-raise', 'walking-lunge', 'wall-sit',
];
REQUIRED.forEach((id) => { if (!ids.has(id)) fail('missing movement: ' + id); });

// ---- every phase / equipment combo has enough movements in every slot, for every format
const equipSets = [[], ['dumbbell'], ['kettlebell'], ['band'], ['step'], ['sliders'], Gen.EQUIPMENT.slice()];
const minPool = {
  amrap: { single: 4, core: 4, upper: 2, lower: 3, fifth: 3 },
  emom: { single: 4, core: 4, upper: 2, lower: 3, fifth: 3 },
  power: { single: 3, core: 4, upper: 2, lower: 3, fifth: 2 },
};
for (const phase of Gen.PHASES) {
  for (const equipment of equipSets) {
    const cfg = Gen.normalizeConfig({ phase, equipment });
    for (const fmt of Gen.FORMATS) {
      for (const [slot, min] of Object.entries(minPool[fmt])) {
        const n = Gen.slotPool(slot, exercises, cfg, fmt).length;
        if (n < min) fail(`${fmt}/${phase}/${equipment.join('+') || 'bodyweight'}: only ${n} movements for ${slot}`);
      }
    }
  }
}

// ---- generate many workouts and check the rules
const typeOf = (m) => (m.slot === 'push' || m.slot === 'pull' ? 'up' : m.slot === 'single' || m.slot === 'lower' || m.slot === 'stab' ? 'leg' : m.slot);
const stats = { amrap: { n: 0, ok: 0 }, emom: { n: 0, ok: 0 }, power: { n: 0, ok: 0 } };
const seen = new Set();
let total = 0, adjacentSame = 0;
for (const fmt of Gen.FORMATS) {
  for (const phase of Gen.PHASES) {
    for (const equipment of equipSets) {
      for (const movements of [4, 5]) {
        for (const doubleSingle of [false, true]) {
          for (const doubleCore of [false, true]) {
            const cfg = Gen.normalizeConfig({ phase, equipment, movements, doubleSingle, doubleCore, format: fmt });
            for (let s = 0; s < 15; s++) {
              const w = Gen.generate({ exercises, cfg, recent: {} }, `t|${s}|${Gen.cfgKey(cfg)}`);
              total++;
              w.moves.forEach((m) => seen.add(m.id));
              const problems = Gen.validate(w, cfg, exercises);
              if (problems.length) fail(`${Gen.cfgKey(cfg)} seed ${s}: ${problems.join(', ')}`);
              if (w.format !== fmt) fail(`asked for ${fmt}, got ${w.format}`);

              stats[fmt].n++;
              if (fmt === 'amrap') {
                if (w.roundSeconds >= Gen.ROUND_MIN && w.roundSeconds <= Gen.ROUND_MAX) stats[fmt].ok++;
              } else {
                const budget = fmt === 'power' ? Gen.POWER_BUDGET : Gen.EMOM_BUDGET;
                const fits = w.moves.every((m) => m.sec <= (m.group === 'core' && fmt === 'power' ? Gen.POWER_CORE_BUDGET : budget) + 4 && m.sec >= 14);
                if (fits) stats[fmt].ok++;
                if (w.cycles !== 20 / w.moves.length) fail('cycles must be 20 / movements');
              }
              for (let i = 1; i < w.moves.length; i++) if (typeOf(w.moves[i]) === typeOf(w.moves[i - 1])) adjacentSame++;
              if (phase === 'easing' && w.moves.some((m) => exercises.find((e) => e.id === m.id).imp > 0)) fail('impact movement in easing phase');

              // swapping any position must keep the rules intact
              for (let i = 0; i < w.moves.length; i++) {
                const sw = Gen.swap(w, i, { exercises, cfg, recent: {} }, 1);
                const p = Gen.validate(sw, cfg, exercises);
                if (p.length) fail(`swap ${i} in ${fmt} ${Gen.cfgKey(cfg)} seed ${s}: ${p.join(', ')}`);
              }
            }
          }
        }
      }
    }
  }
}

// ---- "mix" picks all three formats, and avoids repeating yesterday's
const mixCfg = Gen.normalizeConfig({ phase: 'building', equipment: ['dumbbell'], format: 'mix' });
const counts = { amrap: 0, emom: 0, power: 0 }, afterEmom = { amrap: 0, emom: 0, power: 0 };
for (let s = 0; s < 600; s++) {
  counts[Gen.generate({ exercises, cfg: mixCfg, recent: {} }, 'mix|' + s).format]++;
  afterEmom[Gen.generate({ exercises, cfg: mixCfg, recent: {}, lastFormat: 'emom' }, 'mix|' + s).format]++;
}
Gen.FORMATS.forEach((f) => { if (counts[f] < 60) fail(`mix picked ${f} only ${counts[f]} times in 600`); });
if (afterEmom.emom >= counts.emom) fail('mix did not avoid repeating yesterday\'s format');

// determinism
const cfg0 = Gen.normalizeConfig({ phase: 'building', equipment: ['dumbbell'] });
assert.deepStrictEqual(
  Gen.generate({ exercises, cfg: cfg0, recent: {} }, 'same-seed'),
  Gen.generate({ exercises, cfg: cfg0, recent: {} }, 'same-seed'),
  'same seed must give the same workout'
);

// every movement actually shows up in generated workouts
exercises.forEach((e) => { if (!seen.has(e.id)) fail(`${e.id} never appeared in ${total} generated workouts`); });

const pct = (f) => ((stats[f].ok / stats[f].n) * 100).toFixed(1);
console.log(`${total} workouts generated. In spec: AMRAP ${pct('amrap')}%, EMOM ${pct('emom')}%, Power EMOM ${pct('power')}%. Adjacent same-region neighbours: ${adjacentSame}.`);
console.log(`Mix over 600 days: AMRAP ${counts.amrap}, EMOM ${counts.emom}, Power EMOM ${counts.power}. After an EMOM day: EMOM ${afterEmom.emom}.`);
Gen.FORMATS.forEach((f) => { if (stats[f].ok / stats[f].n < 0.9) fail(`only ${pct(f)}% of ${f} workouts fit the format`); });

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed.');
