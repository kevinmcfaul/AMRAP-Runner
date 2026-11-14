# 20-minute AMRAP for a runner getting back into it

A new "as many rounds and reps as possible in 20 minutes" workout every morning. Every workout has at least one single-leg movement and at least one core movement, and the movements and rep counts scale to where you are in your return to running.

The workout format is borrowed from sites like The Twenty Minute Marriage: a short list of movements, done in order, repeated until the clock runs out. The movements here are chosen for runners (calf raises, single-leg hinges, step-ups, side planks, dead bugs, and so on).

## Set it up (about five minutes)

1. Create a new GitHub repository and push this folder to it (the default branch should be `main`).
2. In the repository go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Go to **Actions > Daily workout > Run workflow**. When it finishes, your site is live at `https://<your-username>.github.io/<repo-name>/`.

From then on it runs by itself every day at 10:30 UTC (5:30 am EST, 6:30 am EDT in Toronto) and publishes that day's workout. The same workout is also written to `TODAY.md`, which GitHub renders nicely if you'd rather read it in the repo.

Pages is free for public repositories. Private repositories need a paid GitHub plan for Pages.

## Don't like today's workout?

- **Quick, on your own device:** open the site and tap **Shuffle**, or tap the arrow on any single movement to swap it. Swaps keep the single-leg and core rules intact. Nothing is saved to the repo.
- **Replace the published one:** **Actions > Daily workout > Run workflow**. Leave "Replace today's workout" ticked. You can also change phase, equipment or movement count for that one run.

## Change your defaults

Edit `config.json` and commit:

```json
{
  "timezone": "America/Toronto",
  "phase": "easing",
  "equipment": [],
  "movements": 5,
  "doubleSingle": false,
  "doubleCore": false
}
```

- `phase`: `easing` (no impact, lighter reps), `building` (light impact allowed), `ready` (jumps and hops included). Move up when the current phase feels easy and your runs are going well.
- `equipment`: any of `dumbbell`, `kettlebell`, `band`, `step`. Empty means bodyweight only.
- `movements`: 4 or 5 per round.
- `doubleSingle` / `doubleCore`: ask for two single-leg or two core movements.

## Add or change movements

Everything lives in `lib/exercises.js`. Each entry says which slot it fills (`single`, `lower`, `push`, `pull`, `core`, `cond`), what equipment it needs, how much impact it has, and the reps for each phase. The generator avoids repeating a movement pattern within a workout and rotates away from anything used in the last seven days.

Run `npm test` after editing. It checks the library and generates a few thousand workouts to confirm every one has single-leg and core work and respects phase and equipment.

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
