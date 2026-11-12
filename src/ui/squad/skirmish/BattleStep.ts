/**
 * BattleStep — step 3 of the Skirmish setup (THE ENEMY & BATTLE): enemy
 * skill and points per side on the left (details only for the focused
 * option), map, scenario and battle format on the right. The scenario and
 * battle-format controls are the scene's own widgets, moved into this panel
 * while the step is open and hidden again when it closes.
 */

import type Phaser from "phaser";
import type { AIDifficultyLevel } from "../../../ai/AIDifficulty";
import { DIFFICULTY_NAMES } from "../../../ai/AIDifficulty";
import { difficultyTermId, termEntry } from "../../../data/tooltips";
import { t } from "../../../i18n";
import type { ScenarioPicker } from "../../../scenes/scenario/ScenarioPicker";
import { drawHoloFrame } from "../../menu/holoChrome";
import type { FocusTarget } from "../../menu/MenuFocus";
import type { HoloPressButton } from "../../menu/HoloPressButton";
import { firstSentence } from "../../menu/tooltipContent";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../../theme/HoloTheme";
import { DIFFICULTIES, POINT_LIMITS } from "../FormatPanel";
import { createMapThemeButton } from "../MapThemeButton";
import type { SquadReinforcementSetup } from "../SquadReinforcementSetup";
import { SQUAD_TYPE, addCaption, addSquadText } from "../squadBuilderStyle";
import { drawToggleGroup } from "./toggleGroup";

/** What the step reads and changes. */
export interface BattleStepHost {
  readonly difficulty: () => AIDifficultyLevel;
  readonly setDifficulty: (level: AIDifficultyLevel) => void;
  readonly pointLimit: () => number;
  readonly setPointLimit: (points: number) => void;
  readonly scenario: ScenarioPicker | null;
  readonly reinforcements: SquadReinforcementSetup;
}

/** Geometry (scene coordinates). */
const STEP = {
  top: 104,
  height: 340,
  leftX: 32,
  leftW: 596,
  rightX: 644,
  pad: HOLO_SPACING.lg,
  titleY: 14,
  rowOffset: 44,
  rowH: 32,
  mapW: 260,
  optionGap: HOLO_SPACING.sm,
  /** Distance from one group's caption to the next group's caption. */
  groupPitch: 110,
} as const;

/** Step 3 of the Skirmish setup. */
export class BattleStep {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private mapButton: HoloPressButton | null = null;
  private groupTargets: FocusTarget[] = [];
  private skillLine: Phaser.GameObjects.Text | null = null;
  /** Every control of the step in reading order; mutated in place for a MenuFocus. */
  readonly focusTargets: FocusTarget[] = [];

  /**
   * @param scene - The Squad Builder scene.
   * @param host - Choices and the scene's own scenario / format widgets.
   * @param accent - Faction accent for the frames.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: BattleStepHost,
    private readonly accent: number,
  ) {}

  /** Draw (or redraw) the step and move the scene's widgets into it. */
  render(): void {
    this.clear();
    const rightW = this.scene.scale.width - STEP.leftX - STEP.rightX;
    this.panel(STEP.leftX, STEP.leftW);
    this.panel(STEP.rightX, rightW);
    this.drawSkill();
    this.drawPoints();
    this.drawRight(STEP.rightX + STEP.pad, rightW - STEP.pad * 2);
    this.focusTargets.splice(
      0,
      this.focusTargets.length,
      ...this.groupTargets,
      ...(this.mapButton ? [this.mapButton] : []),
      ...(this.host.scenario ? [this.host.scenario.button] : []),
      ...this.host.reinforcements.focusTargets(),
    );
  }

  /** Remove the step's objects and hide the scene's scenario / format widgets. */
  destroy(): void {
    this.clear();
    this.host.scenario?.setShown(false);
    this.host.reinforcements.setShown(false);
  }

  private clear(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.mapButton = null;
    this.groupTargets = [];
    this.skillLine = null;
    this.focusTargets.length = 0;
  }

  private panel(x: number, width: number): void {
    const frame = this.scene.add.graphics();
    drawHoloFrame(frame, { x, y: STEP.top, width, height: STEP.height }, { accent: this.accent, radius: HOLO_RADIUS.lg });
    this.objects.push(frame);
  }

  private caption(x: number, groupIndex: number, text: string): void {
    this.objects.push(addCaption(this.scene, x, STEP.top + STEP.titleY + groupIndex * STEP.groupPitch, text));
  }

  private rowY(groupIndex: number): number {
    return STEP.top + STEP.rowOffset + groupIndex * STEP.groupPitch;
  }

  private drawSkill(): void {
    const x = STEP.leftX + STEP.pad;
    const width = (STEP.leftW - STEP.pad * 2 - STEP.optionGap * (DIFFICULTIES.length - 1)) / DIFFICULTIES.length;
    this.caption(x, 0, t("skirmish.battle.difficulty"));
    this.skillLine = addSquadText(this.scene, x, this.rowY(0) + STEP.rowH + HOLO_SPACING.sm, "", {
      size: SQUAD_TYPE.body,
      color: HOLO_PALETTE.textSecondary,
    }).setWordWrapWidth(STEP.leftW - STEP.pad * 2);
    this.objects.push(this.skillLine);
    const group = drawToggleGroup(this.scene, {
      options: DIFFICULTIES.map((level) => ({ value: level, label: DIFFICULTY_NAMES[level], name: `skirmishSkill_${level}` })),
      selected: this.host.difficulty(),
      accent: this.accent,
      slot: (index) => ({
        x: x + width / 2 + index * (width + STEP.optionGap),
        y: this.rowY(0) + STEP.rowH / 2,
        width,
        height: STEP.rowH,
      }),
      onPick: (level) => this.host.setDifficulty(level),
      onPreview: (level) => this.showSkill(level ?? this.host.difficulty()),
    });
    this.objects.push(...group.objects);
    this.groupTargets.push(...group.targets);
    this.showSkill(this.host.difficulty());
  }

  private showSkill(level: AIDifficultyLevel): void {
    this.skillLine?.setText(firstSentence(termEntry(difficultyTermId(level)).definition));
  }

  private drawPoints(): void {
    const x = STEP.leftX + STEP.pad;
    const width = (STEP.leftW - STEP.pad * 2 - STEP.optionGap * (POINT_LIMITS.length - 1)) / POINT_LIMITS.length;
    this.caption(x, 1, t("skirmish.battle.points"));
    this.objects.push(
      addSquadText(this.scene, x, this.rowY(1) + STEP.rowH + HOLO_SPACING.sm, firstSentence(termEntry("ui.point_limit").definition), {
        size: SQUAD_TYPE.body,
        color: HOLO_PALETTE.textSecondary,
      }).setWordWrapWidth(STEP.leftW - STEP.pad * 2),
    );
    const group = drawToggleGroup(this.scene, {
      options: POINT_LIMITS.map((points) => ({ value: points, label: `${points}`, name: `skirmishPoints_${points}` })),
      selected: this.host.pointLimit(),
      accent: this.accent,
      slot: (index) => ({
        x: x + width / 2 + index * (width + STEP.optionGap),
        y: this.rowY(1) + STEP.rowH / 2,
        width,
        height: STEP.rowH,
      }),
      onPick: (points) => this.host.setPointLimit(points),
      onPreview: () => undefined,
    });
    this.objects.push(...group.objects);
    this.groupTargets.push(...group.targets);
  }

  private drawRight(x: number, width: number): void {
    this.caption(x, 0, t("skirmish.battle.map"));
    this.mapButton = createMapThemeButton(this.scene, {
      x: x + STEP.mapW / 2,
      y: this.rowY(0) + STEP.rowH / 2,
      width: STEP.mapW,
    });
    this.objects.push(this.mapButton);
    const { scenario, reinforcements } = this.host;
    if (scenario) {
      this.caption(x, 1, t("skirmish.battle.scenario"));
      scenario.placeInPanel({ x, y: this.rowY(1), width });
      scenario.setShown(true);
      scenario.bringToFront();
    }
    this.caption(x, 2, t("skirmish.battle.format"));
    reinforcements.placeInPanel({ x, y: this.rowY(2) });
    reinforcements.setShown(true);
    reinforcements.bringToFront();
  }
}
