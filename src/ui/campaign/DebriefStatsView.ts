/**
 * DebriefStatsView — the stats step of the debrief: mission-results and
 * pilot-progression panels side by side, the primary CONTINUE button
 * (disabled until the XP animations finish) and the continue hint.
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { MENU_LAYOUT, addFooterHint } from "../menu/MenuScaffold";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { factionAccent } from "../theme/HoloTheme";
import {
  statsPanelHeight,
  statsPanelTop,
  type DebriefSceneData,
} from "./debriefTypes";
import { createResultsPanel, missionResultItems } from "./DebriefResultsPanel";
import { createPilotProgressPanel } from "./DebriefPilotPanel";

/** Footer hint shown while the player can advance. */
export const CONTINUE_HINT = "CLICK OR SPACE TO CONTINUE";

/** CONTINUE primary button. */
const CONTINUE_BUTTON = { width: 200, height: 48, font: "600 16px" } as const;

/** Built stats view. */
export interface DebriefStatsView {
  readonly objects: Phaser.GameObjects.GameObject[];
  /** CONTINUE button — created disabled. */
  readonly continueButton: HoloPressButton;
  /** Time until every XP animation has settled. */
  readonly animationMs: number;
}

/**
 * Build the debrief stats view.
 *
 * @param scene - Owning scene.
 * @param data - Debrief data.
 * @param onContinue - Invoked when CONTINUE is pressed / activated.
 * @returns Created objects, the CONTINUE button and the animation length.
 */
export function createDebriefStatsView(
  scene: Phaser.Scene,
  data: DebriefSceneData,
  onContinue: () => void,
): DebriefStatsView {
  const accent = factionAccent(data.factionId);
  const results = missionResultItems(data);
  const height = statsPanelHeight(
    results.length,
    data.updatedSave.campaignPilots.length,
  );
  const top = statsPanelTop(height);
  const resultsPanel = createResultsPanel(scene, top, height, accent, results);
  const pilots = createPilotProgressPanel(scene, top, height, accent, data);
  const continueButton = createHoverButton(
    scene,
    scene.scale.width / 2,
    scene.scale.height - MENU_LAYOUT.primaryInset,
    {
      width: CONTINUE_BUTTON.width,
      height: CONTINUE_BUTTON.height,
      color: accent,
      variant: "primary",
      label: "CONTINUE",
      font: CONTINUE_BUTTON.font,
      icon: "next",
    },
    onContinue,
  ).setEnabled(false);
  const hint = addFooterHint(scene, CONTINUE_HINT);
  return {
    objects: [resultsPanel, pilots.panel, continueButton, hint],
    continueButton,
    animationMs: pilots.animationMs,
  };
}
