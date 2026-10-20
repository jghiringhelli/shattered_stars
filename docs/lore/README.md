# Shattered Stars — Lore Bible

> **Resumen (ES).** *Shattered Stars* es combate táctico de escuadrones en
> tiempo real con cinco facciones. Esta biblia redefine el canon. El tono es
> ciencia ficción militar con los pies en la tierra, al estilo StarCraft: cinco
> potencias con motivos legítimos y opuestos, y una amenaza cósmica que se
> revela poco a poco. Hay nombres y conceptos propios: la "Fuerza" pasa a ser
> **psiónica** (rara, física, con costes y límites). La tienen algunos pilotos
> humanos y todos los vaelith (Ascendant). Los "astromech" pasan a ser
> **riggers**. Las maniobras se llaman **Snap Turn / Hook Loop / Knife Roll**.
> La campaña cuenta **la misma guerra de 300 días** desde cada facción, con
> misiones distintas. Los actos están **entrelazados**: el Acto N se abre
> cuando el Acto N−1 está completo en al menos N facciones ("Regla de N"). El
> final (Acto V, campaña Coalición) exige las cinco. Hay **15 batallas
> cruzadas** (la misma batalla vista desde dos o tres bandos), con flags
> compartidos en una **Crónica** común y tres finales según la unidad lograda
> (Answer / Sever / Seal). Las 78 misiones existentes se conservan con sus ids
> (la mayoría solo con retoques de texto) y se marca cuáles reescribir.

## Pitch
2387 CE. Humanity crossed the galaxy along the lanes, and split over who holds
the gates. On **Day 0** a Hegemony research team powered an ancient Vaelith
lock, the **Nexus**, and broadcast a three-second signal through every relay
in the galaxy. Machines woke. A sleeper ten thousand years old woke. Thousands
of human psions woke screaming. And something beyond the **Shattered Reach**
heard it. Five powers go to war over what the signal means, and an admiral in
Fleet Intelligence makes sure they keep fighting until the **Void Tide**
arrives.

## Tone pillars
1. **Grounded military sci-fi.** Ranks, logistics, debriefs, losses that stay lost (Lance, Wildfire, Theta, the Wolves, Halo Wing).
2. **Everyone is partly right.** Order vs freedom vs continuity vs survival vs faith. No faction is purely good or evil.
3. **Psionics is rare and physical.** It strains the pilot, it has limits, and it is loud in the Deep, which has cosmic consequences.
4. **The threat arrives through consequence.** Dead lanes, wrong music (the three-note motif in every boss track), staged battles. Not exposition dumps.
5. **One war, five witnesses.** The same days and battles, never the same missions.
6. **Own vocabulary.** Nothing that reads as Star Wars or tabletop in player-facing text.

## Contents
| File | What |
|---|---|
| [universe.md](./universe.md) | Setting, timeline, astrography, technology, psionics rules, Nexus and Void Tide (with reveal schedule) |
| [factions/hegemony.md](./factions/hegemony.md) | Terran Hegemony: discipline and elite aces · hero Chen |
| [factions/confederation.md](./factions/confederation.md) | Free Confederation: crews, riggers, mixed ordnance · hero Santos |
| [factions/synthetic.md](./factions/synthetic.md) | Synthetic Collective: swarm and data-link · hero OMEGA-7 |
| [factions/corsairs.md](./factions/corsairs.md) | Void Corsairs: tricks, hit-and-run, contraband · hero Kira |
| [factions/ascendant.md](./factions/ascendant.md) | Ascendant Empire: shields, support, psionics · hero the Dreamer (and the Templar Kaeth) |
| [campaign_arc.md](./campaign_arc.md) | The 5 acts, the act-unlock rule, the Chronicle, the crossovers, keys and endings |
| [campaigns/](./campaigns/) | Per faction, all 15 slots mapped to the existing 78 mission ids: [Hegemony](./campaigns/hegemony.md) · [Confederation](./campaigns/confederation.md) · [Synthetic](./campaigns/synthetic.md) · [Corsairs](./campaigns/corsairs.md) · [Ascendant](./campaigns/ascendant.md) |
| [glossary.md](./glossary.md) | Canonical terms and the **distancing table** (Star Wars/tabletop terms in `src/` with counts and replacements) |

The bible **supersedes** [../campaign_narrative.md](../campaign_narrative.md)
and the lore sections of [../scifi_factions.md](../scifi_factions.md). Those
files stay as history. The roster tables in `scifi_factions.md` that map ships
to tabletop stat lines are obsolete.

## What changed vs the old lore, and why

| Old | New | Why |
|---|---|---|
| "Force", Force powers | **Psionics** with disciplines, strain, burnout, Deepfall and *loudness* | User direction: distance from Star Wars. Costs make it grounded and tie it to the cosmic threat |
| Astromech droids | **Riggers**, capped below sentience by Confederation law | Own concept, and it adds tension with the Synthetic Question |
| K-turn / Segnor / Tallon | Snap Turn / Hook Loop / Knife Roll | Own pilot slang (ids unchanged) |
| Great/Galactic Schism as a vague origin | **The Schism** (2364–71) with causes: Purge Order, Gate Crash, Tessaly Massacre | Each faction gets a concrete grievance |
| "Shattered Stars" was only a title | The **Shattered Reach**: eleven stars broken by the Vaelith to stop the First Tide | The title becomes literal and backs the Survival sectors and hazards |
| Void Tide = weapon of a dead race, explained early | The **Warden**: a Lanewright gardener, revealed in layers; the Vaelith's starbreaking made it worse | Mystery pacing, and moral complexity even for the cosmic threat |
| Traitor = "a leader of your most-played faction" | The **Hollowed**: Vance, Prime, the Prophet Ilsandre (persuaded, not puppets) | Fits the shipped Vance conspiracy and the finales already in data |
| Chen orders the station destroyed, then defects | Vance scuttles Prometheus; Chen purges the conspiracy and calls the ceasefire | Matches shipped dialogue (Vance arc, promotion to Admiral) |
| Santos a border commander; Vasquez a rescue target | Santos a **Hegemony deserter**; Vasquez in her squad from Day 5 | Matches shipped Confederation missions and cast |
| Dreamer is the pilot | The Dreamer **speaks through** the player's Templar | Matches shipped dialogue ("I can hear your thoughts, Templar") |
| 4 faction acts + 8 coalition missions, recommended order | 3 faction acts (as shipped) + Coalition Acts IV–V (8 missions, to build); **Rule of N** gating | Fits the shipped 15-slot structure. Interlocking replaces a fixed order |
| Battle of Prometheus "in all five campaigns" | **15 crossovers** (2–3 sides each), plus The Breach in all five finales | Each crossover has a real mission on each side and shared flags |
| Faction finales were contradictory total victories | Each finale is a faction climax ending on the **same Breach beat** | One canon, five points of view |

## Implementation notes (built 2026-10-14)
- ~~**Chronicle store** for cross-faction flags (per-faction saves stay as they are), plus variant support that reads it.~~ DONE (`src/campaign/chronicle`, `src/systems/ChronicleManager.ts`; variants read the merged flags).
- ~~**Act gating:** the Rule of N across saves, and the "Free Order" setting.~~ DONE (`actUnlocks.ts`; Free Order on the hub\u0027s CHRONICLE tab).
- ~~**Coalition campaign** (`coal_4_*`, `coal_5_*`) and the final-choice scene.~~ DONE (lead hero + allied squads; the choice is on `CampaignCompleteScene`).
- ~~**Display renames** from the [distancing table](./glossary.md#distancing-table), with their test assertions.~~ DONE 2026-10-13 (guard: `tests/unit/lore/distancing.test.ts`).
- ~~**Mission edits:** most changes are RETEXT.~~ DONE (`src/data/campaign/lore/*`). The original note: most changes are RETEXT. REWORK items: `cors_1_4` (enemies), `heg_2_4` (extra fleeing contacts), `heg_3_4` and `heg_3_5` (premise), `synth_3_5` (new bonus), `asc_2_2` (new bonus), `asc_3_5` (premise), plus new bonuses that set crossover flags.
