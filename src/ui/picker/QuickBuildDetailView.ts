/**
 * QuickBuildDetailView — the "what this quick build really is" block of the
 * ship picker's detail panel: the pilot (name, initiative, unique marker)
 * and ability (card text + real-time summary) on the left; the slot bar
 * (filled vs empty by category, pilot slots edged in gold) and each
 * upgrade's real-time summary on the right.
 *
 * Display only (nothing interactive), so it is safe inside the panel's
 * container. All text comes from src/data/quickBuildDetails.ts.
 */

import Phaser from "phaser";
import type { UpgradeSlotType } from "../../core/upgradeTypes";
import {
  describeQuickBuild,
  fillSlotBar,
  pilotSlotBar,
  type FilledSlot,
  type QuickBuildDetails,
} from "../../data/quickBuildDetails";
import { ROOKIE_INITIATIVE } from "../../data/pilotPricing";
import type { ShipLoadout } from "../../data/ShipLoadouts";

/** Short chip label and colour per slot category. */
const SLOT_STYLE: Readonly<
  Record<UpgradeSlotType, { readonly label: string; readonly color: number }>
> = {
  talent: { label: "TAL", color: 0xffcc66 },
  missile: { label: "MSL", color: 0xff7755 },
  torpedo: { label: "TRP", color: 0xff5566 },
  cannon: { label: "CAN", color: 0xff9944 },
  turret: { label: "TUR", color: 0xffaa77 },
  bomb: { label: "BMB", color: 0xdd6644 },
  crew: { label: "CRW", color: 0x66ccff },
  gunner: { label: "GUN", color: 0xff8866 },
  astromech: { label: "AST", color: 0x88ddff },
  sensor: { label: "SEN", color: 0x55ddcc },
  tech: { label: "TEC", color: 0x88aaff },
  modification: { label: "MOD", color: 0x99cc66 },
  illicit: { label: "ILL", color: 0xcc66cc },
  title: { label: "TTL", color: 0xddddaa },
  configuration: { label: "CFG", color: 0xaabbcc },
  force_power: { label: "FRC", color: 0xbb88ff },
};

const COLUMN_GAP = 16;
/** Share of the block's width given to the pilot column (slots get the rest). */
const PILOT_COLUMN_SHARE = 0.42;
const CHIP_W = 44;
const CHIP_H = 18;
const CHIP_GAP = 4;
const LINE_GAP = 3;
const SECTION_GAP = 4;
const PILOT_SLOT_EDGE = 0xffd76a;
const HEADER_STYLE = { font: "bold 11px Arial", color: "#3a5a7a" } as const;

/** Where to draw and what. */
export interface QuickBuildDetailArgs {
  readonly shipId: string;
  /** The selected quick build, or undefined for the bare ship. */
  readonly loadout: ShipLoadout | undefined;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Draws one quick build's pilot / ability / slots / upgrades block. */
export class QuickBuildDetailView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
  ) {}

  /**
   * Renders the block.
   *
   * @param args - Ship, selected build and the block's box.
   * @returns The y just below the block.
   */
  render(args: QuickBuildDetailArgs): number {
    const pilotW = (args.width - COLUMN_GAP) * PILOT_COLUMN_SHARE;
    const slotsW = args.width - COLUMN_GAP - pilotW;
    const details = args.loadout ? describeQuickBuild(args.loadout) : null;
    const slots = details?.slots ?? fillSlotBar(pilotSlotBar(args.shipId), []);
    const pilotBottom = this.drawPilot(details, args.x, args.y, pilotW);
    const slotsX = args.x + pilotW + COLUMN_GAP;
    const slotsBottom = this.drawSlots(slots, slotsX, args.y, slotsW);
    const upgradesBottom = this.drawUpgrades(
      details,
      slotsX,
      slotsBottom + SECTION_GAP,
      slotsW,
    );
    return Math.max(pilotBottom, upgradesBottom);
  }

  /**
   * Adds a text object and returns the y below it.
   * @param x - Left edge.
   * @param y - Top edge.
   * @param text - Content.
   * @param style - Phaser text style.
   * @returns y below the text plus a small gap.
   */
  private addText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): number {
    const t = this.scene.add.text(x, y, text, style);
    this.container.add(t);
    return y + t.height + LINE_GAP;
  }

  /**
   * Pilot name / initiative / unique marker, then the ability.
   * @param details - The build (null for the bare ship).
   * @param x - Column left.
   * @param y - Column top.
   * @param w - Column width.
   * @returns y below the column.
   */
  private drawPilot(
    details: QuickBuildDetails | null,
    x: number,
    y: number,
    w: number,
  ): number {
    let cy = this.addText(x, y, "PILOT", HEADER_STYLE);
    const pilot = details?.pilot;
    const name = pilot
      ? `${pilot.isUnique ? "\u2605 " : ""}${pilot.name}`
      : "Rookie pilot";
    const initiative = pilot?.initiative ?? ROOKIE_INITIATIVE;
    cy = this.addText(x, cy, name, {
      font: "bold 14px Arial",
      color: pilot?.isUnique ? "#ffd76a" : "#eef6ff",
    });
    const tags = [`Initiative ${initiative}`];
    if (pilot?.isUnique) tags.push("Unique \u2014 one per squad");
    cy = this.addText(x, cy, tags.join("  \u00b7  "), {
      font: "11px Arial",
      color: "#8ab0cc",
    });
    return this.drawAbility(details, x, cy + LINE_GAP, w);
  }

  /**
   * Ability name, card text and real-time summary.
   * @param details - The build (null for the bare ship).
   * @param x - Column left.
   * @param y - Top.
   * @param w - Column width.
   * @returns y below the ability.
   */
  private drawAbility(
    details: QuickBuildDetails | null,
    x: number,
    y: number,
    w: number,
  ): number {
    const ability = details?.ability;
    if (!ability) {
      return this.addText(x, y, "No pilot ability", {
        font: "italic 11px Arial",
        color: "#5a7a8a",
      });
    }
    let cy = this.addText(x, y, `ABILITY \u2014 ${ability.name}`, {
      font: "bold 12px Arial",
      color: "#66bbee",
    });
    if (ability.cardText) {
      cy = this.addText(x, cy, `\u201c${ability.cardText}\u201d`, {
        font: "italic 11px Arial",
        color: "#7090a8",
        wordWrap: { width: w },
      });
    }
    return this.addText(
      x,
      cy,
      `\u25b8 ${ability.summary || "No real-time effect"}`,
      {
        font: "bold 11px Arial",
        color: "#88ffcc",
        wordWrap: { width: w },
      },
    );
  }

  /**
   * Slot bar as chips: filled ones solid, empty ones outlined, pilot slots
   * edged in gold.
   * @param slots - The filled slot bar.
   * @param x - Column left.
   * @param y - Column top.
   * @param w - Column width.
   * @returns y below the chips.
   */
  private drawSlots(
    slots: readonly FilledSlot[],
    x: number,
    y: number,
    w: number,
  ): number {
    const filled = slots.filter((slot) => slot.upgradeId !== null).length;
    const legend = slots.some((slot) => slot.fromPilot)
      ? "   (gold edge = added by the pilot)"
      : "";
    const cy = this.addText(
      x,
      y,
      `SLOTS  ${filled}/${slots.length} FILLED${legend}`,
      HEADER_STYLE,
    );
    const perRow = Math.max(
      1,
      Math.floor((w + CHIP_GAP) / (CHIP_W + CHIP_GAP)),
    );
    slots.forEach((slot, i) => {
      const chipX = x + (i % perRow) * (CHIP_W + CHIP_GAP);
      const chipY = cy + Math.floor(i / perRow) * (CHIP_H + CHIP_GAP);
      this.drawChip(slot, chipX, chipY);
    });
    return cy + Math.ceil(slots.length / perRow) * (CHIP_H + CHIP_GAP);
  }

  /**
   * One slot chip.
   * @param slot - The slot.
   * @param x - Chip left.
   * @param y - Chip top.
   */
  private drawChip(slot: FilledSlot, x: number, y: number): void {
    const style = SLOT_STYLE[slot.type];
    const isFilled = slot.upgradeId !== null;
    const g = this.scene.add.graphics();
    g.fillStyle(isFilled ? style.color : 0x131c28, isFilled ? 0.85 : 1);
    g.fillRoundedRect(x, y, CHIP_W, CHIP_H, 3);
    g.lineStyle(
      slot.fromPilot ? 2 : 1,
      slot.fromPilot ? PILOT_SLOT_EDGE : style.color,
      isFilled || slot.fromPilot ? 1 : 0.5,
    );
    g.strokeRoundedRect(x, y, CHIP_W, CHIP_H, 3);
    const label = this.scene.add
      .text(x + CHIP_W / 2, y + CHIP_H / 2, style.label, {
        font: "bold 10px Arial",
        color: isFilled
          ? "#0d1525"
          : `#${style.color.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0.5)
      .setAlpha(isFilled ? 1 : 0.6);
    this.container.add([g, label]);
  }

  /**
   * Each upgrade with its real-time summary.
   * @param details - The build (null for the bare ship).
   * @param x - Column left.
   * @param y - Top.
   * @param w - Column width.
   * @returns y below the list.
   */
  private drawUpgrades(
    details: QuickBuildDetails | null,
    x: number,
    y: number,
    w: number,
  ): number {
    let cy = this.addText(x, y, "UPGRADES", HEADER_STYLE);
    const upgrades = details?.upgrades ?? [];
    if (upgrades.length === 0) {
      return this.addText(x, cy, "None equipped", {
        font: "italic 11px Arial",
        color: "#5a7a8a",
      });
    }
    for (const upgrade of upgrades) {
      const summary = upgrade.summary ? `: ${upgrade.summary}` : "";
      cy = this.addText(x, cy, `\u25c6 ${upgrade.name}${summary}`, {
        font: "11px Arial",
        color: "#b0c8dc",
        wordWrap: { width: w },
      });
    }
    return cy;
  }
}
