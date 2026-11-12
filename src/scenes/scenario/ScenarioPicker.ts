/**
 * ScenarioPicker — the Squad Builder's "SCENARIO" selector: a header button
 * that cycles None → Assault at the Satellite Array → Chance Engagement →
 * Salvage Mission → Scramble the Transmissions, with the chosen scenario's
 * one-line rules under it. The choice persists in the game registry and goes
 * into the battle config as `scenario` (ArcadeBattleScene runs it).
 */

import type Phaser from "phaser";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  isScenarioId,
  type ScenarioId,
} from "../../arcade/scenarios";
import { createHoverButton } from "../../ui/ButtonFactory";
import type { HoloPressButton } from "../../ui/menu/HoloPressButton";
import { MENU_LAYOUT } from "../../ui/menu/MenuScaffold";
import { attachHintTooltip } from "../../ui/menu/HintTooltip";
import { contentFromTerm } from "../../ui/menu/tooltipContent";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { createHoloText } from "../../ui/hud/holoPrimitives";

/** Registry key of the player's scenario choice. */
export const SCENARIO_CHOICE_KEY = "scenarioChoice";

/** A scenario, or a plain Skirmish. */
export type ScenarioChoice = ScenarioId | null;

/** Geometry: left of the SIMPLE/ADVANCED toggle (128 px) on the header row. */
const PICKER = { width: 250, height: 30, toggleWidth: 128, font: 12 } as const;

/**
 * @param current - The current choice.
 * @returns The next one in the cycle (None first, then every scenario).
 */
export function nextScenarioChoice(current: ScenarioChoice): ScenarioChoice {
  if (current === null) return SCENARIO_IDS[0] ?? null;
  const next = SCENARIO_IDS.indexOf(current) + 1;
  return next < SCENARIO_IDS.length ? SCENARIO_IDS[next]! : null;
}

/**
 * @param choice - A choice.
 * @returns The button label.
 */
export function scenarioChoiceLabel(choice: ScenarioChoice): string {
  return `SCENARIO: ${choice ? SCENARIO_DEFINITIONS[choice].shortName : "NONE"}`;
}

/**
 * @param choice - A choice.
 * @returns The rule line under the button ("" for none).
 */
export function scenarioChoiceSummary(choice: ScenarioChoice): string {
  if (!choice) return "";
  const def = SCENARIO_DEFINITIONS[choice];
  return `${def.name} — ${def.summary}`;
}

export class ScenarioPicker {
  /** The header button (keyboard focus target). */
  readonly button: HoloPressButton;
  private readonly summary: Phaser.GameObjects.Text;
  private choice: ScenarioChoice;
  /** Right edge of the header placement (left of the SIMPLE / ADVANCED toggle). */
  private readonly headerRight: number;

  /** @param scene - The Squad Builder scene. */
  constructor(private readonly scene: Phaser.Scene) {
    const stored: unknown = scene.registry.get(SCENARIO_CHOICE_KEY);
    this.choice = isScenarioId(stored) ? stored : null;
    const right =
      scene.scale.width -
      MENU_LAYOUT.margin -
      PICKER.toggleWidth -
      HOLO_SPACING.md;
    this.headerRight = right;
    this.button = createHoverButton(
      scene,
      right - PICKER.width / 2,
      MENU_LAYOUT.titleY,
      {
        width: PICKER.width,
        height: PICKER.height,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: scenarioChoiceLabel(this.choice),
        font: `600 ${PICKER.font}px`,
      },
      () => this.cycle(),
    );
    attachHintTooltip(scene, this.button, () =>
      contentFromTerm(
        this.choice ? `scenario.${this.choice}` : "scenario.none",
      ),
    );
    this.summary = createHoloText(
      scene,
      right,
      MENU_LAYOUT.subtitleY,
      scenarioChoiceSummary(this.choice),
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(1, 0.5);
  }

  /** The chosen scenario, or null for a plain Skirmish. */
  get selected(): ScenarioChoice {
    return this.choice;
  }

  /**
   * Moves the button and its rule line into a panel (Skirmish step 3): the
   * button on the left of the box, the rule line under it, left aligned.
   *
   * @param box - Top-left of the button's row and the button width.
   */
  placeInPanel(box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
  }): void {
    this.button.setPosition(
      box.x + PICKER.width / 2,
      box.y + PICKER.height / 2,
    );
    this.summary
      .setOrigin(0, 0)
      .setPosition(box.x, box.y + PICKER.height + HOLO_SPACING.sm)
      .setWordWrapWidth(box.width);
  }

  /** @param shown - Whether the button and its rule line are visible. */
  setShown(shown: boolean): void {
    this.button.setVisible(shown);
    this.summary.setVisible(shown);
  }

  /** Draws the button and rule line above anything created after them (the step's panels). */
  bringToFront(): void {
    this.scene.children.bringToTop(this.button);
    this.scene.children.bringToTop(this.summary);
  }

  /** Moves the button and its rule line back to the header row (advanced builder). */
  placeInHeader(): void {
    this.button.setPosition(
      this.headerRight - PICKER.width / 2,
      MENU_LAYOUT.titleY,
    );
    this.summary
      .setOrigin(1, 0.5)
      .setPosition(this.headerRight, MENU_LAYOUT.subtitleY)
      .setWordWrapWidth(null);
  }

  /** Destroy the button and its rule line. */
  destroy(): void {
    this.button.destroy();
    this.summary.destroy();
  }

  private cycle(): void {
    this.choice = nextScenarioChoice(this.choice);
    this.scene.registry.set(SCENARIO_CHOICE_KEY, this.choice);
    this.button.setLabel(scenarioChoiceLabel(this.choice));
    this.summary.setText(scenarioChoiceSummary(this.choice));
  }
}
