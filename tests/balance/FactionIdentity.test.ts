/**
 * Faction identity — each faction excels at its specialty
 * (docs/specs/factions.md, src/data/factionIdentity.ts) and its squads
 * actually fly it. Gate on the real engine (skill arena, average pilots,
 * fixed seeds, both seats): every faction's 200-point squad flown without
 * its identity levers (aura, identity cards, ace abilities —
 * src/simulation/identityAblation.ts) against the other four loses at
 * least IDENTITY_MARGIN win points versus the same squad with them.
 * `npm run balance:report` measures the margins with 320 games per side.
 */

import { describe, it, expect } from "vitest";
import {
  BALANCE_FACTIONS,
  skirmishAutoFillList,
  type SquadList,
} from "../../src/simulation/balance/squadLists";
import { classicPair } from "../../src/simulation/balance/factionMatrix";
import {
  addTallies,
  EMPTY_TALLY,
  shareInterval,
  type WinTally,
} from "../../src/simulation/balance/balanceStats";
import { identityUsage } from "../../src/simulation/identityAblation";
import { seedRange } from "../../src/simulation/skill";
import type { FactionId } from "../../src/config";

/** Seeds per pairing (each played from both seats). */
const SEEDS = seedRange(6, 9100);
/** Win points the identity must be worth to its faction. */
const IDENTITY_MARGIN = 0.08;

function seriesAgainstField(list: SquadList, faction: FactionId): WinTally {
  return BALANCE_FACTIONS.filter((other) => other !== faction).reduce(
    (tally, other) =>
      addTallies(
        tally,
        classicPair(list, skirmishAutoFillList(other), SEEDS).tally,
      ),
    EMPTY_TALLY,
  );
}

describe("each faction's squad flies its identity", () => {
  it.each(BALANCE_FACTIONS)(
    "%s's 200-point squad carries identity cards or aces",
    (faction) => {
      const usage = identityUsage(skirmishAutoFillList(faction).ships);
      expect(usage.identityShips).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(BALANCE_FACTIONS)(
    "%s's 200-point squad projects its faction aura",
    (faction) => {
      const usage = identityUsage(skirmishAutoFillList(faction).ships);
      expect(usage.auraProjectors).toBeGreaterThanOrEqual(1);
    },
  );
});

describe("each faction's identity is worth a clear margin (classic squads)", () => {
  const margins = new Map<FactionId, number>();
  it("plays every faction with and without its identity", () => {
    for (const faction of BALANCE_FACTIONS) {
      const list = skirmishAutoFillList(faction);
      const full = shareInterval(seriesAgainstField(list, faction)).share;
      const stripped = shareInterval(
        seriesAgainstField({ ...list, withoutIdentity: true }, faction),
      ).share;
      margins.set(faction, full - stripped);
    }
    expect(margins.size).toBe(BALANCE_FACTIONS.length);
  }, 600_000);

  it.each(BALANCE_FACTIONS)(
    "%s loses its edge without its identity",
    (faction) => {
      expect(margins.get(faction)).toBeGreaterThanOrEqual(IDENTITY_MARGIN);
    },
  );
});
