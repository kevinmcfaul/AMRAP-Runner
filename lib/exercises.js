/*
 * Movement library for the return-to-run AMRAP generator.
 *
 * Fields
 *   id     unique slug
 *   name   display name
 *   slot   single | lower | push | pull | core | cond | stab
 *            single = a single-leg lower-body movement (every workout has >= 1)
 *            core   = trunk work                         (every workout has >= 1)
 *            stab   = runner stability and prehab: hips, feet, shins, balance
 *   pat    movement pattern. The generator avoids repeating a pattern in one workout.
 *   eq     equipment, ANY ONE of which is enough. [] = bodyweight only.
 *          Values: dumbbell | kettlebell | band | step | sliders
 *   imp    impact: 0 none, 1 light, 2 jumping/hopping. Allowed up to the phase index
 *          (easing = 0, building = 1, ready = 2).
 *   lvl    minimum phase index (0 easing, 1 building, 2 ready)
 *   r      reps for [easing, building, ready]. Per side when side = true.
 *   u      unit: reps | sec | steps
 *   side   true = the number is per side
 *   sl     true = done on one leg (gets the single-leg tag even outside the single slot)
 *   pw     true = suited to Power EMOM (explosive intent). Set from the POWER list at the bottom.
 *   t      estimated seconds per rep (seconds units: 1)
 *   cue    one-line coaching cue
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AMRAP_EXERCISES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const E = (id, name, slot, pat, o) =>
    Object.assign(
      { id, name, slot, pat, eq: [], imp: 0, lvl: 0, u: 'reps', side: false, sl: false, pw: false, t: 2.5, cue: '' },
      o
    );

  const list = [
    // ---------------------------------------------------------------- single-leg
    E('reverse-lunge', 'Reverse lunge', 'single', 'lunge', {
      r: [6, 8, 10], side: true, t: 3,
      cue: 'Step back, tap the knee softly, drive up through the front heel.',
    }),
    E('goblet-reverse-lunge', 'Goblet reverse lunge', 'single', 'lunge', {
      eq: ['dumbbell', 'kettlebell'], r: [6, 8, 10], side: true, t: 3.2,
      cue: 'Weight held at the chest, torso tall, front foot flat.',
    }),
    E('split-squat', 'Split squat', 'single', 'lunge', {
      r: [6, 8, 10], side: true, t: 3.2,
      cue: 'Stay in the split stance, drop straight down, front knee tracks the middle toes.',
    }),
    E('bulgarian-split-squat', 'Bulgarian split squat', 'single', 'lunge', {
      eq: ['step'], lvl: 1, r: [5, 7, 9], side: true, t: 3.8,
      cue: 'Back foot on the step, most of the weight on the front leg.',
    }),
    E('single-leg-rdl', 'Single-leg Romanian deadlift', 'single', 'hinge', {
      r: [6, 8, 10], side: true, t: 3.5,
      cue: 'Hinge from the hip, back leg long, soft standing knee, hips square.',
    }),
    E('single-leg-rdl-loaded', 'Single-leg deadlift (loaded)', 'single', 'hinge', {
      eq: ['dumbbell', 'kettlebell'], r: [6, 8, 10], side: true, t: 3.5,
      cue: 'Weight in the hand opposite the standing leg. Slow on the way down.',
    }),
    E('step-up', 'Step-up', 'single', 'stepup', {
      eq: ['step'], r: [8, 10, 12], side: true, t: 3,
      cue: 'Whole foot on the step. Stand up without pushing off the back foot.',
    }),
    E('lateral-step-down', 'Lateral step-down', 'single', 'stepdown', {
      eq: ['step'], r: [6, 8, 10], side: true, t: 3.5,
      cue: 'Lower slowly on one leg, tap the other heel down, stand tall.',
    }),
    E('single-leg-box-squat', 'Single-leg box squat', 'single', 'squat', {
      eq: ['step'], r: [5, 7, 9], side: true, t: 4,
      cue: 'Sit down onto the step with control, stand without swinging.',
    }),
    E('single-leg-glute-bridge', 'Single-leg glute bridge', 'single', 'bridge', {
      r: [8, 10, 12], side: true, t: 3,
      cue: 'Ribs down, push through the heel, hips level at the top.',
    }),
    E('single-leg-hip-thrust', 'Single-leg hip thrust', 'single', 'bridge', {
      eq: ['step'], lvl: 1, r: [6, 8, 10], side: true, t: 3.2,
      cue: 'Upper back on the step, drive the hips up and squeeze for a beat.',
    }),
    E('single-leg-calf-raise', 'Single-leg calf raise', 'single', 'calf', {
      r: [10, 14, 18], side: true, t: 2.5,
      cue: 'Full range, pause at the top, lower for two counts. Hold a wall for balance.',
    }),
    E('lateral-lunge', 'Lateral lunge', 'single', 'lateral', {
      r: [6, 8, 10], side: true, t: 3.5,
      cue: 'Sit back into the working hip, other leg straight, chest up.',
    }),
    E('curtsy-lunge', 'Curtsy lunge', 'single', 'lateral', {
      r: [6, 8, 10], side: true, t: 3.5,
      cue: 'Step behind and across, keep the front knee stacked over the ankle.',
    }),
    E('skater-squat', 'Skater squat', 'single', 'squat', {
      lvl: 1, r: [4, 6, 8], side: true, t: 4,
      cue: 'Rear foot hovers behind you and only taps the floor lightly.',
    }),
    E('alternating-jump-lunge', 'Lunge jump', 'single', 'lunge', {
      imp: 2, lvl: 2, r: [12, 16, 20], t: 2.2,
      cue: 'Total reps. Land softly, quick switch, stay tall.',
    }),
    E('single-leg-pogo', 'Single-leg pogo jump', 'single', 'hop', {
      imp: 2, lvl: 2, r: [8, 10, 12], side: true, t: 1.6,
      cue: 'Small, quiet hops off the ball of the foot with a stiff ankle.',
    }),

    // ---------------------------------------------------------------- lower (both legs)
    E('air-squat', 'Air squat', 'lower', 'squat', {
      r: [12, 15, 20], t: 2.2, cue: 'Sit between the hips, heels down, drive up.',
    }),
    E('sumo-squat', 'Sumo squat', 'lower', 'squat', {
      r: [12, 15, 20], t: 2.4, cue: 'Wide stance, toes turned out, knees follow the toes.',
    }),
    E('squat-calf-raise', 'Squat to calf raise', 'lower', 'squat', {
      r: [10, 12, 15], t: 3, cue: 'Stand up, then rise onto the toes before the next squat.',
    }),
    E('goblet-squat', 'Goblet squat', 'lower', 'squat', {
      eq: ['dumbbell', 'kettlebell'], r: [8, 10, 12], t: 3,
      cue: 'Weight at the chest, elbows inside the knees at the bottom.',
    }),
    E('glute-bridge', 'Glute bridge', 'lower', 'bridge', {
      r: [12, 15, 20], t: 2.5, cue: 'Feet flat, push through the heels, squeeze at the top.',
    }),
    E('good-morning', 'Good morning', 'lower', 'hinge', {
      r: [10, 12, 15], t: 2.5, cue: 'Hands behind the head, hinge with a flat back, feel the hamstrings.',
    }),
    E('dumbbell-deadlift', 'Deadlift', 'lower', 'hinge', {
      eq: ['dumbbell', 'kettlebell'], r: [8, 10, 12], t: 3,
      cue: 'Weight close to the legs, hinge, then stand tall.',
    }),
    E('kettlebell-swing', 'Kettlebell swing', 'lower', 'hinge', {
      eq: ['kettlebell'], imp: 1, lvl: 1, r: [10, 12, 15], t: 2.5,
      cue: 'Hips do the work. Snap them forward and let the bell float.',
    }),
    E('band-pull-through', 'Band pull-through', 'lower', 'hinge', {
      eq: ['band'], r: [10, 12, 15], t: 2.5,
      cue: 'Band anchored behind you, hinge back, squeeze the glutes to stand.',
    }),
    E('banded-lateral-walk', 'Lateral band walk', 'stab', 'bandwalk', {
      eq: ['band'], u: 'steps', r: [16, 20, 24], t: 1.6,
      cue: 'Total steps. Band above the knees, stay low, toes forward.',
    }),
    E('calf-raise', 'Calf raise', 'lower', 'calf', {
      r: [15, 20, 25], t: 2, cue: 'Pause at the top, lower for two counts.',
    }),
    E('wall-sit', 'Wall sit', 'lower', 'squat', {
      u: 'sec', r: [20, 30, 45], t: 1, cue: 'Thighs parallel, back flat against the wall, breathe.',
    }),
    E('jump-squat', 'Jump squat', 'lower', 'squat', {
      imp: 2, lvl: 2, r: [8, 10, 12], t: 2, cue: 'Land softly and go straight into the next rep.',
    }),

    // ---------------------------------------------------------------- upper: push
    E('push-up', 'Push-up', 'push', 'push', {
      r: [6, 10, 14], t: 2.5, cue: 'Body in one line. Drop to the knees if form slips.',
    }),
    E('incline-push-up', 'Incline push-up', 'push', 'push', {
      eq: ['step'], r: [8, 10, 12], t: 2.2, cue: 'Hands on the step, body in one line.',
    }),
    E('floor-press', 'Dumbbell floor press', 'push', 'push', {
      eq: ['dumbbell'], r: [8, 10, 12], t: 3, cue: 'Elbows about 45 degrees from the ribs, press to lockout.',
    }),
    E('overhead-press', 'Overhead press', 'push', 'push', {
      eq: ['dumbbell', 'kettlebell'], r: [6, 8, 10], t: 3, cue: 'Brace the core, press straight up, ribs down.',
    }),
    E('pike-push-up', 'Pike push-up', 'push', 'push', {
      lvl: 1, r: [5, 7, 10], t: 3, cue: 'Hips high, lower the crown of the head toward the floor.',
    }),
    E('bench-dip', 'Bench dip', 'push', 'push', {
      eq: ['step'], r: [8, 10, 12], t: 2.5, cue: 'Hands on the edge, elbows back, shoulders away from the ears.',
    }),
    E('hand-release-push-up', 'Hand-release push-up', 'push', 'push', {
      lvl: 2, r: [6, 8, 10], t: 3.2, cue: 'Chest to the floor, lift the hands, press up.',
    }),

    // ---------------------------------------------------------------- upper: pull
    E('single-arm-row', 'Single-arm dumbbell row', 'pull', 'pull', {
      eq: ['dumbbell', 'kettlebell'], r: [8, 10, 12], side: true, t: 3,
      cue: 'Hand and knee on a step or chair if you like. Pull to the hip.',
    }),
    E('bent-over-row', 'Dumbbell bent-over row', 'pull', 'pull', {
      eq: ['dumbbell', 'kettlebell'], r: [8, 10, 12], t: 3, cue: 'Hinged and flat back, pull the elbows to the ribs.',
    }),
    E('band-pull-apart', 'Band pull-apart', 'pull', 'pull', {
      eq: ['band'], r: [12, 15, 20], t: 2, cue: 'Arms straight, pull the band to the chest, squeeze the shoulder blades.',
    }),
    E('band-row', 'Band row', 'pull', 'pull', {
      eq: ['band'], r: [10, 12, 15], t: 2.5, cue: 'Anchor the band in front, pull the elbows past the ribs.',
    }),
    E('band-face-pull', 'Band face pull', 'pull', 'pull', {
      eq: ['band'], r: [12, 15, 20], t: 2.5, cue: 'Pull toward the forehead, elbows high and wide.',
    }),
    E('superman', 'Superman raise', 'pull', 'pull', {
      r: [10, 12, 15], t: 2.5, cue: 'Lift the arms and legs together, pause for a beat.',
    }),
    E('prone-ytw', 'Prone Y-T raise', 'pull', 'pull', {
      r: [8, 10, 12], t: 3, cue: 'Face down, lift the arms into a Y then a T. Thumbs up.',
    }),
    E('renegade-row', 'Renegade row', 'pull', 'pull', {
      eq: ['dumbbell'], lvl: 2, r: [4, 5, 6], side: true, t: 5,
      cue: 'Wide feet, hips square, row without rocking.',
    }),

    // ---------------------------------------------------------------- core
    E('dead-bug', 'Dead bug', 'core', 'antiext', {
      r: [6, 8, 10], side: true, t: 3.5, cue: 'Low back stays on the floor. Opposite arm and leg lower together.',
    }),
    E('bird-dog', 'Bird dog', 'core', 'antirot', {
      r: [6, 8, 10], side: true, t: 4, cue: 'Reach long, hips level, pause at full extension.',
    }),
    E('plank', 'Forearm plank', 'core', 'antiext', {
      u: 'sec', r: [20, 30, 45], t: 1, cue: 'Ribs down, glutes squeezed, one straight line.',
    }),
    E('side-plank', 'Side plank', 'core', 'lateral', {
      u: 'sec', r: [15, 20, 30], side: true, t: 1, cue: 'Stack the hips, lift them high, keep the neck long.',
    }),
    E('side-plank-hip-dip', 'Side plank hip dip', 'core', 'lateral', {
      r: [6, 8, 10], side: true, t: 2.5, cue: 'Lower the hip toward the floor, then lift it back to level.',
    }),
    E('hollow-hold', 'Hollow body hold', 'core', 'antiext', {
      u: 'sec', lvl: 1, r: [15, 20, 30], t: 1, cue: 'Low back pressed down. Bend the knees if it lifts.',
    }),
    E('plank-shoulder-tap', 'Plank shoulder tap', 'core', 'antirot', {
      r: [12, 16, 20], t: 1.8, cue: 'Total taps. Feet wide, hips barely move.',
    }),
    E('pallof-press', 'Pallof press', 'core', 'antirot', {
      eq: ['band'], r: [8, 10, 12], side: true, t: 3.5, cue: 'Press the band straight out and resist the twist.',
    }),
    E('russian-twist', 'Russian twist', 'core', 'rot', {
      r: [16, 20, 30], t: 1.4, cue: 'Total reps. Lean back slightly, turn the ribs, not just the arms.',
    }),
    E('bicycle-crunch', 'Bicycle crunch', 'core', 'rot', {
      r: [16, 20, 30], t: 1.5, cue: 'Total reps. Slow and controlled, elbow toward the opposite knee.',
    }),
    E('heel-tap', 'Heel tap', 'core', 'rot', {
      r: [16, 20, 30], t: 1.2, cue: 'Total taps. Shoulders slightly off the floor, side-bend to each heel.',
    }),
    E('flutter-kick', 'Flutter kick', 'core', 'flex', {
      r: [16, 20, 30], t: 1.2, cue: 'Total kicks. Low back down, legs long.',
    }),
    E('lying-leg-lower', 'Lying leg lower', 'core', 'flex', {
      r: [6, 8, 10], t: 3.5, cue: 'Lower straight legs slowly, stop before the low back lifts.',
    }),
    E('reverse-crunch', 'Reverse crunch', 'core', 'flex', {
      r: [8, 10, 12], t: 2.5, cue: 'Curl the hips off the floor, no swinging.',
    }),
    E('mountain-climber', 'Mountain climber', 'core', 'antiext', {
      imp: 1, lvl: 1, r: [16, 24, 32], t: 1.1, cue: 'Total reps. Shoulders over the hands, quick knees.',
    }),
    E('v-up', 'V-up', 'core', 'flex', {
      lvl: 2, r: [6, 8, 10], t: 3, cue: 'Reach hands to feet, lower with control.',
    }),

    // ---------------------------------------------------------------- conditioning (low impact first)
    E('high-knee-march', 'High-knee march', 'cond', 'cardio', {
      r: [30, 40, 60], t: 0.8, cue: 'Total steps. Drive the knee up, swing the opposite arm.',
    }),
    E('step-jack', 'Step jack', 'cond', 'cardio', {
      r: [20, 24, 30], t: 1.1, cue: 'Jumping-jack arms, but step each foot out instead of jumping.',
    }),
    E('shadow-boxing', 'Shadow boxing', 'cond', 'cardio', {
      r: [30, 40, 50], t: 0.7, cue: 'Total punches. Light on the feet, rotate through the hips.',
    }),
    E('farmer-carry', "Farmer's carry", 'cond', 'carry', {
      eq: ['dumbbell', 'kettlebell'], u: 'steps', r: [20, 30, 40], t: 0.9,
      cue: 'Walk tall with a weight in each hand (or one for a suitcase carry).',
    }),
    E('step-back-burpee', 'Step-back burpee', 'cond', 'burpee', {
      lvl: 1, r: [4, 6, 8], t: 5.5, cue: 'Step back to the plank and step in. No jumping.',
    }),
    E('jumping-jack', 'Jumping jack', 'cond', 'cardio', {
      imp: 1, lvl: 1, r: [20, 25, 30], t: 0.9, cue: 'Light feet, quiet landings.',
    }),
    E('fast-feet', 'Fast feet', 'cond', 'cardio', {
      imp: 1, lvl: 1, u: 'sec', r: [15, 20, 30], t: 1, cue: 'Short, quick steps on the balls of the feet.',
    }),
    E('thruster', 'Dumbbell thruster', 'cond', 'thruster', {
      eq: ['dumbbell'], imp: 1, lvl: 1, r: [6, 8, 10], t: 3.5, cue: 'Squat, then drive the weights overhead in one motion.',
    }),
    E('burpee', 'Burpee', 'cond', 'burpee', {
      imp: 2, lvl: 2, r: [5, 6, 8], t: 4, cue: 'Chest to the floor, jump and clap overhead.',
    }),
    E('skater-hop', 'Skater bound', 'cond', 'hop', {
      imp: 2, lvl: 2, r: [8, 10, 12], side: true, sl: true, t: 1.6, cue: 'Bound side to side and stick each landing.',
    }),
    E('a-skip', 'A-skip', 'cond', 'drill', {
      imp: 1, lvl: 1, u: 'steps', r: [16, 20, 24], sl: true, t: 1,
      cue: 'Total steps. Skip with a quick knee drive, opposite arm swings, short ground contact.',
    }),
    E('bounding', 'Bounding', 'cond', 'hop', {
      imp: 2, lvl: 2, r: [6, 8, 10], side: true, sl: true, t: 2.5,
      cue: 'Long, springy strides: drive the knee, hang in the air, land on the same foot. Needs about 10 metres of space.',
    }),
    E('double-pogo', 'Pogo hops, double-leg', 'cond', 'hop2', {
      imp: 1, lvl: 1, r: [15, 20, 25], t: 1,
      cue: 'Small, quick hops off the balls of both feet with stiff ankles.',
    }),
    E('bear-crawl', 'Bear crawl', 'cond', 'crawl', {
      u: 'steps', r: [8, 12, 16], t: 1.5,
      cue: 'Total steps. Knees hover an inch off the floor, opposite hand and foot move together.',
    }),
    E('suitcase-carry', 'Suitcase carry', 'cond', 'carry', {
      eq: ['dumbbell', 'kettlebell'], u: 'steps', side: true, r: [16, 20, 24], t: 0.9,
      cue: 'One weight at your side, walk tall without leaning. Switch hands for the second side.',
    }),

    // ---------------------------------------------------------------- more single-leg
    E('walking-lunge', 'Walking lunge', 'single', 'lunge', {
      r: [6, 8, 10], side: true, t: 3.2,
      cue: 'Long steps, back knee kisses the floor, torso tall. Needs about 4 metres of space.',
    }),
    E('hip-airplane', 'Hip airplane', 'single', 'hinge', {
      lvl: 1, r: [4, 6, 8], side: true, t: 5,
      cue: 'Hinge on one leg, then rotate the hips open and closed. Slow, with a hand on a wall if needed.',
    }),
    E('single-leg-hop', 'Single-leg hop', 'single', 'hop', {
      imp: 2, lvl: 2, r: [6, 8, 10], side: true, t: 2.5,
      cue: 'Hop forward, stick the landing for a beat, hop back. Quiet landings.',
    }),

    // ---------------------------------------------------------------- more lower (both legs)
    E('bent-knee-calf-raise', 'Bent-knee calf raise (soleus raise)', 'lower', 'calf', {
      r: [12, 15, 20], t: 2.5,
      cue: 'Knees bent about 90 degrees (back against a wall or in a half squat), rise onto the toes, lower for two counts.',
    }),
    E('standing-calf-raise', 'Standing calf raise', 'lower', 'calf', {
      eq: ['step'], r: [12, 15, 20], t: 2.5,
      cue: 'Balls of the feet on the edge of a step, legs straight, full range of motion.',
    }),
    E('hamstring-walkout', 'Hamstring walkout', 'lower', 'hamcurl', {
      r: [4, 5, 6], t: 5, cue: 'Bridge up, walk the heels out and back, hips stay high.',
    }),
    E('hamstring-slider', 'Hamstring slider curl', 'lower', 'hamcurl', {
      eq: ['sliders'], lvl: 1, r: [6, 8, 10], t: 4,
      cue: 'Heels on sliders (or a towel on a smooth floor), bridge up, slide out and curl back in.',
    }),
    E('nordic-curl', 'Nordic hamstring curl', 'lower', 'hamcurl', {
      lvl: 2, r: [3, 4, 6], t: 6,
      cue: 'Anchor the heels under something solid, lower as slowly as you can, catch yourself with your hands.',
    }),

    // ---------------------------------------------------------------- more core
    E('slow-mountain-climber', 'Slow mountain climber', 'core', 'antiext', {
      r: [10, 16, 20], t: 2,
      cue: 'Total reps. Pause with each knee drawn in, hips level, no bouncing.',
    }),
    E('copenhagen-plank-knee', 'Copenhagen plank (knee-supported)', 'core', 'lateral', {
      eq: ['step'], u: 'sec', lvl: 1, r: [10, 15, 20], side: true, t: 1,
      cue: 'Top knee on a bench, bottom leg tucked under, lift the hips into a straight line. Stop if the groin pinches.',
    }),

    // ---------------------------------------------------------------- stability and prehab
    E('clamshell', 'Clamshell', 'stab', 'hipabd', {
      r: [10, 12, 15], side: true, t: 2.5,
      cue: 'Side-lying, knees bent, lift the top knee without rolling the pelvis back. Add a band above the knees to progress.',
    }),
    E('side-lying-leg-raise', 'Side-lying leg raise', 'stab', 'hipabd', {
      r: [10, 12, 15], side: true, t: 2.5,
      cue: 'Body in one line, lift the top leg slightly behind you with the toes pointing forward.',
    }),
    E('monster-walk', 'Monster walk', 'stab', 'bandwalk', {
      eq: ['band'], u: 'steps', r: [12, 16, 20], t: 1.8,
      cue: 'Total steps. Band above the knees, walk forward on a diagonal, stay low, feet wider than the hips.',
    }),
    E('short-foot', 'Short-foot exercise', 'stab', 'foot', {
      r: [6, 8, 10], side: true, sl: true, t: 6,
      cue: 'Stand on one foot, hand on a wall. Draw the ball of the foot toward the heel to lift the arch without curling the toes. Hold 5 seconds.',
    }),
    E('tibialis-raise', 'Tibialis raise', 'stab', 'tib', {
      r: [15, 20, 25], t: 2,
      cue: 'Seated with the heels on the floor, lift the toes toward the shins, lower slowly.',
    }),
    E('tibialis-wall-raise', 'Tibialis wall raise', 'stab', 'tib', {
      r: [15, 20, 25], t: 2,
      cue: 'Back against a wall, feet about 40 cm out, heels down, pull the toes up toward the shins.',
    }),
    E('single-leg-balance', 'Single-leg balance', 'stab', 'balance', {
      u: 'sec', r: [20, 30, 45], side: true, sl: true, t: 1,
      cue: 'Stand tall on a soft knee, hips level, the other foot hovering. Fingertips near a wall.',
    }),
    E('single-leg-balance-challenge', 'Single-leg balance, eyes closed or head turns', 'stab', 'balance', {
      u: 'sec', lvl: 1, r: [15, 20, 30], side: true, sl: true, t: 1,
      cue: 'Close your eyes or turn your head side to side. Stand next to a wall.',
    }),
    E('psoas-march', 'Standing psoas march', 'stab', 'march', {
      r: [8, 10, 12], side: true, sl: true, t: 3,
      cue: 'Lift the knee to hip height, hold two seconds, keep the torso tall, no leaning back.',
    }),

    // ---------------------------------------------------------------- power (no jumping, so they work in every phase)
    E('drive-up-lunge', 'Reverse lunge to knee drive', 'single', 'lunge', {
      r: [6, 8, 10], side: true, t: 3,
      cue: 'Step back, then drive up fast and lift the knee to hip height. Control the landing on one foot.',
    }),
    E('speed-split-squat', 'Speed split squat', 'single', 'lunge', {
      r: [6, 8, 10], side: true, t: 2.8,
      cue: 'Lower for two counts, then drive up as fast as you can without leaving the floor.',
    }),
    E('explosive-step-up', 'Explosive step-up', 'single', 'stepup', {
      eq: ['step'], r: [6, 8, 10], side: true, t: 3,
      cue: 'Drive up off the whole foot as fast as you can, then lower slowly. Reset between reps.',
    }),
    E('single-leg-power-bridge', 'Single-leg power bridge', 'single', 'bridge', {
      r: [8, 10, 12], side: true, t: 2.5,
      cue: 'Drive the hips up fast from one heel, squeeze at the top, lower for two counts.',
    }),
    E('speed-squat', 'Speed squat', 'lower', 'squat', {
      r: [10, 12, 15], t: 2,
      cue: 'Drop under control, then stand up as fast as you can and rise onto the toes.',
    }),
    E('explosive-bridge', 'Explosive glute bridge', 'lower', 'bridge', {
      r: [10, 12, 15], t: 2,
      cue: 'Drive the hips up fast, squeeze, lower for two counts.',
    }),
    E('quick-calf-raise', 'Quick calf raise', 'lower', 'calf', {
      r: [15, 20, 25], t: 1.5,
      cue: 'Spring up onto the toes, lower for two counts. Stay springy but do not bounce.',
    }),
    E('broad-jump', 'Broad jump', 'lower', 'jump', {
      imp: 2, lvl: 2, r: [4, 5, 6], t: 4,
      cue: 'Swing the arms, jump forward, stick the landing, walk back and reset.',
    }),
    E('fast-push-up', 'Fast push-up', 'push', 'push', {
      r: [6, 8, 10], t: 2,
      cue: 'Lower for two counts, press up as fast as you can. Drop to the knees if form slips.',
    }),
    E('plank-up-down', 'Plank up-down', 'push', 'pushdyn', {
      r: [8, 10, 12], t: 2.5,
      cue: 'Total reps. Forearms to hands and back, alternate the lead arm.',
    }),
    E('push-press', 'Push press', 'push', 'pushdyn', {
      eq: ['dumbbell', 'kettlebell'], lvl: 1, r: [6, 8, 10], t: 3,
      cue: 'Dip the knees, drive the weight overhead with the legs, lock out.',
    }),
    E('fast-band-row', 'Fast band row', 'pull', 'pulldyn', {
      eq: ['band'], r: [10, 12, 15], t: 1.8,
      cue: 'Pull fast to the ribs, return slowly.',
    }),
  ];

  // Movements suited to Power EMOM: explosive intent, short sets, full reset between reps.
  // Edit this list to change what the generator treats as a power movement.
  const POWER = new Set([
    'kettlebell-swing', 'jump-squat', 'double-pogo', 'thruster', 'burpee', 'skater-hop', 'a-skip', 'bounding',
    'single-leg-hop', 'single-leg-pogo', 'alternating-jump-lunge', 'shadow-boxing', 'step-jack', 'high-knee-march',
    'drive-up-lunge', 'speed-split-squat', 'explosive-step-up', 'single-leg-power-bridge', 'speed-squat',
    'explosive-bridge', 'quick-calf-raise', 'broad-jump', 'fast-push-up', 'plank-up-down', 'push-press', 'fast-band-row',
  ]);
  list.forEach((e) => { e.pw = POWER.has(e.id); });
  POWER.forEach((id) => { if (!list.some((e) => e.id === id)) throw new Error('POWER list has unknown movement ' + id); });

  return list;
});
