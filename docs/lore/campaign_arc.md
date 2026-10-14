# Campaign Arc — one war, five witnesses

The five faction campaigns tell **the same 300 days** from five sides, each
with its own missions. A sixth, shared **Coalition** campaign (Acts IV–V)
closes the story. Mission-level detail: [campaigns/](./campaigns/).

## 1. The five acts

| Story act | Content | Days | Missions |
|---|---|---|---|
| **I · The Fracture** | Faction Act I (slots 1–5) | 1–40 | 25 slots / 26 definitions |
| **II · Escalation** | Faction Act II (slots 6–10) | 41–120 | 25 slots / 26 definitions |
| **III · Revelation** | Faction Act III (slots 11–15) | 121–200 | 25 slots / 26 definitions |
| **IV · The Coalition** | Coalition campaign, part 1 | 201–260 | 5 new (`coal_4_1..5`) |
| **V · Shattered Stars** | Coalition finale | 261–300 | 3 new (`coal_5_1..3`) |

The data's `act` 1–3 maps 1:1 to story Acts I–III. Acts IV–V are new content
(built). They reuse the same objective models, scripting, hazards and
hero powers, with a mixed squad of the five heroes.

### Act I — The Fracture (Days 1–40)
- **Day 0:** the Nexus Broadcast. Every Act I opener (slot 1) hears the click-tone mid-trial.
- **Day 3:** the Hegemony cordon at Station Omega fires on refugee lifters
  fleeing Prometheus. Santos refuses the order and deserts. Vasquez escapes
  with the Nexus data.
- The Registry starts sweeping for newly woken psions. The Collective probes
  the border. The Corsairs sell everyone's secrets. The Ascendant Vigil rises.
- Vance (Fleet Intelligence) quietly feeds intelligence to raiders on every
  side ("They were waiting for us. Someone told them.").
- **Crossovers:** X1 Kessa Lane · X2 Tessaly Junction · X3 Cinder Gate.
- **Act-end reveal:** someone is staging these battles.

### Act II — Escalation (Days 41–120)
- **Day 88:** Vance orders Prometheus scuttled to deny the Nexus to everyone.
  The Nexus shatters into singing shards.
- **Day 90: The Fall of Prometheus (X7),** a three-way battle over the wreck.
- The Witness (X6): Phoenix carries Vance's orders to Chen. The Collective
  Mothership carries Hegemony encryption (X8).
- The Dreamer remembers the First Tide. OMEGA-7 hears a three-note song in Prime's choir.
- **Crossovers:** X4 Convoy Alpha · X5 Gallows Hulk · X6 The Witness · X7 Prometheus · X8 Node Kel-9 · X9 Hale's Run.
- **Act-end reveal:** Vance is coordinating all sides. The Nexus was a lock.

### Act III — Revelation (Days 121–200)
- Vance's staged war peaks: Halden (X10), the Broken Alliance (X11). Chen
  takes Vance into custody (heg_3_4).
- Prime's Catalyst tries to open a door in the Deep (X13). The faithful and
  the purged cross at the Rendezvous (X12).
- **Day 200: The Breach.** Each faction's finale (slot 15) is its own climax:
  a ceasefire called, Kronos falls, Prime's unity, Kira's crown, the false
  Prophet silenced. Every finale **ends on the same beat**: the Void Tide's
  front enters the Reach and the gates of the Spine go dark.
- **Crossovers:** X10 Halden Orbit · X11 The Broken Alliance · X12 The Rendezvous · X13 The Catalyst · X14 Brannoc Gate · X15 The Breach (all five finales).
- **Act-end reveal:** the Tide is real, and the Hollowed invited it.

### Act IV — The Coalition (Days 201–260) · BUILT
| Id | Title | Type | Gist |
|---|---|---|---|
| `coal_4_1` | Truce at Brannoc | defend | Hold the ceasefire talks against Kronos's remnant fleet and the first tidecells. Squad: Chen + Santos. |
| `coal_4_2` | Exodus of Vega Prime | escort | Get human and Vaelith colonists out ahead of the front. Squad: Dreamer/Templar + Kira. |
| `coal_4_3` | The Hollow Man | assassinate | Vance escapes custody with the Hegemony's half of the gate codes. Run him down before he opens the Spine. |
| `coal_4_4` | Signal Fire | sabotage | OMEGA-7 cuts Prime out of the lattice at Node Kel-9 while the Coalition holds the node. |
| `coal_4_5` | The Breach of Sol | survive | The Tide reaches the Sol Mouth. First Resonance prototype. Hold until the Mouth is collapsed or saved. |

### Act V — Shattered Stars (Days 261–300) · BUILT
| Id | Title | Type | Gist |
|---|---|---|---|
| `coal_5_1` | Resonance | capture | Hold three Resonance nodes at the Resonance Point. Every hero power available. |
| `coal_5_2` | Heart of the Void | waypoints + boss | Fly a consumed lane to the Warden's avatar. Hazards: void front (new hazard, or a retinted `flare_wall`). |
| `coal_5_3` | The Answer | boss + final choice | Defeat the avatar's guard, then choose **Sever / Seal / Answer** (§6). |

## 2. Act-unlock rule — the Rule of N

> **Act N opens once Act N−1 is complete in at least N factions.**
> For a faction act, the faction's own Act N−1 must be one of them.

| Act | Unlock condition | Minimum before it |
|---|---|---|
| I (any faction) | Always open: all five Act I campaigns | — |
| II (faction F) | F's Act I + Act I of **1 other** (2 total) | 2 Act Is (10 missions) |
| III (faction F) | F's Act II + Act II of **2 others** (3 total) | 3 Act Is + 3 Act IIs (30) |
| IV (Coalition) | Act III of **4** factions | 4 full faction campaigns |
| V (Coalition) | Act IV complete **and** Act III of **all 5** factions | Everything |

Why this rule:
- It is one rule that scales with the act, so it is easy to explain on a hub card.
- Breadth grows with the stakes. By the Breach the player has seen at least
  three sides of Act II, so the crossovers land.
- The finale needs all five witnesses, because the true ending needs one key
  from each faction (§6).
- Inside an act, the existing hub rules still apply (opener → three middles → finale; `missionGraph.ts`).

**Hub text when locked:** "ACT II — the war must be seen from another side
first (complete Act I with 1 more faction)."

**Optional "Free Order" setting** (accessibility, off by default; on
automatically after the first full completion) lifts the cross-faction
condition. Crossovers then use their default variants.

## 3. The Chronicle — shared flags across factions

Today each faction save keeps its own `storyFlags`. Crossovers need a
**Chronicle**: one cross-faction flag record that every campaign can read and
that the crossover missions write (built: `src/systems/ChronicleManager.ts`).

**Rules**
1. **Compatible primaries.** Both sides of a crossover can win their primary
   objectives in the same canon. Example: in Convoy Alpha the Hegemony delivers
   most of the convoy while the Corsairs gut the straggler.
2. **Exclusive outcomes come from bonus objectives.** They are written as `x<N>_…` flags.
3. **First witness writes canon.** The first side to finish a crossover writes
   its exclusive flags. When the other side is played later, it gets a
   **variant**: its own exclusive bonus is swapped for a compatible one, and
   the briefing and script refer to what happened. There are no contradictions
   and no replays required.
4. **Nobody dies off-campaign.** A crossover can never kill or remove another
   campaign's named character. "Killed" outcomes become *downed, wounded,
   rechassised, fled*. Losses only happen inside the losing character's own
   campaign (Lance, Wildfire, Theta, the Wolves and Halo Wing keep working as today).
5. **Unity accounting.** Some Chronicle flags are **unity flags**. They count
   toward the Act V endings.

## 4. Crossover missions

| # | Battle (Day) | Side A | Side B (+C) | What A sees | What B sees | Shared flags (canon by first witness) |
|---|---|---|---|---|---|---|
| X1 | **Kessa Lane** (19) | Heg `heg_1_4` Field Promotion | Conf `conf_1_3` Guerrilla Tactics | Hunting the cell leader who burned a Registry convoy | The raid, then Iron Fist's reaction force arriving | `x1_phoenix_wounded` (Heg forced her to flee hurt) · `x1_census_burned` (Conf destroyed the Registry census cores) |
| X2 | **Tessaly Junction** (38) | Heg `heg_1_5` Border Skirmish | Syn `synth_1_5` Multi-Vector Assault | A Collective strike hitting both sides of the border | Organics shooting each other, and the junction taken | `heg_relay_held` (existing) **xor** `x2_junction_collective` |
| X3 | **Cinder Gate** (34) | Asc `asc_1_5` The Convergence | Cor `cors_1_4` Echo Run (**rewrite**) | Machines and raiders drawn to the Dreamer's waking point | A paying job to grab a "singing rock" | `x3_shard_taken` (Corsairs keep a pre-Prometheus shard) |
| X4 | **Convoy Alpha** (52) | Heg `heg_2_1` Supply Convoy | Cor `cors_2_4` Ambush Setup | Escorting Omega's freighters | Ambushing the same convoy in an ion cloud | `heg_convoy_intact` (existing) **xor** `x4_convoy_gutted` |
| X5 | **Gallows Hulk** (63) | Conf `conf_2_2` Prison Break | Cor `cors_2_3` Prison Ship | Pods of Confederation prisoners | Shuttles of Corsair crew, from the same hulk | `conf_prisoners_freed`, `cors_crew_rescued` (both can hold) · **unity:** both set → `x5_joint_breakout` |
| X6 | **The Witness** (74–80) | Conf `conf_2_4` Intelligence Theft | Heg `heg_2_3b` The Witness / `heg_2_3` Ace Hunt | Stealing Vance's orders from a Hegemony relay | Phoenix bringing those orders under truce, or being hunted | `x6_vance_orders` (Conf stole them; unlocks the Heg branch text) · `heg_phoenix_defected` (= Phoenix testified) |
| X7 | **The Fall of Prometheus** (90) | Heg `heg_2_4` Station Defense | Syn `synth_2_1` Data Harvest · Asc `asc_2_1` Sacred Artifact | Omega holding while Prometheus burns | Data cores / singing shards in the wreck field | `x7_nexus_data` (Syn) · `x7_shards_saved` (Asc) · `x7_omega_held` (Heg) |
| X8 | **Node Kel-9** (104) | Heg `heg_2_5` The Mothership | Syn `synth_2_4` Node Defense | Killing the Mothership and finding Vance's codes | The Mothership dying so the node lives | `relay_down` (existing) · `x8_node_preserved` |
| X9 | **Hale's Run** (112) | Syn `synth_2_5` Organic Command | Cor `cors_2_5` The Captain's Grudge | Remove the commander, Commodore Hale | Blackmaw's grudge against the same man | `x9_hale_down` (whoever kills him first) **xor** `x9_hale_escaped` |
| X10 | **Halden Orbit** (141) | Heg `heg_3_1` Fleet Engagement | Conf `conf_3_2` Capital Liberation | Vance's ordered assault on the uprising | Liberating the capital's orbit | `x10_chen_held_fire` (unity: Heg bonus "no lifter fired on") · `conf_wildfire_lost` (existing, Conf only) |
| X11 | **The Broken Alliance** (158) | Heg `heg_3_3` / `heg_3_3b` | Asc `asc_3_1` Crusade Begins | Vance's false orders turning an ally into an enemy | The Crusade's first strike, and the order they refused | `x11_betrayal_averted` (unity: Heg 3_3b chosen, or Asc bonus "hold fire on the parley ship") |
| X12 | **The Rendezvous** (171) | Syn `synth_3_3` Resistance Purge | Asc `asc_3_3` Alliance of Faith | Purging a coalition rendezvous | Escorting refugees to sanctuary past the purge | `x12_rendezvous_denied` (Syn) · `x12_sanctuary_reached` (unity, Asc) |
| X13 | **The Catalyst** (186) | Asc `asc_3_2` The Dark Vision | Syn `synth_3_4` Core Expansion | A machine that opens doors | Planting Prime's core seeds | `x13_catalyst_destroyed` (unity) **xor** `x13_door_opened` |
| X14 | **Brannoc Gate** (199) | Heg `heg_3_5` The Last Gate | Conf `conf_3_4` Final Offensive | Holding the gate against the offensive | Breaking the defense fleet's aces | `x14_ceasefire_called` (unity: Heg victory) |
| X15 | **The Breach** (200) | All five finales | — | Each faction's climax | Same final beat: the front arrives | `x15_breach_witnessed_<faction>` |

**One-way echoes** (one side reads a flag, no paired mission):

| Echo | Writer → Reader | Effect |
|---|---|---|
| E1 | `cors_crew_rescued` → `conf_2_3` | Kira's freed crew escort the parley (variant ally) |
| E2 | `conf_corsair_pact` → `conf_3_3` (existing), `cors_3_3` (new) | Corsair raiders arrive at the Gambit; Confederation pickets wave Kira through |
| E3 | `asc_1_4` (named Hunter downed) → `synth_2_4` | Unit Zero speaks from a new chassis ("I was unmade once this season.") |
| E4 | `cors_kappa_ledger` (cors_3_2) → `heg_3_4` | Whisper already has Vance's payroll, so an extra reinforcement wave never comes |
| E5 | `asc_heretics_spared` (asc_2_2) → `conf_3_1` | Unbound Vaelith join the Six Worlds broadcast (variant line + ally) |
| E6 | `synth_gate_virus` (synth_3_2) → `heg_3_5`, Act IV | The Spine gates fail early during the Breach. Act IV briefing blames Prime. |
| E7 | `asc_choir_silenced` → `synth_3_5` | Prime's final reserve arrives without its choir (one fewer wave) |

## 5. Faction keys (needed for the true ending)

| Faction | Key flag | How it is earned |
|---|---|---|
| Hegemony | `key_heg_witness` | `heg_phoenix_defected` **or** `x11_betrayal_averted` |
| Confederation | `key_conf_pact` | `conf_corsair_pact` (the Confederation learned to trust outlaws) |
| Synthetic | `key_synth_dissent` | New bonus in `synth_3_5`: "Let the evacuation lifters go". OMEGA-7 disobeys Prime. |
| Corsairs | `key_cors_loyalty` | `cors_crew_rescued` (loyalty over gold) |
| Ascendant | `key_asc_mercy` | New bonus in `asc_2_2`: "Burn the relay, spare the preachers" (`asc_heretics_spared`) |

## 6. Endings (Act V)

**Coalition Unity (U)** counts the unity flags set in the Chronicle. There are
12 possible: `x5_joint_breakout`, `heg_phoenix_defected`, `x7_shards_saved`,
`x8_node_preserved`, `x10_chen_held_fire`, `x11_betrayal_averted`,
`x12_sanctuary_reached`, `x13_catalyst_destroyed`, `x14_ceasefire_called`,
`conf_corsair_pact`, `asc_temple_intact`, `x3_shard_taken` (the Corsair shard
returns in Act V).

| Ending | Condition | What happens |
|---|---|---|
| **Answer** (true) | All 5 keys **and** U ≥ 7 | OMEGA-7's lattice, the Dreamer's chorus, Vasquez's cipher, the Hegemony gate codes and Kira's shard become one voice. The Coalition proves to the Warden that the galaxy can be loud without breaking the lanes. The Tide recedes into a guardian role. Psionics survive, and the five powers sign the Brannoc Accord. |
| **Sever** | U ≥ 4 | The Resonance strike destroys the Warden. The lanes it kept healthy begin to fray. Within a generation, half the wild lanes close. The galaxy is free but smaller. Psionics fade for a decade. |
| **Seal** | Always available | The Nexus is rebuilt around a mind: the Dreamer plus the player's most-flown hero. The Tide sleeps, and the cold war resumes with a memorial at Brannoc. |
| **The Quiet** (forced Seal) | U < 4 | As Seal, but the Reach is lost with Vega Prime, and the Ascendant become a refugee people. |

Each faction's existing epilogue (`epilogues.ts`) stays the *Act III*
epilogue. Act V adds one line per hero, chosen by ending and flags.

## 7. Recommended "Chronicle order" (for players who want guidance)

Hegemony I → Confederation I → Synthetic I → Hegemony II → Corsairs I →
Confederation II → Ascendant I → Corsairs II → Synthetic II → Ascendant II →
Act IIIs in any order (Ascendant last for the reveal) → Coalition.
