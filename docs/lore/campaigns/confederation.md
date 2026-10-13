# Confederation Campaign — "Libre" (was *The Rebel's Path*)

POV: **Commander Aria Santos** ("Libre One"), Phoenix One, Doc Vasquez.
15 slots, 15 definitions.
Arc: a deserter learns what freedom costs, liberates Halden, and answers the enemy's ceasefire.

Legend: **KEEP / RETEXT / REWORK**, ⚔ crossover. See the [Hegemony campaign](./hegemony.md#hegemony-campaign--the-iron-fist).

## Act I — Free Fall (Days 1–40)

**1 · `conf_1_1` Freedom Flight** — RETEXT
- Corrin's Drift, asteroid belt · Day 5 · waypoints race
- Brief: two days ago you refused to fire on refugee lifters at Omega and ran.
  The cell has repainted your stolen hull. Learn it.
- Beats: Vasquez's first line also introduces her: "I'm the reason those lifters were running."
- Flags: none.

**2 · `conf_1_2` First Strike** — RETEXT
- Rim census lane · Day 9 · eliminate the Viper
- Brief: a **Registry census** Viper is scanning for newly woken psions. Stop it before it reports.
- Flags: none.

**3 · `conf_1_3` Guerrilla Tactics** — RETEXT · ⚔ **X1 Kessa Lane**
- Kessa Lane · Day 19 · eliminate convoy + waypoints exit + stealth/protect bonus
- Brief: the convoy carries the Registry's census cores. Burn them and vanish.
- Beats (existing): buoys tripped, reaction force inbound. Retext so the force
  is **Iron Fist**: "Hegemony Raptors — that's Chen's squadron!"
- Flags: sets `x1_census_burned` · reads `x1_phoenix_wounded` (variant: Phoenix
  flies hurt; debrief "Chen's squadron put two rounds through my canopy").

**4 · `conf_1_4` Upgrade Salvage** — RETEXT
- Crash site, Rim · Day 25 · salvage tech cores + capture/eliminate bonus
- Brief: a crashed **Fleet Intelligence courier**. Its logs carry convoy schedules, signed by a Vance cipher.
- Flags: sets `conf_crash_data` (existing).

**5 · `conf_1_5` Hidden Base Defense** — KEEP
- The Nest, Corrin's Drift · Day 36 · defend + survive + escort bonus (evac transports)
- Flags: (new) `conf_nest_evacuated` (bonus) → epilogue line.

## Act II — The Long Night (Days 41–120)

**6 · `conf_2_1` Supply Raid** — KEEP
- Garrison lane · Day 48 · assassinate the hauler (it spools for 90 s)
- Flags: reads `conf_crash_data` (existing).

**7 · `conf_2_2` Prison Break** — RETEXT · ⚔ **X5 Gallows Hulk**
- Gallows Hulk · Day 63 · escort escape pods + eliminate + protect bonus
- Beats: new line: "Second breakout on the other side of the hulk. Corsairs! Same idea, same night."
- Flags: sets `conf_prisoners_freed` (existing) · reads `cors_crew_rescued` (variant: Corsair shuttles escort your pods for 30 s) · both set → `x5_joint_breakout` (unity).

**8 · `conf_2_3` Corsair Alliance** — RETEXT · Echo E1
- Ion storm parley point · Day 70 · survive + eliminate + protect the captain (bonus)
- The Corsair captain is **Captain Kira** (named ally). Under the "nobody dies
  off-campaign" rule, losing her means *crippled, withdraws*: "Kira's out. So
  is the deal."
- Beats (existing): the ambush is Hegemony, and Vance tipped them off.
- Flags: sets `conf_corsair_pact` (existing; unity, `key_conf_pact`) · reads `cors_crew_rescued` (E1).

**9 · `conf_2_4` Intelligence Theft** — RETEXT · ⚔ **X6 The Witness**
- Hegemony deepcomm relay · Day 74 · sabotage (hold in range) + waypoints + stealth bonus
- Brief: the relay keeps Fleet Intelligence's orders. Vasquez: "If Vance signed what I think he signed..."
- Debrief: Phoenix volunteers to carry it to "the one Hegemony officer who might listen" (Chen).
- Flags: sets `x6_vance_orders` · reads `heg_phoenix_defected` (variant debrief: "Chen listened.").

**10 · `conf_2_5` Hegemony Battlecruiser** — KEEP
- Rim worlds orbit · Day 118 · boss *HNS Iron Verdict* (Kronos's vanguard) · Wildfire allies
- Flags: sets `conf_wildfire_lost` (existing).

## Act III — Dawn (Days 121–200)

**11 · `conf_3_1` Revolution Rising** — KEEP · Echo E5
- The Six Worlds · Day 128 · eliminate + capture beacon
- Flags: reads `conf_prisoners_freed` (existing Freed Pilots variant), `asc_heretics_spared` (E5: Unbound Vaelith chorus joins the broadcast).

**12 · `conf_3_2` Capital Liberation** — RETEXT · ⚔ **X10 Halden Orbit**
- Halden · Day 141 · capture orbital control + eliminate + protect squad · Wildfire allies
- Beats: if `x10_chen_held_fire` is canon: "Iron Fist is holding fire on the lifters. Why?" Ironwing Chen (Marcus's sister) flies in the strike group.
- Flags: reads `conf_wildfire_lost` (existing), `x10_chen_held_fire`.

**13 · `conf_3_3` Admiral's Gambit** — RETEXT · Echo E2
- Kronos's encirclement, double minefield · Day 167 · waypoints breakout + eliminate
- The Admiral is **Kronos**, named in the briefing.
- Flags: reads `conf_corsair_pact` (existing: Corsair raiders arrive).

**14 · `conf_3_4` Final Offensive** — RETEXT · ⚔ **X14 Brannoc Gate**
- Fort Brannoc (Rim Command, not Sol), ion screen · Day 199 · eliminate + defense aces bonus
- Beats: if `x14_ceasefire_called` is canon, a final beat: "Libre One, this is
  Iron Actual. I'm calling a ceasefire." Santos: "...Hold fire. All cells, hold fire."
- Flags: reads/sets `x14_ceasefire_called` (Confederation side: "ceasefire answered").

**15 · `conf_3_5` Freedom's Dawn** — RETEXT · ⚔ **X15 The Breach**
- Halden high orbit, flare front · Day 200 · boss *HNS Unbending* (Kronos), who refuses the ceasefire
- Briefing retext: "The Hegemony falls" → "Kronos falls. Halden is free."
- Beats: Kronos vents his reactor (existing flare). After victory, the
  Brannoc gate dies, the three-note signal plays, and Vasquez says: "That's the
  sound from Prometheus. It's here."
- Flags: sets `conf_independence` (existing), `x15_breach_witnessed_confederation`, `key_conf_pact` (if earned).

## Epilogue
Keep. Add a line when `x14_ceasefire_called`: "Chen kept his word. So will we."
