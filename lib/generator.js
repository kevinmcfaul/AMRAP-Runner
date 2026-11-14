/*
 * Workout generator. Pure functions, no dependencies. Runs in Node (scripts/generate.js)
 * and in the browser (index.html), so a seed gives the same workout in both places.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AmrapGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PHASES = ['easing', 'building', 'ready'];
  const EQUIPMENT = ['dumbbell', 'kettlebell', 'band', 'step'];
  const MINUTES = 20;
  const ROUND_MIN = 130; // seconds per round, lower bound of the window we aim for
  const ROUND_MAX = 225; // upper bound
  const TRANSITION = 6; // seconds between movements
  const SIDE_SWITCH = 4; // seconds to change sides

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
    };
  }
  const cfgKey = (c) =>
    [c.phase, c.equipment.join('+') || 'bodyweight', c.movements, c.doubleSingle ? 1 : 0, c.doubleCore ? 1 : 0].join('|');

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

  function slotPool(slot, exercises, cfg) {
    const ok = exercises.filter((e) => eligible(e, cfg));
    if (slot === 'upper') return ok.filter((e) => e.slot === 'push' || e.slot === 'pull');
    return ok.filter((e) => e.slot === slot);
  }

  function moveSeconds(ex, qty) {
    const sides = ex.side ? 2 : 1;
    const work = ex.u === 'sec' ? qty * sides : qty * sides * ex.t;
    return Math.round(work + (ex.side ? SIDE_SWITCH : 0) + TRANSITION);
  }
  const moveReps = (ex, qty) => (ex.u === 'sec' ? 0 : qty * (ex.side ? 2 : 1));

  function buildMove(ex, cfg, rng) {
    const qty = ex.r[levelIndex(cfg)];
    const avail = ex.eq.filter((e) => cfg.equipment.includes(e));
    const uses = avail.length ? avail[Math.floor(rng() * avail.length)] : null;
    return {
      id: ex.id, name: ex.name, slot: ex.slot, pat: ex.pat,
      qty, unit: ex.u, side: !!ex.side, uses, cue: ex.cue,
      sec: moveSeconds(ex, qty), reps: moveReps(ex, qty),
    };
  }

  function planSlots(cfg) {
    const slots = cfg.movements === 5
      ? ['single', 'core', 'upper', 'lower', 'cond']
      : ['single', 'core', 'upper', 'lower'];
    if (cfg.doubleSingle) slots[slots.indexOf('lower')] = 'single';
    if (cfg.doubleCore) slots[slots.indexOf(cfg.movements === 5 ? 'cond' : 'upper')] = 'core';
    return slots;
  }

  const typeOf = (m) => (m.slot === 'push' || m.slot === 'pull' ? 'up' : m.slot === 'single' || m.slot === 'lower' ? 'leg' : m.slot);
  const RANK = { single: 0, push: 1, pull: 1, core: 2, lower: 3, cond: 4 };

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

  function chooseFor(slot, ctx, rng, chosen) {
    const { exercises, cfg, recent } = ctx;
    const used = new Set(chosen.map((m) => m.id));
    const pats = new Set(chosen.map((m) => m.pat));
    const pool = slotPool(slot, exercises, cfg).filter((e) => !used.has(e.id));
    if (!pool.length) return null;
    const groupSize = { push: 0, pull: 0 };
    if (slot === 'upper') pool.forEach((e) => groupSize[e.slot]++);
    const ex = pickWeighted(rng, pool, (e) => {
      let w = recencyWeight(e, recent);
      if (pats.has(e.pat)) w *= 0.12;
      if (slot === 'upper') w /= groupSize[e.slot];
      return w;
    });
    return buildMove(ex, cfg, rng);
  }

  const sumSec = (moves) => moves.reduce((a, m) => a + m.sec, 0);
  const sumReps = (moves) => moves.reduce((a, m) => a + m.reps, 0);

  const ADJ = ['Steady', 'Easy', 'Smooth', 'Even', 'Quiet', 'Patient', 'Strong', 'Long', 'Tempo', 'Early'];
  const NOUN = ['Cadence', 'Stride', 'Mile', 'Loop', 'Pace', 'Trail', 'Hill', 'Kick', 'Base', 'Lap'];

  function summarize(moves, seed, cfg, rng) {
    const roundSeconds = sumSec(moves);
    return {
      seed: String(seed),
      title: ADJ[Math.floor(rng() * ADJ.length)] + ' ' + NOUN[Math.floor(rng() * NOUN.length)],
      format: 'AMRAP',
      minutes: MINUTES,
      phase: cfg.phase,
      moves,
      roundSeconds,
      repsPerRound: sumReps(moves),
      targetRounds: Math.max(3, Math.round((MINUTES * 60) / (roundSeconds * 1.15))),
    };
  }

  // ---------------------------------------------------------------- public API
  /**
   * ctx = { exercises, cfg (normalized), recent: {id: count} }
   */
  function generate(ctx, seed) {
    const rng = rngFrom(seed);
    const slots = planSlots(ctx.cfg);
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = [];
      let failed = false;
      for (const slot of slots) {
        const m = chooseFor(slot, ctx, rng, chosen);
        if (!m) { failed = true; break; }
        chosen.push(m);
      }
      if (failed) continue;
      const secs = sumSec(chosen);
      const miss = secs < ROUND_MIN ? ROUND_MIN - secs : secs > ROUND_MAX ? secs - ROUND_MAX : 0;
      if (!best || miss < best.miss) best = { chosen, miss };
      if (miss === 0) break;
    }
    if (!best) throw new Error('Not enough movements for this configuration');
    return summarize(arrange(best.chosen), seed, ctx.cfg, rng);
  }

  /** Replace one movement with another from the same slot (keeps single-leg and core guarantees). */
  function swap(workout, index, ctx, nonce) {
    const rng = rngFrom(workout.seed + '|swap|' + nonce);
    const cur = workout.moves[index];
    const slot = cur.slot === 'push' || cur.slot === 'pull' ? 'upper' : cur.slot;
    const others = workout.moves.filter((_, i) => i !== index);
    let best = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const m = chooseFor(slot, ctx, rng, workout.moves.length ? others.concat([cur]) : others);
      if (!m) break;
      const next = others.slice();
      next.splice(index, 0, m);
      const secs = sumSec(next);
      const miss = secs < ROUND_MIN ? ROUND_MIN - secs : secs > ROUND_MAX ? secs - ROUND_MAX : 0;
      if (!best || miss < best.miss) best = { moves: next, miss };
      if (miss === 0) break;
    }
    if (!best) return workout;
    const roundSeconds = sumSec(best.moves);
    return Object.assign({}, workout, {
      moves: best.moves,
      roundSeconds,
      repsPerRound: sumReps(best.moves),
      targetRounds: Math.max(3, Math.round((MINUTES * 60) / (roundSeconds * 1.15))),
    });
  }

  /** Human label for a movement's quantity: "8 / side", "30 sec", "20 steps". */
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
    for (const m of workout.moves) {
      const ex = byId[m.id];
      if (!ex) { problems.push('unknown id ' + m.id); continue; }
      if (!eligible(ex, cfg)) problems.push('ineligible movement ' + m.id);
    }
    return problems;
  }

  return {
    PHASES, EQUIPMENT, MINUTES, ROUND_MIN, ROUND_MAX,
    normalizeConfig, cfgKey, eligible, slotPool,
    generate, swap, qtyLabel, validate, rngFrom,
  };
});
