/**
 * SimpleSquadFlow — the default entry to Skirmish, an ordered flow of three
 * steps behind one header strip: (1) YOUR SHIP (faction + role-grouped ship
 * catalog + payload), (2) YOUR WINGMEN (what kind of squad flies with you)
 * and (3) THE ENEMY & BATTLE (skill, points, map, scenario, format). The
 * points bar and the NEXT / LAUNCH button stay at the bottom on every step.
 *
 * Emits: 'start' { factionId, shipId, loadoutId } · 'focusTargetsChanged' ·
 * 'difficultyChanged' (level) · 'pointsChanged' (points) ·
 * 'wingmenChanged' { type, custom, customLoadouts } ·
 * 'editSquad' { ships, loadoutChoices } (open the squad picker for CUSTOM).
 */

import Phaser from "phaser";
import type { AIDifficultyLevel } from "../../ai/AIDifficulty";
import type { FactionId } from "../../config";
import type { GameMode } from "../../core/squadTypes";
import { getShipsByFaction } from "../../data/ShipDefinitions";
import type { ScenarioPicker } from "../../scenes/scenario/ScenarioPicker";
import {
  planWingmen,
  type WingmenPlan,
  type WingmenRequest,
} from "../../systems/setup/wingmen";
import type { WingmenType } from "../../systems/setup/wingmenTypes";
import type { FocusTarget } from "../menu/MenuFocus";
import { ShipCatalogPanel, type CatalogSelection } from "../picker/ShipCatalogPanel";
import { budgetOf, wingmenCaption } from "../picker/pointsBudget";
import { factionAccent } from "../theme/HoloTheme";
import { BattleStep } from "./skirmish/BattleStep";
import { FactionRow } from "./skirmish/FactionRow";
import { SkirmishFooter } from "./skirmish/SkirmishFooter";
import { StepTabs } from "./skirmish/StepTabs";
import { WingmenChoice } from "./skirmish/WingmenChoice";
import { WingmenStep } from "./skirmish/WingmenStep";
import { navButton, nextStep, type SkirmishStep } from "./skirmish/skirmishModel";
import { previewWingmenSquad } from "./simpleBudget";
import type { SquadReinforcementSetup } from "./SquadReinforcementSetup";

/** Ship step geometry: the faction row sits above the catalog, the footer under it. */
const SHIP_STEP = { catalogTopY: 148, catalogPanelH: 516 } as const;

/** What the flow starts from and talks to. */
export interface SimpleFlowOptions {
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  readonly aiDifficulty: AIDifficultyLevel;
  readonly wingmen: WingmenType;
  /** The CUSTOM wingmen picked earlier (ships after the flagship). */
  readonly customWingmen: readonly string[];
  readonly reinforcements: SquadReinforcementSetup;
  readonly scenario: ScenarioPicker | null;
}

const NOTHING_STAGED: CatalogSelection = { shipId: null, loadoutId: null };

/** Ship → wingmen → battle → launch. */
export class SimpleSquadFlow extends Phaser.Events.EventEmitter {
  private selectedFaction: FactionId;
  private step: SkirmishStep = "ship";
  private catalog: ShipCatalogPanel | null = null;
  private selection: CatalogSelection = NOTHING_STAGED;
  private readonly choice: WingmenChoice;
  private pointLimit: number;
  private difficulty: AIDifficultyLevel;
  private wingmenStep: WingmenStep | null = null;
  private battleStep: BattleStep | null = null;
  private readonly tabs: StepTabs;
  private readonly factionRow: FactionRow;
  private readonly footer: SkirmishFooter;
  /** Tabs, the open step's controls and the step button — one array so a MenuFocus can keep it. */
  private readonly allTargets: FocusTarget[] = [];

  /**
   * @param scene - Owning scene.
   * @param initialFaction - Faction selected on entry.
   * @param options - Starting choices and the scene's own battle widgets.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    initialFaction: FactionId,
    private readonly options: SimpleFlowOptions,
  ) {
    super();
    this.selectedFaction = initialFaction;
    this.choice = new WingmenChoice(options.wingmen, options.customWingmen);
    this.pointLimit = options.pointLimit;
    this.difficulty = options.aiDifficulty;
    this.tabs = new StepTabs(scene, this.step, (step) => this.showStep(step));
    this.factionRow = new FactionRow(scene, (faction) => this.pickFaction(faction));
    this.footer = new SkirmishFooter(scene, () => this.pressNav());
  }

  /** The faction selected in the faction row. */
  get faction(): FactionId {
    return this.selectedFaction;
  }

  /** The open step. */
  get openStep(): SkirmishStep {
    return this.step;
  }

  /** Tabs, then the open step's controls, then the step button. */
  get focusTargets(): FocusTarget[] {
    return this.allTargets;
  }

  /**
   * @param shipId - The flagship.
   * @param loadoutId - Its quick build (null = default build).
   * @returns The squad the launch fields: flagship plus wingmen of the chosen type.
   */
  squadFor(shipId: string, loadoutId: string | null): WingmenPlan {
    return planWingmen(this.request(shipId, loadoutId));
  }

  /**
   * Takes the squad the player edited in the squad picker as the CUSTOM wingmen.
   *
   * @param ships - The squad, flagship first.
   * @param loadoutChoices - Builds by squad index.
   */
  applyCustomSquad(ships: readonly string[], loadoutChoices: Readonly<Record<string, string>>): void {
    this.choice.applyPicked(this.selection.shipId, ships, loadoutChoices);
    this.changedWingmen();
  }

  /** Render (or re-render) the open step. */
  render(): void {
    this.closeStep();
    this.tabs.setActive(this.step);
    this.footer.build(factionAccent(this.selectedFaction));
    if (this.step === "ship") this.openShipStep();
    else if (this.step === "wingmen") this.openWingmenStep();
    else this.openBattleStep();
    this.refreshFooter();
    this.syncFocusTargets();
  }

  /** @param step - The step to open. */
  showStep(step: SkirmishStep): void {
    this.step = step;
    this.render();
  }

  /** Destroy every control of the flow. */
  destroy(): void {
    this.tabs.destroy();
    this.closeStep();
    this.footer.destroy();
    this.allTargets.length = 0;
  }

  private closeStep(): void {
    this.factionRow.destroy();
    this.catalog?.destroy();
    this.catalog = null;
    this.wingmenStep?.destroy();
    this.wingmenStep = null;
    this.battleStep?.destroy();
    this.battleStep = null;
  }

  private pickFaction(faction: FactionId): void {
    if (faction !== this.selectedFaction) {
      this.choice.resetForFaction();
      this.emit("wingmenChanged", this.choice.snapshot());
    }
    this.selectedFaction = faction;
    this.selection = NOTHING_STAGED;
    this.render();
  }

  private openShipStep(): void {
    const ships = getShipsByFaction(this.selectedFaction).filter(
      (s) => s.role !== "capital" && s.baseStats.size !== "huge",
    );
    this.factionRow.render(this.selectedFaction);
    this.catalog = new ShipCatalogPanel(
      this.scene,
      ships,
      this.selectedFaction,
      undefined,
      "LAUNCH",
      SHIP_STEP.catalogTopY,
      SHIP_STEP.catalogPanelH,
      { hiddenCapitals: this.hiddenCapitalCount(), initial: this.selection },
    );
    this.catalog.on("addInstance", (e: { shipId: string; loadoutId: string | null }) =>
      this.emit("start", { factionId: this.selectedFaction, shipId: e.shipId, loadoutId: e.loadoutId }),
    );
    this.catalog.on("focusTargetsChanged", () => this.syncFocusTargets());
    this.catalog.on("selectionChanged", (selection: CatalogSelection) => {
      this.selection = selection;
      this.refreshFooter();
    });
    this.catalog.render();
  }

  private openWingmenStep(): void {
    this.wingmenStep = new WingmenStep(
      this.scene,
      {
        type: () => this.choice.type,
        plan: () => this.currentPlan(),
        select: (type) => this.chooseWingmen(type),
        shuffle: () => {
          this.choice.shuffle();
          this.changedWingmen();
        },
        edit: () => this.editSquad(),
      },
      factionAccent(this.selectedFaction),
    );
    this.wingmenStep.render();
  }

  private openBattleStep(): void {
    this.battleStep = new BattleStep(
      this.scene,
      {
        difficulty: () => this.difficulty,
        setDifficulty: (level) => {
          this.difficulty = level;
          this.emit("difficultyChanged", level);
          this.battleStep?.render();
          this.syncFocusTargets();
        },
        pointLimit: () => this.pointLimit,
        setPointLimit: (points) => {
          this.pointLimit = points;
          this.emit("pointsChanged", points);
          this.battleStep?.render();
          this.refreshFooter();
          this.syncFocusTargets();
        },
        scenario: this.options.scenario,
        reinforcements: this.options.reinforcements,
      },
      factionAccent(this.selectedFaction),
    );
    this.battleStep.render();
  }

  private chooseWingmen(type: WingmenType): void {
    this.choice.choose(type, this.currentPlan());
    this.changedWingmen();
  }

  private changedWingmen(): void {
    this.emit("wingmenChanged", this.choice.snapshot());
    this.wingmenStep?.render();
    this.refreshFooter();
    this.syncFocusTargets();
  }

  private editSquad(): void {
    const plan = this.currentPlan();
    if (plan) this.emit("editSquad", { ships: plan.ships, loadoutChoices: plan.loadoutChoices });
  }

  private currentPlan(): WingmenPlan | null {
    const { shipId, loadoutId } = this.selection;
    return shipId ? this.squadFor(shipId, loadoutId) : null;
  }

  private request(shipId: string, loadoutId: string | null): WingmenRequest {
    return this.choice.request({
      faction: this.selectedFaction,
      shipId,
      loadoutId,
      gameMode: this.options.gameMode,
      pointLimit: this.pointLimit,
      rules: this.options.reinforcements.wingmenRules(),
    });
  }

  /** Capital ships Skirmish leaves out (listed as an epic-only notice). */
  private hiddenCapitalCount(): number {
    return getShipsByFaction(this.selectedFaction).filter(
      (s) => s.role === "capital" || s.baseStats.size === "huge",
    ).length;
  }

  private pressNav(): void {
    const { shipId, loadoutId } = this.selection;
    const next = nextStep(this.step);
    if (!navButton(this.step, shipId !== null).enabled) return;
    if (next === null && shipId) this.emit("start", { factionId: this.selectedFaction, shipId, loadoutId });
    else if (next) this.showStep(next);
  }

  /** The points bar (ship + wingmen of the chosen type) and the step button. */
  private refreshFooter(): void {
    const limit = this.pointLimit;
    const { shipId, loadoutId } = this.selection;
    const note = `Enemy squad matched to ${limit} pts`;
    if (!shipId) {
      this.footer.showBudget(budgetOf(0, limit), note, `Pick a ship \u2014 your ${limit} points also buy AI wingmen`);
    } else {
      const preview = previewWingmenSquad(this.request(shipId, loadoutId));
      this.footer.showBudget(
        budgetOf(preview.squadTotal, limit),
        note,
        wingmenCaption(preview.ownCost, preview.squadTotal, limit),
      );
    }
    this.footer.showNav(navButton(this.step, shipId !== null));
  }

  private syncFocusTargets(): void {
    const stepTargets =
      this.step === "ship"
        ? [...this.factionRow.targets, ...(this.catalog?.focusTargets ?? [])]
        : this.step === "wingmen"
          ? (this.wingmenStep?.focusTargets ?? [])
          : (this.battleStep?.focusTargets ?? []);
    const nav = this.footer.navButton;
    this.allTargets.splice(0, this.allTargets.length, ...this.tabs.buttons, ...stepTargets, ...(nav ? [nav] : []));
    this.emit("focusTargetsChanged");
  }
}
