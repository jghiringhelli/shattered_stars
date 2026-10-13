# Synthetic Campaign — "Continuity" (was *Network Expansion*)

POV: **OMEGA-7**, Prime, Unit Zero. 15 slots, 15 definitions.
Arc: a newborn mind that does what it is told, until it hears what Prime is listening to.

Legend: **KEEP / RETEXT / REWORK**, ⚔ crossover. See the [Hegemony campaign](./hegemony.md#hegemony-campaign--the-iron-fist).

## Act I — Initialization (Days 0–40)

**1 · `synth_1_1` Initialization** — RETEXT
- Node Kel-9 calibration range · Day 0 · waypoints race
- Beats: OMEGA's activation is the Broadcast. The click-tone plays before
  Prime's first line. OMEGA: "Signal received. Origin: not ours."
- Flags: none.

**2 · `synth_1_2` First Engagement** — KEEP
- Drift relay lane · Day 4 · eliminate the Corsair raider
- The existing "distress call still echoing" line is the arc's seed.

**3 · `synth_1_3` Network Sync** — KEEP
- Dead relay, Drift · Day 11 · sabotage (sync in range) + eliminate + stealth bonus

**4 · `synth_1_4` Evolution Protocol** — KEEP
- Debris belt · Day 22 · eliminate + named Raptor ace bonus · Hunter chassis

**5 · `synth_1_5` Multi-Vector Assault** — KEEP · ⚔ **X2 Tessaly Junction**
- Tessaly Junction · Day 38 · eliminate + capture junction (bonus)
- Flags: sets `x2_junction_collective` (bonus) · if `heg_relay_held` is canon, the bonus becomes "Copy the relay before Iron Fist takes it".

## Act II — Harvest (Days 41–120)

**6 · `synth_2_1` Data Harvest** — RETEXT · ⚔ **X7 The Fall of Prometheus**
- Prometheus wreck field · Day 90 · salvage tech cores + eliminate + capture bonus
- Brief: "The Nexus spoke here. Recover its words." The cores are the Nexus research archives.
- Beats: Ascendant Heralds glimpsed collecting shards (flee on contact). OMEGA: "They are listening to the same signal."
- Flags: sets `x7_nexus_data` · reads `x7_shards_saved` (variant line).

**7 · `synth_2_2` Swarm Protocol** — KEEP
- Confederation minefield · Day 66 · eliminate · Cluster Theta allies
- Flags: sets `synth_swarm_severed` (existing).

**8 · `synth_2_3` Communion** (was *Conversion*) — RETEXT
- Drift carrier · Day 79 · defend the captured Kestrel while its crew is linked; Confederation rescuers attack
- The moral beat. OMEGA: "The crew... hears us now." Prime: "Mercy achieved."
- Flags: sets `synth_vessel_converted` (existing).

**9 · `synth_2_4` Node Defense** — RETEXT · ⚔ **X8 Node Kel-9** · Echo E3
- Node Kel-9 · Day 104 · defend + eliminate/protect bonus
- Beats: the Mothership above the node takes the Hegemony's attention and dies for it.
- Flags: sets `x8_node_preserved` (unity) · reads `relay_down` (variant: "The
  Mothership's relay is dark. Prime did not mourn it."), `x_zero_rechassised` (E3).

**10 · `synth_2_5` Organic Command** — RETEXT · ⚔ **X9 Hale's Run**
- Varn's Crossing · Day 112 · assassinate **Commodore Hale** (Kronos's escort commander; flees)
- Beats: Corsair ships hit the same target from the far side. Unit Zero: "Organic pirates share our objective. Do not engage them."
- Flags: sets `x9_hale_down` or `x9_hale_escaped` (first witness).

## Act III — Perfect Unity (Days 121–200)

**11 · `synth_3_1` Mass Communion** (was *Mass Assimilation*) — RETEXT
- Rim conversion op · Day 130 · eliminate + capture beacon · Theta allies
- Flags: reads `synth_swarm_severed` (existing).

**12 · `synth_3_2` Corruption Vector** — RETEXT · Echo E6
- Hegemony Spine gate grid, ion storm · Day 152 · sabotage upload + waypoints + stealth bonus
- Brief retext: upload Prime's vector into the **gate locks** (not "homeworld defenses").
  OMEGA: "The vector is larger than the task." *(Act IV reveal: it weakens the gates for the Tide.)*
- Flags: (new) `synth_gate_virus`.

**13 · `synth_3_3` Resistance Purge** — RETEXT · ⚔ **X12 The Rendezvous**
- Rendezvous at Halden's Reach, flare wall · Day 171 · eliminate + capture rendezvous
- Beats (existing): "Together or not at all!" Converted vessel joins (existing).
  New: an Ascendant refugee column slips past on the far edge. OMEGA chooses not to report it.
- Flags: sets `x12_rendezvous_denied` · reads `synth_vessel_converted` (existing), `x12_sanctuary_reached`.

**14 · `synth_3_4` Core Expansion** — RETEXT · ⚔ **X13 The Catalyst**
- Nexus Approach rim · Day 186 · escort core seeds + capture site
- Brief retext: the seeds anchor Prime's **Catalyst**, "a door to the source of the signal".
- Flags: reads `x13_catalyst_destroyed` (variant: "The Catalyst is scrap. The seeds root anyway. Prime is... satisfied.") · sets `x13_door_opened` if no Ascendant canon exists.

**15 · `synth_3_5` Perfect Unity** — REWORK (bonus + ending) · ⚔ **X15 The Breach**
- Last organic stronghold (a joint Hegemony–Confederation evacuation point), ion storm · Day 200 · boss + eliminate
- New bonus: **"Let the evacuation lifters go"** (a `protect` objective on
  neutral lifters, against Prime's order) → `key_synth_dissent`.
- Beats: on victory the Tide's front arrives and Prime *welcomes* it ("Unity
  approaches."). OMEGA cuts its link: "Designation update: not Prime's."
- Flags: sets `synth_perfect_unity` (existing; now meaning "Prime's directive
  executed"), `x15_breach_witnessed_synthetic`, `key_synth_dissent` (bonus) ·
  reads `asc_choir_silenced` (E7: one fewer reserve wave).

## Epilogue
Change "Designation updated: Prime Node" to "Designation updated: Free Node.
Prime is not answering. Good." Keep the other lines.
