#!/usr/bin/env node
/*
 * Generates today's plan: a workout on session days, a rest-day note on the others.
 *
 *   node scripts/generate.js            today (no-op if already generated with the same settings)
 *   node scripts/generate.js --reroll   force a brand-new workout for today
 *
 * Overrides (used by the GitHub Action's "Run workflow" form), all optional:
 *   FORMAT=mix|amrap|emom|power   PHASE=easing|building|ready   EQUIPMENT=dumbbell,band   MOVEMENTS=4|5
 *   DOUBLE_SINGLE=true  DOUBLE_CORE=true  FLAGS=knee,calf  WEAKER_SIDE=left|right  REROLL=true
 *
 * Reads:  config.json, data/athlete.json (pain flags, weaker side, effort log, block start)
 * Writes: data/today.json, data/today.js (loaded by the page), data/history.json, TODAY.md
 *
 * Test hooks: AMRAP_ROOT (project folder), AMRAP_DATE (YYYY-MM-DD).
 */
const fs = require('fs');
const path = require('path');
const root = process.env.AMRAP_ROOT || path.join(__dirname, '..');
const exercises = require('../lib/exercises.js');
const Gen = require('../lib/generator.js');
const Plan = require('../lib/plan.js');

const p = (...a) => path.join(root, ...a);
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
};
const KIND = { session: 'Strength', rest: 'Rest', long: 'Long run', hard: 'Hard run', race: 'Race' };
const list = (s) => String(s).split(/[,\s]+/).filter(Boolean).map((x) => x.toLowerCase());

const fileCfg = readJson(p('config.json'), {});
const athleteFile = readJson(p('data', 'athlete.json'), {});
const env = process.env;
const tz = fileCfg.timezone || 'America/Toronto';
const date = process.env.AMRAP_DATE ||
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// ---- settings
const overrides = {};
if (env.FORMAT) overrides.format = env.FORMAT.trim().toLowerCase();
if (env.PHASE) overrides.phase = env.PHASE.trim();
if (env.EQUIPMENT !== undefined && env.EQUIPMENT.trim() !== '') overrides.equipment = list(env.EQUIPMENT);
if (env.MOVEMENTS) overrides.movements = Number(env.MOVEMENTS);
if (env.DOUBLE_SINGLE) overrides.doubleSingle = env.DOUBLE_SINGLE === 'true';
if (env.DOUBLE_CORE) overrides.doubleCore = env.DOUBLE_CORE === 'true';

// Flags: config.json, plus anything in data/athlete.json that has not expired, plus the form.
const flags = [];
[].concat(fileCfg.flags || [], Plan.activeFlags(athleteFile.flags, date), env.FLAGS ? list(env.FLAGS) : [])
  .forEach((f) => { const a = typeof f === 'string' ? f : f && f.area; if (a && flags.indexOf(a) < 0) flags.push(a); });
overrides.flags = flags;

const cfg = Gen.normalizeConfig(Object.assign({}, fileCfg, overrides));
const key = Gen.cfgKey(cfg);

const weakerSide = ['left', 'right'].includes(String(env.WEAKER_SIDE || '').toLowerCase())
  ? env.WEAKER_SIDE.toLowerCase()
  : ['left', 'right'].includes(athleteFile.weakerSide) ? athleteFile.weakerSide : null;

// ---- plan
const schedule = Plan.normalizeSchedule(fileCfg.schedule);
const plan = Plan.normalizePlan(fileCfg.plan);
const existing = readJson(p('data', 'today.json'), null);
const planStart = plan.startDate || (Plan.isISO(athleteFile.planStart) ? athleteFile.planStart : null) ||
  (existing && existing.planStart) || Plan.mondayOf(date);
const planCtx = { schedule, plan, planStart };
const log = (Array.isArray(athleteFile.log) ? athleteFile.log : []).filter((e) => e && Plan.isISO(e.date)).slice(-30);
const day = Plan.planDay(date, planCtx, { log });
const reroll = process.argv.includes('--reroll') || env.REROLL === 'true';

const athleteOut = { planStart, weakerSide, flags: Plan.activeFlags(athleteFile.flags, date), log };
const planOut = {
  stage: day.stage, sessionsThisWeek: day.sessionsThisWeek, notes: day.notes, suggestUp: day.suggestUp,
  modifiers: day.modifiers, week: day.week, kind: day.kind,
};
// Everything that should trigger a fresh workout when it changes. Effort-log changes do not,
// so logging a session never swaps out the workout you are about to do.
const signature = key + '#' + JSON.stringify([schedule, plan, planStart, weakerSide]);

if (existing && existing.date === date && existing.signature === signature && !reroll) {
  console.log(`Plan for ${date} already generated. Nothing to do.`);
  existing.athlete = athleteOut;
  writeBrowserFile(existing);
  process.exit(0);
}

const base = { date, timezone: tz, generatedAt: new Date().toISOString(), trigger: env.GITHUB_EVENT_NAME || 'local', config: cfg, cfgKey: key, signature, planStart, plan: planOut, athlete: athleteOut };

fs.mkdirSync(p('data'), { recursive: true });

// ---- rest day
if (day.restDay && !reroll) {
  const payload = Object.assign(base, {
    salt: '', recent: {}, lastFormat: null, workout: null,
    restDay: { kind: day.kind, reason: day.reason, nextSession: day.nextSession },
  });
  fs.writeFileSync(p('data', 'today.json'), JSON.stringify(payload, null, 2) + '\n');
  writeBrowserFile(payload);
  fs.writeFileSync(p('TODAY.md'), toMarkdown(payload));
  console.log(`Rest day ${date}: ${day.reason}`);
  process.exit(0);
}

// ---- session day (or a manual reroll on a rest day, which makes an optional light session)
const history = readJson(p('data', 'history.json'), { days: {} });
const priorDates = Object.keys(history.days).filter((d) => d < date).sort();
const recent = {};
priorDates.slice(-7).forEach((d) => history.days[d].ids.forEach((id) => (recent[id] = (recent[id] || 0) + 1)));
const lastFormat = priorDates.length ? history.days[priorDates[priorDates.length - 1]].format : undefined;

const salt = reroll ? Date.now().toString(36) : existing && existing.date === date ? existing.salt || '' : '';
const seed = `${date}|${salt}|${key}`;
const mods = day.restDay ? Plan.OPTIONAL : day.modifiers;
const workout = Gen.generate({ exercises, cfg, recent, lastFormat, plan: mods, weakerSide }, seed);

const problems = Gen.validate(workout, cfg, exercises, mods);
if (problems.length) {
  console.error('Generated workout failed validation: ' + problems.join(', '));
  process.exit(1);
}

const payload = Object.assign(base, { salt, recent, lastFormat: lastFormat || null, workout });
if (day.restDay) {
  payload.optional = true;
  payload.plan = Object.assign({}, planOut, { modifiers: mods });
  payload.restDay = { kind: day.kind, reason: day.reason, nextSession: day.nextSession };
}
fs.writeFileSync(p('data', 'today.json'), JSON.stringify(payload, null, 2) + '\n');
writeBrowserFile(payload);

history.days[date] = { title: workout.title, format: workout.format, ids: workout.moves.map((m) => m.id) };
const keep = Object.keys(history.days).sort().slice(-30);
history.days = Object.fromEntries(keep.map((d) => [d, history.days[d]]));
fs.writeFileSync(p('data', 'history.json'), JSON.stringify(history, null, 2) + '\n');

fs.writeFileSync(p('TODAY.md'), toMarkdown(payload));
console.log(`Generated ${date}: ${workout.title}, ${Gen.FORMAT_LABEL[workout.format]} (${workout.moves.map((m) => m.name).join(', ')})`);

// ---------------------------------------------------------------- output
function writeBrowserFile(pl) {
  fs.mkdirSync(p('data'), { recursive: true });
  fs.writeFileSync(p('data', 'today.js'), 'window.AMRAP_TODAY = ' + JSON.stringify(pl) + ';\n');
}

function mmss(s) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function weekLine(pl) {
  return pl.plan.week
    .map((d) => `${d.date === pl.date ? '**' + d.day + '**' : d.day} ${d.kind === 'session' && d.intensity === 'light' ? 'Light strength' : KIND[d.kind]}`)
    .join(' | ');
}

function toMarkdown(pl) {
  const head = [];
  if (pl.plan && pl.plan.stage) {
    head.push(`_${pl.plan.stage.title}. ${pl.plan.stage.blurb}_`, '');
    (pl.plan.notes || []).forEach((n) => head.push(`- ${n}`));
    if ((pl.plan.notes || []).length) head.push('');
  }
  const foot = [];
  if (pl.plan && pl.plan.week) foot.push('', `This week: ${weekLine(pl)}`);
  if (pl.athlete && pl.athlete.flags.length) foot.push('', `Working around: ${pl.athlete.flags.join(', ')}.`);

  if (!pl.workout) {
    const ns = pl.restDay.nextSession;
    return ['# Rest day', '', `**${pl.date}**. ${pl.restDay.reason}`, '', ...head,
      ns ? `Next strength session: ${ns.day} ${ns.date}${ns.intensity === 'light' ? ' (light)' : ''}.` : '', ...foot, ''].join('\n');
  }

  const w = pl.workout;
  const phaseName = { easing: 'Easing back', building: 'Building', ready: 'Ready' }[w.phase];
  const label = Gen.FORMAT_LABEL[w.format];
  const lines = [`# ${w.title}`, '', `**${pl.date}**. ${w.minutes} minute ${label}, ${phaseName} phase${w.intensity === 'light' ? ', light day' : ''}.`, '', ...head];
  if (pl.optional) lines.push('_Rest day, so this is an optional light session._', '');

  if (w.format === 'amrap') {
    lines.push('Work through the list in order with no planned rest, then start again. Count rounds and reps until the clock hits zero.', '');
  } else if (w.format === 'emom') {
    lines.push(
      'Every minute on the minute, do the next movement. Whatever time is left in the minute is your rest. ' +
      `${w.moves.length} movements, ${w.cycles} times through.`, ''
    );
  } else {
    lines.push(
      'Every minute on the minute, one short explosive set. Move fast, reset fully between reps, and rest for the rest of the minute. ' +
      `Stop a set early if the reps slow down. ${w.moves.length} movements, ${w.cycles} times through.`, ''
    );
  }
  if (w.startSide) lines.push(`Start each one-sided movement on your ${w.startSide} side.`, '');

  w.moves.forEach((m, i) => {
    const tags = [m.slot === 'single' || m.sl ? 'single-leg' : '', m.slot === 'core' ? 'core' : '', m.slot === 'stab' ? 'stability' : '', m.uses || ''].filter(Boolean);
    const when = w.format === 'amrap' ? '' : ` Minutes ${minutesFor(i, w.moves.length, w.minutes).join(', ')}.`;
    lines.push(`${i + 1}. **${Gen.qtyLabel(m)}** ${m.name}${tags.length ? ` (${tags.join(', ')})` : ''}.${when} ${m.cue}`);
  });

  if (w.format === 'amrap') {
    lines.push('', `One round takes about ${mmss(w.roundSeconds)}, so aim for roughly ${w.targetRounds} rounds. That is ${w.repsPerRound} reps per round (holds not counted).`);
  } else {
    lines.push('', `${w.repsPerRound} reps in one pass through the list (holds not counted). Score yourself by the minutes you finished the full set.`);
  }
  lines.push(...foot, '', '_Not medical advice. If anything pinches, skip it and ask your physio._', '');
  return lines.join('\n');
}

function minutesFor(index, len, total) {
  const out = [];
  for (let m = index; m < total; m += len) out.push(m + 1);
  return out;
}
