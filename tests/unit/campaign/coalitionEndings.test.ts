/**
 * Coalition endings (docs/lore/campaign_arc.md §6): the choice-screen text and
 * the epilogue lines of the four Act V endings.
 */

import { describe, expect, it } from "vitest";
import {
  ENDING_EPILOGUES,
  ENDING_TEXT,
} from "../../../src/data/campaign/coalitionEpilogues";
import {
  CHRONICLE_FLAGS,
  type EndingId,
} from "../../../src/data/campaign/crossovers";
import { KNOWN_PORTRAITS, WRITTEN } from "./coalitionFixtures";

const ENDINGS: readonly EndingId[] = ["answer", "sever", "seal", "quiet"];

/** The five hero voices every ending must carry one line of. */
const HERO_SPEAKERS = [
  "ADMIRAL CHEN",
  "SANTOS",
  "OMEGA-7",
  "KIRA",
  "THE DREAMER",
];

describe("Coalition endings", () => {
  it.each(ENDINGS.map((e) => [e] as const))(
    "%s has a title, summary and 5-8 epilogue lines",
    (ending) => {
      expect(ENDING_TEXT[ending].title.length).toBeGreaterThan(0);
      expect(ENDING_TEXT[ending].summary.length).toBeGreaterThan(0);
      const lines = ENDING_EPILOGUES[ending];
      expect(lines.length).toBeGreaterThanOrEqual(5);
      expect(lines.length).toBeLessThanOrEqual(8);
    },
  );

  it.each(ENDINGS.map((e) => [e] as const))(
    "%s speaks once for every hero",
    (ending) => {
      const speakers = ENDING_EPILOGUES[ending]
        .filter((l) => !l.when)
        .map((l) => l.speaker);
      for (const hero of HERO_SPEAKERS) expect(speakers, hero).toContain(hero);
    },
  );

  it.each(ENDINGS.map((e) => [e] as const))(
    "%s reads only flags that exist and known portraits",
    (ending) => {
      const lines = ENDING_EPILOGUES[ending];
      expect(lines.some((l) => l.when)).toBe(true);
      for (const line of lines) {
        if (line.when)
          expect(
            CHRONICLE_FLAGS.has(line.when.flag) || WRITTEN.has(line.when.flag),
            line.when.flag,
          ).toBe(true);
        expect(KNOWN_PORTRAITS.has(line.portraitKey), line.portraitKey).toBe(
          true,
        );
      }
    },
  );
});
