/**
 * teamAuras — support auras in a team battle. Auras are faction doctrine:
 * a support ship's aura covers the same-faction ships of its own team only.
 * An enemy of the same faction (mirror match) is never covered, and a
 * teammate of another faction (mixed team) is not either. Resolved by
 * running the shared resolver once per team, so every aura rule (swarm
 * counts included) sees only its own team.
 *
 * Pure.
 */

import { AURA_STACKING } from "../../systems/aura/FactionAuras";
import {
  resolveSupportAuras,
  type ActiveAura,
  type AuraResolution,
  type AuraShip,
} from "../../systems/SupportAura";
import type { Teamed } from "./teams";

/**
 * @param ships - Every ship in play, each with its team.
 * @returns Combined buffs and covered ids of every team.
 */
export function resolveTeamAuras(
  ships: ReadonlyArray<AuraShip & Teamed>,
): AuraResolution {
  const byTeam = new Map<number, (AuraShip & Teamed)[]>();
  for (const ship of ships) {
    const team = byTeam.get(ship.team) ?? [];
    team.push(ship);
    byTeam.set(ship.team, team);
  }
  const buffs = new Map<string, ActiveAura>();
  const coveredShipIds = new Set<string>();
  for (const team of byTeam.values()) {
    const resolution = resolveSupportAuras(team, AURA_STACKING.mixedTeamShare);
    for (const [id, aura] of resolution.buffs) buffs.set(id, aura);
    for (const id of resolution.coveredShipIds) coveredShipIds.add(id);
  }
  return { buffs, coveredShipIds };
}
