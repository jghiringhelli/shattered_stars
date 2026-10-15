/**
 * ContinueCard — main-menu holo card in the footer area (under the Flight
 * School card, outside the keyboard-navigable rows so the row order the e2e
 * helpers click is untouched): the last battle's one-line summary, CONTINUE
 * (relaunches the last mode, key R) and DETAILS (its stored stats).
 */

import type Phaser from "phaser";
import { loadLastBattle } from "../../telemetry/lastBattleStore";
import { loadLastLaunch } from "../../systems/setup/setupMemory";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { continueCardState } from "./continueModel";
import { openLastBattleDetails } from "./lastBattleDialog";

/** Card geometry (same column as the briefing and Flight School cards). */
const CARD = {
  x: 1010,
  y: 616,
  width: 320,
  height: 104,
  bodySize: 13,
  buttonWidth: 148,
  buttonHeight: 30,
  buttonY: 24,
  buttonFont: "600 12px",
} as const;

/** Main-menu CONTINUE / last-battle card. */
export class ContinueCard {
  private readonly panel: HoloPanel | null;
  /** Whether CONTINUE can start something (the R key checks this). */
  readonly canContinue: boolean;

  /**
   * @param scene - Main menu scene.
   * @param onContinue - Relaunches the last mode.
   */
  constructor(
    scene: Phaser.Scene,
    onContinue: () => void,
  ) {
    const launch = loadLastLaunch();
    const battle = loadLastBattle();
    const state = continueCardState(launch, battle);
    this.canContinue = state.canContinue;
    if (!state.visible) {
      this.panel = null;
      return;
    }
    const panel = createHoloPanel(scene, CARD.x, CARD.y, {
      width: CARD.width,
      height: CARD.height,
      title: state.title,
    });
    panel.add(
      scene.add
        .text(-CARD.width / 2 + HOLO_SPACING.lg, panel.contentTop + HOLO_SPACING.xs, state.line, {
          ...holoFont(CARD.bodySize, "400"),
          color: toCssColor(HOLO_PALETTE.textSecondary),
        })
        .setOrigin(0, 0)
        .setName("lastBattleLine"),
    );
    const y = CARD.y + CARD.buttonY;
    const gap = HOLO_SPACING.xs;
    const button = (
      x: number,
      label: string,
      variant: "primary" | "secondary",
      onPress: () => void,
      name: string,
    ): void => {
      createHoverButton(
        scene,
        x,
        y,
        {
          width: CARD.buttonWidth,
          height: CARD.buttonHeight,
          label,
          color: HOLO_PALETTE.panelFill,
          variant,
          font: CARD.buttonFont,
        },
        onPress,
      ).setName(name);
    };
    if (state.canContinue)
      button(
        CARD.x - CARD.buttonWidth / 2 - gap,
        "CONTINUE  [R]",
        "primary",
        onContinue,
        "continueLast",
      );
    if (battle)
      button(
        state.canContinue ? CARD.x + CARD.buttonWidth / 2 + gap : CARD.x,
        "DETAILS",
        "secondary",
        () => openLastBattleDetails(battle),
        "lastBattleDetails",
      );
    this.panel = panel;
  }

  /** The card container (entrance tween), or null when nothing is remembered. */
  get container(): HoloPanel | null {
    return this.panel;
  }
}
