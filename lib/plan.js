/*
 * Weekly and block planning. Pure functions, no dependencies (Node and browser).
 *
 *  - planWeek:  which days of a week are strength sessions, rest days or run days
 *  - stageFor:  where you are in the training block (base, build, deload, race season...)
 *  - readiness: how your recent effort and soreness ratings should change today's session
 *  - planDay:   everything the generator needs for one date
 *
 * Dates are ISO strings (YYYY-MM-DD). Weeks start on Monday.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AmrapPlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const parseISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };
  const isISO = (s) => !Number.isNaN(parseISO(s));
  const fmtISO = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  const addDays = (s, n) => fmtISO(parseISO(s) + n * DAY_MS);
  const dow = (s) => (new Date(parseISO(s)).getUTCDay() + 6) % 7; // Monday = 0
  const mondayOf = (s) => addDays(s, -dow(s));
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY_MS); // b minus a
  const dayIndex = (name) => {
    const i = DAYS.findIndex((d) => d.toLowerCase() === String(name || '').trim().slice(0, 3).toLowerCase());
    return i < 0 ? null : i;
  };

  // ---------------------------------------------------------------- config
  function normalizeSchedule(s) {
    s = s || {};
    const n = Math.min(4, Math.max(1, Math.round(Number(s.sessionsPerWeek) || 3)));
    const long = dayIndex(s.longRunDay);
    const hard = (Array.isArray(s.hardRunDays) ? s.hardRunDays : [])
      .map(dayIndex).filter((i) => i !== null && i !== long);
    const fixed = Array.isArray(s.sessionDays) && s.sessionDays.length
      ? [...new Set(s.sessionDays.map(dayIndex).filter((i) => i !== null))].sort((a, b) => a - b)
      : null;
    return { sessionsPerWeek: n, longRunDay: long, hardRunDays: [...new Set(hard)].sort((a, b) => a - b), sessionDays: fixed };
  }

  function normalizePlan(p) {
    p = p || {};
    const clamp = (v, lo, hi, d) => {
      v = Math.round(Number(v));
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    };
    return {
      startDate: isISO(p.startDate) ? p.startDate : null,
      baseWeeks: clamp(p.baseWeeks, 2, 8, 4),
      buildWeeks: clamp(p.buildWeeks, 2, 8, 4),
      raceDate: isISO(p.raceDate) ? p.raceDate : null,
    };
  }

  // ---------------------------------------------------------------- stages
  // Modifiers the generator understands:
  //   vol          multiplies reps and hold times
  //   noImpact     removes all jumping and hopping
  //   allowPower   Power EMOM allowed
  //   loadedScale  reps multiplier for movements done with dumbbells or kettlebells (fewer reps, heavier weight)
  //   loadedBoost  how much more often loaded movements are picked
  //   stabBoost    how much more often stability work is picked
  //   singlePref   'half' | 'always': swap the both-legs slot for a second single-leg movement
  //   maxMovements cap on movements per workout
  const STAGES = {
    base: {
      label: 'Base', vol: 1, noImpact: false, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1.5, singlePref: 'half',
      blurb: 'Build the foundation: clean form, single-leg and stability work, lighter loads, no power sets yet.',
    },
    build: {
      label: 'Build', vol: 1, noImpact: false, allowPower: true, loadedScale: 0.85, loadedBoost: 1.8, stabBoost: 1, singlePref: null,
      blurb: 'Heavier loads and fewer reps wherever you have weights, and power work is back in.',
    },
    deload: {
      label: 'Deload', vol: 0.6, noImpact: true, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1.5, singlePref: null, maxMovements: 4,
      blurb: 'Back off so the work sinks in. Fewer sessions, easy effort, no jumping.',
    },
    maintain: {
      label: 'Race season', vol: 0.8, noImpact: false, allowPower: true, loadedScale: 1, loadedBoost: 1, stabBoost: 1, singlePref: 'always', sessionsCap: 2,
      blurb: 'Strength is now maintenance for your running. Single-leg work comes first and effort decides the reps.',
    },
    taper: {
      label: 'Taper', vol: 0.6, noImpact: true, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1, singlePref: 'always', sessionsCap: 2, maxMovements: 4,
      blurb: 'Race week. Keep it short, easy and fresh.',
    },
    recovery: {
      label: 'Recovery', vol: 0.5, noImpact: true, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1.5, singlePref: null, sessionsCap: 1, maxMovements: 4,
      blurb: 'Post-race recovery. One easy session at most.',
    },
    race: { label: 'Race window', vol: 0.5, noImpact: true, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1, singlePref: null, sessionsCap: 0, blurb: 'Race day and the day before. No strength.' },
  };

  /** Where `date` falls in the block. planStart is the ISO date the block began (any day of its first week). */
  function stageFor(plan, date, planStart) {
    plan = plan || normalizePlan();
    if (plan.raceDate) {
      const toRace = daysBetween(date, plan.raceDate);
      if (toRace < 0 && toRace >= -7) return withStage('recovery', `Recovery, day ${-toRace} after the race`);
      if (toRace >= 0 && toRace <= 1) return withStage('race', toRace === 0 ? 'Race day' : 'Day before the race');
      if (toRace <= 7) return withStage('taper', `Taper, ${toRace} days to the race`);
      if (toRace <= 56) return withStage('maintain', `Race season, ${Math.ceil(toRace / 7)} weeks to the race`);
    }
    const start = plan.startDate || planStart || date;
    const w = Math.max(0, Math.floor(daysBetween(mondayOf(start), mondayOf(date)) / 7));
    const cycle = plan.baseWeeks + 1 + plan.buildWeeks + 1;
    const k = w % cycle;
    if (k < plan.baseWeeks) return withStage('base', `Base, week ${k + 1} of ${plan.baseWeeks}`, { week: k + 1, of: plan.baseWeeks });
    if (k === plan.baseWeeks) return withStage('deload', 'Deload week', { week: 1, of: 1 });
    if (k < plan.baseWeeks + 1 + plan.buildWeeks) {
      const j = k - plan.baseWeeks - 1;
      return withStage('build', `Build, week ${j + 1} of ${plan.buildWeeks}`, { week: j + 1, of: plan.buildWeeks });
    }
    return withStage('deload', 'Deload week', { week: 1, of: 1 });
  }
  function withStage(id, title, extra) {
    return Object.assign({ id, title }, STAGES[id], extra || {});
  }
  const stageInfo = (st) => ({ id: st.id, label: st.label, title: st.title, blurb: st.blurb, week: st.week || null, of: st.of || null });

  // ---------------------------------------------------------------- weekly layout
  /** Choose `n` session days from Monday-first indexes, away from key runs and not back to back. */
  function pickSessionDays(n, long, hard, fixed) {
    if (fixed) return fixed.slice(0, Math.max(0, n));
    const run = new Set([long].concat(hard).filter((i) => i !== null));
    const cand = [0, 1, 2, 3, 4, 5, 6].filter((i) => !run.has(i));
    n = Math.min(n, cand.length);
    if (n <= 0) return [];
    const combos = [];
    (function rec(start, cur) {
      if (cur.length === n) { combos.push(cur.slice()); return; }
      for (let i = start; i < cand.length; i++) { cur.push(cand[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    const adjacent = (a, b) => { const d = Math.abs(a - b); return d === 1 || d === 6; };
    const score = (c, strict) => {
      if (strict) for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (adjacent(c[i], c[j])) return Infinity;
      let pen = 0;
      c.forEach((d) => {
        if (run.has((d + 1) % 7)) pen += 3; // the day before a key run
        if (long !== null && d === (long + 1) % 7) pen += 1; // the day after the long run
      });
      const gaps = c.map((d, i) => (i + 1 < c.length ? c[i + 1] - d : c[0] + 7 - d));
      const mean = 7 / c.length;
      gaps.forEach((g) => { pen += 0.3 * (g - mean) * (g - mean); });
      return pen;
    };
    for (const strict of [true, false]) {
      let best = null, bestScore = Infinity;
      combos.forEach((c) => { const s = score(c, strict); if (s < bestScore) { best = c; bestScore = s; } });
      if (best) return best;
    }
    return combos[0];
  }

  /** ctx = { schedule, plan, planStart } (normalized). Returns 7 days, Monday first. */
  function planWeek(date, ctx) {
    const sch = ctx.schedule, plan = ctx.plan;
    const mon = mondayOf(date);
    const stageMon = stageFor(plan, mon, ctx.planStart);
    let n = sch.sessionsPerWeek;
    if (stageMon.sessionsCap !== undefined) n = Math.min(n, stageMon.sessionsCap);
    if (stageMon.id === 'deload') n = Math.max(1, n - 1);
    const sessions = new Set(pickSessionDays(n, sch.longRunDay, sch.hardRunDays, sch.sessionDays));
    const run = new Set([sch.longRunDay].concat(sch.hardRunDays).filter((i) => i !== null));
    const days = DAYS.map((name, i) => {
      const d = addDays(mon, i);
      const st = stageFor(plan, d, ctx.planStart);
      let kind;
      if (plan.raceDate === d) kind = 'race';
      else if (i === sch.longRunDay) kind = 'long';
      else if (sch.hardRunDays.indexOf(i) >= 0) kind = 'hard';
      else if (st.id === 'race') kind = 'rest';
      else if (sessions.has(i) && st.sessionsCap !== 0) kind = 'session';
      else kind = 'rest';
      const light = kind === 'session' && (st.noImpact || st.id === 'deload' || run.has((i + 1) % 7));
      return { date: d, day: name, kind, intensity: kind === 'session' ? (light ? 'light' : 'full') : null, stage: st.id };
    });
    return { monday: mon, days };
  }

  // ---------------------------------------------------------------- readiness
  /** Effort log entries: { date, rpe (1-10), soreness (0-3) }. */
  function readiness(log, date) {
    const recent = (Array.isArray(log) ? log : [])
      .filter((e) => e && isISO(e.date) && daysBetween(e.date, date) >= 1 && daysBetween(e.date, date) <= 10)
      .filter((e) => Number.isFinite(Number(e.rpe)) || Number.isFinite(Number(e.soreness)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const out = { vol: 1, light: false, suggestUp: false, notes: [] };
    const last = recent[0];
    if (last) {
      const r = Number(last.rpe), s = Number(last.soreness);
      if (r >= 9 || s >= 3) {
        out.vol = 0.7; out.light = true;
        out.notes.push('Your last session felt very hard or left you sore, so today is trimmed by about 30% with no jumping.');
      } else if (r >= 8 || s >= 2) {
        out.vol = 0.85;
        out.notes.push('Your last session felt hard, so today is trimmed by about 15%.');
      }
    }
    const rated = recent.filter((e) => Number.isFinite(Number(e.rpe))).slice(0, 3);
    if (!out.light && out.vol === 1 && rated.length === 3 && recent.slice(0, 3).every((e) => !(Number(e.soreness) >= 2))) {
      const avg = rated.reduce((a, e) => a + Number(e.rpe), 0) / 3;
      if (avg <= 5.5) {
        out.suggestUp = true;
        out.notes.push('Your last three sessions felt easy. If your runs are going well, consider moving up a phase in config.json.');
      }
    }
    return out;
  }

  /** Active pain flags: strings or { area, until }. */
  function activeFlags(flags, date) {
    const out = [];
    (Array.isArray(flags) ? flags : []).forEach((f) => {
      const area = typeof f === 'string' ? f : f && f.area;
      const until = typeof f === 'object' && f ? f.until : null;
      if (area && (!until || !isISO(until) || until >= date) && out.indexOf(area) < 0) out.push(area);
    });
    return out;
  }

  // ---------------------------------------------------------------- one day
  const REASONS = {
    long: 'Long run day. Strength waits so your legs are fresh for it.',
    hard: 'Hard run day. Strength waits so you can run it well.',
    race: 'Race day. Nothing to do in the gym today.',
    rest: 'Rest day. The training sinks in on days like this. An easy walk or a few minutes of mobility is plenty.',
  };

  function nextSession(date, ctx) {
    for (let i = 1; i <= 14; i++) {
      const d = addDays(date, i);
      const e = planWeek(d, ctx).days[dow(d)];
      if (e.kind === 'session') return { date: d, day: e.day, intensity: e.intensity };
    }
    return null;
  }

  function modifiersFrom(stage, intensity, ready) {
    const light = intensity === 'light' || ready.light || stage.noImpact;
    let vol = stage.vol * ready.vol;
    if (light && !stage.noImpact) vol *= 0.85;
    return {
      intensity: light ? 'light' : 'full',
      vol: Math.round(vol * 100) / 100,
      noImpact: light,
      allowPower: stage.allowPower && !light,
      loadedScale: stage.loadedScale, loadedBoost: stage.loadedBoost, stabBoost: stage.stabBoost,
      singlePref: stage.singlePref || null,
      maxMovements: stage.maxMovements || null,
      stageId: stage.id,
    };
  }

  /** What to do on a rest day if you train anyway. */
  const OPTIONAL = {
    intensity: 'light', vol: 0.7, noImpact: true, allowPower: false, loadedScale: 1, loadedBoost: 1, stabBoost: 1,
    singlePref: null, maxMovements: 4, stageId: null,
  };

  /**
   * ctx = { schedule, plan, planStart } (normalized); athlete = { log, ... }.
   * Returns { restDay, reason?, stage, week, sessionsThisWeek, notes, modifiers, nextSession? }.
   */
  function planDay(date, ctx, athlete) {
    athlete = athlete || {};
    const week = planWeek(date, ctx);
    const today = week.days[dow(date)];
    const stage = stageFor(ctx.plan, date, ctx.planStart);
    const ready = readiness(athlete.log, date);
    const base = {
      date, stage: stageInfo(stage), week: week.days,
      sessionsThisWeek: week.days.filter((d) => d.kind === 'session').length,
      suggestUp: ready.suggestUp,
    };
    if (today.kind !== 'session') {
      return Object.assign(base, {
        restDay: true, kind: today.kind, reason: REASONS[today.kind] || REASONS.rest,
        notes: ready.notes, nextSession: nextSession(date, ctx), modifiers: Object.assign({}, OPTIONAL, { stageId: stage.id }),
      });
    }
    const mods = modifiersFrom(stage, today.intensity, ready);
    const notes = [];
    if (today.intensity === 'light' && !stage.noImpact) notes.push('Light day: a key run is coming up, so today skips jumping and trims the volume.');
    ready.notes.forEach((n) => notes.push(n));
    return Object.assign(base, { restDay: false, kind: 'session', notes, modifiers: mods });
  }

  return {
    DAYS, STAGES, OPTIONAL,
    normalizeSchedule, normalizePlan, stageFor, planWeek, planDay, nextSession, readiness, activeFlags,
    addDays, mondayOf, dow, daysBetween, isISO, parseISO, pickSessionDays,
  };
});
