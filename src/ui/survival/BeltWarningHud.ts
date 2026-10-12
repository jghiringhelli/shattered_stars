/**
 * BeltWarningHud — Survival's asteroid-belt warning on screen. While the
 * player's ship is within the avoid margin of the belt ("near") or in it
 * ("inside") it shows a pulsing frame around the screen edges, a warning
 * icon, a text line saying what to do and an arrow pointing back to the
 * arena centre — never colour alone — and sounds the belt cue (BeltWarning
 * decides when). Zoom-independent, screen-space.
 */

import Phaser from "phaser";
import {
  beltWarningLevel,
  type BeltConfig,
  type BeltWarningLevel,
} from "../../systems/arena/ArenaBoundary";
import {
  beltCue,
  beltPulseAlpha,
  beltWarningText,
  INITIAL_BELT_CUE,
  type BeltCueState,
} from "../../systems/arena/BeltWarning";
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import {
  cancelCameraZoom,
  pinTree,
  type ZoomCameraLike,
} from "../modeHud/screenSpace";

/** Thickness and opacity of the pulsing screen-edge frame. */
const FRAME_THICKNESS = 14;
const FRAME_ALPHA = 0.55;
/** Vertical position of the warning block, as a fraction of screen height. */
const BLOCK_Y_FRACTION = 0.2;
/** Warning triangle: half width and height (px). */
const ICON_HALF_WIDTH = 18;
const ICON_HEIGHT = 32;
/** The "!" glyph: stroke width (px), bar start/length and dot rise (fractions of the icon height). */
const ICON_GLYPH_WIDTH = 4;
const ICON_BAR_START = 0.35;
const ICON_BAR_LENGTH = 0.35;
const ICON_DOT_RISE = 0.2;
/** Arrow toward the centre: distance below the text and size (px). */
const ARROW_OFFSET_Y = 34;
const ARROW_LENGTH = 22;
const ARROW_HALF_WIDTH = 9;
/** Volume of the belt cue. */
const CUE_VOLUME = 0.6;

/** A position on the battlefield. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Screen warning shown while the player's ship nears or enters the belt. */
export class BeltWarningHud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private cue: BeltCueState = INITIAL_BELT_CUE;
  private shownLevel: BeltWarningLevel = "clear";

  /**
   * @param scene - The battle scene.
   * @param playCue - Sounds the belt cue (volume 0..1).
   */
  constructor(
    scene: Phaser.Scene,
    private readonly playCue: (volume: number) => void,
  ) {
    const { width, height } = scene.scale;
    const y = height * BLOCK_Y_FRACTION;
    this.frame = scene.add.graphics();
    this.icon = scene.add.graphics();
    this.arrow = scene.add.graphics();
    this.label = createHoloText(
      scene,
      width / 2,
      y + HOLO_SPACING.md,
      "",
      "heading",
      HOLO_PALETTE.warning,
    ).setOrigin(0.5, 0);
    this.drawFrame(width, height);
    this.drawIcon(width / 2, y);
    this.drawArrow();
    this.arrow.setPosition(width / 2, y + ARROW_OFFSET_Y + HOLO_SPACING.xl);
    this.root = scene.add
      .container(0, 0, [this.frame, this.icon, this.label, this.arrow])
      .setDepth(HOLO_DEPTH.hudIndicators)
      .setAlpha(0);
    pinTree(this.root);
  }

  /** The warning level currently shown. */
  get level(): BeltWarningLevel {
    return this.shownLevel;
  }

  /** The warning line currently shown ("" when clear). */
  get text(): string {
    return this.label.text;
  }

  /**
   * Refresh from the player's ship this frame.
   *
   * @param ship - The player's ship, or null when it is gone.
   * @param center - The arena centre.
   * @param belt - The current belt.
   * @param nowMs - Scene time (ms).
   */
  update(
    ship: Point | null,
    center: Point,
    belt: BeltConfig,
    nowMs: number,
  ): void {
    const level = ship ? beltWarningLevel(ship, center, belt) : "clear";
    const next = beltCue(this.cue, level, nowMs);
    this.cue = next.state;
    if (next.play) this.playCue(CUE_VOLUME);
    this.shownLevel = level;
    this.label.setText(beltWarningText(level));
    this.root.setAlpha(beltPulseAlpha(level, nowMs));
    if (ship)
      this.arrow.setRotation(Math.atan2(center.y - ship.y, center.x - ship.x));
  }

  /**
   * Keep the warning 1:1 on screen under the current camera zoom.
   *
   * @param camera - The scene camera.
   */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** Destroy every game object. */
  destroy(): void {
    this.root.destroy();
  }

  private drawFrame(width: number, height: number): void {
    const t = FRAME_THICKNESS;
    this.frame.fillStyle(HOLO_PALETTE.danger, FRAME_ALPHA);
    this.frame.fillRect(0, 0, width, t);
    this.frame.fillRect(0, height - t, width, t);
    this.frame.fillRect(0, t, t, height - 2 * t);
    this.frame.fillRect(width - t, t, t, height - 2 * t);
  }

  /** A filled warning triangle with an exclamation mark cut into it. */
  private drawIcon(x: number, y: number): void {
    const g = this.icon;
    const top = y - ICON_HEIGHT;
    const half = ICON_GLYPH_WIDTH / 2;
    g.fillStyle(HOLO_PALETTE.warning, 1);
    g.fillTriangle(x, top, x + ICON_HALF_WIDTH, y, x - ICON_HALF_WIDTH, y);
    g.fillStyle(HOLO_PALETTE.panelFill, 1);
    g.fillRect(
      x - half,
      top + ICON_HEIGHT * ICON_BAR_START,
      ICON_GLYPH_WIDTH,
      ICON_HEIGHT * ICON_BAR_LENGTH,
    );
    g.fillRect(
      x - half,
      y - ICON_HEIGHT * ICON_DOT_RISE,
      ICON_GLYPH_WIDTH,
      ICON_GLYPH_WIDTH,
    );
  }

  /** An arrow pointing right (rotation 0); update() turns it to the centre. */
  private drawArrow(): void {
    this.arrow.fillStyle(HOLO_PALETTE.warning, 1);
    this.arrow.fillTriangle(
      ARROW_LENGTH,
      0,
      -ARROW_LENGTH / 2,
      ARROW_HALF_WIDTH,
      -ARROW_LENGTH / 2,
      -ARROW_HALF_WIDTH,
    );
  }
}
