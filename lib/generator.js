/*
 * Workout generator. Pure functions, no dependencies. Runs in Node (scripts/generate.js)
 * and in the browser (index.html), so a seed gives the same workout in both places.
 *
 * Formats
 *   amrap  go through the list in order, as many rounds as possible in 20 minutes
 *   emom   every minute on the minute, one movement; sets sized to about 35 s of work
 *   power  like EMOM but explosive: short sets (about 20 s of work), power movements only
 *          (plus one core slot), lots of rest
 *   mix    (config only) pick one of the above for the day
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AmrapGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PHASES = ['easing', 'building', 'ready'];
  const EQUIPMENT = ['dumbbell', 'kettlebell', 'band', 'step', 'sliders'];
  const FORMATS = ['amrap', 'emom', 'power'];
  const FORMAT_CHOICES = ['mix'].concat(FORMATS);
  const FORMAT_LABEL = { amrap: 'AMRAP', emom: 'EMOM', power: 'Power EMOM' };
  const FORMAT_WEIGHT = { amrap: 0.4, emom: 0.35, power: 0.25 }; // how often "mix" picks each
  const MINUTES = 20;
  const ROUND_MIN = 130; // AMRAP: seconds per round, lower bound of the window we aim for
  const ROUND_MAX = 225; // AMRAP: upper bound
  const TRANSITION = 6; // AMRAP: seconds between movements
  const SIDE_SWITCH = 4; // seconds to change sides
  const EMOM_BUDGET = 38; // seconds of work available in an EMOM minute
  const POWER_BUDGET = 24; // seconds of work in a Power EMOM minute
  const POWER_CORE_BUDGET = 34; // the core minute in a Power EMOM can run a little longer

  // ---------------------------------------------------------------- seeded random
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rngFrom = (seed) => mulberry32(xmur3(String(seed))());

  // ---------------------------------------------------------------- config
  function normalizeConfig(c) {
    c = c || {};
    const eq = Array.isArray(c.equipment) ? c.equipment : [];
    return {
      phase: PHASES.includes(c.phase) ? c.phase : 'easing',
      equipment: EQUIPMENT.filter((e) => eq.includes(e)),
      movements: Number(c.movements) === 4 ? 4 : 5,
      doubleSingle: !!c.doubleSingle,
      doubleCore: !!c.doubleCore,
      format: FORMAT_CHOICES.includes(c.format) ? c.format : 'mix',
    };
  }
  const cfgKey = (c) =>
    [c.phase, c.equipment.join('+') || 'bodyweight', c.movements, c.doubleSingle ? 1 : 0, c.doubleCore ? 1 : 0, c.format].join('|');

  const levelIndex = (cfg) => PHASES.indexOf(cfg.phase);

  function eligible(ex, cfg) {
    const lvl = levelIndex(cfg);
    if (ex.lvl > lvl || ex.imp > lvl) return false;
    if (ex.eq.length && !ex.eq.some((e) => cfg.equipment.includes(e))) return false;
    return true;
  }

  // ---------------------------------------------------------------- building blocks
  function pickWeighted(rng, items, weightOf) {
    const w = items.map(weightOf);
    const total = w.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return items[Math.floor(rng() * items.length)];
    let x = rng() * total;
    for (let i = 0; i < items.length; i++) {
      x -= w[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  // Planned slots that can draw from more than one movement type, and the share each type gets.
  const GROUPS = {
    upper: { push: 0.5, pull: 0.5 },
    lower: { lower: 0.75, stab: 0.25 },
    fifth: { cond: 0.5, stab: 0.5 },
  };
  // Power EMOM only uses power movements, except the core slot.
  function slotPool(group, exercises, cfg, fmt) {
    const power = fmt === 'power' && group !== 'core';
    const g = GROUPS[group];
    return exercises.filter(
      (e) => eligible(e, cfg) && (g ? e.slot in g : e.slot === group) && (!power || e.pw)
    );
  }
  // Which planned slot a move came from (older published files have no `group`).
  const groupOf = (m) => m.group || (m.slot === 'push' || m.slot === 'pull' ? 'upper' : m.slot);

  function workSeconds(ex, qty) {
    const sides = ex.side ? 2 : 1;
    const work = ex.u === 'sec' ? qty * sides : qty * sides * ex.t;
    return Math.round(work + (ex.side ? SIDE_SWITCH : 0));
  }
  const moveSeconds = (ex, qty) => workSeconds(ex, qty) + TRANSITION;
  const moveReps = (ex, qty) => (ex.u === 'sec' ? 0 : qty * (ex.side ? 2 : 1));

  function budgetFor(fmt, group) {
    if (fmt === 'power') return group === 'core' ? POWER_CORE_BUDGET : POWER_BUDGET;
    return EMOM_BUDGET;
  }

  /** Pick a rep count so the set fills (but does not overrun) the minute. */
  function fitQty(ex, base, budget, powerCap) {
    const sides = ex.side ? 2 : 1;
    const per = ex.u === 'sec' ? 1 : ex.t;
    const overhead = ex.side ? SIDE_SWITCH : 0;
    const fit = Math.floor((budget - overhead) / (sides * per));
    let cap;
    // Power sets are short and heavy on intent, so cap the reps. Fast light movements (marches,
    // shadow boxing) are sized by the clock instead, otherwise 10 reps would be a few seconds.
    if (powerCap) cap = ex.u === 'sec' ? (ex.side ? 15 : 20) : ex.t < 1.5 ? 60 : ex.side ? 6 : 10;
    else cap = Math.ceil(base * 1.5);
    let q = Math.min(fit, cap);
    if (ex.u === 'sec') q = Math.max(10, Math.floor(q / 5) * 5);
    else q = Math.max(3, q);
    return q;
  }

  function buildMove(ex, cfg, rng, group, fmt) {
    const base = ex.r[levelIndex(cfg)];
    const timed = fmt !== 'amrap';
    const qty = timed ? fitQty(ex, base, budgetFor(fmt, group), fmt === 'power' && group !== 'core') : base;
    const avail = ex.eq.filter((e) => cfg.equipment.includes(e));
    const uses = avail.length ? avail[Math.floor(rng() * avail.length)] : null;
    return {
      id: ex.id, name: ex.name, slot: ex.slot, group, pat: ex.pat,
      sl: ex.slot === 'single' || !!ex.sl,
      qty, unit: ex.u, side: !!ex.side, uses, cue: ex.cue,
      sec: timed ? workSeconds(ex, qty) : moveSeconds(ex, qty),
      reps: moveReps(ex, qty),
    };
  }

  function planSlots(cfg) {
    const slots = cfg.movements === 5
      ? ['single', 'core', 'upper', 'lower', 'fifth']
      : ['single', 'core', 'upper', 'lower'];
    if (cfg.doubleSingle) slots[slots.indexOf('lower')] = 'single';
    if (cfg.doubleCore) slots[slots.indexOf(cfg.movements === 5 ? 'fifth' : 'upper')] = 'core';
    return slots;
  }

  const typeOf = (m) =>
    m.slot === 'push' || m.slot === 'pull' ? 'up' : m.slot === 'single' || m.slot === 'lower' || m.slot === 'stab' ? 'leg' : m.slot;
  const RANK = { single: 0, push: 1, pull: 1, core: 2, lower: 3, cond: 4, stab: 4 };

  // Alternate body regions so no two neighbours hit the same thing.
  function arrange(moves) {
    const rest = moves.slice().sort((a, b) => RANK[a.slot] - RANK[b.slot]);
    const out = [rest.shift()];
    while (rest.length) {
      const prev = out[out.length - 1];
      let i = rest.findIndex((m) => typeOf(m) !== typeOf(prev));
      if (i < 0) i = 0;
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  }

  function recencyWeight(ex, recent) {
    const n = (recent && recent[ex.id]) || 0;
    return 1 / (1 + 2 * n);
  }

  function chooseFor(slot, ctx, rng, chosen, fmt) {
    const { exercises, cfg, recent } = ctx;
    const used = new Set(chosen.map((m) => m.id));
    const pats = new Set(chosen.map((m) => m.pat));
    const pool = slotPool(slot, exercises, cfg, fmt).filter((e) => !used.has(e.id));
    if (!pool.length) return null;
    const g = GROUPS[slot];
    const size = {};
    if (g) pool.forEach((e) => (size[e.slot] = (size[e.slot] || 0) + 1));
    const ex = pickWeighted(rng, pool, (e) => {
      let w = recencyWeight(e, recent);
      if (pats.has(e.pat)) w *= 0.12;
      if (g) w *= g[e.slot] / size[e.slot];
      return w;
    });
    return buildMove(ex, cfg, rng, slot, fmt);
  }

  const sumSec = (moves) => moves.reduce((a, m) => a + m.sec, 0);
  const sumReps = (moves) => moves.reduce((a, m) => a + m.reps, 0);

  /** How far a set of moves is from fitting the format (0 = fits). */
  function miss(moves, fmt) {
    if (fmt === 'amrap') {
      const s = sumSec(moves);
      return s < ROUND_MIN ? ROUND_MIN - s : s > ROUND_MAX ? s - ROUND_MAX : 0;
    }
    let m = 0;
    moves.forEach((mv) => {
      const budget = budgetFor(fmt, groupOf(mv));
      if (mv.sec > budget + 4) m += mv.sec - budget;
      if (mv.sec < 14) m += 14 - mv.sec;
    });
    return m;
  }

  /** Round and cycle numbers for a list of moves. */
  function recalc(moves, fmt) {
    if (fmt === 'amrap') {
      const rs = sumSec(moves);
      return {
        roundSeconds: rs, repsPerRound: sumReps(moves), cycles: null,
        targetRounds: Math.max(3, Math.round((MINUTES * 60) / (rs * 1.15))),
      };
    }
    // EMOM and Power EMOM: one movement per minute, so a full cycle takes `moves.length` minutes.
    return { roundSeconds: moves.length * 60, repsPerRound: sumReps(moves), cycles: MINUTES / moves.length, targetRounds: null };
  }

  const TITLES = {
    amrap: {
      adj: ['Steady', 'Easy', 'Smooth', 'Even', 'Quiet', 'Patient', 'Strong', 'Long', 'Tempo', 'Early'],
      noun: ['Cadence', 'Stride', 'Mile', 'Loop', 'Pace', 'Trail', 'Hill', 'Kick', 'Base', 'Lap'],
    },
    emom: {
      adj: ['Steady', 'Even', 'Patient', 'Quiet', 'Smooth', 'Early', 'Tidy', 'Calm'],
      noun: ['Metronome', 'Clock', 'Pulse', 'Beat', 'Interval', 'Rhythm', 'Tick'],
    },
    power: {
      adj: ['Quick', 'Sharp', 'Light', 'Crisp', 'Springy', 'Fast', 'Bright'],
      noun: ['Spring', 'Snap', 'Pop', 'Bounce', 'Spark', 'Launch', 'Strike'],
    },
  };

  function summarize(moves, seed, cfg, rng, fmt) {
    const t = TITLES[fmt];
    return Object.assign(
      {
        seed: String(seed),
        title: t.adj[Math.floor(rng() * t.adj.length)] + ' ' + t.noun[Math.floor(rng() * t.noun.length)],
        format: fmt,
        minutes: MINUTES,
        phase: cfg.phase,
        moves,
      },
      recalc(moves, fmt)
    );
  }

  function pickFormat(cfg, rng, lastFormat) {
    if (cfg.format !== 'mix') return cfg.format;
    return pickWeighted(rng, FORMATS, (f) => FORMAT_WEIGHT[f] * (f === lastFormat ? 0.25 : 1));
  }

  // ---------------------------------------------------------------- public API
  /**
   * ctx = { exercises, cfg (normalized), recent: {id: count}, lastFormat?: 'amrap' | 'emom' | 'power' }
   */
  function generate(ctx, seed) {
    const rng = rngFrom(seed);
    const fmt = pickFormat(ctx.cfg, rng, ctx.lastFormat);
    const slots = planSlots(ctx.cfg);
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = [];
      let failed = false;
      for (const slot of slots) {
        const m = chooseFor(slot, ctx, rng, chosen, fmt);
        if (!m) { failed = true; break; }
        chosen.push(m);
      }
      if (failed) continue;
      const off = miss(chosen, fmt);
      if (!best || off < best.miss) best = { chosen, miss: off };
      if (off === 0) break;
    }
    if (!best) throw new Error('Not enough movements for this configuration');
    return summarize(arrange(best.chosen), seed, ctx.cfg, rng, fmt);
  }

  /** Replace one movement with another from the same slot (keeps single-leg and core guarantees). */
  function swap(workout, index, ctx, nonce) {
    const fmt = workout.format || 'amrap';
    const rng = rngFrom(workout.seed + '|swap|' + nonce);
    const cur = workout.moves[index];
    const slot = groupOf(cur);
    const others = workout.moves.filter((_, i) => i !== index);
    let best = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const m = chooseFor(slot, ctx, rng, others.concat([cur]), fmt);
      if (!m) break;
      const next = others.slice();
      next.splice(index, 0, m);
      const off = miss(next, fmt);
      if (!best || off < best.miss) best = { moves: next, miss: off };
      if (off === 0) break;
    }
    if (!best) return workout;
    return Object.assign({}, workout, { moves: best.moves }, recalc(best.moves, fmt));
  }

  /** Human label for a movement's quantity: "8 reps each side", "30 sec", "20 steps". */
  function qtyLabel(m) {
    const unit = m.unit === 'sec' ? 'sec' : m.unit === 'steps' ? 'steps' : 'reps';
    return m.side ? `${m.qty} ${unit} each side` : `${m.qty} ${unit}`;
  }

  function validate(workout, cfg, exercises) {
    const problems = [];
    const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
    const ids = workout.moves.map((m) => m.id);
    if (new Set(ids).size !== ids.length) problems.push('duplicate movement');
    const singles = workout.moves.filter((m) => m.slot === 'single').length;
    const cores = workout.moves.filter((m) => m.slot === 'core').length;
    if (singles < (cfg.doubleSingle ? 2 : 1)) problems.push('missing single-leg movement');
    if (cores < (cfg.doubleCore ? 2 : 1)) problems.push('missing core movement');
    if (workout.moves.length !== cfg.movements) problems.push('wrong movement count');
    if (!FORMATS.includes(workout.format)) problems.push('unknown format');
    if (cfg.format !== 'mix' && workout.format !== cfg.format) problems.push('wrong format');
    for (const m of workout.moves) {
      const ex = byId[m.id];
      if (!ex) { problems.push('unknown id ' + m.id); continue; }
      if (!eligible(ex, cfg)) problems.push('ineligible movement ' + m.id);
      if (workout.format === 'power' && groupOf(m) !== 'core' && !ex.pw) problems.push('not a power movement: ' + m.id);
      if (workout.format !== 'amrap' && m.sec > budgetFor(workout.format, groupOf(m)) + 6) problems.push('set too long: ' + m.id);
    }
    return problems;
  }

  return {
    PHASES, EQUIPMENT, FORMATS, FORMAT_CHOICES, FORMAT_LABEL, MINUTES, ROUND_MIN, ROUND_MAX,
    EMOM_BUDGET, POWER_BUDGET, POWER_CORE_BUDGET,
    normalizeConfig, cfgKey, eligible, slotPool,
    generate, swap, qtyLabel, validate, rngFrom,
  };
});
