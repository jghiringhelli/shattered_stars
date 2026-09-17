# Shattered Stars — Suno Music Prompts

Golden standard: **StarCraft 1 — Terran Theme 1** (Glenn Stafford, 1998).
That track is lonely-frontier space-western: harmonica lead, twangy electric
guitar, restrained brass, walking bass, slow-burn cinematic build, minor-key
melancholy resolving to defiance. Each faction below inherits ONE of those
DNA elements and mutates the rest to fit their identity.

---

## Global Suno settings

- **Style tag** goes in the "Style of Music" field.
- **Lyrics field**: leave empty (instrumental). If Suno insists, use `[instrumental]`.
- **Duration**: 90–150 s per loopable track. Suno v4 handles 4-min max.
- **Model**: Suno v4 or v4.5 (v3.5 for cheaper drafts).
- **Persona**: set a consistent "Shattered Stars OST" persona so tracks share timbre.
- Every prompt below is one paste-ready block for the Style field.

---

## Menu — the game's face

### `menu_main` — "Shattered Stars Main Theme"
```
cinematic space opera main theme, slow reverent orchestral build, distant lone harmonica motif over sustained strings, deep taiko heartbeat every 4 bars, subtle detuned synth pad drifting like starlight, minor to major modulation at 0:45, no drums until 1:00 then a slow martial snare cadence, wide stereo brass swell at climax, ends unresolved on a suspended chord, 85 BPM, instrumental, no vocals, mixed like a AAA game menu (Halo x StarCraft x Mass Effect Andromeda)
```

---

## Faction — TERRAN HEGEMONY (elite, imperial, disciplined)

Militaristic empire. Think Roman legion in space; Battlestar Galactica colonial
fleet. Brass-forward, martial, stately.

### `heg_tactical`
```
imperial military anthem in a low reverberant hall, staccato french horn ostinato, slow orchestral snare marching cadence, deep timpani rolls on downbeats, ceremonial trumpet fanfare answered by cellos, cold precision, mid-tempo 100 BPM, key of D minor, no percussion under 90 seconds then heavy 4/4 kick enters, sparse crackling comms radio static in the far background, instrumental cinematic score, no vocals
```

### `heg_combat`
```
war-drum siege score, aggressive taiko + military snare polyrhythm, iron-forged brass stabs on the two and four, distorted low strings on ostinato, incoming missile whistle FX, rising chromatic string runs into brass hits, key of D minor, 130 BPM, tight orchestral rock hybrid like Zimmer Man of Steel meets Sabaton, industrial metallic percussion, wide dynamic range, instrumental, no vocals
```

### `heg_boss`
```
capital ship approaches, massive slow dreadnought theme, subharmonic bass drone, ominous 6-note french horn motif repeating, cathedral choir wordless "aaah" pad, thunderous 3-hit taiko phrase every 8 bars, brass and timpani building for 2 minutes without release, in D minor Phrygian, 70 BPM, unrelenting dread, ends on a single detuned piano note, instrumental
```

---

## Faction — FREE CONFEDERATION (balanced, heroic underdogs)

The direct StarCraft-Terran-Theme-1 descendant. Rebels, salvagers, frontier
democracy. Twangy space-western with a beating heart.

### `conf_tactical`
```
lonely space western, mournful harmonica melody over slow finger-picked electric guitar with heavy spring reverb, upright acoustic bass walking a I-vi-IV-V progression, brushed snare on 2 and 4, warm Rhodes electric piano fills, subtle pedal steel guitar swells, campfire under starlight vibe, 92 BPM, A minor, in the exact spirit of StarCraft Terran Theme 1, instrumental cinematic score, no vocals
```

### `conf_combat`
```
heroic underdog battle theme, driving distorted electric guitar power chords, live rock drum kit half-time groove, harmonica leads doubled by lead guitar an octave up, sweeping string section on the chorus, defiant major-key modulation at the halfway mark, hopeful and desperate simultaneously, 128 BPM, A minor to C major, film score meets southern rock like Firefly opening cranked to 11, instrumental
```

### `conf_boss`
```
last stand at the edge of nowhere, slow ballad tempo builds to full orchestral rock climax, solo harmonica opens over sustained pad, joined by pedal steel then strings then live drums then choir, hero-motif restated in triumphant brass at 2:00, catharsis and grief in equal measure, 76 BPM building to 100, A minor to A major final resolution, John Williams-scale emotional arc with a Firefly soul, instrumental
```

---

## Faction — SYNTHETIC COLLECTIVE (swarm, hive-mind AI)

**Rule from the game bible: synthesizers only, no acoustic instruments.**
Chromatic, metrically unstable, alien. Think Blade Runner 2049 x Squarepusher x
Aphex Twin Selected Ambient Works II.

### `syn_tactical`
```
cold data-center ambient, granular resynthesis pads shifting between 5/4 and 7/8, arpeggiated FM synth on a chromatic 12-tone row, subtle sub-bass pulse at 60 BPM half-time, glitching hi-hat clicks on irregular subdivisions, sonar ping every 8 bars, no melody per se but an evolving harmonic cell, key of B (locrian mode implied), Vangelis Blade Runner 2049 meets Autechre Amber, entirely electronic, no acoustic instruments, no vocals, instrumental
```

### `syn_combat`
```
industrial techno swarm assault, relentless 909 kick at 145 BPM, distorted acid 303 bassline mutating chromatically, glitched drum edits on offbeats, atonal FM synth stabs in irregular polyrhythms, digital screaming pad on the drop, mechanical inhuman precision, no melody just pattern, feels like being surrounded by 10000 drones, key implied B Locrian, Perturbator meets Autechre meets Nine Inch Nails Ghosts, entirely synthetic, no vocals
```

### `syn_boss`
```
awakening of a hive intelligence, 8 minutes of built-up dread in 3 minutes, single sub-bass note holds for 30 seconds, then FM bells enter one voice at a time until 32 voices layer into a cluster chord, arrhythmic industrial impacts, choir simulated entirely by granular synthesis (never a real voice), climax is pure white noise wall cut to silence then one chromatic descent, terror and inevitability, entirely synthesized, no drums until final 60 seconds then broken 7/8 kicks, key of B Locrian, instrumental
```

---

## Faction — VOID CORSAIRS (fast raiders, pirates, hit-and-run)

Reckless, brash, dangerous fun. Motörhead in a stolen freighter. High-tempo
driving rock with a mocking grin.

### `cors_tactical`
```
smoky spaceport bar groove, dirty electric bass walking a bluesy line, brushed drum shuffle, muted trumpet lead answered by wah-wah electric guitar, hammond B3 organ chords sneaking in on the chorus, hint of danger under the swagger, 108 BPM, E minor blues scale, feels like Cowboy Bebop Tank meets Firefly cantina, instrumental, no vocals
```

### `cors_combat`
```
high-speed piracy raid, thundering double-kick drums at 165 BPM, downtuned distorted guitar chugging on the low E, screaming lead guitar melody in E Phrygian dominant, bass guitar racing the guitar riff, cowbell on every backbeat, ska-punk horn hits punctuating, defiant rebellious energy, Motorhead meets Reel Big Fish in a knife fight, instrumental
```

### `cors_boss`
```
the flagship raider arrives, mid-tempo doom groove at 90 BPM, sludgy detuned bass, single tolling church bell every 4 bars, gang-vocal wordless "hey" chant every 8 bars (no lyrics, just shouted syllables), tremolo picked guitar tremolando, escalating to full thrash blast beats at the 2:30 mark, closes on the tolling bell alone, E Phrygian, instrumental
```

---

## Faction — ASCENDANT EMPIRE (mystical, heavy shields, cultural)

**Rule from the game bible: non-Western instruments only** (duduk, erhu, oud).
432 Hz tuning. Vast reverb. Minimum notes. Silence is an instrument.

### `asc_tactical`
```
sacred meditative space, solo Armenian duduk playing a slow ornamented melody, distant Chinese erhu answering on long sustained bows, hand-struck frame drum on beats 1 and 3 only, ambient temple bells with 10-second decays, Middle Eastern oud arpeggios in the second half, tuned to 432 Hz, key of D dorian mode, extreme cathedral reverb, 60 BPM feeling like 30, Peter Gabriel Passion meets Hans Zimmer Dune, absolutely no Western orchestral instruments, no rock instruments, instrumental
```

### `asc_combat`
```
prayer of judgment, duduk and erhu leads doubling a defiant melody, deep taiko heartbeat pattern in 6/8, tuned metal singing bowls layered as pad, oud strumming a driving rhythm, throat-singing drone in the low end (no words), rising modal melody in D dorian resolving to D major, sacred wrath, 96 BPM, 432 Hz, no Western instruments, feels like Dune Sardaukar meets Peter Gabriel Rabbit-Proof Fence, instrumental
```

### `asc_boss`
```
the prophecy realized, opens with 30 seconds of silence broken by a single struck singing bowl, duduk enters with an aching melody, erhu joins in canon, throat-singing drone deepens over 90 seconds, hand percussion joins in 7/8, monastery bells cascade at the climax, dissolves back to silence and one final duduk note held forever, D dorian to D lydian, 432 Hz, extreme reverb, no Western orchestral or rock instruments whatsoever, instrumental
```

---

## Cross-faction / narrative

### `void_encounter` — an alien presence
```
approach of the void tide, subsonic drone at 20 Hz slowly rising to 40 Hz over 90 seconds, no melody, no harmony, no rhythm, just texture, occasional 3-note descending Phrygian cell (F-E-Eb) emerging then disappearing like a memory, granular textures resembling whale-song filtered through a broken radio, absence of music is intentional, this is what dread sounds like, key of F Phrygian implied only, no drums, no percussion, ambient horror
```

### `void_nexus_discovery` — the electronic activation signal
```
ancient technology awakens, single sine wave pulse at 440 Hz repeating every 1 second, layers of harmonic partials add one octave at a time each measure, DX7 electric piano bell cluster on the downbeat every 8 bars, no drums until 2:00, then a slow mechanical 4/4 kick at 70 BPM, the 3-note Phrygian void-tide cell (F-E-Eb) restated in metallic timbres, mystery and revelation, key of F Phrygian, ambient electronic
```

### `victory_common` — 20 s sting
```
20 second triumphant sting, brass fanfare in D major, timpani roll into two decisive impacts, choir "aaah" cadence, ends on a sustained major chord with slow fade, instrumental, orchestral
```

### `defeat_common` — 20 s sting
```
20 second lament sting, solo cello descending line in D minor over sustained low strings, one distant tolling bell, ends on unresolved suspended chord, no percussion, instrumental, orchestral
```

---

## Mode-specific overlays

### `arcade_action` — for real-time Skirmish / Dogfight / Epic
```
adrenaline dogfight underscore, driving synthwave 130 BPM, arpeggiated saw synth over gated reverb snare on the two and four, big 80s tom fills every 8 bars, Miami Vice hi-hats, sub-bass Moog pulse, no melody just relentless propulsion, key of C minor, layer over any faction combat theme, instrumental
```

### `tactical_planning` — for turn-based Ace Duel + Continuous planning phase
```
chess match in orbit, cold minimalist piano playing a Steve Reich style phase pattern, sub-bass drone every 16 bars, distant string pad, no drums, no melody progression, tension without release, 65 BPM, key of C minor, Arvo Part meets Trent Reznor The Social Network, instrumental
```

### `survival_ramp` — for roguelite survival waves
```
escalating survival theme, starts sparse with lone electric bass ostinato at 90 BPM, adds one instrument per minute (drums, guitar, brass, choir, synth lead), never quite resolves the tension, every 4 minutes drops back to sparse and restarts the layer stack one degree higher, key stays C minor throughout, orchestral rock hybrid, feels like a system pushing you to your limit, instrumental
```

### `campaign_briefing` — narrative interlude
```
mission briefing under station lights, warm Rhodes electric piano playing a hopeful IV-V-vi-I progression, distant string pad, soft brushed snare, no melody in the first minute then a solo french horn enters with a memorable 8-bar theme in C major, feels like Star Trek TNG Ten Forward, 78 BPM, instrumental
```

---

## Delivery order (recommended for Suno session)

Do these in blocks so Suno's persona/style consistency lands right:

1. `menu_main` — establishes the OST palette
2. All five `<faction>_tactical` back to back — sets faction identities
3. All five `<faction>_combat`
4. All five `<faction>_boss`
5. `void_encounter`, `void_nexus_discovery`
6. `victory_common`, `defeat_common`
7. Mode overlays (`arcade_action`, `tactical_planning`, `survival_ramp`, `campaign_briefing`)

After generating a faction's tactical track, favorite it in Suno and use
"Extend from" or "Style match" on the combat + boss tracks so the family
sounds coherent.

---

## Filename conventions (matches Harmonia track IDs)

Save as `public/assets/audio/music/<id>.mp3`. Existing IDs the game already
references:

- `heg_tactical`, `heg_combat`, `heg_boss`, `heg_victory`, `heg_defeat`
- `conf_tactical`, `conf_combat`, `conf_boss`, `conf_victory`, `conf_defeat`
- `syn_tactical`, `syn_combat`, `syn_boss`, `syn_awakening`
- `cors_tactical`, `cors_combat`, `cors_boss`, `cors_heist`
- `asc_tactical`, `asc_combat`, `asc_boss`, `asc_prophecy`
- `void_encounter`, `void_nexus_discovery`, `void_campaign_credits`

The five `<faction>_victory` and `<faction>_defeat` variants can reuse
`victory_common` / `defeat_common` for v1; regenerate faction-specific
stingers when time permits.
