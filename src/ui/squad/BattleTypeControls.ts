/**
 * BattleTypeControls — the Squad Builder's reinforcement controls on the
 * header row, left of the title (Skirmish, Epic, Scenario): a BATTLE toggle
 * (Reinforcements ⇄ Classic), an EDIT RESERVE button that opens the reserve
 * editor, and a short caption with the pool and field cap.
 */

import type Phaser from "phaser";
import {
  rulesFor,
  type ReinforcementFormat,
  type ReinforcementPrefs,
} from "../../arcade/reinforcements";
import { createHoverButton } from "../ButtonFactory";
import { attachHintTooltip, attachTermTooltip } from "../menu/HintTooltip";
import { contentFromTerm } from "../menu/tooltipContent";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";

/** Geometry: right of BACK, clear of the centred title. */
const CONTROLS = {
  battleWidth: 176,
  reserveWidth: 112,
  height: 30,
  font: 11,
} as const;

/** What the controls read and change. */
export interface BattleTypeHost {
  readonly prefs: () => ReinforcementPrefs;
  readonly setPrefs: (prefs: ReinforcementPrefs) => void;
  /** The reinforcement format of the current mode, or null (no reinforcements). */
  readonly format: () => ReinforcementFormat | null;
  readonly openEditor: () => void;
}

/**
 * @param prefs - Saved setup.
 * @returns The BATTLE button's label.
 */
export function battleTypeLabel(prefs: ReinforcementPrefs): string {
  return prefs.battle === "reinforcements"
    ? "BATTLE: REINFORCEMENTS"
    : "BATTLE: CLASSIC";
}

/**
 * @param prefs - Saved setup.
 * @param format - The battle's format.
 * @returns The caption under the buttons.
 */
export function battleTypeCaption(
  prefs: ReinforcementPrefs,
  format: ReinforcementFormat,
): string {
  if (prefs.battle === "classic") return "ONE SQUAD, NO REPLACEMENTS";
  const rules = rulesFor(format);
  return `POOL ${rules.poolPoints} · CAP ${rules.fieldCapPoints}`;
}

export class BattleTypeControls {
  readonly battleButton: HoloPressButton;
  readonly reserveButton: HoloPressButton;
  private readonly caption: Phaser.GameObjects.Text;

  /**
   * @param scene - The Squad Builder scene.
   * @param host - Prefs access and the editor opener.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly host: BattleTypeHost,
  ) {
    const left = MENU_LAYOUT.margin + MENU_LAYOUT.backWidth + HOLO_SPACING.md;
    const button = (x: number, width: number, onClick: () => void) =>
      createHoverButton(
        scene,
        x,
        MENU_LAYOUT.titleY,
        {
          width,
          height: CONTROLS.height,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          label: "",
          font: `600 ${CONTROLS.font}px`,
        },
        onClick,
      );
    this.battleButton = button(
      left + CONTROLS.battleWidth / 2,
      CONTROLS.battleWidth,
      () => this.toggle(),
    );
    this.reserveButton = button(
      left + CONTROLS.battleWidth + HOLO_SPACING.sm + CONTROLS.reserveWidth / 2,
      CONTROLS.reserveWidth,
      () => this.host.openEditor(),
    );
    attachHintTooltip(scene, this.battleButton, () =>
      contentFromTerm(
        this.host.prefs().battle === "classic"
          ? "battle.classic"
          : "battle.reinforcements",
      ),
    );
    attachTermTooltip(scene, this.reserveButton, "battle.reserve");
    this.caption = createHoloText(
      scene,
      left,
      MENU_LAYOUT.subtitleY,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0, 0.5);
    this.caption.setInteractive();
    attachHintTooltip(scene, this.caption, () =>
      contentFromTerm(
        this.host.prefs().battle === "classic" ? "battle.classic" : "battle.pool",
      ),
    );
    this.refresh();
  }

  /** Re-read the prefs and the mode: labels, caption, visibility. */
  refresh(): void {
    const format = this.host.format();
    const prefs = this.host.prefs();
    const visible = format !== null;
    this.battleButton.setVisible(visible);
    this.reserveButton.setVisible(visible);
    this.caption.setVisible(visible);
    if (!format) return;
    this.battleButton.setLabel(battleTypeLabel(prefs));
    this.reserveButton.setLabel("EDIT RESERVE");
    this.reserveButton.setEnabled(prefs.battle === "reinforcements");
    this.caption.setText(battleTypeCaption(prefs, format));
  }

  /** @returns The buttons that take keyboard focus while shown. */
  focusTargets(): HoloPressButton[] {
    return this.host.format() ? [this.battleButton, this.reserveButton] : [];
  }

  /** Destroy the controls. */
  destroy(): void {
    this.battleButton.destroy();
    this.reserveButton.destroy();
    this.caption.destroy();
  }

  private toggle(): void {
    const prefs = this.host.prefs();
    this.host.setPrefs({
      ...prefs,
      battle: prefs.battle === "reinforcements" ? "classic" : "reinforcements",
    });
    this.refresh();
  }
}
