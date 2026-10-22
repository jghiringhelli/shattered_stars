/**
 * schoolWeaponsLink — what the secondary-weapons runtime reads from (and
 * asks of) the Flight School range: every ship but the beacon is a body, the
 * trainee's target is the HUD target, hits go through the scene's damage path.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { playerTargetId } from "../duel/duelHudSnapshot";
import type { BattleWeaponsLink, WeaponHit } from "../battleUi/BattleWeapons";
import { weaponBodyOf } from "../battleUi/sceneWeapons";
import type { SchoolField } from "./SchoolField";
import type { SchoolShip } from "./schoolShips";

/**
 * @param field - The ships on the range.
 * @param applyHit - The scene's damage path for a weapon hit.
 * @returns The link the weapons runtime is built on.
 */
export function schoolWeaponsLink(
  field: SchoolField,
  applyHit: (hit: WeaponHit) => void,
): BattleWeaponsLink {
  return {
    bodies: () =>
      [...field.ships.values()]
        .filter((ship) => ship.role !== "beacon")
        .map((ship) => weaponBodyOf(ship, ship.owner, 1)),
    wantedTargetOf: (shipId: string) =>
      shipId === field.player.id
        ? playerTargetId({
            ships: field.ships.values(),
            playerId: shipId,
            isAlly: (s: SchoolShip) => s.owner === "player",
            worldSize: BATTLEFIELD_SIZE,
          })
        : (field.crew?.targetOf(shipId) ?? null),
    playerShipId: () => field.player.id,
    playerSide: () => "player",
    sideOf: (shipId: string) => field.ships.get(shipId)?.owner ?? null,
    applyHit,
  };
}
