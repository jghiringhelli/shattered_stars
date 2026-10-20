/**
 * Mission music cues — the Broadcast click-tone and the three-note Tide motif
 * have their own procedural stinger cues (not the generic "tension" track),
 * and every cue a script asks for resolves in the music catalog.
 */

import { describe, expect, it } from "vitest";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../../src/data/CampaignData";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import type {
  MusicCue,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";
import { campaignStingerTrack } from "../../../src/audio/musicContexts";
import { isCueTrack } from "../../../src/audio/musicCues";

const MISSIONS: readonly CampaignMission[] = [
  ...Object.values(FACTION_CAMPAIGNS),
  COALITION_CAMPAIGN,
].flatMap((campaign) => campaign.missions);

const beatsOf = (mission: CampaignMission): readonly ScriptBeat[] => [
  ...(mission.script ?? []),
  ...(mission.variants ?? []).flatMap((v) => v.script ?? []),
];

/** Every (mission, beat, cue) a script plays. */
const CUE_BEATS = MISSIONS.flatMap((mission) =>
  beatsOf(mission).flatMap((beat) =>
    beat.actions.flatMap((action) =>
      action.do === "music" ? [{ mission, beat, cue: action.cue }] : [],
    ),
  ),
);

const KNOWN_CUES: readonly MusicCue[] = [
  "tactical",
  "combat",
  "boss",
  "victory",
  "tension",
  "broadcast",
  "tide_motif",
];

describe("mission music cues", () => {
  it("only asks for cues the scene can play", () => {
    for (const { cue } of CUE_BEATS) expect(KNOWN_CUES).toContain(cue);
  });

  it("plays the Broadcast with its own click-tone cue, not tension", () => {
    const broadcastBeats = CUE_BEATS.filter(({ beat }) =>
      beat.actions.some((a) => a.do === "banner" && /BROADCAST/i.test(a.title)),
    );
    expect(broadcastBeats.length).toBeGreaterThanOrEqual(3);
    for (const { mission, cue } of broadcastBeats)
      expect([mission.id, cue]).toEqual([mission.id, "broadcast"]);
  });

  it("plays the three falling Tide notes with the Tide motif cue", () => {
    const tideBeats = CUE_BEATS.filter(({ beat }) =>
      beat.actions.some(
        (a) =>
          (a.do === "say" && /three notes/i.test(a.text)) ||
          (a.do === "banner" && /three notes/i.test(a.subtitle)),
      ),
    );
    expect(tideBeats.map(({ mission }) => mission.id).sort()).toEqual(
      expect.arrayContaining(["asc_2_5", "cors_3_5"]),
    );
    for (const { mission, cue } of tideBeats)
      expect([mission.id, cue]).toEqual([mission.id, "tide_motif"]);
  });

  it("maps the stinger cues to procedural catalog tracks", () => {
    for (const cue of ["broadcast", "tide_motif"] as const) {
      const track = campaignStingerTrack(cue);
      expect(track).not.toBeNull();
      expect(isCueTrack(track!)).toBe(true);
    }
  });
});
