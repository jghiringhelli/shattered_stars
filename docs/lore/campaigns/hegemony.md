# Hegemony Campaign — "The Iron Fist"

POV: **Commander Marcus Chen** ("Iron Actual") and Iron Fist Squadron
(Striker, Whisper). 15 slots, 18 definitions (branch pairs at 3, 8, 13).
Arc: an honest officer flying a dishonest war, until he finds out whose war it is.

**Status legend:** **KEEP** = data as is · **RETEXT** = briefing, tagline,
dialogue or debrief edits only · **REWORK** = objectives, enemies or script
change · ⚔ = crossover ([campaign_arc §4](../campaign_arc.md#4-crossover-missions)).
Objective names follow `src/arcade/objectives`.

## Act I — Quarantine (Days 1–40)

**1 · `heg_1_1` Tycho Trial** (was *Academy Training*) — RETEXT
- Tycho Academy range, Luna · Day 1 · waypoints race (bonus: course record)
- Brief: Chen flies the final trial course alongside the cadet class he
  instructs. Striker is a cadet, and Whisper is the Fleet Intelligence observer.
- Beats: mid-course the **Nexus Broadcast** click-tone hits every channel and
  the gates go dark for 3 s (`music` cue `nexus_broadcast`). Whisper: "That
  wasn't us." The trial ends with a recall order: all instructors to Station Omega.
- Flags: none.

**2 · `heg_1_2` First Blood** — KEEP
- Omega approach · Day 6 · eliminate (bonus: kill under time)
- A lone Corsair raider was waiting on the patrol route. Whisper: "They were waiting for us. Someone told them." (first Vance seed)

**3 · `heg_1_3` Wing Formation** {TEAMWORK} / **`heg_1_3b` Shadow Strike** {COVERT} — KEEP
- Omega cordon · Day 10 · eliminate + protect wingman / eliminate + stealth
- Corsair blades probe the quarantine cordon. TEAMWORK teaches the squad mark;
  COVERT tracks the Corsair "coordination pattern". That pattern is Vance's
  leak, though the player won't know until Act II.
- Flags: (new) `heg_path_covert` on 3b. Act II Whisper adds a line: "Your nav logs from the cordon. The pattern matches."

**4 · `heg_1_4` Field Promotion** — RETEXT · ⚔ **X1 Kessa Lane**
- Kessa Lane, Rim · Day 19 · assassinate (Confederation cell leader in a Hawk; flees when hurt) + eliminate bonus
- Brief: a Confederation cell burned a Registry convoy. Its leader is a known
  ace. Ground her before she reaches the lane. *(Fix the "him/her" mismatch:
  the leader is Phoenix One.)*
- Beats: Striker: "That's no militia flying." Phoenix escapes or is forced down hurt.
- Win: Chen takes command of **Iron Fist**.
- Flags: sets `x1_phoenix_wounded` (if her hull drops below the flee threshold before she escapes) · reads `x1_census_burned` (variant briefing: "the census cores are ash").

**5 · `heg_1_5` Border Skirmish** — KEEP · ⚔ **X2 Tessaly Junction**
- Tessaly Junction, asteroid field · Day 38 · eliminate + capture relay (bonus)
- Confederation and Collective contacts at the junction where the 2362
  massacre happened. The Collective strikes both sides at once.
- Flags: sets `heg_relay_held` (existing) · if `x2_junction_collective` is already canon, the bonus becomes "Recover the relay's black box".

## Act II — The Cordon (Days 41–120)

**6 · `heg_2_1` Supply Convoy** — RETEXT · ⚔ **X4 Convoy Alpha**
- Omega supply lane · Day 52 · escort (3 freighters) + eliminate + protect bonus
- Corsairs in the dark. They knew the convoy's timing (Vance).
- Flags: sets `heg_convoy_intact` (existing) · if `x4_convoy_gutted` is canon, the variant swaps the bonus for "Recover the straggler's black box".

**7 · `heg_2_2` Drone Swarm** — KEEP
- Picket Lyra outpost · Day 60 · defend + eliminate · Lance Squadron allies
- Flags: sets `heg_lance_lost` (existing).

**8 · `heg_2_3` Ace Hunt** {ELIMINATE} / **`heg_2_3b` The Witness** {TRUCE} (was *The Defection*) — RETEXT · ⚔ **X6 The Witness**
- ELIMINATE: Day 74, deep Rim · assassinate Phoenix (she flees; canon: she
  escapes, "She'll be back"). Downing her sets `x1_phoenix_wounded` if it isn't set yet.
- TRUCE: Day 80, a dead relay · escort Phoenix's Wasp to a safe jump while
  Vance's loyalists try to silence her (`terran_centurion` ace).
- Debrief (existing): the name at the top of every order is **Vance**.
- Flags: sets `heg_phoenix_defected` (existing; meaning "Phoenix testified") ·
  reads `x6_vance_orders` (variant: Phoenix carries "the orders your own relay
  leaked to us"; without it she carries her own flight logs).

**9 · `heg_2_4` Station Defense** — REWORK (light) · ⚔ **X7 The Fall of Prometheus**
- Station Omega · Day 90 · defend (3 waves) + eliminate bonus
- Brief: Vance ordered Prometheus scuttled at 0400. Omega holds the cordon
  while everyone comes for the wreck.
- Beats: the Prometheus flash on the horizon at the start (banner `PROMETHEUS
  LOST`). Corsair raiders and veil-runner Phantoms (existing), plus Collective
  harvesters and Ascendant Heralds glimpsed at the edge (**rework**: add 2
  `synth_drone` and 1 `ascendant_herald`, set to flee).
- Flags: reads `heg_convoy_intact` (existing Resupplied variant) · sets `x7_omega_held`.

**10 · `heg_2_5` The Mothership** — RETEXT · ⚔ **X8 Node Kel-9**
- Kel-9 approach, ion storm · Day 104 · boss (Mothership) + sabotage relay bonus
- Debrief (existing): Hegemony-grade encryption in the comm core. Vance has been running the Collective's attacks too.
- Flags: sets `relay_down` (existing) · reads `x8_node_preserved` (variant line: "the node survived, the Mothership was its shield").

## Act III — The Purge (Days 121–200)

**11 · `heg_3_1` Fleet Engagement** — RETEXT · ⚔ **X10 Halden Orbit**
- Halden orbit · Day 141 · eliminate + capture command buoy · Lance allies
- Brief: Vance orders the uprising crushed. Chen obeys, for now.
- New bonus: "No civilian lifter fired on" → `x10_chen_held_fire` (unity).
- Flags: reads `heg_relay_held`, `heg_lance_lost` (existing).

**12 · `heg_3_2` Behind Enemy Lines** — RETEXT
- Confederation militia depot, Rim · Day 150 · salvage data cores + waypoints + stealth bonus
- Brief: steal the depot's logistics. Twist: the cores prove **Vance armed
  this depot**. He supplies both sides.
- Flags: (new) `heg_vance_ledger`.

**13 · `heg_3_3` Alliance Betrayal** {REACTIVE} / **`heg_3_3b` Iron Preemption** {PREEMPTIVE} — KEEP · ⚔ **X11 The Broken Alliance**
- Cinder Gate · Day 158 · survive in a Templar minefield / strike Vance's loyalist Vindicator
- Flags: 3b sets `x11_betrayal_averted` (unity, `key_heg_witness`) · 3a reads `x11_betrayal_averted` if Ascendant-side canon exists (variant: the Templars hold fire, and the mines are Vance's).

**14 · `heg_3_4` Capital Strike** — REWORK
- Deep Rim · Day 186 · sabotage pylon + boss *CNS Freedom* + flare wall
- New premise: Vance's loyalists seized the captured carrier **CNS Freedom**
  to flee. Enemies stay Confederation hulls with loyalist crews ("He flies
  stolen colours."). The reactor venting is Vance's scorched earth.
- Debrief (existing): Vance in custody.
- Flags: reads `cors_kappa_ledger` (echo E4: the last loyalist wave never launches) · sets `heg_vance_captured`.

**15 · `heg_3_5` The Last Gate** (was *Final Push*) — REWORK · ⚔ **X14 Brannoc Gate** · **X15 The Breach**
- Brannoc Gate · Day 199–200 · capture gate zone + eliminate + protect squad
- Brief: the Confederation's Final Offensive hits Fort Brannoc. Hold the gate.
  Kronos wants a massacre, and Chen wants a ceasefire.
- Beats: hold the zone. Then Chen calls a **ceasefire** on open channel
  (Santos answers if `x14_ceasefire_called` is already canon). Then the gates
  of the Spine go dark one by one: **the Breach**, the `void_tide_cell` motif.
  If `synth_gate_virus` is set, the gate dies 30 s earlier (echo E6).
- Debrief: promoted to Admiral. Iron Fist becomes the First Response Wing.
  *Retext:* "Seventeen missions. Twelve months." → "Two hundred days."
- Flags: sets `x14_ceasefire_called`, `x15_breach_witnessed_hegemony`, `key_heg_witness` (if earned).

## Epilogue (`epilogues.ts`)
Keep the existing lines. Change the first to: "Vance is in a cell. The
Hegemony stands, cleaner than before. And the gates are dark."
