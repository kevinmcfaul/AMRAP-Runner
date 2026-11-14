#!/usr/bin/env node
/*
 * Generates today's workout.
 *
 *   node scripts/generate.js            generate today's workout (no-op if already generated with same config)
 *   node scripts/generate.js --reroll   force a brand-new workout for today
 *
 * Overrides (used by the GitHub Action's "Run workflow" form), all optional:
 *   PHASE=easing|building|ready   EQUIPMENT=dumbbell,band   MOVEMENTS=4|5
 *   DOUBLE_SINGLE=true            DOUBLE_CORE=true          REROLL=true
 *
 * Writes: data/today.json, data/today.js (loaded by the page), data/history.json, TODAY.md
 */
const fs = require('fs');
const path = require('path');
const exercises = require('../lib/exercises.js');
const Gen = require('../lib/generator.js');

const root = path.join(__dirname, '..');
const p = (...a) => path.join(root, ...a);
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
};

const fileCfg = readJson(p('config.json'), {});
const env = process.env;
const overrides = {};
if (env.PHASE) overrides.phase = env.PHASE.trim();
if (env.EQUIPMENT !== undefined && env.EQUIPMENT.trim() !== '')
  overrides.equipment = env.EQUIPMENT.split(/[,\s]+/).filter(Boolean).map((s) => s.toLowerCase());
if (env.MOVEMENTS) overrides.movements = Number(env.MOVEMENTS);
if (env.DOUBLE_SINGLE) overrides.doubleSingle = env.DOUBLE_SINGLE === 'true';
if (env.DOUBLE_CORE) overrides.doubleCore = env.DOUBLE_CORE === 'true';

const cfg = Gen.normalizeConfig(Object.assign({}, fileCfg, overrides));
const key = Gen.cfgKey(cfg);
const tz = fileCfg.timezone || 'America/Toronto';
const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const reroll = process.argv.includes('--reroll') || env.REROLL === 'true';

const existing = readJson(p('data', 'today.json'), null);
if (existing && existing.date === date && existing.cfgKey === key && !reroll) {
  console.log(`Workout for ${date} already generated (${existing.workout.title}). Nothing to do.`);
  writeBrowserFile(existing);
  process.exit(0);
}

const history = readJson(p('data', 'history.json'), { days: {} });
// Count how often each movement showed up in the last 7 days (excluding today) so we rotate.
const recent = {};
Object.keys(history.days)
  .filter((d) => d < date)
  .sort()
  .slice(-7)
  .forEach((d) => history.days[d].ids.forEach((id) => (recent[id] = (recent[id] || 0) + 1)));

const salt = reroll
  ? Date.now().toString(36)
  : existing && existing.date === date ? existing.salt : '';
const seed = `${date}|${salt}|${key}`;
const workout = Gen.generate({ exercises, cfg, recent }, seed);

const problems = Gen.validate(workout, cfg, exercises);
if (problems.length) {
  console.error('Generated workout failed validation: ' + problems.join(', '));
  process.exit(1);
}

const payload = {
  date, timezone: tz, generatedAt: new Date().toISOString(),
  trigger: env.GITHUB_EVENT_NAME || 'local',
  salt, config: cfg, cfgKey: key, recent, workout,
};

fs.mkdirSync(p('data'), { recursive: true });
fs.writeFileSync(p('data', 'today.json'), JSON.stringify(payload, null, 2) + '\n');
writeBrowserFile(payload);

history.days[date] = { title: workout.title, ids: workout.moves.map((m) => m.id) };
const keep = Object.keys(history.days).sort().slice(-30);
history.days = Object.fromEntries(keep.map((d) => [d, history.days[d]]));
fs.writeFileSync(p('data', 'history.json'), JSON.stringify(history, null, 2) + '\n');

fs.writeFileSync(p('TODAY.md'), toMarkdown(payload));
console.log(`Generated ${date}: ${workout.title} (${workout.moves.map((m) => m.name).join(', ')})`);

function writeBrowserFile(pl) {
  fs.mkdirSync(p('data'), { recursive: true });
  fs.writeFileSync(p('data', 'today.js'), 'window.AMRAP_TODAY = ' + JSON.stringify(pl) + ';\n');
}

function mmss(s) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function toMarkdown(pl) {
  const w = pl.workout;
  const phaseName = { easing: 'Easing back', building: 'Building', ready: 'Ready' }[w.phase];
  const lines = [
    `# ${w.title}`,
    '',
    `**${pl.date}**. AMRAP ${w.minutes} minutes, ${phaseName} phase.`,
    '',
    'Work through the list in order with no planned rest, then start again. Count rounds and reps until the clock hits zero.',
    '',
  ];
  w.moves.forEach((m, i) => {
    const tags = [m.slot === 'single' ? 'single-leg' : '', m.slot === 'core' ? 'core' : '', m.uses || ''].filter(Boolean);
    lines.push(`${i + 1}. **${Gen.qtyLabel(m)}** ${m.name}${tags.length ? ` (${tags.join(', ')})` : ''}. ${m.cue}`);
  });
  lines.push('', `One round takes about ${mmss(w.roundSeconds)}, so aim for roughly ${w.targetRounds} rounds. That is ${w.repsPerRound} reps per round (holds not counted).`);
  lines.push('', '_Not medical advice. If anything pinches, skip it and ask your physio._', '');
  return lines.join('\n');
}
