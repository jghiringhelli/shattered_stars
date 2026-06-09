/**
 * SquadCard — renders one squad slot in SquadBuilderScene.
 * Always shows ship list. Clicking any non-button area on the card opens the
 * ship editor (emits 'editShips'). Buttons and team chips work independently.
 *
 * Emits: 'changed' | 'factionChanged' | 'teamChanged' teamId |
 *        'autoFill' | 'editShips' | 'remove'
 */

import Phaser from "phaser";
import type { SquadEntry } from "../../core/squadTypes";
import { TEAM_COLORS, TEAM_LABELS } from "../../core/squadTypes";
import { FACTION_COLORS } from "../../config";
import type { FactionId } from "../../config";
import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import { getShipLoadouts } from "../../data/ShipLoadouts";

export const CARD_W = 260;
export const CARD_H_COLLAPSED = 100;
export const SHIP_ROW_H = 38;
export const MAX_SHOWN_SHIPS = 3;

const TEAM_ROW_Y = 42;
const ACTION_Y = 68;
const BTN_W = 80;
const BTN_H = 22;
const CHIP_W = 28;
const CHIP_H = 16;
const DIVIDER_Y = CARD_H_COLLAPSED + 4;

const FACTION_IDS: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];
const FACTION_SHORT: Record<FactionId, string> = {
  terran_hegemony: "Terran",
  free_confederation: "Confed",
  synthetic_collective: "Synth",
  void_corsairs: "Corsair",
  ascendant_empire: "Ascend",
};
const FACTION_FULL: Record<FactionId, string> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

export interface SquadCardConfig {
  squad: SquadEntry;
  pointLimit: number;
}

export class SquadCard extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private readonly squad: SquadEntry;
  private readonly pointLimit: number;
  private container!: Phaser.GameObjects.Container;

  /** Exposed so SquadListPanel can nest this card inside its scrollable container. */
  get cardContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  constructor(scene: Phaser.Scene, config: SquadCardConfig) {
    super();
    this.scene = scene;
    this.squad = config.squad;
    this.pointLimit = config.pointLimit;
  }

  /** Total card height including ship rows */
  get height(): number {
    const shown = Math.min(
      Math.max(this.squad.ships.length, 1),
      MAX_SHOWN_SHIPS,
    );
    return CARD_H_COLLAPSED + 12 + shown * SHIP_ROW_H + 10;
  }

  /** Render or re-render at position */
  render(x: number, y: number): void {
    this.container?.destroy();
    this.container = this.scene.add.container(x, y);
    this.drawBackground();
    this.drawHeader();
    this.drawTeamRow();
    this.drawActionRow();
    this.drawShipList();
  }

  destroy(): void {
    this.container?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const h = this.height;
    const fCol = this.squad.factionId
      ? FACTION_COLORS[this.squad.factionId]
      : 0x334455;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1e2a3a, 0.97);
    bg.fillRoundedRect(0, 0, CARD_W, h, 6);
    bg.lineStyle(2, fCol, 0.65);
    bg.strokeRoundedRect(0, 0, CARD_W, h, 6);

    // Decorative header strip (visual only)
    const strip = this.scene.add.rectangle(
      CARD_W / 2,
      19,
      CARD_W - 4,
      36,
      fCol,
      0.1,
    );

    // Transparent click zone covering the whole card body (excludes rightmost 28px where ✕ sits).
    // Team chips, action buttons, and ✕ are added later in z-order so they receive events first.
    const editZone = this.scene.add
      .rectangle((CARD_W - 28) / 2, h / 2, CARD_W - 28, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    editZone.on("pointerover", () => strip.setAlpha(0.18));
    editZone.on("pointerout", () => strip.setAlpha(0.1));
    editZone.on("pointerdown", () => this.emit("editShips"));
    this.container.add([bg, strip, editZone]);
  }

  private drawHeader(): void {
    const fCol = this.squad.factionId
      ? FACTION_COLORS[this.squad.factionId]
      : 0x334455;
    const hexCol = `#${fCol.toString(16).padStart(6, "0")}`;
    // Use abbreviated name so it never runs into the points counter on the right
    const name = this.squad.factionId
      ? FACTION_SHORT[this.squad.factionId]
      : "Select Faction";
    this.container.add(
      this.scene.add.text(10, 5, name, {
        font: "bold 13px Arial",
        color: hexCol,
      }),
    );
    const over = this.squad.pointsUsed > this.pointLimit;
    this.container.add(
      this.scene.add
        .text(CARD_W - 28, 5, `${this.squad.pointsUsed}/${this.pointLimit}pt`, {
          font: "11px Arial",
          color: over ? "#ff5544" : "#44ff88",
        })
        .setOrigin(1, 0),
    );
    this.container.add(
      this.scene.add.text(10, 22, this.buildShipSummary(), {
        font: "11px Arial",
        color: "#7a8fa8",
      }),
    );
    this.container.add(
      this.scene.add
        .text(CARD_W - 28, 22, "✏ edit ships", {
          font: "9px Arial",
          color: "#3a5066",
        })
        .setOrigin(1, 0),
    );
    const rm = this.scene.add
      .text(CARD_W - 6, 4, "✕", { font: "bold 13px Arial", color: "#885555" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    rm.on("pointerover", () => rm.setColor("#ff7777"));
    rm.on("pointerout", () => rm.setColor("#885555"));
    rm.on("pointerdown", () => this.emit("remove"));
    this.container.add(rm);
  }

  private buildShipSummary(): string {
    const n = this.squad.ships.length;
    if (n === 0) return "No ships — auto-fill or tap to edit";
    const names = this.squad.ships
      .slice(0, 2)
      .map((id) => SHIP_DEFINITIONS[id]?.name ?? id);
    return n > 2 ? `${names.join(", ")} +${n - 2} more` : names.join(", ");
  }

  private drawTeamRow(): void {
    const y = TEAM_ROW_Y;
    TEAM_LABELS.forEach((label, i) => {
      const teamId = i + 1;
      const active = this.squad.teamId === teamId;
      const col = TEAM_COLORS[i]!;
      const chip = this.scene.add.container(6 + i * (CHIP_W + 5), y);
      const bg = this.scene.add.graphics();
      bg.fillStyle(active ? col : 0x111928, active ? 0.5 : 1);
      bg.fillRoundedRect(0, 0, CHIP_W, CHIP_H, 3);
      bg.lineStyle(1, col, active ? 0.9 : 0.3);
      bg.strokeRoundedRect(0, 0, CHIP_W, CHIP_H, 3);
      const hexCol = `#${col.toString(16).padStart(6, "0")}`;
      const txt = this.scene.add
        .text(CHIP_W / 2, CHIP_H / 2, label, {
          font: `${active ? "bold " : ""}9px Arial`,
          color: active ? "#ffffff" : hexCol,
        })
        .setOrigin(0.5);
      chip.add([bg, txt]);
      chip.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, CHIP_W, CHIP_H),
        Phaser.Geom.Rectangle.Contains,
      );
      chip.on("pointerdown", () => this.emit("teamChanged", teamId));
      this.container.add(chip);
    });
  }

  private drawActionRow(): void {
    const ctrlLabel = this.squad.controller === "player" ? "Player" : "AI";
    const ctrlColor =
      this.squad.controller === "player" ? "#44ee88" : "#ee8844";
    const fLabel = this.squad.factionId
      ? FACTION_SHORT[this.squad.factionId]
      : "Faction";
    this.container.add(
      this.makeBtn(6, ACTION_Y, fLabel, "#99aacc", () => this.cycleFaction()),
    );
    this.container.add(
      this.makeBtn(92, ACTION_Y, ctrlLabel, ctrlColor, () =>
        this.toggleController(),
      ),
    );
    this.container.add(
      this.makeBtn(178, ACTION_Y, "Auto-Fill", "#8899aa", () =>
        this.emit("autoFill"),
      ),
    );
  }

  private drawShipList(): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x1e2a38, 1);
    divider.lineBetween(8, DIVIDER_Y, CARD_W - 8, DIVIDER_Y);
    this.container.add(divider);

    if (this.squad.ships.length === 0) {
      this.container.add(
        this.scene.add.text(
          14,
          DIVIDER_Y + 10,
          "No ships — tap card header or Auto-Fill",
          { font: "9px Arial", color: "#445566" },
        ),
      );
      return;
    }

    const shown = Math.min(this.squad.ships.length, MAX_SHOWN_SHIPS);
    this.squad.ships
      .slice(0, shown)
      .forEach((shipId, i) => this.drawShipRow(shipId, i));

    if (this.squad.ships.length > MAX_SHOWN_SHIPS) {
      const extra = this.squad.ships.length - MAX_SHOWN_SHIPS;
      const moreY = DIVIDER_Y + 8 + MAX_SHOWN_SHIPS * SHIP_ROW_H;
      this.container.add(
        this.scene.add.text(14, moreY, `+${extra} more ships — tap to edit`, {
          font: "9px Arial",
          color: "#445566",
        }),
      );
    }
  }

  private drawShipRow(shipId: string, index: number): void {
    const def = SHIP_DEFINITIONS[shipId];
    if (!def) return;
    const y = DIVIDER_Y + 8 + index * SHIP_ROW_H;
    const loadoutId =
      this.squad.loadoutChoices[String(index)] ??
      this.squad.loadoutChoices[shipId];
    const loadout = loadoutId
      ? getShipLoadouts(shipId).find((l) => l.id === loadoutId)
      : null;
    const pts = loadout?.pointCost ?? def.baseStats.pointCost;
    const desc = loadout ? loadout.description : def.description;
    const statsLabel = `ATK ${def.baseStats.attack}  HUL ${def.baseStats.hull}  SHD ${def.baseStats.shields}`;
    const spriteX = 6 + 12;
    const spriteY = y + SHIP_ROW_H / 2 - 2;

    // Dark bg circle makes sprites visible against the card background
    const spriteBg = this.scene.add.graphics();
    spriteBg.fillStyle(0x0d1620, 0.8);
    spriteBg.fillCircle(spriteX, spriteY, 14);

    this.container.add(
      this.scene.add
        .text(CARD_W - 6, y + 2, `${pts}pt`, {
          font: "11px Arial",
          color: "#88aa66",
        })
        .setOrigin(1, 0),
    );
    this.container.add(
      this.scene.add.text(36, y + 2, def.name, {
        font: "bold 11px Arial",
        color: "#d8ecff",
      }),
    );
    this.container.add(
      this.scene.add.text(36, y + 15, statsLabel, {
        font: "10px Arial",
        color: "#6a8aaa",
      }),
    );
    const truncDesc = desc.length > 36 ? `${desc.slice(0, 33)}…` : desc;
    this.container.add(
      this.scene.add.text(36, y + 26, truncDesc, {
        font: "9px Arial",
        color: "#5a6c7a",
      }),
    );
    this.container.add(spriteBg);
    // Use real sprite if loaded; fall back to faction+size placeholder
    const spriteKey = this.scene.textures.exists(def.spriteKey)
      ? def.spriteKey
      : `ship_${this.squad.factionId ?? "terran_hegemony"}_${def.baseStats.size}`;
    const sprite = this.scene.add
      .image(spriteX, spriteY, spriteKey)
      .setDisplaySize(22, 22);
    this.container.add(sprite);
  }

  private cycleFaction(): void {
    const idx = this.squad.factionId
      ? FACTION_IDS.indexOf(this.squad.factionId)
      : -1;
    this.squad.factionId = FACTION_IDS[
      (idx + 1) % FACTION_IDS.length
    ] as FactionId;
    this.emit("factionChanged");
  }

  private toggleController(): void {
    this.squad.controller =
      this.squad.controller === "player" ? "ai" : "player";
    this.emit("changed");
  }

  private makeBtn(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x243040, 1);
    bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3);
    const txt = this.scene.add
      .text(BTN_W / 2, BTN_H / 2, label, { font: "10px Arial", color })
      .setOrigin(0.5);
    c.add([bg, txt]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, BTN_W, BTN_H),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x344454, 1);
      bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3);
    });
    c.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x243040, 1);
      bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3);
    });
    c.on("pointerdown", onClick);
    return c;
  }
}
