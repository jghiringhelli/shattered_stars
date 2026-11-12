/**
 * battleRoute — where the Squad Builder sends the player once the battle is
 * configured: the battle scene of the mode, Survival with the player's
 * faction, or the online lobby with the player's squad.
 */

import type Phaser from "phaser";
import type { GameMode, SquadEntry } from "../../core/squadTypes";

/**
 * @param scene - The Squad Builder scene (starts the next scene and holds the registry).
 * @param mode - The game mode.
 * @param squads - The configured squads.
 * @param pointLimit - Points per side (online lobby).
 */
export function startBattleScene(
  scene: Phaser.Scene,
  mode: GameMode,
  squads: readonly SquadEntry[],
  pointLimit: number,
): void {
  const player = squads.find((s) => s.controller === "player");
  if (mode === "epic" || mode === "arcade") {
    scene.scene.start("ArcadeBattleScene");
  } else if (mode === "survival") {
    scene.scene.start("SurvivalScene", { factionId: player?.factionId ?? "free_confederation" });
  } else if (mode === "online") {
    scene.registry.set("onlineSquad", player?.ships ?? []);
    scene.registry.set("onlineFaction", player?.factionId ?? "free_confederation");
    scene.registry.set("onlinePointLimit", pointLimit);
    scene.scene.start("LobbyScene");
  } else {
    scene.scene.start("ContinuousTacticalScene");
  }
}
