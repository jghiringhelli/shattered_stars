/**
 * DUEL_CODEX_TERMS - tooltip terms of: Dogfight / Ace Duel / Epic / Boss Raid / reserve editor setup screens and the encyclopedia. Pure data.
 */

import { CODEX_TERMS } from "./codexTerms";
import { DUEL_TERMS } from "./duelTerms";
import { RAID_TERMS } from "./raidTerms";
import { RESERVE_TERMS } from "./reserveTerms";
import type { term } from "./termTypes";

/** Terms owned by this feature area (add entries in the per-area files). */
export const DUEL_CODEX_TERMS = {
  ...DUEL_TERMS,
  ...RAID_TERMS,
  ...RESERVE_TERMS,
  ...CODEX_TERMS,
} as const satisfies Record<string, ReturnType<typeof term>>;
