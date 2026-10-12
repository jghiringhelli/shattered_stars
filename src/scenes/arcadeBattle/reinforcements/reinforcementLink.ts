/**
 * reinforcementLink — what the reinforcement controller reads from (and
 * asks of) the Skirmish scene, and the camera target it hands back while
 * the local pilot's ship is down. Sides are teams; squads are the battle
 * config's squads (index); human squads each have their own picker.
 */

import type { TeamId } from "../../../arcade/teams";
import type { ArcadeShip } from "../arcadeShipFactory";

/** What the controller needs from the scene. */
export interface ReinforcementSceneLink {
  readonly worldSize: number;
  /** The simulation's "player" team (offline: the player's; online: seat 0's). */
  readonly playerTeam: TeamId;
  /** Every battle-config squad's team (index = squad). */
  readonly squadTeams: readonly TeamId[];
  /** Human squads → the ship their human flies at the start. */
  readonly humanSquads: ReadonlyMap<number, string>;
  /** The squad whose pilot is the simulation's `player` (offline: the player's; online: seat 0's). */
  readonly primarySquad: number;
  /** The squad this client flies (its picker, camera, YOU rows), or null. */
  readonly localSquad: number | null;
  /** The scene's live ship records (living and destroyed). */
  readonly ships: ReadonlyMap<string, ArcadeShip>;
  /** A scenario decides the match (deploy on its lines, it owns the result). */
  readonly hasScenario: boolean;
  /**
   * Put a new ship into the battle (record, sprite, overlay, AI pilot).
   * @param ship - The new ship.
   * @param pilotSquad - The human squad whose human flies it from now on, or null.
   */
  readonly adopt: (ship: ArcadeShip, pilotSquad: number | null) => void;
  /** Called once when the reinforcement rules end the match. */
  readonly onEnd: (victory: boolean) => void;
  /**
   * Online: a pick on the local picker becomes a lockstep command (applied
   * on every client in the same tick through `choose` for the seat's squad)
   * instead of deploying at once.
   */
  readonly requestPick?: (index: number) => void;
}

/** Camera target while the local pilot's ship is down. */
export interface CameraFocus {
  readonly x: number;
  readonly y: number;
  readonly control: { readonly speed: number };
}
