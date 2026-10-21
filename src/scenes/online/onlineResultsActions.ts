/**
 * onlineResultsActions — the results-screen actions of an online battle:
 * REMATCH casts the relay's rematch vote (label shows who is still deciding)
 * and enters the new match when everyone accepted; MAIN MENU leaves the room.
 */

import Phaser from "phaser";
import { OnlineRematch } from "../../net/battle/OnlineRematch";
import { getOnlineSession } from "../../net/lobby/createOnlineSession";
import type { ResultsActions } from "../../ui/results/ResultsPanel";
import { launchOnlineMatch } from "./launchOnlineMatch";
import { ONLINE_LOBBY_SCENE } from "./onlineExit";

/**
 * @param scene - The finished battle scene.
 * @param playedMatchId - The match whose results are on screen.
 * @returns Actions for the results panel.
 */
export function onlineResultsActions(
  scene: Phaser.Scene,
  playedMatchId: string,
): ResultsActions {
  const session = getOnlineSession(scene.registry);
  const rematch = new OnlineRematch(session, playedMatchId, {
    onNewMatch: () => {
      const match = session.state.match;
      if (match) launchOnlineMatch(scene, match, session.state.localId);
    },
    onFallback: () => scene.scene.start(ONLINE_LOBBY_SCENE),
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => rematch.dispose());
  return {
    onRematch: () => rematch.click(),
    watchRematchLabel: (apply) => rematch.watch((status) => apply(status.label)),
    onMenu: () => {
      session.leaveRoom();
      scene.scene.start("MainMenuScene");
    },
  };
}
