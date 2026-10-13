# Corsairs Campaign — "The Plunder Path"

POV: **Captain Zara Kira** ("Blackblade"), The Admiral, Bloodfang. 15 slots, 15 definitions.
Arc: a deckhand with nightmares becomes the king of the lanes, and learns what's worth more than the score.

Legend: **KEEP / RETEXT / REWORK**, ⚔ crossover. See the [Hegemony campaign](./hegemony.md#hegemony-campaign--the-iron-fist).

## Act I — New Blood (Days 1–40)

**1 · `cors_1_1` Welcome to the Crew** — RETEXT
- Brass Anchorage rock run · Day 2 · waypoints race
- Beats: Kira, after the run: "Heard a song in the rocks. Three notes. Down." The Admiral goes silent for a moment.
- Flags: none.

**2 · `cors_1_2` First Plunder** — KEEP
- Rim trade lane · Day 8 · salvage pods + eliminate guard

**3 · `cors_1_3` Terror Tactics** — KEEP
- Rim lane, picket buoys · Day 14 · eliminate + waypoints exit + stealth bonus

**4 · `cors_1_4` Echo Run** (was *Ship Upgrade*) — REWORK · ⚔ **X3 Cinder Gate**
- Cinder Gate, Reach rim · Day 34 · salvage one shard + eliminate + capture bonus (hold the drop point) · flying the captured Marauder (keep the evolution beat)
- Brief: the Admiral pays double for a "singing rock" that fell near Cinder
  Gate when the Broadcast hit. Everyone else heard it too.
- Rework: enemies change from a Hegemony patrol to `ascendant_cherub` ×2,
  `synth_drone` ×3 and `synth_hunter` ×1 (the Ascendant side's "Convergence").
- Beats: "Who invited the Corsairs?" (now heard from the inside). The Dreamer's
  voice crackles on Kira's comms: *"You hear it too, child."*
- Flags: sets `x3_shard_taken` (unity in Act V).

**5 · `cors_1_5` Fleet Action** — KEEP
- The Rookery · Day 37 · defend the frigate + eliminate
- The Hegemony burns the Rookery on intelligence Vance supplied. Canon: it falls.
- Flags: (new) `cors_rookery_burned` (always set; read by `cors_3_2`).

## Act II — Blood and Gold (Days 41–120)

**6 · `cors_2_1` Rich Pickings** — RETEXT (optional)
- Liner *Aurelia* · Day 45 · assassinate (cripple liner) + salvage strongboxes
- Optional: the nobles aboard include Consul Vera's nephew. The ransom buys a new Rookery.

**7 · `cors_2_2` Rival Elimination** — RETEXT
- Rustjaw's den, mines + rocks · Day 56 · eliminate + sabotage depot · Wolves allies
- Retext: Rustjaw's new guns came from Fleet Intelligence. Vance pays rivals to keep the clans split.
- Flags: sets `cors_wolves_lost` (existing).

**8 · `cors_2_3` Prison Ship** — RETEXT · ⚔ **X5 Gallows Hulk**
- Gallows Hulk · Day 63 · escort shuttles + eliminate
- Beats: "Confederation pods launching off the other side. Cell pilots with our idea, same night."
- Debrief (new): Blackmaw gives Kira her own ship and crew, and she is **Captain Kira** from here on (she is the captain at the Confederation parley, `conf_2_3`).
- Flags: sets `cors_crew_rescued` (existing; `key_cors_loyalty`) · reads `conf_prisoners_freed` → `x5_joint_breakout`.

**9 · `cors_2_4` Ambush Setup** — RETEXT · ⚔ **X4 Convoy Alpha**
- Omega supply lane, ion cloud · Day 52 · eliminate + stealth bonus
- Brief: someone paid the clans to hit Omega's convoy. The Admiral: "Take the money. Then find out who."
- Flags: sets `x4_convoy_gutted` (bonus "no hauler escapes") · if `heg_convoy_intact` is canon, the variant becomes "gut the straggler and its escort".

**10 · `cors_2_5` The Captain's Grudge** — RETEXT · ⚔ **X9 Hale's Run**
- Varn's Crossing · Day 112 · assassinate **Commodore Hale** (Kronos's escort commander)
- Beats: Collective drones hit the same target. Bloodfang: "Machines want him too? Then race them."
- Debrief reveal (new): the Admiral removes the mask. Vaelith, Unbound, waiting 300 years "for the lock to fail".
- Flags: sets `x9_hale_down` / `x9_hale_escaped` (first witness).

## Act III — The Crown (Days 121–200)

**11 · `cors_3_1` Pirate Armada** — KEEP
- The Moot, Brass Anchorage · Day 132 · eliminate + capture standard · Skarn's Reaver ace
- Flags: reads `cors_wolves_lost` (existing).

**12 · `cors_3_2` Hegemony Payback** — RETEXT · Echo E4
- **Station Kappa** (Fleet Intelligence black site), reactor flare · Day 148 · sabotage reactor + eliminate
- Beats: Kira grabs Vance's payroll ledger on the way out. "Every crew that hit us was on this list."
- Flags: (new) `cors_kappa_ledger` (leaked to Whisper → `heg_3_4`).

**13 · `cors_3_3` War Profiteering** — RETEXT · Echo E2
- Four fronts, ion + rocks · Day 166 · waypoints race + eliminate
- Flags: reads `conf_corsair_pact` (variant: Confederation pickets wave you through one checkpoint).

**14 · `cors_3_4` Grand Heist** — RETEXT
- Hegemony treasury ship, minefield · Day 184 · sabotage vault + salvage + waypoints
- Retext: the vault also holds the Hegemony's half of the **Nexus gate codes**.
  The Admiral takes those, not the gold. (They matter in Act V.)
- Flags: (new) `cors_gate_codes`.

**15 · `cors_3_5` Pirate King** — RETEXT · ⚔ **X15 The Breach**
- Brass Anchorage, rocks + ion storm · Day 200 · assassinate **Vosk** (renamed from *Vorn*) + eliminate Reaver aces
- Beats: Vosk murdered Blackmaw. Kira takes the throne. As the Moot cheers,
  the anchorage's lane goes dead and the three-note song plays, loud this
  time. Kira: "That's my nightmare. It's real."
- Flags: sets `cors_pirate_king` (existing), `x15_breach_witnessed_corsairs` · reads `cors_crew_rescued` (existing Rescued Crew variant), `cors_wolves_lost`.

## Epilogue
Keep. Add when `cors_gate_codes` is set: The Admiral: "Keep the crown. I'm keeping the codes. Trust me."
