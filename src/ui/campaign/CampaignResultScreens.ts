/**
 * CampaignResultScreens — the battle's end-of-mission overlays: the
 * MISSION COMPLETE beat before the debrief (panel fades in, holds, camera
 * fades out) and the MISSION FAILED panel with the reason and RETRY / QUIT.
 */

import type Phaser from "phaser";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import {
  showResultOverlay,
  type ResultLine,
  type ResultOverlay,
} from "../modeHud/HoloResultOverlay";

/** Victory panel fade-in, hold, then camera fade-out before the debrief (ms). */
const RESULT_FADE_IN_MS = 400;
const VICTORY_HOLD_MS = 1600;
const CAMERA_FADE_MS = 400;

/** Kills and losses shown on both panels. */
export interface MissionTally {
  readonly kills: number;
  readonly shipsLost: number;
}

/**
 * @param tally - Kills and losses.
 * @returns Their result lines.
 */
function tallyLines(tally: MissionTally): ResultLine[] {
  return [
    { text: `Enemies destroyed: ${tally.kills}` },
    { text: `Ships lost: ${tally.shipsLost}` },
  ];
}

/**
 * Victory beat: a MISSION COMPLETE panel fades in, holds, then the camera
 * fades out and `onComplete` runs.
 *
 * @param scene - Battle scene.
 * @param title - Mission title.
 * @param tally - Kills and losses.
 * @param onComplete - Called once the fade finishes.
 * @returns The overlay.
 */
export function showCampaignVictoryFlash(
  scene: Phaser.Scene,
  title: string,
  tally: MissionTally,
  onComplete: () => void,
): ResultOverlay {
  const overlay = showResultOverlay(scene, {
    header: title,
    title: "MISSION COMPLETE",
    accent: HOLO_PALETTE.success,
    lines: tallyLines(tally),
    actions: [],
  });
  overlay.panel.setAlpha(0);
  scene.tweens.add({
    targets: overlay.panel,
    alpha: 1,
    duration: RESULT_FADE_IN_MS,
    onComplete: () => {
      scene.time.delayedCall(VICTORY_HOLD_MS, () => {
        scene.cameras.main.fade(
          CAMERA_FADE_MS,
          0,
          0,
          0,
          false,
          (_cam: unknown, progress: number) => {
            if (progress === 1) onComplete();
          },
        );
      });
    },
  });
  return overlay;
}

/** What the failure panel shows and offers. */
export interface FailureScreen {
  readonly title: string;
  readonly reason: string;
  readonly tally: MissionTally;
  readonly onRetry: () => void;
  readonly onQuit: () => void;
}

/**
 * MISSION FAILED panel (RETRY / QUIT). Callers reset the camera zoom first —
 * the buttons are scrollFactor(0) and Phaser mis-hit-tests them under zoom.
 *
 * @param scene - Battle scene.
 * @param screen - Title, reason, tally and actions.
 * @returns The overlay.
 */
export function showCampaignFailure(
  scene: Phaser.Scene,
  screen: FailureScreen,
): ResultOverlay {
  return showResultOverlay(scene, {
    header: screen.title,
    title: "MISSION FAILED",
    accent: HOLO_PALETTE.danger,
    lines: [
      { text: screen.reason, role: "heading", color: HOLO_PALETTE.danger },
      ...tallyLines(screen.tally),
      {
        text: "Try different tactics, mods or research",
        color: HOLO_PALETTE.textMuted,
      },
    ],
    actions: [
      { label: "Retry", variant: "primary", onClick: screen.onRetry },
      { label: "Quit", variant: "secondary", onClick: screen.onQuit },
    ],
  });
}
