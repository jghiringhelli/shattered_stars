/**
 * Survival setup — run controls row: seed entry (type a code, or random),
 * the ascension selector with its visible modifiers, the Star Charts
 * unlock shop and the run history. Presentation + small local state; the
 * scene owns starting runs.
 */

import Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { attachTermTooltip } from "../menu/HintTooltip";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import { clampAscension } from "../../data/survival/ascension";
import { codeToSeed, SEED_CODE_LENGTH } from "../../systems/survival/RunRng";
import { ascensionTip } from "./starterModel";

/** Layout of the row (px) — the DAILY button (dailyMenu) sits at its left end. */
const ROW = {
  y: 608,
  height: 32,
  seedX: 406,
  seedWidth: 200,
  ascX: 660,
  stepGap: 112,
  unlocksX: 889,
  historyX: 1063,
  buttonWidth: 150,
} as const;
/** Width of the invisible hover zone over the ascension readout (px). */
const ASCENSION_ZONE_WIDTH = 160;

/** What the row reports to the scene. */
export interface RunSetupHandlers {
  readonly onUnlocks: () => void;
  readonly onHistory: () => void;
}

export class RunSetupControls {
  private seedCode = "";
  private typing = false;
  private ascension = 0;
  private seedButton: Phaser.GameObjects.Container | null = null;
  private ascText!: Phaser.GameObjects.Text;

  /**
   * @param scene - The setup scene.
   * @param maxAscension - Highest unlocked ascension.
   * @param handlers - Unlocks / history callbacks.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxAscension: number,
    handlers: RunSetupHandlers,
  ) {
    this.renderSeedButton();
    this.createAscension();
    const style = {
      width: ROW.buttonWidth,
      height: ROW.height,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary" as const,
      font: "600 14px",
    };
    attachTermTooltip(
      scene,
      createHoverButton(
        scene,
        ROW.unlocksX,
        ROW.y,
        { ...style, label: "UNLOCKS ★" },
        handlers.onUnlocks,
      ),
      "survival.star_charts",
    );
    attachTermTooltip(
      scene,
      createHoverButton(
        scene,
        ROW.historyX,
        ROW.y,
        { ...style, label: "HISTORY" },
        handlers.onHistory,
      ),
      "survival.history",
    );
    scene.input.keyboard?.on("keydown", (event: KeyboardEvent) =>
      this.onKey(event),
    );
  }

  /** @returns The typed seed, or undefined for a random run. */
  get seed(): number | undefined {
    return codeToSeed(this.seedCode) ?? undefined;
  }

  /** @returns The chosen ascension level. */
  get ascensionLevel(): number {
    return this.ascension;
  }

  /** @returns True while the seed field takes keystrokes. */
  get isTyping(): boolean {
    return this.typing;
  }

  /**
   * Sets the seed code programmatically (e2e, "replay seed").
   *
   * @param code - A seed code ("" = random).
   */
  setSeedCode(code: string): void {
    this.seedCode = code.toUpperCase().slice(0, SEED_CODE_LENGTH);
    this.typing = false;
    this.renderSeedButton();
  }

  /**
   * @param level - Ascension to select (clamped to the unlocked range).
   */
  setAscension(level: number): void {
    this.ascension = Math.min(this.maxAscension, clampAscension(level));
    this.ascText.setText(`ASCENSION ${this.ascension}/${this.maxAscension}`);
  }

  private label(): string {
    if (this.typing) return `SEED: ${this.seedCode}_`;
    return this.seedCode ? `SEED: ${this.seedCode}` : "SEED: RANDOM";
  }

  private renderSeedButton(): void {
    this.seedButton?.destroy();
    this.seedButton = createHoverButton(
      this.scene,
      ROW.seedX,
      ROW.y,
      {
        width: ROW.seedWidth,
        height: ROW.height,
        color: HOLO_PALETTE.panelFill,
        variant: this.typing ? "primary" : "secondary",
        label: this.label(),
        font: "600 14px",
      },
      () => {
        this.typing = !this.typing;
        this.renderSeedButton();
      },
    );
    this.seedButton.setName("seedButton");
    attachTermTooltip(this.scene, this.seedButton, "survival.seed");
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.typing) return;
    if (event.key === "Enter" || event.key === "Escape") this.typing = false;
    else if (event.key === "Backspace")
      this.seedCode = this.seedCode.slice(0, -1);
    else if (
      /^[0-9a-zA-Z]$/.test(event.key) &&
      this.seedCode.length < SEED_CODE_LENGTH
    ) {
      this.seedCode += event.key.toUpperCase();
    }
    this.renderSeedButton();
  }

  private createAscension(): void {
    const style = {
      width: 36,
      height: ROW.height,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary" as const,
      font: "600 16px",
    };
    const step = (direction: -1 | 1, icon: "back" | "next"): void => {
      attachTermTooltip(
        this.scene,
        createHoverButton(
          this.scene,
          ROW.ascX + direction * ROW.stepGap,
          ROW.y,
          { ...style, label: "", icon },
          () => this.setAscension(this.ascension + direction),
        ),
        "survival.ascension",
      );
    };
    step(-1, "back");
    step(1, "next");
    this.ascText = this.scene.add
      .text(ROW.ascX, ROW.y, "", {
        ...holoFont(16, "600"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setOrigin(0.5);
    addTipZone(
      this.scene,
      null,
      {
        x: ROW.ascX - ASCENSION_ZONE_WIDTH / 2,
        y: ROW.y - ROW.height / 2,
        width: ASCENSION_ZONE_WIDTH,
        height: ROW.height,
      },
      () => ascensionTip(this.ascension, this.maxAscension),
    );
    this.setAscension(0);
  }
}
