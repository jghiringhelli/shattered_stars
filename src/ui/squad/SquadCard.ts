/**
 * SquadCard — renders one squad slot in SquadBuilderScene as a holo card:
 * faction-accented frame with a header strip (faction, points, remove),
 * team chips, an action row and the ship list. Clicking any non-control
 * area opens the ship editor (emits 'editShips'). Buttons and team chips
 * work independently.
 *
 * Emits: 'changed' | 'factionChanged' | 'teamChanged' teamId |
 *        'autoFill' | 'editShips' | 'remove'
 */

import Phaser from "phaser";
import type { SquadEntry } from "../../core/squadTypes";
import type { FactionId } from "../../config";
import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_TYPE_SCALE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { factionTermId } from "../../data/tooltips";
import { attachHintTooltip, attachTermTooltip } from "../menu/HintTooltip";
import { contentFromTerm } from "../menu/tooltipContent";
import { addTipZone } from "../menu/tooltipTargets";
import {
  CARD_LAYOUT,
  CARD_W,
  MAX_SHOWN_SHIPS,
  SHIP_ROW_H,
  SHIP_ROW_LAYOUT,
  squadCardHeight,
} from "./squadCardLayout";
import {
  createCardAction,
  createRemoveControl,
  createShipRow,
  createTeamChips,
  drawCardChrome,
} from "./squadCardParts";
import {
  SQUAD_TYPE,
  addCaption,
  addSquadText,
  squadAccent,
  truncateText,
} from "./squadBuilderStyle";

export {
  CARD_W,
  CARD_H_COLLAPSED,
  SHIP_ROW_H,
  MAX_SHOWN_SHIPS,
} from "./squadCardLayout";

/** Opacity of the divider above the ship list. */
const DIVIDER_ALPHA = 0.4;

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

/** Construction options for {@link SquadCard}. */
export interface SquadCardConfig {
  squad: SquadEntry;
  pointLimit: number;
}

/** One squad slot card. */
export class SquadCard extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private readonly squad: SquadEntry;
  private readonly pointLimit: number;
  private container!: Phaser.GameObjects.Container;

  /** Exposed so SquadListPanel can nest this card inside its scrollable container. */
  get cardContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * @param scene - Owning scene.
   * @param config - Squad (mutated by faction / controller controls) and point limit.
   */
  constructor(scene: Phaser.Scene, config: SquadCardConfig) {
    super();
    this.scene = scene;
    this.squad = config.squad;
    this.pointLimit = config.pointLimit;
  }

  /** Total card height including ship rows */
  get height(): number {
    return squadCardHeight(this.squad);
  }

  /**
   * Render or re-render at position.
   *
   * @param x - Left edge in the parent container.
   * @param y - Top edge in the parent container.
   */
  render(x: number, y: number): void {
    this.container?.destroy();
    this.container = this.scene.add.container(x, y);
    this.drawBackground();
    this.drawHeader();
    this.container.add(
      createTeamChips(this.scene, this.squad.teamId, (teamId) =>
        this.emit("teamChanged", teamId),
      ),
    );
    this.drawActionRow();
    this.drawShipList();
  }

  /** Destroy the card's display objects and listeners. */
  destroy(): void {
    this.container?.destroy();
    super.destroy();
  }

  private get accent(): number {
    return squadAccent(this.squad.factionId);
  }

  private drawBackground(): void {
    const height = this.height;
    const chrome = this.scene.add.graphics();
    const featured = this.squad.controller === "player";
    const paint = (hovered: boolean): void =>
      drawCardChrome(chrome, {
        height,
        accent: this.accent,
        hovered,
        featured,
      });
    paint(false);
    const editHint = addCaption(
      this.scene,
      CARD_W - CARD_LAYOUT.pad,
      CARD_LAYOUT.chipRowY + CARD_LAYOUT.chipH / 2,
      "Edit ships",
      HOLO_PALETTE.textMuted,
    ).setOrigin(1, 0.5);
    // Transparent click zone covering the whole card. Team chips, action
    // buttons and the remove control are added later in z-order so they
    // receive events first.
    const editZone = this.scene.add
      .rectangle(CARD_W / 2, height / 2, CARD_W, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    editZone.on("pointerover", () => {
      paint(true);
      editHint.setColor(toCssColor(this.accent));
    });
    editZone.on("pointerout", () => {
      paint(false);
      editHint.setColor(toCssColor(HOLO_PALETTE.textMuted));
    });
    editZone.on("pointerdown", () => this.emit("editShips"));
    this.container.add([chrome, editZone, editHint]);
  }

  private drawHeader(): void {
    const { pad, titleY, summaryY, closeBox } = CARD_LAYOUT;
    const name = this.squad.factionId
      ? FACTION_SHORT[this.squad.factionId]
      : "Select Faction";
    const over = this.squad.pointsUsed > this.pointLimit;
    const pointsText = addSquadText(
      this.scene,
      CARD_W - closeBox,
      titleY,
      `${this.squad.pointsUsed}/${this.pointLimit}pt`,
      {
        size: SQUAD_TYPE.label,
        weight: "600",
        color: over ? HOLO_PALETTE.danger : HOLO_PALETTE.success,
      },
    ).setOrigin(1, 0);
    this.container.add([
      addSquadText(this.scene, pad, titleY, name.toUpperCase(), {
        size: SQUAD_TYPE.body,
        weight: "600",
        color: this.accent,
        letterSpacing: HOLO_TYPE_SCALE.caption.letterSpacing,
      }),
      pointsText,
      addSquadText(
        this.scene,
        pad,
        summaryY,
        truncateText(this.buildShipSummary(), SHIP_ROW_LAYOUT.summaryChars),
        { size: SQUAD_TYPE.caption, color: HOLO_PALETTE.textSecondary },
      ),
      ...createRemoveControl(this.scene, () => this.emit("remove")),
    ]);
    addTipZone(
      this.scene,
      this.container,
      { x: pointsText.x - pointsText.width, y: pointsText.y, width: pointsText.width, height: pointsText.height },
      "ui.points_total",
      () => this.emit("editShips"),
    );
  }

  private buildShipSummary(): string {
    const n = this.squad.ships.length;
    if (n === 0) return "No ships — auto-fill or tap to edit";
    const names = this.squad.ships
      .slice(0, 2)
      .map((id) => SHIP_DEFINITIONS[id]?.name ?? id);
    return n > 2 ? `${names.join(", ")} +${n - 2} more` : names.join(", ");
  }

  private drawActionRow(): void {
    const isPlayer = this.squad.controller === "player";
    const factionLabel = this.squad.factionId
      ? FACTION_SHORT[this.squad.factionId]
      : "Faction";
    const [faction, controller, autoFill] = [
      createCardAction(this.scene, 0, factionLabel, "secondary", () =>
        this.cycleFaction(),
      ),
      createCardAction(
        this.scene,
        1,
        isPlayer ? "Player" : "AI",
        isPlayer ? "primary" : "secondary",
        () => this.toggleController(),
      ),
      createCardAction(this.scene, 2, "Auto-Fill", "secondary", () =>
        this.emit("autoFill"),
      ),
    ] as const;
    const { factionId } = this.squad;
    attachHintTooltip(this.scene, faction, () =>
      contentFromTerm(
        factionId ? factionTermId(factionId) : "faction.terran_hegemony",
      ),
    );
    attachTermTooltip(this.scene, controller, "ui.controller");
    attachTermTooltip(this.scene, autoFill, "ui.auto_fill");
    this.container.add([faction, controller, autoFill]);
  }

  private drawShipList(): void {
    const { pad, dividerY, listPad } = CARD_LAYOUT;
    const divider = this.scene.add.graphics();
    divider.lineStyle(HOLO_BORDER.hairline, HOLO_PALETTE.border, DIVIDER_ALPHA);
    divider.lineBetween(pad, dividerY, CARD_W - pad, dividerY);
    this.container.add(divider);
    const listTop = dividerY + listPad;

    if (this.squad.ships.length === 0) {
      this.container.add(
        this.mutedLine(
          listTop + SHIP_ROW_H / 2,
          "No ships — tap card header or Auto-Fill",
        ),
      );
      return;
    }

    this.squad.ships.slice(0, MAX_SHOWN_SHIPS).forEach((shipId, index) => {
      this.container.add(
        createShipRow(this.scene, {
          shipId,
          top: listTop + index * SHIP_ROW_H,
          factionId: this.squad.factionId,
          loadoutId:
            this.squad.loadoutChoices[String(index)] ??
            this.squad.loadoutChoices[shipId],
        }),
      );
    });

    if (this.squad.ships.length > MAX_SHOWN_SHIPS) {
      const extra = this.squad.ships.length - MAX_SHOWN_SHIPS;
      const moreY =
        listTop + MAX_SHOWN_SHIPS * SHIP_ROW_H + CARD_LAYOUT.moreLineH / 2;
      this.container.add(
        this.mutedLine(moreY, `+${extra} more ships — tap to edit`),
      );
    }
  }

  private mutedLine(centreY: number, text: string): Phaser.GameObjects.Text {
    return addSquadText(this.scene, CARD_LAYOUT.pad, centreY, text, {
      size: SQUAD_TYPE.small,
      color: HOLO_PALETTE.textMuted,
    }).setOrigin(0, 0.5);
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
}
