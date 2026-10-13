# Ascendant Campaign — "The Prophecy"

POV: **the Templar Kaeth**, carrying **the Dreamer**. Archon Zaelthar and the
Herald. 15 slots, 15 definitions.
Arc: the faithful learn their scripture is a scar, and the Ascension they
prayed for is a sacrifice.

Legend: **KEEP / RETEXT / REWORK**, ⚔ crossover. See the [Hegemony campaign](./hegemony.md#hegemony-campaign--the-iron-fist).

## Act I — The Waking (Days 0–40)

**1 · `asc_1_1` Awakening** — RETEXT
- Trial lane of the Ninth Vigil, veil (ion) + rocks · Day 0 · waypoints race
- Beats: the Broadcast lands mid-trial. The Dreamer's first words ("I see the
  next gate before I reach it") are **her** waking inside Kaeth. The Herald: "A
  sleeper has woken. The Oracles... take note."
- Flags: none.

**2 · `asc_1_2` First Prophecy** — KEEP
- Shrine-lanes · Day 6 · eliminate the mapping drone

**3 · `asc_1_3` Mind Link** — KEEP
- Pylon lane · Day 13 · eliminate + waypoints + stealth bonus (chorus link)

**4 · `asc_1_4` Evolution Path** — RETEXT · Echo E3
- Proving ring · Day 24 · eliminate + named Hunter bonus · unlocks the Oracle
- The named Hunter is **Unit Zero**. Canon: its chassis is destroyed and its
  process persists.
- Flags: (new) `x_zero_rechassised` (bonus kill).

**5 · `asc_1_5` The Convergence** — RETEXT · ⚔ **X3 Cinder Gate**
- Cinder Gate · Day 34 · capture + eliminate + protect squad
- Beats (existing): "Corsairs! Who invited the Corsairs?" New: the Dreamer
  hears a human mind singing back (Kira).
- Flags: reads `x3_shard_taken` (variant: "A raider took a shard of the lock. The Oracles will call it theft. I call it fate.").

## Act II — The Shards (Days 41–120)

**6 · `asc_2_1` Sacred Artifact** — RETEXT · ⚔ **X7 The Fall of Prometheus**
- Prometheus wreck field · Day 90 · salvage shards + eliminate/capture bonus
- Brief: the humans broke the lock (the Nexus). Every shard still sings. Bring them home.
- Flags: sets `x7_shards_saved` (bonus: all shards; unity) · reads `x7_nexus_data` (variant: "The machines took its words. We take its voice.").

**7 · `asc_2_2` Heretic Purge** — REWORK (bonus) · Echo E5
- A Confederation world of Unbound preachers · Day 58 · eliminate + sabotage relay
- New bonus: **"Burn the relay, spare the preachers' ships"** →
  `asc_heretics_spared` (`key_asc_mercy`). Taking it means not destroying the
  fleeing preacher ships.
- Beats (existing): Dreamer: "They pray as we pray. Why did the vision not show me that?"

**8 · `asc_2_3` Vision Quest** — RETEXT
- A broken sun in the Reach, flare + veil · Day 71 · survive + eliminate
- Retext: the "vision" is the Dreamer's **memory of the Shattering**. The flare
  front comes from a star her people broke. "We did this. To stop it."

**9 · `asc_2_4` Temple Defense** — KEEP
- Temple of the Ninth Vigil · Day 96 · defend + Guardians allies
- Flags: sets `asc_temple_intact` (existing; unity).

**10 · `asc_2_5` Machine God** — RETEXT
- Collective choir platform, veil · Day 110 · boss + sabotage choir + Halo allies
- Retext: the platform's song **is the three-note Tide motif**. The machines
  learned it from something. "Prime sings what the Tide sings."
- Flags: sets `asc_choir_silenced`, `asc_halo_lost` (existing).

## Act III — Ascension (Days 121–200)

**11 · `asc_3_1` Crusade Begins** — RETEXT · ⚔ **X11 The Broken Alliance**
- Cinder Gate · Day 158 · eliminate + capture standard · Halo allies
- Brief: Hegemony orders call for the Ascendant to strike the "traitors" at Cinder. The orders are Vance's forgery.
- New bonus: "Hold fire on the parley ship" → `x11_betrayal_averted` (unity).
- Flags: reads `x11_betrayal_averted` (variant: if Hegemony canon averted it,
  the Crusade's first strike hits Vance's loyalists only, and Chen's Iron Fist flies on the flank).

**12 · `asc_3_2` The Dark Vision** — KEEP · ⚔ **X13 The Catalyst**
- Nexus Approach, veil + flare · Day 186 · assassinate the Catalyst + waypoints exit
- Beats (existing): "a machine that opens doors". On failure: "The darkness has a doorway now."
- Flags: sets `x13_catalyst_destroyed` (unity) or `x13_door_opened`.

**13 · `asc_3_3` Alliance of Faith** — RETEXT · ⚔ **X12 The Rendezvous**
- Halden's Reach · Day 171 · escort refugees + eliminate
- Retext: the "faithful organics" are human and Unbound refugees from Vega
  Prime heading for the Coalition rendezvous. The Archon calls them converts.
  The Dreamer calls them people.
- Flags: sets `x12_sanctuary_reached` (unity) · reads `asc_temple_intact` (existing Guardians variant), `x12_rendezvous_denied`.

**14 · `asc_3_4` Final Revelation** — RETEXT
- The Eleven (broken suns), mines + rocks · Day 192 · eliminate + ace + sabotage
- Retext: the machines' "prophets" predict the Tide's arrival to the hour. Prime is counting down. "Their predictions mirror mine."
- Flags: reads `asc_halo_lost` (existing).

**15 · `asc_3_5` Ascension** — REWORK (intent) · ⚔ **X15 The Breach**
- The Vigil fleet at Nexus Approach, flare front · Day 200 · assassinate **the Prophet Ilsandre** (Hollowed) + eliminate + protect squad
- New premise: Ilsandre proclaims the Ascension: open the Reach, "let the Tide
  judge the loud." Every faction's ships nearby are drawn in (existing mixed
  enemies). Zaelthar sides with the Dreamer.
- Beats: when Ilsandre falls, the front breaks through anyway. Dreamer: "The
  light rises behind us" becomes "The dark rises ahead of us. There is only forward."
- Flags: sets `asc_ascension` (existing; now meaning "the false Prophet
  silenced, the Dreamer recognised"), `x15_breach_witnessed_ascendant` · reads
  `asc_halo_lost`, `asc_temple_intact` (existing).

## Epilogue
Change the first line to: "The vision is fulfilled. Not as they preached it. As it was." Keep the flagged lines.
