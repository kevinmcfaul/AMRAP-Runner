# 20-minute workouts for a runner getting back into it

A new 20-minute workout every morning, in one of three formats. Every workout has at least one single-leg movement and at least one core movement, and the movements and rep counts scale to where you are in your return to running.

| Format | How it runs |
| --- | --- |
| **AMRAP** | Work through the list in order and repeat. As many rounds and reps as you can in 20 minutes. |
| **EMOM** | Every minute on the minute, one movement, then rest until the minute turns over. Sets are sized to about 35 seconds of work. You cycle through the list (4 movements five times, or 5 movements four times). |
| **Power EMOM** | Like EMOM, but each set is short and explosive (about 20 seconds of work) with lots of rest. Only movements marked as power movements are used, plus one core movement. Quality over quantity. |

By default (`"format": "mix"`) each day gets one of the three, weighted toward AMRAP and EMOM, and avoids repeating yesterday's format. The format style is borrowed from sites like The Twenty Minute Marriage. The movements here are chosen for runners (calf raises, single-leg hinges, step-ups, side planks, dead bugs, and so on).

## A plan, not just a workout

The page and the daily Action now work from a weekly and block plan, so you are not doing the same load every day regardless of your runs.

- **Rest days and run days.** Tell it your week in `config.json` (`schedule`). Strength never lands on your long run or hard run days. The day before a key run is a light session (no jumping, trimmed reps). On days with no session you get a rest-day page with an easy-movement suggestion and a **Do a light session anyway** button.
- **Training blocks.** From `plan.startDate` (or the first day it runs) the plan cycles through 4 weeks of **Base**, a **Deload** week, 4 weeks of **Build**, and another **Deload**. Base leans on single-leg and stability work with no power sets. Build uses heavier loads (fewer reps) if you have weights, and brings power back. Deload drops a session, trims reps by 40% and removes jumping.
- **Race date.** Set `plan.raceDate` and the plan switches to **Race season** (8 weeks out: maintenance, two sessions at most, single-leg first), **Taper** (final week), a no-strength race window, then a week of **Recovery**.
- **Anything flaring up.** Tap the areas (calf, Achilles, foot, shin, knee, hip, hamstring, back, shoulder) under *Adjust this workout*. Movements that load that area are removed, any leg area also removes all jumping, and a few helpful movements are favoured. It is a guardrail, not a diagnosis. Pain that lasts more than a few days is one for your physio.
- **Weaker side.** Pick left or right and every one-sided movement is tagged to start there.
- **Effort check-in.** After a workout, rate it 1 to 10, rate soreness, and tick anything that hurt. A very hard or sore session trims the next one by about 30% and removes jumping. Three easy sessions in a row suggest moving up a phase.

### Getting your data to the daily pick

The page keeps your flags, weaker side and ratings on your device. The Action can only see what is in the repo, so tap **Copy profile update**, paste it over `data/athlete.json`, and commit. Flags expire after 14 days unless you renew them. Logging a session never replaces the workout you are about to do; the new ratings shape the next one. You can also set flags and the weaker side for a single run from **Actions > Run workflow**.

## Set it up (about five minutes)

1. Create a new GitHub repository and push this folder to it (the default branch should be `main`).
2. In the repository go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Go to **Actions > Daily workout > Run workflow**. When it finishes, your site is live at `https://<your-username>.github.io/<repo-name>/`.

From then on it runs by itself every day at 10:30 UTC (5:30 am EST, 6:30 am EDT in Toronto) and publishes that day's workout. The same workout is also written to `TODAY.md`, which GitHub renders nicely if you'd rather read it in the repo.

Pages is free for public repositories. Private repositories need a paid GitHub plan for Pages.

## Log it in Strava or TrainingPeaks

When the clock hits zero, a results card appears under the timer with two buttons:

- **Copy results**: the format, your score, the time, and what you completed for each movement, for example `Air squat: 4 x 17 reps = 68 reps`. EMOM workouts also list any minutes you marked as missed.
- **Copy short summary**: a one-line version that fits a title or a short description.

You can also copy results mid-workout (tap **Copy results** under the clock while paused, for a session you cut short), and every saved score in the list at the bottom has its own **Copy** link. Paste the text into the description of a Strava activity or the comments on a TrainingPeaks workout. It's plain text, so there is nothing to connect or authorise.

## Don't like today's workout?

- **Quick, on your own device:** open the site and tap **Shuffle**, or tap the arrow on any single movement to swap it. Swaps keep the single-leg and core rules intact. Nothing is saved to the repo.
- **Replace the published one:** **Actions > Daily workout > Run workflow**. Leave "Replace today's workout" ticked. You can also change format, phase, equipment or movement count for that one run.

## Change your defaults

Edit `config.json` and commit:

```json
{
  "timezone": "America/Toronto",
  "format": "mix",
  "phase": "easing",
  "equipment": [],
  "movements": 5,
  "doubleSingle": false,
  "doubleCore": false,
  "schedule": { "sessionsPerWeek": 3, "longRunDay": "Sat", "hardRunDays": ["Tue"] },
  "plan": { "startDate": null, "baseWeeks": 4, "buildWeeks": 4, "raceDate": null },
  "flags": []
}
```

- `format`: `mix` (a different format each day), `amrap`, `emom` or `power`.
- `phase`: `easing` (no impact, lighter reps), `building` (light impact allowed), `ready` (jumps and hops included). Move up when the current phase feels easy and your runs are going well.
- `equipment`: any of `dumbbell`, `kettlebell`, `band`, `step` (step or bench), `sliders` (or a towel on a smooth floor). Empty means bodyweight only.
- `movements`: 4 or 5 per round.
- `doubleSingle` / `doubleCore`: ask for two single-leg or two core movements.
- `schedule`: `sessionsPerWeek` (1 to 4), `longRunDay`, `hardRunDays` (day names such as `"Sat"`). Optionally `sessionDays` (for example `["Mon","Thu"]`) to fix the strength days yourself.
- `plan`: `startDate` (`YYYY-MM-DD`, blank starts this week), `baseWeeks` and `buildWeeks` (2 to 8), `raceDate`.
- `flags`: areas to always work around, for example `["calf"]`.

## Add or change movements

Everything lives in `lib/exercises.js`. The planner is in `lib/plan.js` and the pain-flag rules (which movement patterns each area removes) are in `lib/generator.js`. Each entry says which slot it fills (`single`, `lower`, `push`, `pull`, `core`, `cond`, `stab`), what equipment it needs, how much impact it has, and the reps for each phase. `stab` is for runner stability and prehab work (clamshells, balance, tibialis raises and so on). It fills part of the "both legs" slot and part of the fifth movement.

The `POWER` list at the bottom of that file says which movements Power EMOM may use. The easing phase has no jumping, so its power movements are fast concentric versions (speed squats, explosive bridges, reverse lunge to knee drive) that stay on the floor. Jumps, hops and bounds join at Building and Ready.

Movements done on one leg but outside the single-leg slot (balance, A-skips, bounding) carry `sl: true`, so they get the single-leg tag. Only the `single` slot counts toward the "at least one single-leg movement" rule, so a workout never relies on a balance hold for that. The generator avoids repeating a movement pattern within a workout and rotates away from anything used in the last seven days.

Run `npm test` after editing. It checks the library, the weekly planner and the pain-flag filters, and generates thousands of workouts to confirm every one has single-leg and core work and respects phase and equipment.

## Run it locally

```
npm run generate     # today's workout (no-op if already generated)
npm run reroll       # a new one for today
npm test
```

Then open `index.html` in a browser. No build step and no dependencies.

## Things to know

- The Action versions in `.github/workflows/daily-workout.yml` (`checkout@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`) were written from memory and not checked against the latest releases. If a run warns about a deprecated version, bump it.
- GitHub can pause scheduled workflows in repositories with no activity for 60 days. If the daily run stops, re-enable it under the Actions tab.
- This is general exercise guidance, not medical advice. If you're coming back from an injury, check the plan with your physio.
