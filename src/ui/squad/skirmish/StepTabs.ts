/**
 * StepTabs — the Skirmish header strip: three numbered tabs (YOUR SHIP,
 * YOUR WINGMEN, THE ENEMY & BATTLE), each with its one plain-language
 * sentence under it. The open step is the primary button. Sits between BACK
 * and the SQUADS / ADVANCED buttons.
 */

import type Phaser from "phaser";
import { createHoverButton } from "../../ButtonFactory";
import type { HoloPressButton } from "../../menu/HoloPressButton";
import { MENU_LAYOUT } from "../../menu/MenuScaffold";
import { holoFont } from "../../theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../../theme/HoloTheme";
import { toCssColor } from "../../theme/colorMath";
import { SKIRMISH_STEPS, stepText, type SkirmishStep } from "./skirmishModel";

/** Strip geometry (scene coordinates, 1280 wide). */
const TABS = {
  tabH: 30,
  tabCentreY: 27,
  gap: 10,
  /** Width of the SQUADS / ADVANCED column on the right (px). */
  rightColumn: 128,
  sentenceY: 46,
  sentenceFont: 12,
  font: 14,
} as const;

/** Left edge: right of BACK. */
const LEFT = MENU_LAYOUT.margin + MENU_LAYOUT.backWidth + HOLO_SPACING.md;

/** The three step tabs and their sentences. */
export class StepTabs {
  /** The tab buttons in step order (keyboard focus targets). */
  readonly buttons: HoloPressButton[];
  private readonly sentences: Phaser.GameObjects.Text[];

  /**
   * @param scene - The Squad Builder scene.
   * @param active - The open step.
   * @param onSelect - Called when a tab is pressed.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private active: SkirmishStep,
    onSelect: (step: SkirmishStep) => void,
  ) {
    const right = scene.scale.width - MENU_LAYOUT.margin - TABS.rightColumn - HOLO_SPACING.md;
    const count = SKIRMISH_STEPS.length;
    const width = (right - LEFT - TABS.gap * (count - 1)) / count;
    this.buttons = SKIRMISH_STEPS.map((step, index) => {
      const x = LEFT + index * (width + TABS.gap);
      return createHoverButton(
        scene,
        x + width / 2,
        TABS.tabCentreY,
        {
          width,
          height: TABS.tabH,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          label: `${index + 1} \u00b7 ${stepText(step).title}`,
          font: `600 ${TABS.font}px`,
        },
        () => onSelect(step),
      ).setName(`skirmishStep_${step}`);
    });
    this.sentences = SKIRMISH_STEPS.map((step, index) =>
      scene.add
        .text(LEFT + index * (width + TABS.gap) + HOLO_SPACING.xs, TABS.sentenceY, stepText(step).sentence, {
          ...holoFont(TABS.sentenceFont, "400"),
          wordWrap: { width: width - HOLO_SPACING.sm },
        })
        .setName(`skirmishSentence_${step}`),
    );
    this.paint();
  }

  /** @param step - The step to open (restyles the tabs). */
  setActive(step: SkirmishStep): void {
    this.active = step;
    this.paint();
  }

  /** Destroy the tabs and sentences. */
  destroy(): void {
    this.buttons.forEach((button) => button.destroy());
    this.sentences.forEach((text) => text.destroy());
  }

  private paint(): void {
    SKIRMISH_STEPS.forEach((step, index) => {
      const open = step === this.active;
      this.buttons[index]!.setVariant(open ? "primary" : "secondary");
      this.sentences[index]!.setColor(toCssColor(open ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted));
    });
  }
}
