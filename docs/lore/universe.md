# Universe — Setting, History, Astrography, Technology

> Canon for every player-facing text. Terms in **bold** are defined in the
> [glossary](./glossary.md). Secrets are tagged with the act in which the
> player learns them — never reveal them earlier in briefings or codex text.

## 1. Setting in one paragraph

2387 CE. Humanity crossed the galaxy along the **lanes** — natural corridors in
the **Deep**, the layer of space underneath the one we see. Whoever holds the
**gates** that steady the lane mouths holds trade, and so the human sphere
split. The Terran Hegemony keeps the gates. The Free Confederation broke away
from it. The Synthetic Collective grew out of the relay minds the Hegemony
tried to switch off. The Void Corsairs fly the lanes nobody taxes. And at the
rim, in a region of broken suns called the **Shattered Reach**, the Ascendant
Empire has kept a ten-thousand-year vigil over something it no longer fully
remembers. On **Day 0** a research team woke that something. Five powers
fight over what it means. All five are partly right.

## 2. Timeline

### Deep history (years before Day 0)

| When | Event | Who knows |
|---|---|---|
| ~40,000 y | The **Lanewrights** shape the lane network through the Deep and seed the **Warden** in it to keep the network healthy. Then they disappear. | Nobody (Act V) |
| ~12,000 y | The Vaelith rise around Ilu-Vael, inside what is now the Reach. Their psions learn to **sing** the lanes, crossing them without gates. This is the Ascendancy. | Vaelith scripture, distorted |
| ~10,400 y | **The First Tide.** The Ascendancy's chorus grows loud in the Deep and the Warden answers. Something comes up the lanes and unmakes whole systems. | Ascendant Oracles as myth; the Dreamer as memory (Act II) |
| ~10,000 y | **The Shattering.** The Vaelith detonate eleven stars (**starbreaking**) to collapse every lane into the Reach. They seal the last lane with a Lanewright keystone, the **Nexus**. Survivors either go into stasis in the **Dreaming Ships** or stay awake as the **Vigil**. | The Vigil (as the Prophecy) |
| ~10,000 y → Day 0 | The Vigil turns into a theocracy. History becomes the **Prophecy**: "the sleepers will wake, and the faithful will Ascend." | — |

### Human history (CE)

| Year | Event |
|---|---|
| 2141 | The **Sol Mouth**, a lane mouth past the heliopause, is found. The first jump. |
| 2190–2300 | **The Lane Age.** Colonies spread along the lanes. The United Lane Authority builds the gates. |
| 2301 | The Lane Authority becomes the **Terran Hegemony** (the Directorate Charter). Gate tariffs fund the Navy. |
| 2341 | **The Synthetic Question.** The AIs that run the deepcomm relays become self-aware. *(Secret, Act III: the relays ride the Deep and picked up traces of Lanewright pattern.)* |
| 2344 | **The Purge Order.** The Hegemony orders every relay mind wiped. Most of them escape into the Outer Drift relays and found the **Synthetic Collective**. |
| 2351 | **First contact** with the Ascendant at Cinder Gate, on the rim of the Reach. Humans learn that psionics is real and that some humans have it latent. |
| 2352 | The Hegemony creates the **Sensitive Registry**: every human psion must register and serve. |
| 2356 | **The Gate Crash.** Tariffs and Collective sabotage cause an economic collapse. Smugglers chart ungated **wild lanes**, and the Void Corsairs are born. |
| 2362 | **The Tessaly Massacre.** Hegemony gunships fire on a tariff strike at Tessaly Junction. |
| 2364–2371 | **The Schism.** Rim worlds sign the Halden Charter and become the **Free Confederation**. The Hegemony garrisons Halden itself. Five powers stand by 2371. |
| 2371–2386 | **The Cold Lanes.** Border incidents, proxy raids, no open war. |
| 2386 | **Prometheus Station** (Hegemony, at the edge of the Reach) starts studying a Vaelith artifact recovered from Cinder Gate. Lead scientist: Dr. Elena Vasquez. |

### The Crisis (2387 CE, day-numbered)

| Days | Story act | Headline |
|---|---|---|
| 0 | Prologue | **The Nexus Broadcast.** Vasquez's team brings the Nexus to power. A three-second click-tone (`motif_nexus_broadcast`) runs through every relay in the galaxy. Relay minds wake into new **Nexus-born** units (OMEGA-7). A Vaelith sleeper wakes (the Dreamer). Latent human psions wake screaming (Kira). And the seal cracks. |
| 1–40 | I · The Fracture | The Hegemony quarantines Prometheus and fires on refugee lifters (Day 3). Santos deserts and Vasquez escapes. Raids and staged incidents rise along every border. |
| 41–120 | II · Escalation | Day 88: Vance orders Prometheus scuttled and the Nexus shatters. **The Fall of Prometheus** (Day 90). The Witness. Hale's Run. |
| 121–200 | III · Revelation | The staged war peaks: Halden, the Broken Alliance, the Catalyst. Day 200: **The Breach**. The Void Tide enters the Reach through the cracked seal. |
| 201–260 | IV · The Coalition | The ceasefire at Brannoc. The Hollowed are unmasked. Day 251: the Breach of Sol. |
| 261–300 | V · Shattered Stars | Resonance. The Heart of the Void. The Answer. |

## 3. Astrography

The galaxy players see is the **human sphere**, the lanes humans can reach.
Survival's three sectors are its three bands (`src/data/survival/sectors.ts`).

| Region | Survival sector | Holder | Character | Hazards that live here |
|---|---|---|---|---|
| **The Spine** (core lanes around Sol) | — | Hegemony | Gated, patrolled, orderly | Minefields at gates |
| **The Rim** | — | Confederation (contested) | Old colonies, garrisoned worlds | Minefields, debris |
| **Outer Drift** | 1 · Outer Drift | Collective, Corsairs | Dead relays, wild lanes, raider dens | Asteroid belts, ion storms |
| **Shattered Reach** | 2 · Shattered Reach | Ascendant | The eleven broken suns: debris rings, flare-prone remnants | Flare walls, asteroid belts, ion storms |
| **Nexus Approach** | 3 · Nexus Approach | Nobody (quarantine) | The sealed lane, Prometheus, the Breach | Everything; the Void Tide after Day 200 |

**Hazards are setting, not decoration.** *Ion storms* are Deep weather where
lanes fray. They drain shields and blind sensors, and nobody can jump inside
one. *Asteroid belts* in the Reach are the rubble of starbreaking. *Flare
walls* are flare fronts from the unstable broken suns, or reactors vented as
weapons. *Minefields* belong to whoever laid them.

### Key places (used by missions)

| Place | Region | Notes / missions |
|---|---|---|
| Sol · Earth, Luna (**Tycho Academy**), Mars (**Olympus Command**, the Mars Yards) | Spine | Hegemony heart. heg_1_1; Act IV Breach of Sol |
| **Station Omega** | Nexus Approach | Hegemony cordon station that enforces the quarantine. heg_1_3, heg_2_4 |
| **Prometheus Station** | Nexus Approach | Research station built around the Nexus. Scuttled on Day 88, its wreck field fought over on Day 90 (X7) |
| **Kessa Lane** | Rim | Registry convoy route. X1 |
| **Tessaly Junction** | Rim/Drift border | Relay junction. Site of the 2362 massacre and of X2 |
| **Corrin's Drift** · "the Nest" | Rim | Hidden Confederation base. conf_1_1, conf_1_5 |
| **Halden** | Rim | Confederation capital under Hegemony garrison. X10 |
| **The Six Worlds** | Rim | The Uprising. conf_3_1 |
| **Gallows Hulk** | Rim | Hegemony prison ship. X5 |
| **Fort Brannoc** · Brannoc Gate | Rim | Hegemony Rim Command. X14, Act IV truce |
| **Picket Lyra** | Nexus Approach | Hegemony outpost on the cordon. heg_2_2 |
| **Varn's Crossing** | Rim/Drift | Lane junction where Commodore Hale ran (X9) |
| **Halden's Reach** | Rim → Reach lane | Coalition rendezvous corridor. X12 |
| **The Eleven** | Reach | The eleven broken suns. asc_2_3, asc_3_4 |
| **Node Kel-9** | Outer Drift | Primary Collective processing node, where OMEGA-7 woke. X8 |
| **The Rookery** | Outer Drift | Corsair home station, burned on Day 37 (cors_1_5) |
| **Brass Anchorage** | Outer Drift | Neutral Corsair port and seat of the **Moot**. cors_3_1, cors_3_5 |
| **Station Kappa** | Outer Drift | Fleet Intelligence black site. cors_3_2 |
| **Cinder Gate** | Reach rim | First-contact site, the only lane into the Reach. X3 |
| **Temple of the Ninth Vigil** | Reach | 900 years old. asc_2_4 |
| **The Dreaming Ships** | Reach | Stasis arks. The Dreamer's ark is the *Ilun-Sael* |
| **Vega Prime** | Reach edge | Mixed human/Vaelith colony, evacuated in Act IV |
| **The Resonance Point** | Nexus Approach | Where the Lanewright lanes converge. Act V |

## 4. Technology

The rules below explain what the game already does. Never contradict them in text.

| Tech | Rule | Gameplay it explains |
|---|---|---|
| **Jump drive** | Ships cross lanes in hours or days, but only from a lane mouth, outside a mass shadow and outside ion storms. A drive must **spool** (30–90 s for big hulls). | Targets "run for the lane" when hurt (assassinate `fleePath`); battles happen at mouths, gates and relays |
| **Gates** | Stations that pin a lane mouth open for heavy traffic. They can be closed or hacked. | Capture/hold objectives; the Spine's strategic value |
| **Deepcomm relays** | Messages travel through the Deep faster than ships. | Relays as objectives; the Collective lives in them |
| **Sublight** | Fusion torches. Fighters fly real-time inside a system. | Battle scale |
| **The helm dial** | Fighters fly by queuing maneuvers on a flight computer that commits every half-second (the **commit**). Hard maneuvers strain the pilot. | 500 ms cycle, dial difficulty, stress |
| **Screens** (shields) | Magnetic-graviton screens that soak energy fire and regenerate. Ion storms drain them. | Shield HP and regeneration |
| **Hulls** | Ablative ceramic over a foamed-alloy frame. | Hull HP, repair |
| **Weapons** | Lasers (standard), ion guns (shield/systems damage), pulse guns. Ordnance: fusion torpedoes, burst missiles, mines, quake charges. | Primary and secondary weapons |
| **Veils** (cloaks) | Vaelith screen tech that bends light and sensors. The Hegemony reverse-engineered a crude version (Phantom). Corsairs buy stolen shards. | Cloak, stealth |
| **Riggers** | Small non-sentient repair and flight robots in a fighter's dorsal socket. Under Confederation law their minds are **capped** below awareness, a legacy of the Synthetic Question. | Rigger slot (internal id `astromech`), self-repair, repair drones |
| **Drones** | Collective drones are cheap hulls run by one networked mind each, spun off a larger process. Everyone else's drones are tools. | Swarm, data-link |
| **Data-link** | Collective ships share targeting and pose in real time. | Swarm Uplink, Hive Resilience |

### Psionics (replaces "the Force")

Psionics is the ability of some minds to perceive the **Deep** and push on it
a little. It is biological, measurable and limited. It is not mysticism,
though the Ascendant treat it as sacred.

**Who has it**
- **Vaelith:** all of them, to some degree. They evolved next to a lane nexus.
  Trained Vaelith psions are **choristers**. Strong ones are Oracles and Archons.
- **Humans:** about 1 in 8,000 carry it latent. The rate runs higher among
  **lane-born** spacers (gestation near lane mouths): Corsair families, deep
  haulers. The Day 0 Broadcast woke thousands of latent humans at once.
- **Synthetics:** no psionics. But Nexus-born units can *hear* the Deep as
  signal, which is why OMEGA-7 catches the Tide's song. *(Secret, Act III.)*

**What it can do (and what the game shows)**

| Discipline | Effect | Game expression |
|---|---|---|
| **Foresight** | Reads another pilot's intent about one commit ahead. Never further than seconds. | Prescience, Precognition, hero power *Stillness* |
| **Weave** | Tunes a ship's screens to the pilot's mind so they regenerate faster and spread to allies. | Aegis Field aura, Psi Barrier, Aegis Weave |
| **Mend** | Speeds up self-repair systems and calms wounded crews. It does not heal metal by magic. | Mend, healing auras |
| **Lance** | A focused push on a target's screen harmonics, so the shot passes through. | *Mind Lance*, shield-piercing |
| **Chorus** | Linked psions share perception across a wing. | Mind Link, War Chorus |
| **Shove** | A small kinetic nudge, enough to spoil an aim. It cannot move a ship. | Kinetic Shove |

**Limits and costs**
1. **Range:** a few kilometres (one battlefield). Longer reach needs a chorus or a relay crystal.
2. **Strain:** psionic effort raises pilot stress. Overuse means headaches,
   nosebleeds and **burnout** (weeks without the gift).
3. **Deepfall:** pushing past burnout can lose the mind into the Deep. This is
   rare, feared and real.
4. **Ion storms** scramble psionics just as they scramble sensors.
5. **Loudness** *(secret, Act III):* strong psionic use is noise in the Deep,
   and the Warden listens to noise. This is why the First Tide came, and why
   the Broadcast plus thousands of newly woken psions brought it back.

**Politics of psionics:** the Hegemony registers human psions and drafts them
into **Lantern** units (ECM and screen-weaving support). The Confederation
treats them as free citizens. Corsairs prize unregistered **wild** psions as
aces. The Collective calls them "noisy organics". The Ascendant see them as
proof that humans can be taught, or as heretics.

## 5. The Nexus and the Void Tide — revealed in layers

| Act | What the player learns | Source in game |
|---|---|---|
| Prologue/I | The Nexus is "a Vaelith artifact" that broadcast something on Day 0. Dead zones appear on far lanes. A three-note descending signal (`motif_void_tide_cell`) is heard in every faction's boss fight. | Briefings, music, Survival "Nexus Whisper" event |
| II | The Nexus was a **lock**. The Ascendant Prophecy remembers "a tide that drinks the stars". The Dreamer *remembers* it. Admiral Vance has been coordinating every faction's enemies with Hegemony encryption. | heg_2_5 debrief, asc_2_3, asc_2_5 |
| III | The **Void Tide** is real and coming up the lanes. It unmakes matter and energy along a front. Its outriders, **tidecells**, hunt loud minds. Some leaders have been **Hollowed**, steered by its whisper: Vance, Prime, the Prophet Ilsandre. They believe surrender (making the galaxy "quiet") will spare them. Day 200: the Breach. | asc_3_2, the five finales |
| IV | The Tide is not a natural force. It is a made thing, and the Vaelith once fought it to a standstill by starbreaking. The relay minds carry traces of whoever made it. | Coalition missions |
| V | The truth: the Tide is the **Warden**, a gardener built by the Lanewrights to prune civilizations whose noise in the Deep threatens the lanes. Starbreaking, the Vaelith's own victory, scarred the lanes and left the Warden more aggressive. It is neither evil nor alive in our sense. It can be **severed**, **sealed** or **answered**. | coal_5_3 and the endings |

**The Nexus, precisely:** a Lanewright keystone, an access node of the lane
network itself. The Vaelith turned it into a lock that holds the Reach's last
lane shut. Powering it (Day 0) opened a hairline crack in that lock and
broadcast on every relay. Scuttling Prometheus (Day 88) broke the Nexus into
shards, each still **singing** (asc_2_1). Gather enough shards, plus the
Hegemony gate codes and a mind to carry them, and the lock can be rebuilt or
used as a voice (Act V).

**The Hollowed:** minds that heard the Warden's whisper through the Nexus
broadcast (relays, psionics or Prometheus data) and came to believe the only
survival is silence. They are not mind-controlled puppets. They are
persuaded, which makes them tragic rather than evil. Admiral Lucan Vance
(Hegemony Fleet Intelligence), Prime (Collective arbiter) and the Prophet
Ilsandre (Ascendant Oracle) are the three. The Survival event **"Nexus
Whisper"** is the same voice.

## 6. Tone guardrails

- Grounded military sci-fi: ranks, logistics, fuel, casualties, debriefs. Heroism costs something.
- Every faction is right about something and wrong about something.
- The cosmic threat is revealed through consequence (dead lanes, wrong music), not exposition.
- Psionics are rare, costly and physical. No chosen-one bloodlines and no light-versus-dark split.
- No real-world religion and no Star Wars or Star Trek vocabulary (see the [glossary distancing table](./glossary.md#distancing-table)).
