/**
 * duelSetupWidgets — small drawing helpers of the duel setups: text
 * measuring, a ship art slot and the MATCH tab body (rounds, difficulty and,
 * for Ace Duel, the side to fly), each choice a chip with a tooltip and one
 * plain sentence under it.
 */

import type Phaser from "phaser";
import { shipArtAsset } from "../../assets/assetManifest";
import { swapWhenLoaded } from "../../assets/textureLoading";
import type { ShipDefinition } from "../../core/types";
import { addSelectable, type SelectableSpec } from "../../ui/menu/FlatControls";
import { addContainedImage } from "../../ui/picker/catalogHelpers";
import {
  addPickerText,
  pickerTextStyle,
  type PickerTextRole,
} from "../../ui/picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import {
  DIFFICULTY_LINES,
  DIFFICULTY_TERMS,
  FORMAT_LINES,
  FORMAT_TERMS,
  type DuelDifficulty,
  type DuelFormat,
} from "./duelSetupModel";
import type { BodyArea } from "./duelSetupChrome";

/** Width of the MATCH tab's column (px). */
const MATCH_COLUMN_W = 640;
/** Height of a MATCH chip (px). */
const MATCH_CHIP_H = 40;
/** Distance between MATCH sections (px). */
const MATCH_SECTION_GAP = 32;

/**
 * @param scene - Owning scene.
 * @param text - Text to measure.
 * @param role - Picker type step.
 * @returns Its width in px (a hidden probe is created and destroyed).
 */
export function measureText(
  scene: Phaser.Scene,
  text: string,
  role: PickerTextRole,
): number {
  const probe = scene.add
    .text(0, 0, text, pickerTextStyle(role, HOLO_PALETTE.textPrimary))
    .setVisible(false);
  const width = probe.width;
  probe.destroy();
  return width;
}

/**
 * Draws a ship's art contained in a box.
 *
 * @param area - Scene and root container.
 * @param def - The ship.
 * @param box - Centre and size of the slot.
 */
export function addShipArt(
  area: Pick<BodyArea, "scene" | "root">,
  def: ShipDefinition,
  box: { readonly cx: number; readonly cy: number; readonly size: number },
): void {
  const { scene, root } = area;
  const key =
    [`ship_art_${def.id}`, def.spriteKey].find((k) => scene.textures.exists(k)) ??
    `ship_${def.faction}_${def.baseStats.size}`;
  const art = addContainedImage(scene, key, box.cx, box.cy, box.size, box.size);
  swapWhenLoaded(scene, art, shipArtAsset(def), {
    maxWidth: box.size,
    maxHeight: box.size,
  });
  root.add(art);
}

/** A row of mutually exclusive chips with a sentence under it. */
interface ChoiceRow {
  readonly caption: string;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly tip: SelectableSpec["tip"];
    readonly accent?: number;
  }>;
  readonly selected: string;
  readonly sentence: string;
  readonly onSelect: (id: string) => void;
}

/** What the MATCH tab offers. */
export interface MatchSpec {
  readonly accent: number;
  /** Ace Duel only: the ace to fly. */
  readonly sides?: {
    readonly names: readonly [string, string];
    readonly accents: readonly [number, number];
    readonly selected: 1 | 2;
    readonly sentence: string;
    readonly onSelect: (side: 1 | 2) => void;
  };
  /** Dogfight only: rounds that decide the match. */
  readonly format?: {
    readonly selected: DuelFormat;
    readonly onSelect: (format: DuelFormat) => void;
  };
  readonly difficulty: {
    readonly selected: DuelDifficulty;
    readonly onSelect: (difficulty: DuelDifficulty) => void;
  };
}

const FORMATS: readonly DuelFormat[] = ["best_of_3", "best_of_5"];
const DIFFICULTIES: readonly DuelDifficulty[] = ["easy", "normal", "hard", "brutal"];
const FORMAT_LABELS: Readonly<Record<DuelFormat, string>> = {
  best_of_3: "BEST OF 3",
  best_of_5: "BEST OF 5",
};

/**
 * MATCH tab: side / format / difficulty rows, each with a sentence.
 *
 * @param area - Where to draw.
 * @param spec - Choices and callbacks.
 */
export function drawMatchBody(area: BodyArea, spec: MatchSpec): void {
  const rows: ChoiceRow[] = [];
  if (spec.sides) rows.push(sideRow(spec.sides));
  if (spec.format) rows.push(formatRow(spec.format));
  rows.push(difficultyRow(spec.difficulty));
  const left = area.x + (area.width - MATCH_COLUMN_W) / 2;
  let y = area.y;
  for (const row of rows) {
    y = drawChoiceRow(area, row, { x: left, y, accent: spec.accent });
  }
}

function sideRow(sides: NonNullable<MatchSpec["sides"]>): ChoiceRow {
  return {
    caption: "YOUR ACE",
    options: ([1, 2] as const).map((side) => ({
      id: String(side),
      label: sides.names[side - 1]!.toUpperCase(),
      tip: "duel.side_pick" as const,
      accent: sides.accents[side - 1]!,
    })),
    selected: String(sides.selected),
    sentence: sides.sentence,
    onSelect: (id) => sides.onSelect(id === "1" ? 1 : 2),
  };
}

function formatRow(format: NonNullable<MatchSpec["format"]>): ChoiceRow {
  return {
    caption: "MATCH FORMAT",
    options: FORMATS.map((id) => ({
      id,
      label: FORMAT_LABELS[id],
      tip: FORMAT_TERMS[id],
    })),
    selected: format.selected,
    sentence: FORMAT_LINES[format.selected],
    onSelect: (id) => format.onSelect(id as DuelFormat),
  };
}

function difficultyRow(difficulty: MatchSpec["difficulty"]): ChoiceRow {
  return {
    caption: "AI DIFFICULTY",
    options: DIFFICULTIES.map((id) => ({
      id,
      label: id.toUpperCase(),
      tip: DIFFICULTY_TERMS[id],
    })),
    selected: difficulty.selected,
    sentence: DIFFICULTY_LINES[difficulty.selected],
    onSelect: (id) => difficulty.onSelect(id as DuelDifficulty),
  };
}

function drawChoiceRow(
  area: BodyArea,
  row: ChoiceRow,
  at: { readonly x: number; readonly y: number; readonly accent: number },
): number {
  const { scene, root } = area;
  root.add(
    addPickerText(scene, { x: at.x, y: at.y }, row.caption, "caption", HOLO_PALETTE.textSecondary),
  );
  const chipsY = at.y + HOLO_SPACING.xl;
  const gap = HOLO_SPACING.sm;
  const width = (MATCH_COLUMN_W - gap * (row.options.length - 1)) / row.options.length;
  row.options.forEach((option, i) => {
    addSelectable(scene, root, {
      x: at.x + i * (width + gap),
      y: chipsY,
      width,
      height: MATCH_CHIP_H,
      label: option.label,
      selected: option.id === row.selected,
      accent: option.accent ?? at.accent,
      ...(option.tip === undefined ? {} : { tip: option.tip }),
      onPress: () => row.onSelect(option.id),
    });
  });
  const sentenceY = chipsY + MATCH_CHIP_H + HOLO_SPACING.md;
  const sentence = scene.add.text(
    at.x,
    sentenceY,
    row.sentence,
    pickerTextStyle("body", HOLO_PALETTE.textPrimary, {
      wordWrap: { width: MATCH_COLUMN_W },
    }),
  );
  root.add(sentence);
  return sentenceY + sentence.height + MATCH_SECTION_GAP;
}
