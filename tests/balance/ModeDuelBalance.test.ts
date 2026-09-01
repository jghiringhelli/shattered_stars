/**
 * Mode Duel Balance — safety net for the shared combat model behind the modes
 * that otherwise only have smoke e2e coverage: Dogfight (arcade combat model) and
 * Continuous Tactical / Epic (continuous combat model).
 *
 * These modes don't build squads through the balance harness, so their raw duels
 * were untested. This suite exercises the combat model directly, with a FIXED
 * seed, for representative ships across every faction/role and asserts:
 *  - mirror fairness: identical squads on both sides split ~50/50 once positional
 *    bias is cancelled (no intrinsic first/second-mover advantage),
 *  - decisiveness: 1v1 duels actually resolve (low draw rate),
 *  - determinism: same seed → identical outcome.
 *
 * Both the arcade and continuous combat models are checked so a regression in
 * either mode's ModeBalancing stats is caught.
 */

import { describe, it, expect } from "vitest";
import {
  runDuel,
  MIRROR_FAIRNESS_MARGIN,
  MAX_DRAW_RATE,
  type DuelMode,
} from "../../src/simulation/DuelBalance";

const BATTLES = 120;
const SEED = 20260316;

/** Representative single ships spanning factions and roles (light → capital). */
const MIRROR_SHIPS: readonly string[] = [
  "terran_raptor",
  "terran_viper",
  "confed_falcon",
  "confed_hawk",
  "corsair_fang",
  "corsair_marauder",
  "synth_devastator",
  "ascendant_bastion",
] as const;

const MODES: readonly DuelMode[] = ["arcade", "continuous"] as const;

/**
 * Capital ships are intentionally boss-tier (tripled hull/shields + flat
 * armor damage reduction) so a lone capital survives a swarm — a mirror duel
 * between two identical capitals legitimately needs far more turns to
 * resolve than a fighter mirror. Verified: 100 turns never resolves,
 * 300 always does (see chat/session history for the probe).
 */
const MAX_TURNS_OVERRIDE: Readonly<Record<string, number>> = {
  ascendant_bastion: 300,
};

describe.each(MODES)("Combat model in '%s' mode", (mode) => {
  describe.each(MIRROR_SHIPS)("mirror duel: %s", (shipId) => {
    const outcome = runDuel([shipId], [shipId], {
      mode,
      battles: BATTLES,
      seed: SEED,
      maxTurns: MAX_TURNS_OVERRIDE[shipId] ?? 100,
    });

    it("splits close to 50/50 (no mover advantage)", () => {
      expect(outcome.side1DecisiveShare).toBeGreaterThanOrEqual(
        0.5 - MIRROR_FAIRNESS_MARGIN,
      );
      expect(outcome.side1DecisiveShare).toBeLessThanOrEqual(
        0.5 + MIRROR_FAIRNESS_MARGIN,
      );
    });

    it("resolves decisively (low draw rate)", () => {
      expect(outcome.drawRate).toBeLessThanOrEqual(MAX_DRAW_RATE);
    });
  });

  it("is deterministic for a fixed seed", () => {
    const opts = { mode, battles: BATTLES, seed: SEED } as const;
    const first = runDuel(["terran_raptor"], ["confed_falcon"], opts);
    const second = runDuel(["terran_raptor"], ["confed_falcon"], opts);
    expect(second).toEqual(first);
  });
});
