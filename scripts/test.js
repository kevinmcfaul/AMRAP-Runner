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

// ---- pain flags, plan modifiers
{
  const Plan = require('../lib/plan.js');
  const A = Gen.AREAS;
  let n = 0;
  for (let m = 0; m < 1 << A.length; m += 3) {
    const flags = A.filter((_, i) => (m >> i) & 1);
    for (const phase of Gen.PHASES) for (const equipment of [[], Gen.EQUIPMENT]) for (const format of Gen.FORMAT_CHOICES) {
      for (const plan of [undefined, Plan.OPTIONAL, { vol: 0.6, singlePref: 'always', allowPower: false }]) {
        const cfg = Gen.normalizeConfig({ phase, equipment, format, flags });
        let w;
        try { w = Gen.generate({ exercises, cfg, recent: {}, plan }, 'f' + m + phase); } catch (e) { fail(`flags ${flags} ${phase} ${format}: ${e.message}`); continue; }
        n++;
        const probs = Gen.validate(w, cfg, exercises, plan);
        if (probs.length) fail(`flags ${flags} ${phase} ${format}: ${probs.join(', ')}`);
        if (plan && plan.noImpact && w.moves.some((x) => exercises.find((e) => e.id === x.id).imp > 0)) fail('impact movement on a no-impact day');
        if (plan && plan.allowPower === false && w.format === 'power') fail('power on a no-power day');
      }
    }
  }
  const knee = Gen.normalizeConfig({ phase: 'ready', flags: ['knee'] });
  for (let s = 0; s < 100; s++) {
    Gen.generate({ exercises, cfg: knee, recent: {} }, 'k' + s).moves.forEach((x) => {
      if (['lunge', 'stepdown', 'squat', 'jump', 'hop'].includes(x.pat)) fail('knee flag let through ' + x.id);
    });
  }
  const base = Gen.normalizeConfig({ phase: 'building', format: 'amrap' });
  const full = Gen.generate({ exercises, cfg: base, recent: {}, plan: undefined }, 'vol');
  const half = Gen.generate({ exercises, cfg: base, recent: {}, plan: { vol: 0.6 } }, 'vol');
  if (half.repsPerRound >= full.repsPerRound) fail('vol did not reduce reps');
  if (Gen.cfgKey(Gen.normalizeConfig({ flags: ['knee'] })) === Gen.cfgKey(Gen.normalizeConfig({}))) fail('flags missing from cfgKey');
  console.log(`${n} flag and plan-modifier workouts checked.`);

  // ---- weekly layout and blocks
  const sch = Plan.normalizeSchedule({ sessionsPerWeek: 3, longRunDay: 'Sat', hardRunDays: ['Tue'] });
  const pl = Plan.normalizePlan({});
  const ctx = { schedule: sch, plan: pl, planStart: '2026-11-16' };
  const stages = [];
  for (let w = 0; w < 10; w++) {
    const mon = Plan.addDays('2026-11-16', w * 7);
    const wk = Plan.planWeek(mon, ctx);
    const sess = wk.days.filter((d) => d.kind === 'session');
    const st = Plan.stageFor(pl, mon, '2026-11-16').id;
    stages.push(st);
    const want = st === 'deload' ? 2 : 3;
    if (sess.length !== want) fail(`week ${w} (${st}) has ${sess.length} sessions`);
    wk.days.forEach((d, i) => { if (d.kind === 'session' && (i === 5 || i === 1)) fail('session on a run day'); });
    const idx = sess.map((d) => wk.days.indexOf(d));
    idx.forEach((a) => idx.forEach((b) => { if (a !== b && (Math.abs(a - b) === 1 || Math.abs(a - b) === 6) && sess.length < 4) fail('back-to-back sessions'); }));
    if (st === 'deload' && sess.some((d) => d.intensity !== 'light')) fail('deload session not light');
    if (wk.days[4].kind === 'session' && wk.days[4].intensity !== 'light') fail('day before the long run is not light');
    assert.deepStrictEqual(wk, Plan.planWeek(mon, ctx));
  }
  assert.deepStrictEqual(stages, ['base', 'base', 'base', 'base', 'deload', 'build', 'build', 'build', 'build', 'deload'], 'block order');
  const race = Plan.normalizePlan({ raceDate: '2027-01-30' });
  const rs = (d) => Plan.stageFor(race, d, '2026-11-16').id;
  assert.strictEqual(rs('2026-11-30'), 'base');
  assert.strictEqual(rs('2026-12-10'), 'maintain');
  assert.strictEqual(rs('2027-01-25'), 'taper');
  assert.strictEqual(rs('2027-01-30'), 'race');
  assert.strictEqual(rs('2027-02-03'), 'recovery');
  const rd = Plan.planDay('2026-11-17', ctx, {});
  if (!rd.restDay) fail('hard run day should be a rest day for strength');
  // readiness
  assert.strictEqual(Plan.readiness([{ date: '2026-11-17', rpe: 9, soreness: 1 }], '2026-11-18').light, true);
  assert.strictEqual(Plan.readiness([{ date: '2026-11-17', rpe: 8, soreness: 0 }], '2026-11-18').vol, 0.85);
  assert.strictEqual(Plan.readiness([{ date: '2026-11-18', rpe: 10 }], '2026-11-18').vol, 1, 'same-day entries are ignored');
  const easy = [1, 2, 3].map((i) => ({ date: Plan.addDays('2026-11-10', i), rpe: 4, soreness: 0 }));
  assert.strictEqual(Plan.readiness(easy, '2026-11-15').suggestUp, true);
  assert.deepStrictEqual(Plan.activeFlags([{ area: 'calf', until: '2026-11-01' }, 'knee', { area: 'hip', until: '2026-12-01' }], '2026-11-10'), ['knee', 'hip']);

  // ---- generate.js end to end on a throwaway folder
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amrap-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.copyFileSync(path.join(__dirname, '..', 'config.json'), path.join(dir, 'config.json'));
  fs.writeFileSync(path.join(dir, 'data', 'athlete.json'), JSON.stringify({ weakerSide: 'left', flags: [{ area: 'knee', until: '2099-01-01' }], log: [] }));
  const run = (date, env) => cp.execFileSync('node', [path.join(__dirname, 'generate.js')], { env: Object.assign({}, process.env, { AMRAP_ROOT: dir, AMRAP_DATE: date }, env), encoding: 'utf8' });
  const today = () => JSON.parse(fs.readFileSync(path.join(dir, 'data', 'today.json'), 'utf8'));
  run('2026-11-17');
  if (today().workout !== null || !today().restDay) fail('hard run day did not produce a rest day');
  run('2026-11-18');
  const t1 = today();
  if (!t1.workout || t1.workout.startSide !== 'left') fail('session day missing workout or start side');
  if (t1.config.flags.join() !== 'knee') fail('athlete flags not applied');
  const before = fs.readFileSync(path.join(dir, 'data', 'today.json'), 'utf8');
  run('2026-11-18');
  assert.strictEqual(today().workout.seed, t1.workout.seed, 'second run keeps the same workout');
  fs.writeFileSync(path.join(dir, 'data', 'athlete.json'), JSON.stringify({ weakerSide: 'left', flags: [{ area: 'knee', until: '2099-01-01' }], log: [{ date: '2026-11-17', rpe: 9, soreness: 1 }] }));
  run('2026-11-18');
  assert.strictEqual(today().workout.seed, t1.workout.seed, 'logging effort must not replace the published workout');
  run('2026-11-18', { REROLL: 'true' });
  if (today().workout.seed === t1.workout.seed) fail('reroll did not change the workout');
  run('2026-11-21', { REROLL: 'true' });
  if (!today().optional || !today().workout) fail('reroll on a rest day should make an optional session');
  if (today().workout.intensity !== 'light') fail('optional session should be light');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Planner and generate.js integration checks done.');
}

const pct = (f) => ((stats[f].ok / stats[f].n) * 100).toFixed(1);
console.log(`${total} workouts generated. In spec: AMRAP ${pct('amrap')}%, EMOM ${pct('emom')}%, Power EMOM ${pct('power')}%. Adjacent same-region neighbours: ${adjacentSame}.`);
console.log(`Mix over 600 days: AMRAP ${counts.amrap}, EMOM ${counts.emom}, Power EMOM ${counts.power}. After an EMOM day: EMOM ${afterEmom.emom}.`);
Gen.FORMATS.forEach((f) => { if (stats[f].ok / stats[f].n < 0.9) fail(`only ${pct(f)}% of ${f} workouts fit the format`); });

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed.');
