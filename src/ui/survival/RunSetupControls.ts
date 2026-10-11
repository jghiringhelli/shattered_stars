/**
 * Survival setup — run controls row: seed entry (type a code, or random),
 * the ascension selector with its visible modifiers, the Star Charts
 * unlock shop and the run history. Presentation + small local state; the
 * scene owns starting runs.
 */

import Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  activeAscensionModifiers,
  clampAscension,
} from "../../data/survival/ascension";
import { codeToSeed, SEED_CODE_LENGTH } from "../../systems/survival/RunRng";

/** Layout of the row (px). */
const ROW = {
  y: 545,
  modifiersY: 575,
  height: 36,
  seedX: 330,
  seedWidth: 240,
  ascX: 640,
  stepGap: 140,
  unlocksX: 920,
  historyX: 1120,
  buttonWidth: 170,
} as const;

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
  private modifiersText!: Phaser.GameObjects.Text;

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
    createHoverButton(
      scene,
      ROW.unlocksX,
      ROW.y,
      { ...style, label: "UNLOCKS ★" },
      handlers.onUnlocks,
    );
    createHoverButton(
      scene,
      ROW.historyX,
      ROW.y,
      { ...style, label: "HISTORY" },
      handlers.onHistory,
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
    const mods = activeAscensionModifiers(this.ascension).map(
      (m) => `${m.name}: ${m.description}`,
    );
    this.modifiersText.setText(
      mods.length > 0
        ? mods.join("  ·  ")
        : "Ascension 0 — win a run to unlock Ascension 1",
    );
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
    createHoverButton(
      this.scene,
      ROW.ascX - ROW.stepGap,
      ROW.y,
      { ...style, label: "◀" },
      () => this.setAscension(this.ascension - 1),
    );
    createHoverButton(
      this.scene,
      ROW.ascX + ROW.stepGap,
      ROW.y,
      { ...style, label: "▶" },
      () => this.setAscension(this.ascension + 1),
    );
    this.ascText = this.scene.add
      .text(ROW.ascX, ROW.y, "", {
        ...holoFont(16, "600"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setOrigin(0.5);
    this.modifiersText = this.scene.add
      .text(this.scene.scale.width / 2, ROW.modifiersY, "", {
        ...holoFont(12, "400"),
        color: toCssColor(HOLO_PALETTE.warning),
        align: "center",
        wordWrap: { width: this.scene.scale.width - 120 },
      })
      .setOrigin(0.5, 0);
    this.setAscension(0);
  }
}
