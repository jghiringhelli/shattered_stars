# Void Corsairs — "Fortune Favors the Bold"

**Gameplay identity:** tricks and hit-and-run aces with illicit tech (Raider's
Cadence aura, contraband slots (internal id `illicit`), trick talents, the
best duelists).

## Identity
The Gate Crash of 2356 left a generation of haulers with ships and no legal
lanes. They charted **wild lanes** (ungated, unstable, untaxed) and became
the Void Corsairs: smugglers, salvagers, mercenaries and pirates, depending on
the week. They are clans, not a nation. Their families live on stations like
**the Rookery**, until the Hegemony burns it on Day 37.

- **Right about:** the gates are a toll on survival, and governments abandon the poor first.
- **Wrong about:** that nothing is worth more than the next score. Kira learns otherwise.

## Government
- **Clans** under captains, bound by the **Compact**. Captains meet at the
  **Moot** in Brass Anchorage.
- The **Pirate King** is a title the Moot grants to a captain who unites the
  clans. It has been empty since **Pirate King Skull** (`pirate_king_skull`)
  died in 2381. "King" is the title whatever the holder's gender.
- No Registry. Wild psions are prized, and many Corsair aces have the gift without knowing it.

## Culture
- Debt and honour: "Corsairs don't leave the dead hungry." Crews are family.
- Stolen hulls get new paint and new names. Veils (stolen Vaelith cloak shards)
  are the most valuable contraband there is.
- Colors: deep purple, crimson, brass. Music: Harmonia `corsairs` (heist swagger).

## Military doctrine — "Teeth and Smoke"
- **Hit and run:** strike from an ion cloud or a rock field, gut the prize, jump before the escort forms.
- **Tricks:** pilots fly the dial at its edges: hook loops, knife rolls,
  stressed boosts. Contraband gear trades safety for punch.
- **Aces over formations:** one Corsair ace is worth a squadron of line pilots, and they know it.

## Ship naming
Blades and predators: Blade, Fang, Talon, Venom, Cutlass, Scimitar, Saber,
Specter, Phantom, Shadow, Reaver, Pillager, Ravager War Galley, Torpedo Boat,
Void Galleon, Raider Frigate, Fleet Tender, Dreadnought. Crews name their own
ships (*Red Mercy*, *Blackmaw's Due*, *Second Chance*).

## Hero — Captain Zara Kira, "Blackblade"
Lane-born, a deckhand on Captain Blackmaw's crew. The Day 0 Broadcast woke a
latent psionic gift in her: she has nightmares of a three-note song and an
uncanny feel for the dial. She rises to captain, then to Pirate King. In the
Coalition she leads special operations.
**Arc:** crew → captain → king → someone who gives back the shard instead of selling it.

| Key | Power (data id) | In-universe name | Fiction |
|---|---|---|---|
| V | `cloak_dash` | **Ghost Jump** | A stolen veil shard plus a micro-spool: Kira skips forward and vanishes from sensors. Only a psion can steer it |
| B | `scatter_mines` | **Parting Gift** | Contraband smart mines seeded astern, keyed to hunt only enemies |

**Squad:** **The Admiral** (quartermaster and mentor; masked, centuries old.
*Secret (Act II, `cors_2_5` debrief):* an **Unbound Vaelith** exile who has
hidden among humans for 300 years and has been waiting for the seal to
fail). **Bloodfang** (Fang ace, leader of the Wolves, which can be lost).
**Captain Blackmaw** (Kira's captain, murdered before `cors_3_5`).
Rivals: **Rustjaw**, **Skarn**, and the usurper **Vosk** (renamed from
*Vorn* to avoid the Ascendant card `crusader_vorn`).

## Notable aces (pilot cards)
| Card | Lore |
|---|---|
| `red_jenna` | Blade ace. Kira's first rival, later her wingmate |
| `iron_fist_mora` | Ex-Hegemony **Iron Fist** pilot who deserted in 2379. Chen's former wingman |
| `pirate_king_skull` | The last Pirate King. His Dreadnought is a museum and a legend |
| `ghost_dancer`, `phantom_whisper`, `death_shadow` | Veil-runners. The Admiral sells them shards |
| `bloodaxe_thorne`, `warlord_drake` | Reaver and War Galley warlords of the Moot |
| `loot_master_graves`, `supply_master_patch`, `fleet_master_storm`, `raider_captain_flint` | Clan quartermasters and captains |
| `venom_sting`, `deadly_venom`, `poison_fang`, `razor_talon`, `bloody_cutlass`, `whirlwind_scimitar`, `saber_master`, `bomb_runner_hex`, `torpedo_king_blaze` | Lane legends. Every bar has a song about one |

## Relationships
| With | Start | After the Breach |
|---|---|---|
| Hegemony | The toll-keepers who burned the Rookery | Paid allies |
| Confederation | Marks, then pact partners (Gallows Hulk) | Trusted, if `conf_corsair_pact` |
| Collective | Customers | Customers |
| Ascendant | Myth, and the Admiral's secret | Kin, through the Admiral and the shard |

## Old lore → new
- "The Admiral is Ascendant" → kept, made precise: an **Unbound** exile with a psionic veil-mask.
- "Corsairs want a world of their own" → their Act IV price: Vega Prime's empty colony charter.
