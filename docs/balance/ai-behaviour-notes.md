# AI behaviour notes

Measured with `npm run profile:ai -- --seconds 120 --seeds 3 [--only "1v1 expert"] [--ships]`
(src/simulation/skill/BehaviourRun + BehaviourProfiler: the real BotPilot / SquadCommand through the
skill arena, 1v1 and 3v3 / 5v5 / capital squads, novice / average / expert). Columns are fractions of
alive time unless a unit is given: `arcRange` target in arc and range, `shotsMin`, `revMin` heading
reversals within 3 s, `orbitMin` 360° orbits without a shot, `thrS` throttle changes per second,
`specMin` / `reqMin` specials flown / requested per minute, `asPlanned` cycles flown as the pilot's
intent asked, `turnShare` hard-turn cycles, `spinMin` runs of 6+ hard turns, `thrShare` mean throttle
/ top throttle, `stacked` within 40 px of an ally.

## Found and fixed

- **Lost Snap turns (average pilots).** A special spends its recharge when it is queued
  (`useKTurn`), but the average pilot re-plans every 150 ms and a later hard-turn key replaced the
  queued special: 10.7 requested vs 6.0 flown per minute (56 %), the rest burnt the 5 s recharge for
  nothing. `PilotHands` now never steers over a queued special (requested 3.9, flown 3.7).
- **Average pilots reached for a special whenever it recharged** (not "occasionally"): engaged
  average pilots now consider a special on `AVERAGE_TRICK_CHANCE` (4 %) of their decisions.
  Without it the fix above made Ace Duel `elite_fighters` / `hunter_hunted` and the difficulty
  curve drift (60-seed shares up to 0.74 / 0.77); at 0.04 every tests/balance preset is back in band.

## Checked and fine

- Planner position vs flown position (speed cap included): median error 0 px for planned cycles.
- Throttle flapping: 0.5 changes/s (expert), no up/down chatter; slow throttle is the dial (bank / turn
  are white or red above notch 2 on most fighters), not a bug. No idle straight flight in range.
- Stress: stressed 13-18 % of the time, specials refused while stressed: 0.
- Torus: no raw dx/dy in src/arcade/ai; no seam crossings at all in 120 s arena fights.
- Expert Snap turns lead to a shot chance within 1.5 s in 93 % of cases (turns: 63 %): used with purpose.
- Planner weight sweeps (aim, range, rear, danger, follow-up, mid-cycle, red, crowding): flat within noise.

## Still suspicious

- Mirror duels sit at 17-19 % arc-and-range (arc 20-25 %, range 80 %): both ships circle in slow hard
  turns (expert 53 % hard-turn cycles, average 68 %, throttle ~0.47 of top). It follows from the dial
  (turns capped at speed 1-2) and symmetric scoring; no weight change moved it.
- 4-5 % of squad time within 40 px of an ally; an ally-separation term in the planner did not move it.
- Average pilots re-key within a cycle (`asPlanned` 0.76): the first sharp turn wins the cycle.
- tests/balance and gate 1 smoke are 24-seed fixed-seed samples: any change of bot behaviour re-rolls
  them (sparrow > stalker sits at 0.79-0.86); judge changes on 60+ seeds first.
