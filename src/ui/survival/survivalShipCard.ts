/**
 * Survival setup ship card — a holo card per starter ship: name, role,
 * icon stat readouts (hull / shields / agility), description and the role's
 * pros / cons. Selected = faction-accent border, tint and corner ticks.
 *
 * Objects are created as direct scene children and returned for the caller
 * to track/destroy (setup screens rebuild cards on every selection).
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { getRoleProsCons } from "../../data/ShipRoleProfiles";
import { drawStatGlyph, type StatGlyph } from "../hud/HudIcons";
import { drawHoloFrame } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Card inner layout (offsets from the card's top edge). */
const CARD = {
  padding: HOLO_SPACING.lg,
  nameY: 26,
  roleY: 50,
  statsY: 82,
  statGap: 92,
  statIcon: 14,
  /** Stat readout offsets from each readout's centre. */
  statIconDx: -30,
  statValueDx: -20,
  statCaptionDx: -6,
  statCaptionSize: 10,
  bodySize: 12,
  nameSize: 18,
  descY: 106,
  prosFromBottom: 52,
  consFromBottom: 28,
  selectedFillAlpha: 0.14,
} as const;

/** What a card shows and where. */
export interface SurvivalShipCardOptions {
  /** Card centre x. */
  readonly x: number;
  /** Card top y. */
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly def: ShipDefinition;
  readonly selected: boolean;
  /** Faction accent for the selected state. */
  readonly accent: number;
  readonly onSelect: () => void;
}

/**
 * Render one ship card.
 *
 * @param scene - Setup scene (camera zoom 1).
 * @param options - Card placement, ship and state.
 * @returns Every created object (caller destroys them on rebuild).
 */
export function renderSurvivalShipCard(
  scene: Phaser.Scene,
  options: SurvivalShipCardOptions,
): Phaser.GameObjects.GameObject[] {
  const { x, top, width, height, def, selected, accent } = options;
  const left = x - width / 2;
  const bg = scene.add.graphics();
  drawHoloFrame(
    bg,
    { x: left, y: top, width, height },
    {
      accent: selected ? accent : HOLO_PALETTE.border,
      fill: selected ? accent : HOLO_PALETTE.panelFill,
      fillAlpha: selected ? CARD.selectedFillAlpha : HOLO_PALETTE.panelAlpha,
      borderWidth: selected ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
      borderAlpha: selected ? 1 : HOLO_PALETTE.borderAlpha,
      cornerTicks: selected,
    },
  );
  const name = scene.add
    .text(x, top + CARD.nameY, def.name, {
      ...holoFont(CARD.nameSize, "600"),
      color: toCssColor(
        selected ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
      ),
    })
    .setOrigin(0.5);
  const role = scene.add
    .text(x, top + CARD.roleY, def.role.replace("_", " ").toUpperCase(), {
      ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
      color: toCssColor(selected ? accent : HOLO_PALETTE.textMuted),
    })
    .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing)
    .setOrigin(0.5);
  const objects: Phaser.GameObjects.GameObject[] = [bg, name, role];
  objects.push(...renderStats(scene, x, top + CARD.statsY, def));
  objects.push(...renderBlurb(scene, options));
  const hit = scene.add
    .rectangle(x, top + height / 2, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", options.onSelect);
  objects.push(hit);
  return objects;
}

/**
 * Three icon + number readouts centred on x.
 *
 * @param scene - Owning scene.
 * @param x - Row centre x.
 * @param y - Row centre y.
 * @param def - Ship definition.
 * @returns Created objects.
 */
function renderStats(
  scene: Phaser.Scene,
  x: number,
  y: number,
  def: ShipDefinition,
): Phaser.GameObjects.GameObject[] {
  const stats: ReadonlyArray<[StatGlyph, string, number, number]> = [
    ["hull", "HULL", def.baseStats.hull, HOLO_PALETTE.success],
    ["shield", "SHIELDS", def.baseStats.shields, HOLO_PALETTE.shield],
    ["speed", "AGILITY", def.baseStats.agility, HOLO_PALETTE.warning],
  ];
  const icons = scene.add.graphics();
  const objects: Phaser.GameObjects.GameObject[] = [icons];
  stats.forEach(([glyph, label, value, color], i) => {
    const cx = x + (i - 1) * CARD.statGap;
    drawStatGlyph(icons, glyph, cx + CARD.statIconDx, y, CARD.statIcon, color);
    const text = scene.add
      .text(cx + CARD.statValueDx, y, `${value}`, {
        ...holoFont(HOLO_TYPE_SCALE.numeric.size, "600"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setOrigin(0, 0.5);
    const caption = scene.add
      .text(cx + CARD.statCaptionDx, y + 1, label, {
        ...holoFont(CARD.statCaptionSize, "600"),
        color: toCssColor(HOLO_PALETTE.textMuted),
      })
      .setLetterSpacing(1)
      .setOrigin(0, 0.5);
    objects.push(text, caption);
  });
  return objects;
}

/**
 * Description plus role pros / cons.
 *
 * @param scene - Owning scene.
 * @param options - Card options.
 * @returns Created objects.
 */
function renderBlurb(
  scene: Phaser.Scene,
  options: SurvivalShipCardOptions,
): Phaser.GameObjects.GameObject[] {
  const { x, top, width, height, def } = options;
  const left = x - width / 2 + CARD.padding;
  const wrap = { width: width - CARD.padding * 2 };
  const desc = scene.add
    .text(x, top + CARD.descY, def.description, {
      ...holoFont(CARD.bodySize, "400"),
      color: toCssColor(HOLO_PALETTE.textSecondary),
      wordWrap: wrap,
      align: "center",
    })
    .setOrigin(0.5, 0);
  const { pros, cons } = getRoleProsCons(def.role);
  const prosText = scene.add.text(
    left,
    top + height - CARD.prosFromBottom,
    `+ ${pros}`,
    {
      ...holoFont(CARD.bodySize, "400"),
      color: toCssColor(HOLO_PALETTE.success),
      wordWrap: wrap,
    },
  );
  const consText = scene.add.text(
    left,
    top + height - CARD.consFromBottom,
    `\u2212 ${cons}`,
    {
      ...holoFont(CARD.bodySize, "400"),
      color: toCssColor(HOLO_PALETTE.danger),
      wordWrap: wrap,
    },
  );
  return [desc, prosText, consText];
}
