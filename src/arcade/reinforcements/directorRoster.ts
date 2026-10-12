/**
 * directorRoster — lookups and pure deployment steps over a reinforced
 * match's team sides: which team a squad flies for, a squad's state, the
 * human squads (the player's team first), and a deployment booked into a
 * team (pool spent, field joined, arrival numbered).
 *
 * Pure.
 */

import { deployShip } from "./poolLedger";
import { ReinforcementError } from "./reinforcementErrors";
import { playerSideFirst, withMember, type SideState } from "./directorSides";
import type { MemberState } from "./directorMembers";
import { takeReserve, type PickerOption } from "./reserveQueue";
import type { DeployOption } from "./reinforcementTypes";
import type { DeployPilot, Deployment } from "./directorTypes";

/** Every team side, by side key. */
export type SideMap = ReadonlyMap<string, SideState>;

/**
 * @param sides - Every team.
 * @param key - A team's side key.
 * @returns Its state.
 * @throws ReinforcementError for an unknown side.
 */
export function sideByKey(sides: SideMap, key: string): SideState {
  const side = sides.get(key);
  if (!side) throw new ReinforcementError("side", `unknown side ${key}`);
  return side;
}

/**
 * @param sides - Every team.
 * @param member - A squad.
 * @returns The team it flies for.
 * @throws ReinforcementError for an unknown squad.
 */
export function sideOfMember(sides: SideMap, member: string): SideState {
  for (const side of sides.values())
    if (side.members.some((m) => m.key === member)) return side;
  throw new ReinforcementError("side", `unknown squad ${member}`);
}

/**
 * @param sides - Every team.
 * @param key - A squad.
 * @returns Its state.
 */
export function memberOf(sides: SideMap, key: string): MemberState {
  return sideOfMember(sides, key).members.find((m) => m.key === key)!;
}

/**
 * @param sides - Every team.
 * @returns Every human squad's key, the player's team first.
 */
export function humanMembersOf(sides: SideMap): string[] {
  return playerSideFirst(sides.values()).flatMap((side) =>
    side.members.filter((m) => m.human).map((m) => m.key),
  );
}

/** A ship to book into its team. */
export interface Booking {
  readonly member: string;
  readonly shipId: string;
  readonly option: DeployOption;
  readonly pilot: DeployPilot;
}

/**
 * @param side - The squad's team.
 * @param booking - Squad, new ship id, what it is and who flies it.
 * @returns The team with the ship deployed, and the deployment to spawn.
 */
export function bookDeployment(
  side: SideState,
  booking: Booking,
): { readonly side: SideState; readonly deployment: Deployment } {
  const faction = side.members.find((m) => m.key === booking.member)!.faction;
  return {
    side: {
      ...side,
      ledger: deployShip(side.ledger, booking.shipId, booking.option),
      arrivals: side.arrivals + 1,
    },
    deployment: { ...booking, side: side.key, faction, slot: side.arrivals },
  };
}

/**
 * A human's pick (or the picker's default) deploys: the reserve advances
 * when the row came from it, the human flies the new ship, the picker closes.
 *
 * @param side - The human's team.
 * @param member - The human's squad.
 * @param row - The picked row.
 * @param shipId - The new ship's id.
 * @returns The team and the deployment.
 */
export function bookPick(
  side: SideState,
  member: string,
  row: PickerOption,
  shipId: string,
): { readonly side: SideState; readonly deployment: Deployment } {
  const index = row.reserveIndex;
  const picked = withMember(side, member, (m) => ({
    ...m,
    reserve: index === null ? m.reserve : takeReserve(m.reserve, index),
    pilotId: shipId,
    pickerMs: null,
  }));
  return bookDeployment(picked, {
    member,
    shipId,
    option: row.option,
    pilot: "player",
  });
}
