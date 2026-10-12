/**
 * reinforcementLink — what the reinforcement controller reads from (and
 * asks of) the Skirmish scene, and the camera target it hands back while
 * the player's ship is down.
 */

import type { ArcadeShip } from "../arcadeShipFactory";

/** What the controller needs from the scene. */
export interface ReinforcementSceneLink {
  readonly worldSize: number;
  readonly playerFaction: string;
  /** The scene's live ship records (living and destroyed). */
  readonly ships: ReadonlyMap<string, ArcadeShip>;
  /** A scenario decides the match (deploy on its lines, it owns the result). */
  readonly hasScenario: boolean;
  /** Put a new ship into the battle (record, sprite, overlay, AI pilot, player view). */
  readonly adopt: (ship: ArcadeShip) => void;
  /** Called once when the reinforcement rules end the match. */
  readonly onEnd: (victory: boolean) => void;
  /**
   * Online: a pick on the picker becomes a lockstep command (applied on every
   * client in the same tick through `choose`) instead of deploying at once.
   */
  readonly requestPick?: (index: number) => void;
  /** Whether this client shows the player's picker (online: seat 0 only). Default true. */
  readonly showPicker?: boolean;
}

/** Camera target while the player's ship is down. */
export interface CameraFocus {
  readonly x: number;
  readonly y: number;
  readonly control: { readonly speed: number };
}
