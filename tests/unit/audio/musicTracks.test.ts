/**
 * Spec: music track catalog + track resolution.
 *
 * Menus play the Suno main theme (setup/submenus the Deep Space ambience);
 * faction hubs play the faction theme; battles pick by mode (skirmish
 * rotation, dogfight, boss, hazard) with the ACE-Step Synthetic/Ascendant
 * tracks carrying their factions' skirmishes. Nothing resolves to a file that
 * is not shipped (that 404s in production) and stingers do not loop.
 */

import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  MENU_MUSIC_TRACK,
  RECORDED_MUSIC_TRACKS,
  SUBMENU_MUSIC_TRACK,
  TRACK_ALIASES,
  battleMusicTrack,
  factionMusicTrack,
  isOneShotTrack,
  isRecordedTrack,
  musicFileUrl,
  pickMusicFormat,
  resolveMusicTrack,
  type MusicTrack,
} from "../../../src/audio/musicTracks";
import type { FactionId } from "../../../src/config";

const recorded = (track: MusicTrack): boolean =>
  isRecordedTrack(resolveMusicTrack(track));

describe("menu music", () => {
  it("plays the recorded main theme on the main menu", () => {
    expect(MENU_MUSIC_TRACK).toBe("menu_main");
    expect(isRecordedTrack(MENU_MUSIC_TRACK)).toBe(true);
  });

  it("plays the Deep Space ambience on setup screens and submenus", () => {
    expect(SUBMENU_MUSIC_TRACK).toBe("menu_ambient");
    expect(isRecordedTrack(SUBMENU_MUSIC_TRACK)).toBe(true);
  });

  it("routes the legacy menu_theme id to the main theme", () => {
    expect(resolveMusicTrack("menu_theme")).toBe("menu_main");
  });
});

describe("faction themes (campaign hub / faction tactical)", () => {
  it.each<[FactionId, MusicTrack]>([
    ["terran_hegemony", "heg_tactical"],
    ["void_corsairs", "cors_tactical"],
    ["synthetic_collective", "syn_tactical"],
    ["ascendant_empire", "asc_tactical"],
  ])("%s plays its own recorded theme", (faction, track) => {
    expect(factionMusicTrack(faction, "tactical")).toBe(track);
    expect(isRecordedTrack(track)).toBe(true);
  });

  it("gives the Confederation the hopeful Long Haul travel theme", () => {
    expect(
      resolveMusicTrack(factionMusicTrack("free_confederation", "tactical")),
    ).toBe("long_haul");
  });

  it("falls back to Long Haul for factions without a theme", () => {
    expect(factionMusicTrack("nexus_remnant" as FactionId, "tactical")).toBe(
      "long_haul",
    );
  });
});

describe("battle music by mode", () => {
  it("plays Dogfight Vector in dogfights and ace duels", () => {
    expect(battleMusicTrack("dogfight", "terran_hegemony", 0)).toBe(
      "dogfight_combat",
    );
    expect(battleMusicTrack("dogfight", "synthetic_collective", 0)).toBe(
      "dogfight_combat",
    );
  });

  it("plays Dreadnought in boss fights for every faction", () => {
    expect(battleMusicTrack("boss", "free_confederation", 0)).toBe(
      "boss_dreadnought",
    );
    expect(battleMusicTrack("boss", "ascendant_empire", 0)).toBe(
      "boss_dreadnought",
    );
  });

  it("plays Threading the Belt in hazard / asteroid battles", () => {
    expect(battleMusicTrack("hazard", "void_corsairs", 0)).toBe(
      "asteroid_belt",
    );
  });

  it("rotates the two Combat Skirmish takes across skirmishes", () => {
    expect(battleMusicTrack("skirmish", "terran_hegemony", 0)).toBe(
      "skirmish_combat_a",
    );
    expect(battleMusicTrack("skirmish", "terran_hegemony", 1)).toBe(
      "skirmish_combat_b",
    );
    expect(battleMusicTrack("skirmish", "free_confederation", 2)).toBe(
      "skirmish_combat_a",
    );
  });

  it.each<[FactionId, MusicTrack]>([
    ["synthetic_collective", "syn_combat"],
    ["ascendant_empire", "asc_combat"],
  ])("%s skirmishes carry the faction's own combat track", (faction, track) => {
    expect(battleMusicTrack("skirmish", faction, 1)).toBe(track);
  });

  it("maps the legacy phase API onto the mode tracks", () => {
    expect(factionMusicTrack("void_corsairs", "combat")).toBe(
      "skirmish_combat_a",
    );
    expect(factionMusicTrack("terran_hegemony", "boss")).toBe(
      "boss_dreadnought",
    );
  });
});

describe("stingers", () => {
  it("routes every victory / defeat id to the shared stingers", () => {
    for (const id of [
      "heg_victory",
      "conf_victory",
      "victory_sting",
    ] as const) {
      expect(resolveMusicTrack(id)).toBe("victory_common");
    }
    for (const id of ["heg_defeat", "conf_defeat", "defeat_sting"] as const) {
      expect(resolveMusicTrack(id)).toBe("defeat_common");
    }
  });

  it("plays stingers once and loops everything else", () => {
    expect(isOneShotTrack("victory_common")).toBe(true);
    expect(isOneShotTrack("defeat_common")).toBe(true);
    expect(isOneShotTrack("menu_main")).toBe(false);
    expect(isOneShotTrack("tension_alert")).toBe(false);
  });
});

describe("recorded catalog", () => {
  it("never aliases to a track that is not shipped", () => {
    for (const target of Object.values(TRACK_ALIASES)) {
      expect(isRecordedTrack(target!), target).toBe(true);
    }
  });

  it("keeps procedural-only ids off the network", () => {
    expect(recorded("combat_high")).toBe(false);
    expect(recorded("void_encounter")).toBe(false);
  });

  it.each([...RECORDED_MUSIC_TRACKS])(
    "ships %s as both .ogg and .mp3 under public/",
    (track) => {
      for (const format of ["ogg", "mp3"] as const) {
        const file = resolve("public", musicFileUrl(track, format));
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(0);
      }
    },
  );
});

describe("format selection", () => {
  it("prefers Ogg Vorbis when the browser can decode it", () => {
    const probe = (mime: string): string =>
      mime.startsWith("audio/ogg") ? "probably" : "maybe";
    expect(pickMusicFormat(probe)).toBe("ogg");
  });

  it("falls back to mp3 when Ogg Vorbis is unsupported", () => {
    const probe = (mime: string): string =>
      mime.startsWith("audio/ogg") ? "" : "maybe";
    expect(pickMusicFormat(probe)).toBe("mp3");
  });

  it("builds a relative URL under assets/audio/music", () => {
    expect(musicFileUrl("menu_main", "ogg")).toBe(
      "assets/audio/music/menu_main.ogg",
    );
  });
});
