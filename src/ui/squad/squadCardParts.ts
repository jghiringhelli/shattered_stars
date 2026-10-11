/**
 * squadCardParts — holo building blocks of a SquadCard: frame chrome,
 * team chips, compact action buttons, the remove control and ship rows.
 * Each factory returns scene objects for the card to parent.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { TEAM_LABELS } from "../../core/squadTypes";
import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import { createHoverButton, createToggleButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import type { HoloButtonVariant } from "../hud/holoButtonStyle";
import { drawCornerTicks, drawHoloFrame } from "../menu/holoChrome";
import { drawMenuIcon } from "../menu/MenuIcons";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { CARD_LAYOUT, CARD_W, SHIP_ROW_LAYOUT } from "./squadCardLayout";
import {
  SQUAD_TYPE,
  addSquadText,
  teamAccent,
  truncateText,
} from "./squadBuilderStyle";

/** Card chrome opacities. */
const CARD_ALPHA = {
  fill: 0.82,
  border: 0.7,
  headerFill: 0.16,
  headerFillHover: 0.26,
  rule: 0.55,
} as const;

/** Visual state of a card frame. */
export interface CardChromeState {
  readonly height: number;
  readonly accent: number;
  readonly hovered: boolean;
  /** Player-controlled squads get corner ticks. */
  readonly featured: boolean;
}

/**
 * Clear and draw the card frame: translucent body, accent border and a
 * tinted header strip with an accent rule underneath.
 *
 * @param g - Card graphics (cleared first).
 * @param state - Size, accent and interaction state.
 */
export function drawCardChrome(
  g: Phaser.GameObjects.Graphics,
  state: CardChromeState,
): void {
  const rect = { x: 0, y: 0, width: CARD_W, height: state.height };
  const radius = HOLO_RADIUS.md;
  g.clear();
  drawHoloFrame(g, rect, {
    accent: state.accent,
    fill: state.hovered ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
    fillAlpha: CARD_ALPHA.fill,
    borderWidth: state.hovered ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
    borderAlpha: state.hovered ? 1 : CARD_ALPHA.border,
  });
  g.fillStyle(
    state.accent,
    state.hovered ? CARD_ALPHA.headerFillHover : CARD_ALPHA.headerFill,
  );
  g.fillRoundedRect(0, 0, CARD_W, CARD_LAYOUT.headerH, {
    tl: radius,
    tr: radius,
    bl: 0,
    br: 0,
  });
  g.lineStyle(HOLO_BORDER.hairline, state.accent, CARD_ALPHA.rule);
  g.lineBetween(0, CARD_LAYOUT.headerH, CARD_W, CARD_LAYOUT.headerH);
  if (state.featured) drawCornerTicks(g, rect, state.accent);
}

/**
 * Team chips T1–T4 as small toggles tinted with the team colour.
 *
 * @param scene - Owning scene.
 * @param activeTeam - Currently assigned team.
 * @param onPick - Called with the chosen team id.
 * @returns Chip containers in card-local coordinates.
 */
export function createTeamChips(
  scene: Phaser.Scene,
  activeTeam: number,
  onPick: (teamId: number) => void,
): Phaser.GameObjects.Container[] {
  const { pad, chipW, chipH, chipGap, chipRowY } = CARD_LAYOUT;
  return TEAM_LABELS.map((label, i) => {
    const teamId = i + 1;
    return createToggleButton(
      scene,
      pad + chipW / 2 + i * (chipW + chipGap),
      chipRowY + chipH / 2,
      label,
      activeTeam === teamId,
      {
        width: chipW,
        height: chipH,
        radius: HOLO_RADIUS.sm,
        selectedColor: teamAccent(teamId),
        normalColor: HOLO_PALETTE.panelFill,
        font: `${SQUAD_TYPE.small}px`,
        selectedFont: `600 ${SQUAD_TYPE.small}px`,
      },
      () => onPick(teamId),
    );
  });
}

/**
 * Compact action button for the card's action row.
 *
 * @param scene - Owning scene.
 * @param column - Column index 0–2.
 * @param label - Label (kept verbatim).
 * @param variant - Holo variant.
 * @param onClick - Fired on press.
 * @returns The button in card-local coordinates.
 */
export function createCardAction(
  scene: Phaser.Scene,
  column: number,
  label: string,
  variant: HoloButtonVariant,
  onClick: () => void,
): HoloPressButton {
  const { pad, actionW, actionH, actionGap, actionRowY } = CARD_LAYOUT;
  return createHoverButton(
    scene,
    pad + actionW / 2 + column * (actionW + actionGap),
    actionRowY + actionH / 2,
    {
      width: actionW,
      height: actionH,
      radius: HOLO_RADIUS.sm,
      color: HOLO_PALETTE.panelFill,
      variant,
      label,
      font: `600 ${SQUAD_TYPE.small}px`,
    },
    onClick,
  );
}

/**
 * Remove control (× glyph) in the card's top-right corner.
 *
 * @param scene - Owning scene.
 * @param onRemove - Fired on press.
 * @returns [glyph, hit zone] in card-local coordinates.
 */
export function createRemoveControl(
  scene: Phaser.Scene,
  onRemove: () => void,
): Phaser.GameObjects.GameObject[] {
  const { closeBox, closeIcon } = CARD_LAYOUT;
  const centre = { x: CARD_W - closeBox / 2, y: closeBox / 2 };
  const glyph = scene.add.graphics();
  const paint = (color: number): void => {
    glyph.clear();
    drawMenuIcon(glyph, "close", centre, closeIcon, color);
  };
  paint(HOLO_PALETTE.textMuted);
  const hit = scene.add
    .rectangle(centre.x, centre.y, closeBox, closeBox, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerover", () => paint(HOLO_PALETTE.danger));
  hit.on("pointerout", () => paint(HOLO_PALETTE.textMuted));
  hit.on("pointerdown", onRemove);
  return [glyph, hit];
}

/** Inputs for {@link createShipRow}. */
export interface ShipRowSpec {
  readonly shipId: string;
  readonly top: number;
  readonly factionId: FactionId | null;
  readonly loadoutId: string | undefined;
}

/**
 * One ship row: sprite badge, name, points, stat line and description.
 *
 * @param scene - Owning scene.
 * @param spec - Ship, row top and loadout.
 * @returns Row objects in card-local coordinates (empty if unknown ship).
 */
export function createShipRow(
  scene: Phaser.Scene,
  spec: ShipRowSpec,
): Phaser.GameObjects.GameObject[] {
  const def = SHIP_DEFINITIONS[spec.shipId];
  if (!def) return [];
  const L = SHIP_ROW_LAYOUT;
  const y = spec.top;
  const loadout = spec.loadoutId
    ? getShipLoadouts(spec.shipId).find((l) => l.id === spec.loadoutId)
    : undefined;
  const pts = loadout?.pointCost ?? def.baseStats.pointCost;
  const desc = loadout ? loadout.description : def.description;
  const stats = `ATK ${def.baseStats.attack}  HUL ${def.baseStats.hull}  SHD ${def.baseStats.shields}`;
  const textX = L.textX;
  return [
    ...createShipBadge(scene, def.spriteKey, def.baseStats.size, spec),
    addSquadText(
      scene,
      textX,
      y + L.nameY,
      truncateText(def.name, L.nameChars),
      {
        size: SQUAD_TYPE.label,
        weight: "600",
      },
    ),
    addSquadText(scene, CARD_W - CARD_LAYOUT.pad, y + L.nameY, `${pts}pt`, {
      size: SQUAD_TYPE.caption,
      weight: "600",
      color: HOLO_PALETTE.textSecondary,
    }).setOrigin(1, 0),
    addSquadText(scene, textX, y + L.statsY, stats, {
      size: SQUAD_TYPE.small,
      color: HOLO_PALETTE.textSecondary,
      letterSpacing: 0.5,
    }),
    addSquadText(scene, textX, y + L.descY, truncateText(desc, L.descChars), {
      size: SQUAD_TYPE.small,
      color: HOLO_PALETTE.textMuted,
    }),
  ];
}

/**
 * Circular badge with the ship sprite (falls back to the faction/size
 * placeholder texture when the sprite is not loaded).
 */
function createShipBadge(
  scene: Phaser.Scene,
  spriteKey: string,
  size: string,
  spec: ShipRowSpec,
): Phaser.GameObjects.GameObject[] {
  const L = SHIP_ROW_LAYOUT;
  const cy = spec.top + L.spriteY;
  const badge = scene.add.graphics();
  badge.fillStyle(HOLO_PALETTE.panelFill, 1);
  badge.fillCircle(L.spriteX, cy, L.spriteRadius);
  badge.lineStyle(HOLO_BORDER.hairline, HOLO_PALETTE.border, CARD_ALPHA.rule);
  badge.strokeCircle(L.spriteX, cy, L.spriteRadius);
  const key = scene.textures.exists(spriteKey)
    ? spriteKey
    : `ship_${spec.factionId ?? "terran_hegemony"}_${size}`;
  const sprite = scene.add
    .image(L.spriteX, cy, key)
    .setDisplaySize(L.spriteSize, L.spriteSize);
  return [badge, sprite];
}
