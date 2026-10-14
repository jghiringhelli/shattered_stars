/**
 * Survival setup — the saved-run buttons (CONTINUE / ABANDON) and the Star
 * Charts unlock shop. Presentation helpers over the run service; the setup
 * scene decides where they go and what happens next.
 */

import Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { attachTermTooltip } from "../menu/HintTooltip";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { FACTION_NAMES_SHORT } from "../../data/survival/factionNames";
import { META_UNLOCKS } from "../../data/survival/metaUnlocks";
import type { RoguelikeRunService } from "../../systems/survival/RoguelikeRunService";
import { metaUnlockCards } from "./choiceViewModels";
import type { SurvivalChoicePanel } from "./SurvivalChoicePanel";

/** Where the saved-run buttons go and what they do. */
export interface SavedRunButtonsConfig {
  readonly y: number;
  /** Horizontal offset of each button from the screen centre (px). */
  readonly offset: number;
  readonly width: number;
  readonly height: number;
  readonly onContinue: () => void;
  readonly onAbandoned: () => void;
}

/** Depth above the menu chrome. */
const BUTTON_DEPTH = 10;

/**
 * Adds CONTINUE (left) and ABANDON SAVED RUN (right) when a run is saved.
 *
 * @param scene - The setup scene.
 * @param service - The run service (resumes the saved run).
 * @param config - Placement and callbacks.
 * @returns True when a saved run exists.
 */
export function addSavedRunButtons(
  scene: Phaser.Scene,
  service: RoguelikeRunService,
  config: SavedRunButtonsConfig,
): boolean {
  const saved = service.hasSavedRun() ? service.resume() : null;
  if (!saved) return false;
  const centerX = scene.scale.width / 2;
  const style = {
    width: config.width,
    height: config.height,
    font: "600 16px",
  };
  const label = `CONTINUE (S${saved.sector} · ${FACTION_NAMES_SHORT[saved.faction].split(" ").pop()})`;
  const resume = createHoverButton(
    scene,
    centerX - config.offset,
    config.y,
    { ...style, color: HOLO_PALETTE.success, variant: "primary", label },
    config.onContinue,
  ).setDepth(BUTTON_DEPTH);
  attachTermTooltip(scene, resume, "survival.continue_run");
  const abandon = createHoverButton(
    scene,
    centerX + config.offset,
    config.y,
    {
      ...style,
      color: HOLO_PALETTE.danger,
      variant: "danger",
      label: "ABANDON SAVED RUN",
    },
    () => {
      service.abandon();
      config.onAbandoned();
    },
  ).setDepth(BUTTON_DEPTH);
  attachTermTooltip(scene, abandon, "survival.abandon_run");
  return true;
}

/**
 * Opens the Star Charts unlock shop (re-shown after each purchase).
 *
 * @param panel - The choice overlay.
 * @param service - The run service (meta profile).
 * @param onClose - Called when the player closes the shop.
 */
export function showUnlockShop(
  panel: SurvivalChoicePanel,
  service: RoguelikeRunService,
  onClose: () => void,
): void {
  const meta = service.meta;
  panel.show(
    "Unlocks",
    metaUnlockCards(meta),
    (i) => {
      const unlock = META_UNLOCKS[i];
      if (!unlock) {
        onClose();
        return;
      }
      service.buyUnlock(unlock.id);
      showUnlockShop(panel, service, onClose);
    },
    {
      subtitle: `Star Charts: ${meta.charts} ★ — earned at the end of every run, win or lose.`,
    },
  );
}
