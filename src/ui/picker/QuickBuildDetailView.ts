/**
 * QuickBuildDetailView — the "what this quick build really is" block of the
 * ship picker's detail panel: the pilot (name, initiative, unique marker)
 * and ability (card text + real-time summary + role / best-with hint) on
 * the left; the slot bar (filled vs empty by category, pilot slots edged
 * in gold) and each upgrade's real-time summary and role on the right.
 *
 * Display only (nothing interactive), so it is safe inside the panel's
 * container. All text comes from src/data/quickBuildDetails.ts.
 */

import Phaser from "phaser";
import {
  describeQuickBuild,
  fillSlotBar,
  pilotSlotBar,
  type FilledSlot,
  type QuickBuildDetails,
} from "../../data/quickBuildDetails";
import { ROOKIE_INITIATIVE } from "../../data/pilotPricing";
import { pilotAbilityHint, upgradeHint } from "../../data/roleHints";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { holoFont } from "../theme/holoFont";
import { PICKER_TYPE, pickerTextStyle } from "./pickerStyle";
import { drawSlotChip, SLOT_CHIP } from "./SlotChip";

const COLUMN_GAP = 16;
type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;
/** Share of the block's width given to the pilot column (slots get the rest). */
const PILOT_COLUMN_SHARE = 0.42;
const LINE_GAP = 3;
const SECTION_GAP = 4;
/** Pilot name type step (between card name and panel heading). */
const PILOT_NAME_FONT = { size: 15, weight: "600" } as const;
const HEADER_STYLE = pickerTextStyle("caption", HOLO_PALETTE.textSecondary);
const CAPTION_SPACING = PICKER_TYPE.caption.letterSpacing;
const MUTED_ITALIC = pickerTextStyle("small", HOLO_PALETTE.textMuted, {
  fontStyle: "italic",
});
/** Role-hint line (P2-1): "Flanker — strikes from behind". */
const HINT_ROLE_STYLE = (w: number): TextStyle =>
  pickerTextStyle("micro", HOLO_PALETTE.accent, { wordWrap: { width: w } });
/** "Best with …" line under a role hint. */
const HINT_BEST_STYLE = (w: number): TextStyle =>
  pickerTextStyle("micro", HOLO_PALETTE.textMuted, {
    fontStyle: "400",
    wordWrap: { width: w },
  });

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
   * @param letterSpacing - Extra tracking (captions).
   * @returns y below the text plus a small gap.
   */
  private addText(
    x: number,
    y: number,
    text: string,
    style: TextStyle,
    letterSpacing = 0,
  ): number {
    const t = this.scene.add
      .text(x, y, text, style)
      .setLetterSpacing(letterSpacing);
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
    let cy = this.addText(x, y, "PILOT", HEADER_STYLE, CAPTION_SPACING);
    const pilot = details?.pilot;
    const name = pilot
      ? `${pilot.isUnique ? "\u2605 " : ""}${pilot.name}`
      : "Rookie pilot";
    const initiative = pilot?.initiative ?? ROOKIE_INITIATIVE;
    cy = this.addText(x, cy, name, {
      ...holoFont(PILOT_NAME_FONT.size, PILOT_NAME_FONT.weight),
      color: toCssColor(
        pilot?.isUnique ? HOLO_PALETTE.warning : HOLO_PALETTE.textPrimary,
      ),
    });
    const tags = [`Initiative ${initiative}`];
    if (pilot?.isUnique) tags.push("Unique \u2014 one per squad");
    cy = this.addText(
      x,
      cy,
      tags.join("  \u00b7  "),
      pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
        wordWrap: { width: w },
      }),
    );
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
      return this.addText(x, y, "No pilot ability", MUTED_ITALIC);
    }
    let cy = this.addText(
      x,
      y,
      `ABILITY \u2014 ${ability.name}`,
      pickerTextStyle("name", HOLO_PALETTE.accent),
    );
    if (ability.cardText) {
      cy = this.addText(
        x,
        cy,
        `\u201c${ability.cardText}\u201d`,
        pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
          fontStyle: "italic",
          wordWrap: { width: w },
        }),
      );
    }
    const cy2 = this.addText(
      x,
      cy,
      `\u25b8 ${ability.summary || "No real-time effect"}`,
      pickerTextStyle("small", HOLO_PALETTE.success, {
        fontStyle: "600",
        wordWrap: { width: w },
      }),
    );
    const hint = pilotAbilityHint(ability.id);
    const roleY = this.addText(x, cy2, hint.role, HINT_ROLE_STYLE(w));
    return this.addText(x, roleY, hint.bestWith, HINT_BEST_STYLE(w));
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
    const cy = this.addText(
      x,
      y,
      `SLOTS  ${filled}/${slots.length} FILLED`,
      HEADER_STYLE,
      CAPTION_SPACING,
    );
    const perRow = Math.max(
      1,
      Math.floor((w + SLOT_CHIP.gap) / (SLOT_CHIP.width + SLOT_CHIP.gap)),
    );
    slots.forEach((slot, i) => {
      const chipX = x + (i % perRow) * (SLOT_CHIP.width + SLOT_CHIP.gap);
      const chipY =
        cy + Math.floor(i / perRow) * (SLOT_CHIP.height + SLOT_CHIP.gap);
      drawSlotChip(this.scene, this.container, slot, { x: chipX, y: chipY });
    });
    const rows = Math.ceil(slots.length / perRow);
    const below = cy + rows * (SLOT_CHIP.height + SLOT_CHIP.gap);
    if (!slots.some((slot) => slot.fromPilot)) return below;
    return this.addText(
      x,
      below + LINE_GAP,
      "Gold edge = added by the pilot",
      pickerTextStyle("micro", HOLO_PALETTE.textMuted, { fontStyle: "400" }),
    );
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
    let cy = this.addText(x, y, "UPGRADES", HEADER_STYLE, CAPTION_SPACING);
    const upgrades = details?.upgrades ?? [];
    if (upgrades.length === 0) {
      return this.addText(x, cy, "None equipped", MUTED_ITALIC);
    }
    for (const upgrade of upgrades) {
      const summary = upgrade.summary ? `: ${upgrade.summary}` : "";
      cy = this.addText(
        x,
        cy,
        `\u25c6 ${upgrade.name}${summary}`,
        pickerTextStyle("small", HOLO_PALETTE.textPrimary, {
          wordWrap: { width: w },
        }),
      );
      const card = UPGRADE_DEFINITIONS[upgrade.id];
      if (card) {
        const role = `   ${upgradeHint(card).role}`;
        cy = this.addText(x, cy, role, HINT_ROLE_STYLE(w));
      }
    }
    return cy;
  }
}
