/**
 * ShipPickerScene — three-column ship picker launched over the squad builder.
 * Left = ShipCatalogPanel (browse ship cards, then → ADD).
 * Centre = the catalog's ShipDetailPanel (stats, payload toggles, build).
 * Right = SquadRosterPanel (per-instance rows, hover for details, × to remove).
 *
 * Each ship slot is a SquadInstance so two copies of the same ship can carry
 * different loadouts. Capital ships are blocked unless allowCapitals is set.
 */

import Phaser from "phaser";
import { getShipsByFaction } from "../data/ShipDefinitions";
import { bindMenuBack } from "../ui/menu/menuTransitions";
import type { ShipDefinition } from "../core/types";
import type { FactionId } from "../config";
import { ShipCatalogPanel, CAT_X, CAT_W } from "../ui/picker/ShipCatalogPanel";
import { PointsBar } from "../ui/picker/PointsBar";
import { budgetOf, checkAddToBudget } from "../ui/picker/pointsBudget";
import type { CatalogGating } from "../ui/picker/ShipCatalogPanel";
import {
  SquadRosterPanel,
  ROSTER_X,
  ROSTER_W,
  type SquadInstance,
} from "../ui/picker/SquadRosterPanel";
import { showPickerWelcomeBanner } from "../ui/picker/PickerWelcomeBanner";
import { createUnlockedToggle } from "../ui/picker/UnlockedToggle";
import { addPickerActions } from "../ui/picker/PickerActions";
import { getShipLoadouts } from "../data/ShipLoadouts";
import { wouldDuplicateUniquePilot } from "../data/squadRules";
import { PlayerProfileManager } from "../systems/PlayerProfile";
import { isShipUnlocked, lockReason } from "../data/ProgressionData";
import {
  addFooterHint,
  addMenuHeader,
  MENU_CLEAR_COLOR,
  MENU_LAYOUT,
} from "../ui/menu/MenuScaffold";
import { footerKeys } from "../ui/menu/footerKeys";
import {
  factionAccent,
  HOLO_SPACING,
} from "../ui/theme/HoloTheme";

/** How long a refused-action message replaces the points readout, in ms. */
/** Top of the footer points bar (under the panels, above DONE). */
const BAR_Y = 656;
/** The bar stops short of the centred DONE button (px). */
const BAR_W = 512;
/** Full-screen dim over the scene the picker is launched on top of. */
const PICKER_DIM_ALPHA = 0.9;
/** Gap between the three columns. */
const COLUMN_GAP = HOLO_SPACING.lg;
interface PickerConfig {
  slotIndex: number;
  factionId: FactionId;
  selectedShips: string[];
  loadoutChoices?: Record<string, string>;
  pointLimit: number;
  allowCapitals?: boolean;
}

export class ShipPickerScene extends Phaser.Scene {
  private config!: PickerConfig;
  private ships: ShipDefinition[] = [];
  private squadInstances: SquadInstance[] = [];
  private instanceCounter = 0;
  private catalogPanel!: ShipCatalogPanel;
  private rosterPanel!: SquadRosterPanel;
  private pointsBar!: PointsBar;
  private lockedShipIds = new Set<string>();
  private bannerOpen = false;

  constructor() {
    super({ key: "ShipPickerScene" });
  }

  init(data: PickerConfig): void {
    this.config = data;
    this.instanceCounter = 0;
    this.bannerOpen = false;
    this.squadInstances = data.selectedShips.map((shipId, i) => ({
      id: `i${++this.instanceCounter}`,
      shipId,
      loadoutId: this.resolveLoadoutId(data.loadoutChoices ?? {}, shipId, i),
    }));
  }

  /**
   * Resolves a loadout ID from loadoutChoices supporting both formats:
   * - New: index-keyed  { "0": "loadout_id", "1": "other_id" }
   * - Legacy: ship-id keyed  { "ship_foo": "loadout_id" }
   */
  private resolveLoadoutId(
    choices: Record<string, string>,
    shipId: string,
    index: number,
  ): string | null {
    return choices[String(index)] ?? choices[shipId] ?? null;
  }

  create(): void {
    const accent = factionAccent(this.config.factionId);
    this.ships = getShipsByFaction(this.config.factionId).filter(
      (s) =>
        this.config.allowCapitals ||
        (s.role !== "capital" && s.baseStats.size !== "huge"),
    );
    this.buildChrome(accent);
    this.buildCatalogPanel();
    this.buildRosterPanel();
    this.refreshRoster();
    addPickerActions(this, {
      clearRight: ROSTER_X + ROSTER_W,
      onDone: () => this.finish(),
      onClear: () => {
        this.squadInstances = [];
        this.refreshRoster();
      },
      isActive: () => !this.bannerOpen,
      extraTargets: {
        targets: this.catalogPanel.focusTargets,
        onChange: (listener) =>
          this.catalogPanel.on("focusTargetsChanged", listener),
      },
    });
    addFooterHint(
      this,
      footerKeys([
        ["ESC", "done"],
        ["WHEEL", "scroll ships"],
        ["HOVER", "any tag for its meaning"],
      ]),
    );
    bindMenuBack(this, () => this.finish());
    this.maybeShowWelcomeBanner(accent);
  }

  /**
   * Full-screen dim, header, points readout and the unlocked-only toggle.
   *
   * @param accent - Faction accent.
   */
  private buildChrome(accent: number): void {
    const { width: w, height: h } = this.scale;
    const backdrop = this.add.graphics();
    backdrop.fillStyle(MENU_CLEAR_COLOR, PICKER_DIM_ALPHA);
    backdrop.fillRect(0, 0, w, h);
    addMenuHeader(this, {
      title: `SELECT SHIPS \u2014 ${this.factionLabel()}`,
      subtitle: "Pick a ship, choose its payload, then add it to your squad",
      accent,
    });
    this.pointsBar = new PointsBar(
      this,
      {
        x: MENU_LAYOUT.margin,
        y: BAR_Y,
        width: BAR_W,
      },
      accent,
    );
    createUnlockedToggle(
      this,
      { x: MENU_LAYOUT.margin, y: MENU_LAYOUT.subtitleY },
      accent,
      (value) => this.catalogPanel.setShowOnlyUnlocked(value),
    );
  }

  /**
   * One-time explainer for a brand-new (0 XP) profile: why most rows look locked.
   *
   * @param accent - Faction accent for the banner panel.
   */
  private maybeShowWelcomeBanner(accent: number): void {
    if (PlayerProfileManager.getActive().totalXp > 0) return;
    this.bannerOpen = true;
    showPickerWelcomeBanner(this, accent, () => {
      this.bannerOpen = false;
    });
  }

  private factionLabel(): string {
    return this.ships[0]?.faction.replace(/_/g, " ").toUpperCase() ?? "";
  }

  /** Compute XP-lock state for the active profile and expose it to the catalog. */
  private buildGating(): CatalogGating {
    const profile = PlayerProfileManager.getActive();
    this.lockedShipIds = new Set(
      this.ships.filter((s) => !isShipUnlocked(s, profile)).map((s) => s.id),
    );
    const reasons = new Map(
      this.ships.map((s) => [s.id, lockReason(s, profile)]),
    );
    return {
      lockedShipIds: this.lockedShipIds,
      reasonFor: (id: string) => reasons.get(id) ?? "",
    };
  }

  /** Capital ships the format leaves out (listed as an epic-only notice). */
  private hiddenCapitalCount(): number {
    if (this.config.allowCapitals) return 0;
    return getShipsByFaction(this.config.factionId).filter(
      (s) => s.role === "capital" || s.baseStats.size === "huge",
    ).length;
  }

  private buildCatalogPanel(): void {
    this.catalogPanel = new ShipCatalogPanel(
      this,
      this.ships,
      this.config.factionId,
      this.buildGating(),
      "ADD",
      undefined,
      undefined,
      { hiddenCapitals: this.hiddenCapitalCount() },
    );
    // Centre column between the catalog and the roster — never over the roster.
    const detailX = CAT_X + CAT_W + COLUMN_GAP;
    this.catalogPanel.setDetailArea(detailX, ROSTER_X - COLUMN_GAP - detailX);
    this.catalogPanel.on(
      "addInstance",
      ({ shipId, loadoutId }: { shipId: string; loadoutId: string | null }) => {
        if (this.lockedShipIds.has(shipId)) return;
        const roster = this.squadInstances.map((inst) => inst.loadoutId);
        if (wouldDuplicateUniquePilot(roster, loadoutId)) {
          this.flashPointsMessage(
            "Unique pilot already in squad \u2014 a named pilot flies once per squad",
          );
          return;
        }
        const verdict = checkAddToBudget(
          this.totalPoints(),
          this.flownCostOf(shipId, loadoutId),
          this.config.pointLimit,
          this.cheapestShipCost(),
        );
        if (!verdict.ok) {
          this.flashPointsMessage(verdict.reason);
          return;
        }
        this.squadInstances.push({
          id: `i${++this.instanceCounter}`,
          shipId,
          loadoutId,
        });
        this.refreshRoster();
      },
    );
    this.catalogPanel.render();
  }

  private buildRosterPanel(): void {
    this.rosterPanel = new SquadRosterPanel(this, this.config.factionId);
    this.rosterPanel.on("removeInstance", ({ id }: { id: string }) => {
      this.squadInstances = this.squadInstances.filter(
        (inst) => inst.id !== id,
      );
      this.refreshRoster();
    });
  }

  private refreshRoster(): void {
    this.rosterPanel.render(
      this.squadInstances,
      this.ships,
      this.config.pointLimit,
    );
    this.updatePointsText();
  }

  private updatePointsText(): void {
    this.pointsBar.update(
      budgetOf(this.totalPoints(), this.config.pointLimit),
    );
  }

  /**
   * Briefly replaces the points readout with a rule message, then restores it.
   *
   * @param message - Why the last action was refused.
   */
  private flashPointsMessage(message: string): void {
    this.pointsBar.flashRefusal(message);
  }

  private totalPoints(): number {
    return this.squadInstances.reduce(
      (sum, inst) => sum + this.flownCostOf(inst.shipId, inst.loadoutId),
      0,
    );
  }

  /** What one ship costs as flown: its build, else the bare hull. */
  private flownCostOf(shipId: string, loadoutId: string | null): number {
    const loadout = getShipLoadouts(shipId).find((l) => l.id === loadoutId);
    const def = this.ships.find((s) => s.id === shipId);
    return loadout?.pointCost ?? def?.baseStats.pointCost ?? 0;
  }

  /** Cheapest bare hull the player could still pick (for refusal hints). */
  private cheapestShipCost(): number {
    return Math.min(...this.ships.map((s) => s.baseStats.pointCost));
  }

  private finish(): void {
    const ships = this.squadInstances.map((inst) => inst.shipId);
    const loadoutChoices: Record<string, string> = {};
    this.squadInstances.forEach((inst, i) => {
      if (inst.loadoutId) loadoutChoices[String(i)] = inst.loadoutId;
    });
    this.game.events.emit("shipsPicked", {
      slotIndex: this.config.slotIndex,
      ships,
      loadoutChoices,
      pointsUsed: this.totalPoints(),
    });
    this.scene.stop();
  }
}
