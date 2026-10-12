/**
 * onlineExit — leaving an online battle: PAUSE asks to confirm (the match
 * keeps running underneath — nobody can pause a shared battle), then the
 * seat goes to the AI and the player returns to the room.
 */

import type Phaser from "phaser";
import { showConfirmDialog } from "../../ui/ConfirmDialog";
import type { OnlineBattleLink } from "../../net/battle/OnlineBattleLink";

/** The lobby scene a finished or abandoned online battle returns to. */
export const ONLINE_LOBBY_SCENE = "LobbyScene";

/** Scene hooks around the dialog (the camera must sit at zoom 1 while it shows). */
export interface LeaveDialogHooks {
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

/**
 * PAUSE during an online battle: confirm, then leave for the room.
 *
 * @param scene - The battle scene.
 * @param link - The battle's online link.
 * @param hooks - Called when the dialog opens and when it is dismissed.
 */
export function confirmLeaveOnlineBattle(
  scene: Phaser.Scene,
  link: OnlineBattleLink,
  hooks: LeaveDialogHooks,
): void {
  hooks.onOpen();
  showConfirmDialog({
    scene,
    message: "Leave the match? The AI flies your ship for the others.",
    confirmLabel: "LEAVE",
    cancelLabel: "STAY",
    onConfirm: () => {
      link.leave();
      scene.scene.start(ONLINE_LOBBY_SCENE);
    },
    onCancel: hooks.onClose,
  });
}
