# Ascendant Empire — "Evolution Through Transcendence"

**Gameplay identity:** shields, support and **psionic powers** (Aegis Field
aura; psionic disciplines and talents, which are Ascendant-only, internal slot
id `force_power`; support hulls with crew and shield cards).

## Identity
The Vaelith are the only non-human civilization humans have met, and the
last of the **Ascendancy** that fought the First Tide 10,000 years ago and
starbroke eleven suns to survive it. The waking remnant, the **Vigil**, kept
watch over the sealed Reach for a hundred centuries. Over that time memory
turned into scripture. The Vigil became the **Ascendant Empire**: a
theocracy of psions that believes the sleepers will wake and the faithful
will **Ascend**.

- **Right about:** something terrible sleeps behind the seal, and humans broke it.
- **Wrong about:** what the Prophecy means. "Ascension" is a distorted memory
  of the Shattering, and its price was a mind sealed into the lock.

## Biology
Tall, long-lived (about 400 years), and every one of them psionic. Vaelith
speak in a chorus-tuned trade tongue. Their ships are grown and shaped
(bio-ceramic hulls over psionically tuned screen lattices), which is why
their screens regenerate. **Their angelic ship names are human:** Hegemony
first-contact analysts gave Vaelith hulls codenames from old human
iconography in 2351, and the names stuck in trade-speech. Vaelith call
their Seraphs *ilun-kesh*.

## Government
- **The Oracles:** seers who read the Prophecy and set doctrine. *Secret (Act
  III):* the senior Oracle, the **Prophet Ilsandre** (`vision_of_doom`), is Hollowed.
- **The Archons:** war-priests who command the fleets. **Archon Zaelthar** is the player's commander.
- **The Vigil Temples:** the Temple of the Ninth Vigil is 900 years old.
- **The Dreaming Ships:** stasis arks of the old Ascendancy. Their sleepers are holy, and none had ever woken until Day 0.
- **The Unbound:** heretics and exiles who say the Prophecy is a lie. Many live on Confederation worlds. The Corsairs' Admiral is one.

## Culture
- Ritual flight: trials flown along "light-markers" laid down in an earlier age.
- 432 Hz chorus tones. Shrines drift on the shrine-lanes (Survival event "Ascendant Shrine").
- Colors: emerald, dark gold, deep purple. Music: non-Western instruments only (Harmonia `ascendant`).
- Prophecy language in dialogue ("I have dreamed this"). Foresight is real, but only seconds deep.

## Military doctrine — "The Chorus"
- **Screens over armour:** the Aegis Field lets allies regenerate screens. A
  chorus-linked wing shares perception (Mind Link).
- **Support at the centre:** Oracles, Prophets and Acolytes fly in the
  formation, not behind it, weaving screens and mending crews.
- **Foresight duels:** aces read the enemy's commit and are where the shot is not.
- Overuse means burnout or Deepfall. Archons rotate choristers like ammunition.

## Ship naming
Angelic orders in trade-speech: Seraph, Cherub, Herald, Virtue, Templar,
Crusader, Paladin, Inquisitor, Oracle, Prophet, Acolyte, Avatar, Wrath,
Judgment, Smiter, Purifier. Capitals: Divine Sovereignty, Glory, Sanctum,
Bastion Cruiser.

## Hero — The Dreamer (and the Templar who carries her)
**The Dreamer** is an Ascendancy-era mind who woke on Day 0 aboard the
Dreaming Ship *Ilun-Sael*. She has no body that can fly. She lives in the
mind of a young initiate, **the Templar Kaeth** (the player's pilot), whom
the Oracles chose for the trial. Her lines are the voice in Kaeth's head ("I
can hear your thoughts, Templar"). The hero powers are hers.
**Arc:** ancient witness → doubt (the heretics "pray as we pray") → memory
(the Shattering) → she breaks with the false Prophet → in the Coalition, she
teaches the chorus and offers herself to the Seal.

| Key | Power (data id) | In-universe name | Fiction |
|---|---|---|---|
| V | `time_slow` | **Stillness** | The Dreamer's foresight floods Kaeth's mind. For a few seconds enemies seem to crawl (enemy time ×0.5) |
| B | `psionic_lance` | **Mind Lance** | A focused push on the target's screen harmonics: a shield-piercing strike |

**Squad:** **Archon Zaelthar** (Templar; stern, honest, faithful to the
end). **The Herald** (Herald scout; the Oracles' voice, who later quietly
sides with the Dreamer). Halo Wing (can be lost). Temple Guardians.

## Notable aces (pilot cards)
| Card | Lore |
|---|---|
| `archon_prime` | The First Archon, Zaelthar's superior. Loyal to the Oracles until the Breach |
| `divine_seraphina` | Seraph champion. Her reflexes are pure foresight (rename the ability *Supernatural Reflexes* → **Precog Reflexes**) |
| `high_seer_mira` | Oracle of the Ninth Vigil Temple. First to doubt Ilsandre |
| `vision_of_doom` | The Prophet Ilsandre's command ship (Hollowed) |
| `crusader_vorn` | Templar crusader who leads the Crusade's first strike (X11) |
| `grand_inquisitor` | Rename to **First Censor**; hunts the Unbound |
| `warlord_darius`, `grand_avatar`, `holy_avenger`, `righteous_fury`, `divine_light`, `voice_of_glory` | Archons and champions of the Crusade |
| `blessed_healer`, `high_priest`, `shield_of_faith`, `fortress_of_faith` | Menders and weavers |
| `fury_incarnate`, `divine_sentence`, `wrath_of_heaven`, `cleansing_fire`, `hand_of_the_divine`, `light_of_glory` | Heavy hulls of the Crusade fleet |

## Relationships
| With | Start | After the Breach |
|---|---|---|
| Hegemony | Uneasy allies (trade at Cinder Gate) | Allies, if the Broken Alliance was averted |
| Confederation | Harbourers of heretics | Owed a debt (Vega Prime) |
| Collective | Abominations (echoes of the Lanewrights) | Partners in the Answer |
| Corsairs | Thieves of veils | The Admiral comes home |

## Old lore → new
- "Psionic aliens and bio-tech" stays. The Force-style framing is removed: psionics has rules, costs and a cosmic danger (loudness).
- "The Dreamer awakens and gathers survivors" → the Dreamer speaks through the player pilot, and her conflict is with her own faith.
- The Ascendant finale `asc_ascension` becomes **silencing the false Prophet** (see [campaigns/ascendant.md](../campaigns/ascendant.md)).
