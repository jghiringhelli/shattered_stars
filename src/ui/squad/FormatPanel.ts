/**
 * FormatPanel — left sidebar of SquadBuilderScene, a holo panel with
 * captioned option groups (game mode, point limit, AI difficulty) rendered
 * as holo toggles.
 * Emits: 'modeChanged' GameMode | 'pointsChanged' number | 'difficultyChanged' AIDifficultyLevel
 */

import Phaser from "phaser";
import type { AIDifficultyLevel } from "../../ai/AIDifficulty";
import { DIFFICULTY_NAMES } from "../../ai/AIDifficulty";
import type { GameMode } from "../../core/squadTypes";
import { createToggleButton } from "../ButtonFactory";
import { difficultyTermId, type TermId } from "../../data/tooltips";
import { attachToggleTooltip } from "../menu/tooltipTargets";
import { createHoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { SQUAD_TYPE, addCaption, addSquadText } from "./squadBuilderStyle";

/** Panel geometry (scene coordinates, top-left). */
const FORMAT_LAYOUT = {
  x: 32,
  y: 104,
  width: 272,
  pad: 16,
  headerH: 28,
  captionH: 12,
  captionGap: 8,
  buttonH: 28,
  optionGap: 8,
  sectionGap: 20,
  sections: 3,
} as const;

const SECTION_H =
  FORMAT_LAYOUT.captionH + FORMAT_LAYOUT.captionGap + FORMAT_LAYOUT.buttonH;
const PANEL_H =
  FORMAT_LAYOUT.headerH +
  FORMAT_LAYOUT.pad * 2 +
  FORMAT_LAYOUT.sections * SECTION_H +
  (FORMAT_LAYOUT.sections - 1) * FORMAT_LAYOUT.sectionGap;
const INNER_W = FORMAT_LAYOUT.width - FORMAT_LAYOUT.pad * 2;
const ROW_X = FORMAT_LAYOUT.x + FORMAT_LAYOUT.pad;
const POINT_LIMITS: readonly number[] = [100, 150, 200, 300];
const DIFFICULTIES: readonly AIDifficultyLevel[] = [
  "easy",
  "normal",
  "hard",
  "brutal",
];
const MODES: ReadonlyArray<{ id: GameMode; label: string }> = [
  { id: "arcade", label: "Arcade" },
  { id: "continuous", label: "Continuous" },
];

/** Format options shown by the panel. */
export interface FormatPanelState {
  gameMode: GameMode;
  pointLimit: number;
  aiDifficulty: AIDifficultyLevel;
}

/** One selectable option in a toggle row. */
interface ToggleOption {
  readonly label: string;
  /** Tooltip term of the option. */
  readonly term: TermId;
  readonly selected: boolean;
  readonly onPick: () => void;
}

/** Match-settings sidebar. */
export class FormatPanel extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private state: FormatPanelState;
  private container!: Phaser.GameObjects.Container;

  /**
   * @param scene - Owning scene.
   * @param initial - Initial selections.
   */
  constructor(scene: Phaser.Scene, initial: FormatPanelState) {
    super();
    this.scene = scene;
    this.state = { ...initial };
  }

  /** Render or re-render the panel */
  render(): void {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.container.add(
      createHoloPanel(
        this.scene,
        FORMAT_LAYOUT.x + FORMAT_LAYOUT.width / 2,
        FORMAT_LAYOUT.y + PANEL_H / 2,
        {
          width: FORMAT_LAYOUT.width,
          height: PANEL_H,
          title: "Match settings",
        },
      ),
    );
    let y: number = FORMAT_LAYOUT.y + FORMAT_LAYOUT.headerH + FORMAT_LAYOUT.pad;
    y = this.section(y, "GAME MODE", (rowY) => this.renderModeRow(rowY));
    y = this.section(y, "POINTS", (rowY) => this.renderPointsRow(rowY));
    this.section(y, "AI DIFFICULTY", (rowY) => this.renderDifficultyRow(rowY));
  }

  /**
   * Merge partial state and re-render.
   *
   * @param patch - Fields to replace.
   */
  setState(patch: Partial<FormatPanelState>): void {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  /** @returns The current selections. */
  getState(): Readonly<FormatPanelState> {
    return this.state;
  }

  /** Destroy display objects and listeners. */
  destroy(): void {
    this.container?.destroy();
    super.destroy();
  }

  /** Draw a caption and its option row; returns the next section's top. */
  private section(
    y: number,
    title: string,
    renderRow: (rowCentreY: number) => void,
  ): number {
    this.container.add(addCaption(this.scene, ROW_X, y, title));
    const rowTop = y + FORMAT_LAYOUT.captionH + FORMAT_LAYOUT.captionGap;
    renderRow(rowTop + FORMAT_LAYOUT.buttonH / 2);
    return y + SECTION_H + FORMAT_LAYOUT.sectionGap;
  }

  private renderModeRow(centreY: number): void {
    if (this.state.gameMode === "epic") {
      this.addEpicNotice(centreY, "⚠ EPIC FORMAT — capitals allowed");
      return;
    }
    this.renderToggleRow(
      centreY,
      MODES.map((m) => ({
        label: m.label,
        term: `mode.${m.id}` as TermId,
        selected: this.state.gameMode === m.id,
        onPick: () => {
          this.state.gameMode = m.id;
          this.emit("modeChanged", m.id);
          this.render();
        },
      })),
    );
  }

  private renderPointsRow(centreY: number): void {
    if (this.state.gameMode === "epic") {
      this.addEpicNotice(centreY, "400 pts  ·  EPIC FORMAT");
      return;
    }
    this.renderToggleRow(
      centreY,
      POINT_LIMITS.map((pts) => ({
        label: `${pts}`,
        term: "ui.point_limit",
        selected: this.state.pointLimit === pts,
        onPick: () => {
          this.state.pointLimit = pts;
          this.emit("pointsChanged", pts);
          this.render();
        },
      })),
    );
  }

  private renderDifficultyRow(centreY: number): void {
    this.renderToggleRow(
      centreY,
      DIFFICULTIES.map((d) => ({
        label: DIFFICULTY_NAMES[d],
        term: difficultyTermId(d),
        selected: this.state.aiDifficulty === d,
        onPick: () => {
          this.state.aiDifficulty = d;
          this.emit("difficultyChanged", d);
          this.render();
        },
      })),
    );
  }

  private addEpicNotice(centreY: number, text: string): void {
    this.container.add(
      addSquadText(this.scene, ROW_X, centreY, text, {
        size: SQUAD_TYPE.label,
        weight: "600",
        color: HOLO_PALETTE.warning,
        letterSpacing: 1,
      }).setOrigin(0, 0.5),
    );
  }

  /** Lay out equal-width toggles across the panel's inner width. */
  private renderToggleRow(
    centreY: number,
    options: ReadonlyArray<ToggleOption>,
  ): void {
    const gap = FORMAT_LAYOUT.optionGap;
    const width = (INNER_W - gap * (options.length - 1)) / options.length;
    options.forEach((option, i) => {
      const toggle = createToggleButton(
          this.scene,
          ROW_X + width / 2 + i * (width + gap),
          centreY,
          option.label,
          option.selected,
          {
            width,
            height: FORMAT_LAYOUT.buttonH,
            radius: HOLO_RADIUS.sm,
            selectedColor: HOLO_PALETTE.accent,
            normalColor: HOLO_PALETTE.panelFill,
            font: `${SQUAD_TYPE.label}px`,
            selectedFont: `600 ${SQUAD_TYPE.label}px`,
          },
          option.onPick,
      );
      attachToggleTooltip(this.scene, toggle, option.term);
      this.container.add(toggle);
    });
  }
}
