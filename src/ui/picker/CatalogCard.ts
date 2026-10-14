/**
 * CatalogCard — one ship card in the picker catalog grid: sprite, name,
 * points, role + capability tags, and a padlock hint for XP-locked ships.
 * Cards are holo frames (neutral hairline; faction accent + corner ticks
 * when selected; muted when locked).
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { isStarterPick } from "../../data/ProgressionData";
import { shipSpriteAsset } from "../../assets/assetManifest";
import { swapWhenLoaded } from "../../assets/textureLoading";
import { attachHintTooltip } from "../menu/HintTooltip";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { secondaryTags } from "./catalogHelpers";
import type { TermId } from "../../data/tooltips";
import { addTipZone, type TipSubject } from "../menu/tooltipTargets";
import { shipTooltipContent } from "./shipTooltips";
import { drawLockGlyph, drawTagChip, TAG_CHIP_HEIGHT } from "./pickerGlyphs";
import {
  addPickerText,
  drawPickerCard,
  fitOrEllipsize,
  MIN_NAME_SIZE,
  type CardState,
} from "./pickerStyle";

/** Card interior layout (offsets from the card's top-left). */
const CARD = {
  spriteSize: 32,
  spriteCentreX: 22,
  textX: 44,
  padRight: 8,
  nameY: 7,
  subY: 28,
  pointsGap: 8,
  tagGap: 4,
  tagPadX: 4,
  lockSize: 11,
  lockTextGap: 6,
  lockedSpriteAlpha: 0.35,
  lockedHintAlpha: 0.8,
} as const;

/** What to draw. */
export interface CatalogCardSpec {
  readonly def: ShipDefinition;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly selected: boolean;
  readonly locked: boolean;
  readonly lockReason: string;
  /** Faction accent for hover / selection. */
  readonly accent: number;
}

/** Display objects of one card; `hit` is the interactive zone. */
export interface CatalogCard {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly hit: Phaser.GameObjects.Rectangle;
  /** Every interactive zone of the card (the card hit plus its tag zones). */
  readonly hits: Phaser.GameObjects.Rectangle[];
}

/** A tooltip zone over part of a card (card-local pixel rect). */
interface CardZone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly subject: TipSubject;
}

/** Parts of a subline: what was drawn and where tooltips go. */
interface Subline {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly zones: CardZone[];
}

/**
 * Build a catalog card (objects are not yet added to any container).
 *
 * @param scene - Owning scene.
 * @param spec - Ship, bounds and state.
 * @param onSelect - Invoked on press of an unlocked card.
 * @returns The card's objects and hit zone.
 */
export function buildCatalogCard(
  scene: Phaser.Scene,
  spec: CatalogCardSpec,
  onSelect: () => void,
): CatalogCard {
  const bg = scene.add.graphics();
  const paint = (hover: boolean): void => {
    bg.clear();
    const { state, accent } = cardLook(spec, hover);
    drawPickerCard(bg, spec, state, accent);
  };
  paint(false);
  const hit = scene.add
    .rectangle(
      spec.x + spec.width / 2,
      spec.y + spec.height / 2,
      spec.width,
      spec.height,
      0,
      0,
    )
    .setInteractive({ useHandCursor: !spec.locked });
  attachHintTooltip(scene, hit, shipTooltipContent(spec.def, spec.lockReason));
  if (!spec.locked) {
    hit.on("pointerover", () => paint(true));
    hit.on("pointerout", () => paint(false));
    hit.on("pointerdown", onSelect);
  }
  const subline = buildSubline(scene, spec);
  const body = [...buildHeadline(scene, spec), ...subline.objects];
  const zones = subline.zones.map((zone) => {
    const hover = (on: boolean) => () => !spec.locked && paint(on);
    const tipZone = addTipZone(
      scene,
      null,
      zone,
      zone.subject,
      spec.locked ? undefined : onSelect,
    );
    tipZone.on("pointerover", hover(true)).on("pointerout", hover(false));
    return tipZone;
  });
  return { objects: [bg, ...body, hit, ...zones], hit, hits: [hit, ...zones] };
}

/**
 * Frame state and accent for a card: the starter pick idles with a warm
 * outline so new players spot it.
 *
 * @param spec - Card spec.
 * @param hover - Pointer over the card.
 * @returns State and accent colour.
 */
function cardLook(
  spec: CatalogCardSpec,
  hover: boolean,
): { state: CardState; accent: number } {
  if (spec.locked) return { state: "locked", accent: spec.accent };
  if (spec.selected) return { state: "selected", accent: spec.accent };
  if (hover) return { state: "hover", accent: spec.accent };
  if (isStarterPick(spec.def.id)) {
    return { state: "hover", accent: HOLO_PALETTE.warning };
  }
  return { state: "idle", accent: spec.accent };
}

/**
 * Sprite and name (the name gets the full first line).
 *
 * @param scene - Owning scene.
 * @param spec - Card spec.
 * @returns Created objects.
 */
function buildHeadline(
  scene: Phaser.Scene,
  spec: CatalogCardSpec,
): Phaser.GameObjects.GameObject[] {
  const { def, x, y, locked } = spec;
  const spriteKey = scene.textures.exists(def.spriteKey)
    ? def.spriteKey
    : `ship_${def.faction}_${def.baseStats.size}`;
  const sprite = scene.add
    .image(x + CARD.spriteCentreX, y + spec.height / 2, spriteKey)
    .setDisplaySize(CARD.spriteSize, CARD.spriteSize)
    .setAlpha(locked ? CARD.lockedSpriteAlpha : 1);
  swapWhenLoaded(scene, sprite, shipSpriteAsset(def), "stretch");
  const name = addPickerText(
    scene,
    { x: x + CARD.textX, y: y + CARD.nameY },
    def.name,
    "name",
    locked ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
  );
  fitOrEllipsize(name, x + spec.width - CARD.padRight - name.x, MIN_NAME_SIZE);
  return [sprite, name];
}

/**
 * Second line: points on the right; on the left the padlock and unlock
 * requirement, or the ★ STARTER chip, role and capability chips.
 *
 * @param scene - Owning scene.
 * @param spec - Card spec.
 * @returns Created objects.
 */
function buildSubline(
  scene: Phaser.Scene,
  spec: CatalogCardSpec,
): Subline {
  const left = spec.x + CARD.textX;
  const lineY = spec.y + CARD.subY;
  const points = addPickerText(
    scene,
    { x: spec.x + spec.width - CARD.padRight, y: lineY - 1 },
    `${spec.def.baseStats.pointCost}pt`,
    "name",
    pointsColor(spec),
  ).setOrigin(1, 0);
  const pointsZone: CardZone = {
    x: points.x - points.width,
    y: points.y,
    width: points.width,
    height: points.height,
    subject: "stat.points",
  };
  const maxRight = points.x - points.width - CARD.pointsGap;
  if (!spec.locked) {
    const tags = buildTags(scene, spec, left, maxRight);
    return {
      objects: [points, ...tags.objects],
      zones: [pointsZone, ...tags.zones],
    };
  }
  const glyph = scene.add.graphics().setAlpha(CARD.lockedHintAlpha);
  drawLockGlyph(
    glyph,
    { x: left + CARD.lockSize / 2, y: lineY + CARD.lockSize / 2 },
    CARD.lockSize,
    HOLO_PALETTE.warning,
  );
  const textX = left + CARD.lockSize + CARD.lockTextGap;
  const hint = addPickerText(
    scene,
    { x: textX, y: lineY },
    spec.lockReason,
    "micro",
    HOLO_PALETTE.warning,
  ).setAlpha(CARD.lockedHintAlpha);
  // Keep the XP figure readable: drop the tier name before truncating.
  const tierStart = spec.lockReason.indexOf(" (");
  if (hint.width > maxRight - textX && tierStart > 0) {
    hint.setText(spec.lockReason.slice(0, tierStart));
  }
  fitOrEllipsize(hint, maxRight - textX);
  return {
    objects: [points, glyph, hint],
    zones: [
      pointsZone,
      {
        x: left,
        y: lineY,
        width: maxRight - left,
        height: hint.height,
        subject: "ui.locked",
      },
    ],
  };
}

/**
 * Points colour by card state.
 *
 * @param spec - Card spec.
 * @returns Palette colour.
 */
function pointsColor(spec: CatalogCardSpec): number {
  if (spec.locked) return HOLO_PALETTE.textMuted;
  return spec.selected ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary;
}

/** One left-to-right item of the subline. */
interface SublineItem {
  readonly text: string;
  readonly color: number;
  /** Framed chip (tags) vs plain text (role). */
  readonly chip: boolean;
  readonly term: TermId;
}

/** Most tags a row shows before the rest fold into a "+N" chip. */
const MAX_TAGS = 3;

/** Tooltip term of a capability chip. */
const TAG_TERMS: Readonly<Record<string, TermId>> = {
  TURRET: "tag.turret",
  ORDNANCE: "tag.ordnance",
  SUPPORT: "tag.support",
};

/**
 * ★ STARTER chip (first, so new players always see it), then capability
 * chips — at most three, the rest fold into "+N". The role is not repeated:
 * the section header above the row already names it.
 *
 * @param scene - Owning scene.
 * @param spec - Card spec.
 * @param startX - Left edge of the line.
 * @param maxRight - Rightmost x an item may reach.
 * @returns Created objects and the tooltip zones over each item.
 */
function buildTags(
  scene: Phaser.Scene,
  spec: CatalogCardSpec,
  startX: number,
  maxRight: number,
): Subline {
  const items: SublineItem[] = [
    ...(isStarterPick(spec.def.id)
      ? [
          {
            text: "\u2605 STARTER",
            color: HOLO_PALETTE.warning,
            chip: true,
            term: "tag.starter" as TermId,
          },
        ]
      : []),
    ...secondaryTags(spec.def).map((text) => ({
      text,
      color: HOLO_PALETTE.textSecondary,
      chip: true,
      term: TAG_TERMS[text] ?? ("tag.support" as TermId),
    })),
  ];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const zones: CardZone[] = [];
  const centreY = spec.y + CARD.subY + 1 + TAG_CHIP_HEIGHT / 2;
  let itemX = startX;
  for (const item of items.slice(0, MAX_TAGS)) {
    const pad = item.chip ? CARD.tagPadX : 0;
    const label = addPickerText(
      scene,
      { x: itemX + pad, y: centreY },
      item.text,
      item.chip ? "micro" : "small",
      item.color,
    ).setOrigin(0, 0.5);
    const itemW = label.width + pad * 2;
    if (itemX + itemW > maxRight) {
      label.destroy();
      break;
    }
    objects.push(label);
    if (item.chip)
      objects.push(
        drawTagChip(scene, { x: itemX, centreY, width: itemW }, item.color),
      );
    zones.push({
      x: itemX,
      y: centreY - TAG_CHIP_HEIGHT / 2,
      width: itemW,
      height: TAG_CHIP_HEIGHT,
      subject: item.term,
    });
    itemX += itemW + CARD.tagGap * 2;
  }
  const hidden = items.slice(MAX_TAGS);
  if (hidden.length > 0) addMoreChip(scene, spec, { x: itemX, maxRight }, hidden, { objects, zones });
  return { objects, zones };
}

/**
 * "+N" chip for tags beyond the visible three; hovering lists them.
 *
 * @param scene - Owning scene.
 * @param spec - Card spec.
 * @param at - Left edge and rightmost x of the chip.
 * @param hidden - The tags left out.
 * @param into - Subline parts to add the chip to.
 */
function addMoreChip(
  scene: Phaser.Scene,
  spec: CatalogCardSpec,
  at: { readonly x: number; readonly maxRight: number },
  hidden: readonly SublineItem[],
  into: { objects: Phaser.GameObjects.GameObject[]; zones: CardZone[] },
): void {
  const centreY = spec.y + CARD.subY + 1 + TAG_CHIP_HEIGHT / 2;
  const label = addPickerText(
    scene,
    { x: at.x + CARD.tagPadX, y: centreY },
    `+${hidden.length}`,
    "micro",
    HOLO_PALETTE.textSecondary,
  ).setOrigin(0, 0.5);
  const width = label.width + CARD.tagPadX * 2;
  if (at.x + width > at.maxRight) {
    label.destroy();
    return;
  }
  into.objects.push(label, drawTagChip(scene, { x: at.x, centreY, width }, HOLO_PALETTE.textSecondary));
  into.zones.push({
    x: at.x,
    y: centreY - TAG_CHIP_HEIGHT / 2,
    width,
    height: TAG_CHIP_HEIGHT,
    subject: { title: "More tags", body: hidden.map((item) => item.text.toUpperCase()).join(" \u00b7 ") },
  });
}
