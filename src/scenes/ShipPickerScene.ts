/**
 * ShipPickerScene — split-panel ship picker.
 * Left = ShipCatalogPanel (browse ship + loadout, then → ADD).
 * Right = SquadRosterPanel (per-instance rows, hover for details, × to remove).
 *
 * Each ship slot is a SquadInstance so two copies of the same ship can carry
 * different loadouts. Capital ships are blocked unless allowCapitals is set.
 */

import Phaser from "phaser";
import { getShipsByFaction } from "../data/ShipDefinitions";
import type { ShipDefinition } from "../core/types";
import { FACTION_COLORS } from "../config";
import type { FactionId } from "../config";
import { ShipCatalogPanel, CAT_X, CAT_W } from "../ui/picker/ShipCatalogPanel";
import type { CatalogGating } from "../ui/picker/ShipCatalogPanel";
import {
  SquadRosterPanel,
  ROSTER_X,
  ROSTER_W,
  type SquadInstance,
} from "../ui/picker/SquadRosterPanel";
import { getShipLoadouts } from "../data/ShipLoadouts";
import { wouldDuplicateUniquePilot } from "../data/squadRules";
import { PlayerProfileManager } from "../systems/PlayerProfile";
import { isShipUnlocked, lockReason } from "../data/ProgressionData";

/** How long a refused-action message replaces the points readout, in ms. */
const RULE_MESSAGE_MS = 1500;

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
  private pointsText!: Phaser.GameObjects.Text;
  private lockedShipIds = new Set<string>();

  constructor() {
    super({ key: "ShipPickerScene" });
  }

  init(data: PickerConfig): void {
    this.config = data;
    this.instanceCounter = 0;
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
    const { width: w, height: h } = this.scale;
    const fCol = FACTION_COLORS[this.config.factionId];
    this.ships = getShipsByFaction(this.config.factionId).filter(
      (s) =>
        this.config.allowCapitals ||
        (s.role !== "capital" && s.baseStats.size !== "huge"),
    );

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.88);
    backdrop.fillRect(0, 0, w, h);

    this.add
      .text(w / 2, 52, `SELECT SHIPS — ${this.factionLabel()}`, {
        font: "bold 18px Arial",
        color: "#aaccee",
      })
      .setOrigin(0.5);

    this.pointsText = this.add
      .text(ROSTER_X + ROSTER_W - 12, 52, "", {
        font: "bold 13px Arial",
        color: "#44ff88",
      })
      .setOrigin(1, 0.5);

    this.buildCatalogPanel(fCol);
    this.buildRosterPanel();
    this.refreshRoster();
    this.addActionButtons(w / 2, h - 38);
    this.input.keyboard!.on("keydown-ESC", () => this.finish());
    this.maybeShowWelcomeBanner(w, h);
  }

  /** One-time explainer for a brand-new (0 XP) profile: why most rows look locked. */
  private maybeShowWelcomeBanner(w: number, h: number): void {
    if (PlayerProfileManager.getActive().totalXp > 0) return;

    const bannerW = 460;
    const bannerH = 190;
    const x = w / 2 - bannerW / 2;
    const y = h / 2 - bannerH / 2;
    const overlay = this.add.container(0, 0).setDepth(300);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55);
    dim.fillRect(0, 0, w, h);
    overlay.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(0x0d1525, 1);
    panel.fillRoundedRect(x, y, bannerW, bannerH, 10);
    panel.lineStyle(2, 0xffd76a, 0.8);
    panel.strokeRoundedRect(x, y, bannerW, bannerH, 10);
    overlay.add(panel);

    overlay.add(
      this.add
        .text(w / 2, y + 24, "WELCOME, COMMANDER", {
          font: "bold 15px Arial",
          color: "#ffd76a",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          w / 2,
          y + 56,
          "Your fleet grows as you play. You start with a small roster of\n" +
            "workhorses and light fighters — the \u2605 STARTER ship is a solid\n" +
            "first pick. Win battles to earn XP and unlock aces, gunships,\n" +
            "support ships, more factions, and eventually capital ships.",
          { font: "12px Arial", color: "#aac4dd", align: "center" },
        )
        .setOrigin(0.5, 0),
    );

    const btn = this.add
      .text(w / 2, y + bannerH - 26, "GOT IT", {
        font: "bold 13px Arial",
        color: "#0d1525",
        backgroundColor: "#ffd76a",
        padding: { x: 16, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => overlay.destroy());
    overlay.add(btn);
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

  private buildCatalogPanel(fCol: number): void {
    this.catalogPanel = new ShipCatalogPanel(
      this,
      this.ships,
      this.config.factionId,
      this.buildGating(),
    );
    this.catalogPanel.on(
      "addInstance",
      ({ shipId, loadoutId }: { shipId: string; loadoutId: string | null }) => {
        if (this.lockedShipIds.has(shipId)) return;
        const roster = this.squadInstances.map((inst) => inst.loadoutId);
        if (wouldDuplicateUniquePilot(roster, loadoutId)) {
          this.flashPointsMessage("Unique pilot already in squad");
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

    // Panel border behind the catalog
    const g = this.add.graphics();
    g.lineStyle(2, fCol, 0.25);
    g.strokeRoundedRect(CAT_X, 98, CAT_W, 570, 10);

    this.buildUnlockedToggle();
  }

  /** Small checkbox letting a new player hide the (often numerous) still-locked rows. */
  private buildUnlockedToggle(): void {
    let showOnlyUnlocked = false;
    const label = this.add
      .text(CAT_X + 4, 82, "\u2610 Show only unlocked ships", {
        font: "12px Arial",
        color: "#88aacc",
      })
      .setInteractive({ useHandCursor: true });
    label.on("pointerdown", () => {
      showOnlyUnlocked = !showOnlyUnlocked;
      label.setText(
        `${showOnlyUnlocked ? "\u2611" : "\u2610"} Show only unlocked ships`,
      );
      this.catalogPanel.setShowOnlyUnlocked(showOnlyUnlocked);
    });
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
    const total = this.totalPoints();
    const over = total > this.config.pointLimit;
    this.pointsText.setText(`${total} / ${this.config.pointLimit} pts`);
    this.pointsText.setColor(over ? "#ff4444" : "#44ff88");
  }

  /**
   * Briefly replaces the points readout with a rule message, then restores it.
   *
   * @param message - Why the last action was refused.
   */
  private flashPointsMessage(message: string): void {
    this.pointsText.setText(message);
    this.pointsText.setColor("#ffaa44");
    this.time.delayedCall(RULE_MESSAGE_MS, () => this.updatePointsText());
  }

  private totalPoints(): number {
    return this.squadInstances.reduce((sum, inst) => {
      const def = this.ships.find((s) => s.id === inst.shipId);
      const loadout = getShipLoadouts(inst.shipId).find(
        (l) => l.id === inst.loadoutId,
      );
      return sum + (loadout?.pointCost ?? def?.baseStats.pointCost ?? 0);
    }, 0);
  }

  private addActionButtons(cx: number, cy: number): void {
    const doneBtn = this.add.container(cx + 90, cy);
    const doneBg = this.add.graphics();
    doneBg.fillStyle(0x1a3a1a, 1);
    doneBg.fillRoundedRect(-65, -16, 130, 32, 7);
    doneBg.lineStyle(2, 0x44ff88, 1);
    doneBg.strokeRoundedRect(-65, -16, 130, 32, 7);
    doneBtn.add([
      doneBg,
      this.add
        .text(0, 0, "DONE", { font: "bold 15px Arial", color: "#44ff88" })
        .setOrigin(0.5),
    ]);
    doneBtn.setInteractive(
      new Phaser.Geom.Rectangle(-65, -16, 130, 32),
      Phaser.Geom.Rectangle.Contains,
    );
    doneBtn.on("pointerdown", () => this.finish());

    const clearBtn = this.add.container(cx - 90, cy);
    const clearBg = this.add.graphics();
    clearBg.fillStyle(0x2a1a1a, 1);
    clearBg.fillRoundedRect(-55, -16, 110, 32, 7);
    clearBtn.add([
      clearBg,
      this.add
        .text(0, 0, "CLEAR ALL", { font: "13px Arial", color: "#aa4444" })
        .setOrigin(0.5),
    ]);
    clearBtn.setInteractive(
      new Phaser.Geom.Rectangle(-55, -16, 110, 32),
      Phaser.Geom.Rectangle.Contains,
    );
    clearBtn.on("pointerdown", () => {
      this.squadInstances = [];
      this.refreshRoster();
    });
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
