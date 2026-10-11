/**
 * Radar — circular, heading-up contact display (bottom centre of the HUD).
 *
 * The player's forward direction is always up (Squadrons style). Blips are
 * heading-oriented triangles coloured by side and sized by ship class; the
 * locked target gets a diamond and the squad's marked target a red
 * bracket crosshair. Contacts beyond range are clamped to the rim
 * and dimmed. The static face (disc, range rings, forward cone, player
 * chevron) is drawn once; blips are redrawn into one Graphics per update.
 *
 * Origin: the container sits at the radar centre.
 */

import Phaser from "phaser";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  SIDE_COLORS,
} from "../theme/HoloTheme";
import { addPinned, createScreenContainer } from "./holoPrimitives";
import { drawDiamond, fillBlip } from "./HudIcons";
import { projectToRadar } from "./hudMath";
import { drawMarkReticle } from "./markGlyphs";
import type { ScreenRect } from "./screenRect";
import type { ContactHudState, HudPose, HudSizeClass } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_RADIUS = 78;
const DEFAULT_RANGE_PX = 2000;
const DEFAULT_RING_COUNT = 2;
/** Blip radius in px per ship size class. */
const BLIP_RADIUS: Readonly<Record<HudSizeClass, number>> = {
  tiny: 2.5,
  small: 3,
  medium: 4,
  large: 5.5,
  huge: 7.5,
};
/** Half-angle of the forward view cone, degrees from straight up. */
const FORWARD_CONE_DEG = 35;
const TICK_LENGTH = 6;
const CHEVRON = { tip: 8, back: 5, wing: 6 } as const;
const TARGET_PAD = 4;
const TARGET_LINE_WIDTH = 1.5;
/** Squad-mark crosshair: padding around the blip and stroke (px). */
const MARK_PAD = 6;
const MARK_LINE_WIDTH = 1.5;
/** Rim tick angles (Phaser degrees): fore, starboard, aft, port. */
const RIM_TICKS_DEG = [270, 0, 90, 180] as const;

/** Radar options. */
export interface RadarConfig {
  /** Torus side length for wrap-aware projection (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
  /** Radar radius in px. Default: 78. */
  readonly radius?: number | undefined;
  /** World distance at the rim. Default: 2000. */
  readonly rangePx?: number | undefined;
  /** Number of inner range rings. Default: 2. */
  readonly ringCount?: number | undefined;
}

/** Heading-up circular radar. */
export class Radar {
  /** Screen-space container (scrollFactor 0), origin at the radar centre. */
  readonly container: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly blips: Phaser.GameObjects.Graphics;
  private readonly worldSize: number;
  private readonly ringCount: number;
  private radius: number;
  private rangePx: number;

  /**
   * @param scene - Owning scene.
   * @param config - World size, radius, range.
   */
  constructor(scene: Phaser.Scene, config: RadarConfig) {
    this.worldSize = config.worldSize;
    this.radius = config.radius ?? DEFAULT_RADIUS;
    this.rangePx = config.rangePx ?? DEFAULT_RANGE_PX;
    this.ringCount = config.ringCount ?? DEFAULT_RING_COUNT;
    this.container = createScreenContainer(scene);
    this.face = scene.add.graphics();
    this.blips = scene.add.graphics();
    addPinned(this.container, this.face, this.blips);
    this.drawFace();
  }

  /** Radar radius in px. */
  get radiusPx(): number {
    return this.radius;
  }

  /**
   * Bounding box in the parent's coordinates.
   *
   * @returns The square enclosing the radar disc.
   */
  bounds(): ScreenRect {
    const { x, y } = this.container;
    return {
      x: x - this.radius,
      y: y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2,
    };
  }

  /**
   * Move the radar centre.
   *
   * @param x - Centre x.
   * @param y - Centre y.
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Change the world distance mapped to the rim.
   *
   * @param rangePx - New range in world px.
   */
  setRange(rangePx: number): void {
    this.rangePx = rangePx;
  }

  /**
   * Change the radar radius and redraw the face.
   *
   * @param radius - New radius in px.
   */
  setRadius(radius: number): void {
    this.radius = radius;
    this.drawFace();
  }

  /**
   * Redraw contact blips relative to the player.
   *
   * @param player - Player pose; null clears the blips.
   * @param contacts - Contacts to plot (dead ones are skipped).
   */
  update(
    player: HudPose | null,
    contacts: ReadonlyArray<ContactHudState>,
  ): void {
    this.blips.clear();
    if (player === null) return;
    const options = {
      rangePx: this.rangePx,
      radiusPx: this.radius,
      worldSize: this.worldSize,
    };
    for (const contact of contacts) {
      if (!contact.alive) continue;
      const p = projectToRadar(player, contact.pose, options);
      const alpha = p.inRange ? 1 : HOLO_ALPHA.outOfRange;
      const blipRadius = BLIP_RADIUS[contact.sizeClass];
      this.blips.fillStyle(SIDE_COLORS[contact.side], alpha);
      fillBlip(
        this.blips,
        p.x,
        p.y,
        blipRadius,
        (contact.pose.angle - player.angle) * DEG_TO_RAD,
      );
      if (contact.isTarget) {
        drawDiamond(
          this.blips,
          p.x,
          p.y,
          blipRadius + TARGET_PAD,
          TARGET_LINE_WIDTH,
          HOLO_PALETTE.target,
          1,
        );
      }
      if (contact.isMarked === true) {
        drawMarkReticle(
          this.blips,
          p.x,
          p.y,
          blipRadius + MARK_PAD,
          MARK_LINE_WIDTH,
        );
      }
    }
  }

  /** Destroy all game objects. */
  destroy(): void {
    this.container.destroy();
  }

  private drawFace(): void {
    const g = this.face;
    const r = this.radius;
    g.clear();
    g.fillStyle(HOLO_PALETTE.panelFill, HOLO_PALETTE.panelAlpha);
    g.fillCircle(0, 0, r);
    g.lineStyle(
      HOLO_BORDER.hairline,
      HOLO_PALETTE.border,
      HOLO_ALPHA.structure,
    );
    for (let i = 1; i <= this.ringCount; i++)
      g.strokeCircle(0, 0, (r * i) / (this.ringCount + 1));
    this.drawForwardCone();
    g.lineStyle(
      HOLO_BORDER.regular,
      HOLO_PALETTE.border,
      HOLO_PALETTE.borderAlpha,
    );
    g.strokeCircle(0, 0, r);
    g.lineStyle(HOLO_BORDER.regular, HOLO_PALETTE.accent, 1);
    for (const deg of RIM_TICKS_DEG) {
      const cos = Math.cos(deg * DEG_TO_RAD);
      const sin = Math.sin(deg * DEG_TO_RAD);
      g.lineBetween(
        cos * r,
        sin * r,
        cos * (r - TICK_LENGTH),
        sin * (r - TICK_LENGTH),
      );
    }
    g.fillStyle(SIDE_COLORS.player, 1);
    g.fillTriangle(
      0,
      -CHEVRON.tip,
      CHEVRON.wing,
      CHEVRON.back,
      -CHEVRON.wing,
      CHEVRON.back,
    );
  }

  private drawForwardCone(): void {
    const g = this.face;
    const r = this.radius;
    const half = FORWARD_CONE_DEG * DEG_TO_RAD;
    g.fillStyle(HOLO_PALETTE.accent, HOLO_PALETTE.trackAlpha / 2);
    g.slice(0, 0, r, -Math.PI / 2 - half, -Math.PI / 2 + half, false);
    g.fillPath();
    g.lineStyle(
      HOLO_BORDER.hairline,
      HOLO_PALETTE.accent,
      HOLO_ALPHA.structure,
    );
    g.lineBetween(0, 0, Math.sin(half) * r, -Math.cos(half) * r);
    g.lineBetween(0, 0, -Math.sin(half) * r, -Math.cos(half) * r);
  }
}
