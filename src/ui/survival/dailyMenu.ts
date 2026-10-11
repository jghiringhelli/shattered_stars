/**
 * Survival Daily challenge — setup-screen glue: the DAILY button (on the
 * run-controls row) and the Daily panel (today's fixed run + local best /
 * history) shown in the shared choice overlay.
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import {
  dailyChallengeFor,
  syncDailyResults,
} from "../../systems/survival/DailyChallenge";
import { defaultStore } from "../../systems/survival/KeyValueStore";
import type { RunSummary } from "../../systems/survival/RunHistory";
import type { SurvivalChoicePanel } from "./SurvivalChoicePanel";
import { dailyCards } from "./dailyViewModels";

/** DAILY sits left of SEED on the run-controls row (RunSetupControls). */
const DAILY_BUTTON = { x: 110, y: 545, width: 170, height: 36 } as const;
/** Panel subtitle. */
const DAILY_SUBTITLE =
  "Same seed, faction, flagship and ascension for everyone today. Local best and history.";

/**
 * @param scene - The Survival setup scene.
 * @param onClick - Opens the Daily panel.
 * @returns The button.
 */
export function addDailyButton(
  scene: Phaser.Scene,
  onClick: () => void,
): Phaser.GameObjects.Container {
  return createHoverButton(
    scene,
    DAILY_BUTTON.x,
    DAILY_BUTTON.y,
    {
      width: DAILY_BUTTON.width,
      height: DAILY_BUTTON.height,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "DAILY ⏱",
      font: "600 14px",
    },
    onClick,
  ).setName("dailyButton");
}

/**
 * Show today's challenge: LAUNCH (index 0) starts it; history rows are
 * read-only; the last card closes.
 *
 * @param panel - The setup scene's choice overlay.
 * @param history - Finished runs (the meta profile's history).
 * @param onLaunch - Starts today's run.
 * @param now - The current moment (default: now).
 */
export function openDailyPanel(
  panel: SurvivalChoicePanel,
  history: readonly RunSummary[],
  onLaunch: () => void,
  now: Date = new Date(),
): void {
  const daily = dailyChallengeFor(now);
  const results = syncDailyResults(defaultStore(), history);
  panel.show(
    `Daily challenge · ${daily.key}`,
    dailyCards(daily, results),
    (index) => {
      if (index === 0) onLaunch();
    },
    { subtitle: DAILY_SUBTITLE },
  );
}
