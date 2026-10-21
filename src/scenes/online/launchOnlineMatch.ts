/**
 * launchOnlineMatch — enters the battle scene of the match the relay just
 * started. Shared by the lobby and by the results screens (rematch), so a
 * rematch starts exactly like a first match.
 */

import type Phaser from "phaser";
import {
  buildOnlineBattleConfig,
  buildOnlineDogfightInit,
  localSeatOf,
} from "../../net/lobby/matchSetup";
import type { MatchStart } from "../../net/protocol";

/**
 * @param scene - Any running scene (the lobby or the finished battle).
 * @param match - The match as the relay started it.
 * @param localId - This player's id (picks the local seat).
 */
export function launchOnlineMatch(
  scene: Phaser.Scene,
  match: MatchStart,
  localId: string,
): void {
  const localSeat = localSeatOf(match, localId);
  if (match.mode === "dogfight") {
    scene.scene.start("DogfightScene", buildOnlineDogfightInit(match, localSeat));
    return;
  }
  scene.registry.set("battleConfig", buildOnlineBattleConfig(match, localSeat));
  scene.scene.start("ArcadeBattleScene");
}
