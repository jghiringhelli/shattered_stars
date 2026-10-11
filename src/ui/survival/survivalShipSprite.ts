/**
 * Survival ship sprites: the ship art in a container with the elite /
 * boss glow and outline, and — for elites — the affix label (e.g.
 * "🛡 Shielded · 💨 Swift") so affixes are visible on the battlefield.
 * Extracted from SurvivalScene.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { SHIP_SIZES } from "../../config";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { addShipVisual } from "../../rendering/ShipVisual";
import {
  INITIAL_BANK_STATE,
  type BankState,
} from "../../rendering/ShipBanking";
import { ShipStatCard } from "../ShipStatCard";

/** A ship sprite container with its banking state. */
export interface SurvivalShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  /** Ship art image, when loaded — squashed/stretched by the banking effect on hard turns. */
  image?: Phaser.GameObjects.Image | null;
  /** Image's base scale (from setDisplaySize) that banking must multiply, not overwrite. */
  imageBaseScaleX?: number;
  imageBaseScaleY?: number;
  bankState: BankState;
}

/** What the sprite needs to know about its ship. */
export interface SpriteShip {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Rank styling of a sprite. */
export interface SpriteRank {
  readonly isElite: boolean;
  readonly isBoss: boolean;
}

const ELITE_COLOR = 0xffdd00;
const BOSS_COLOR = 0xff4444;
const GLOW_ALPHA = 0.2;
/** Affix label offset above the ship (multiples of its size). */
const AFFIX_LABEL_OFFSET = 1.6;

/**
 * Builds a ship's sprite container.
 *
 * @param scene - The battle scene.
 * @param ship - The ship.
 * @param rank - Elite / boss styling.
 * @returns The sprite.
 */
export function addSurvivalShipSprite(
  scene: Phaser.Scene,
  ship: SpriteShip,
  rank: SpriteRank,
): SurvivalShipSprite {
  const container = scene.add.container(
    ship.x,
    ship.y,
  ) as unknown as SurvivalShipSprite;
  container.shipId = ship.id;
  const size: number = rank.isBoss
    ? SHIP_SIZES.large
    : rank.isElite
      ? SHIP_SIZES.medium
      : SHIP_SIZES.small;
  const ranked = rank.isElite || rank.isBoss;
  const color = rank.isBoss ? BOSS_COLOR : ELITE_COLOR;
  if (ranked) {
    const glow = scene.add.graphics();
    glow.fillStyle(color, GLOW_ALPHA);
    glow.fillCircle(0, 0, size * 0.8);
    container.add(glow);
  }
  const visual = addShipVisual(scene, container, {
    definitionId: ship.definitionId,
    faction: ship.faction,
    fallbackSizeName:
      getShipDefinition(ship.definitionId)?.baseStats.size ?? "small",
    size,
    isPlayer: ship.owner === "player",
  });
  container.image = visual.image;
  container.imageBaseScaleX = visual.image?.scaleX ?? 1;
  container.imageBaseScaleY = visual.image?.scaleY ?? 1;
  container.bankState = { ...INITIAL_BANK_STATE, lastAngle: ship.angle };
  if (ranked) {
    const outline = scene.add.graphics();
    outline.lineStyle(rank.isBoss ? 4 : 3, color, 1);
    outline.strokeCircle(0, 0, size * 1.1);
    container.add(outline);
  }
  container
    .setAngle(ship.angle)
    .setDepth(rank.isBoss ? 15 : 10)
    .setSize(size * 2, size * 2)
    .setInteractive();
  ShipStatCard.attachHoverCard(scene, container, ship.definitionId);
  return container;
}

/**
 * A floating affix label that follows an elite (kept out of the rotating
 * container so it stays upright).
 *
 * @param scene - The battle scene.
 * @param text - The affix label.
 * @returns The label (caller positions it each frame).
 */
export function addAffixLabel(
  scene: Phaser.Scene,
  text: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, text, {
      font: "600 12px Arial",
      color: "#ffdd55",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(16);
}

/**
 * @param isBoss - True for the boss (larger sprite).
 * @returns How far above the ship (px) its affix label sits.
 */
export function affixLabelOffset(isBoss: boolean): number {
  return (isBoss ? SHIP_SIZES.large : SHIP_SIZES.medium) * AFFIX_LABEL_OFFSET;
}
