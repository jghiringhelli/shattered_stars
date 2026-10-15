/**
 * Survival Summary Scene — the end-of-run screen and the run history.
 *
 * Shows the run that just ended (victory or cause of death, sectors,
 * kills, relics and archetypes, salvage, ascension, time, seed, Star
 * Charts earned) above the last 20 runs. Opened after a run ends, or from
 * the setup screen's HISTORY button (history only).
 */

import Phaser from "phaser";
import { createHoverButton } from "../ui/ButtonFactory";
import { addBackButton, addMenuBackdrop, addMenuHeader } from "../ui/menu/MenuScaffold";
import { bindMenuBack } from "../ui/menu/menuTransitions";
import { SetupKeyNav } from "../ui/menu/SetupKeyNav";
import { HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { holoFont } from "../ui/theme/holoFont";
import { toCssColor } from "../ui/theme/colorMath";
import { runServiceOf } from "../systems/survival/RoguelikeRunService";
import {
  historyRow,
  summaryLines,
  summaryTitle,
} from "../ui/survival/runSummaryText";
import { audioManager } from "../audio/AudioManager";

/** Layout (px). */
const LAYOUT = {
  left: 80,
  summaryTop: 110,
  titleSize: 26,
  bodySize: 15,
  historySize: 12,
  buttonY: 670,
  buttonWidth: 200,
  buttonHeight: 44,
  buttonGap: 120,
} as const;

/**
 * @param text - A top-left-anchored text.
 * @returns The y just below it.
 */
function bottomOf(text: Phaser.GameObjects.Text): number {
  return text.y + text.height;
}

export class SurvivalSummaryScene extends Phaser.Scene {
  /** Opened from the setup screen's HISTORY button: no run summary. */
  private historyOnly = false;

  constructor() {
    super({ key: "SurvivalSummaryScene" });
  }

  init(data: { historyOnly?: boolean }): void {
    this.historyOnly = data?.historyOnly === true;
  }

  create(): void {
    const service = runServiceOf(this.registry);
    const summary = this.historyOnly ? null : service.lastSummary;
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    addMenuHeader(this, {
      title: summary ? "Run Summary" : "Run History",
      subtitle: `Star Charts: ${service.meta.charts} ★   Runs ${service.meta.runs}   Victories ${service.meta.victories}   Max ascension ${service.meta.maxAscension}`,
    });
    let y: number = LAYOUT.summaryTop;
    if (summary) {
      const won = summary.outcome === "victory";
      audioManager.playFactionStinger(
        summary.faction,
        won ? "victory" : "defeat",
      );
      y = bottomOf(
        this.text(
          summaryTitle(summary),
          y,
          LAYOUT.titleSize,
          won ? HOLO_PALETTE.success : HOLO_PALETTE.danger,
          "600",
        ).setName("summaryTitle"),
      );
      y = bottomOf(
        this.text(
          summaryLines(summary).join("\n"),
          y + 6,
          LAYOUT.bodySize,
          HOLO_PALETTE.textPrimary,
        ),
      );
    }
    const history = service.meta.history;
    y = bottomOf(
      this.text(
        `HISTORY — last ${history.length} run${history.length === 1 ? "" : "s"}`,
        y + 16,
        LAYOUT.bodySize,
        HOLO_PALETTE.textSecondary,
        "600",
      ),
    );
    const rows =
      history.length > 0
        ? history.map(historyRow).join("\n")
        : "No runs yet — press NEW RUN (R) to start your first.";
    this.text(
      rows,
      y + 4,
      LAYOUT.historySize,
      HOLO_PALETTE.textSecondary,
      "400",
      true,
    ).setName("historyList");
    this.createButtons();
    this.bindNavigation();
  }

  /** BACK / ESC / B leave, R starts a new run, arrows + ENTER drive the buttons. */
  private bindNavigation(): void {
    const leave = (): void => {
      this.scene.start(this.historyOnly ? "SurvivalSetupScene" : "MainMenuScene");
    };
    addBackButton(this, leave);
    bindMenuBack(this, leave);
    this.input.keyboard?.on("keydown-R", () =>
      this.scene.start("SurvivalSetupScene"),
    );
    new SetupKeyNav(this, { isActive: () => true });
  }

  private text(
    content: string,
    top: number,
    size: number,
    color: number,
    weight = "400",
    mono = false,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(LAYOUT.left, top, content, {
        ...holoFont(size, weight),
        ...(mono ? { fontFamily: "monospace" } : {}),
        color: toCssColor(color),
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
  }

  private createButtons(): void {
    const centerX = this.scale.width / 2;
    const style = {
      width: LAYOUT.buttonWidth,
      height: LAYOUT.buttonHeight,
      font: "600 18px",
    };
    createHoverButton(
      this,
      centerX - LAYOUT.buttonGap,
      LAYOUT.buttonY,
      {
        ...style,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label: "NEW RUN",
      },
      () => this.scene.start("SurvivalSetupScene"),
    );
    createHoverButton(
      this,
      centerX + LAYOUT.buttonGap,
      LAYOUT.buttonY,
      {
        ...style,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: "MENU",
      },
      () => this.scene.start("MainMenuScene"),
    );
  }
}
