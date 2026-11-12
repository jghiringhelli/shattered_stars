/**
 * FiringCue — shows the player what the primary weapon needs to fire: a
 * subtle wedge outline of the forward arc and range in front of the ship
 * (dim while nothing is inside it, accent colour, thicker and lightly filled
 * while a hostile is), a state text on the focus hostile (IN RANGE / OUT OF
 * ARC / OUT OF RANGE) and a small chevron at the arc edge pointing the way to
 * turn when no hostile is in the wedge.
 *
 * Render-only: derived from the snapshot (positions, weapon range and arc),
 * never touching targeting or firing. Static — no pulsing — so Reduce Motion
 * needs no special case. Drawn only while a hostile is within twice the
 * weapon range; otherwise hidden and free (see buildFiringCue).
 */

import Phaser from "phaser";
import { toCssColor } from "../theme/colorMath";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { holoFont } from "../theme/holoFont";
import {
  buildFiringCue,
  firingStateText,
  type FiringCueModel,
  type HostileFireState,
  type TurnHintSide,
} from "./firingCueMath";
import type { ContactHudState, PlayerHudState } from "./types";

const DEG_TO_RAD = Math.PI / 180;
/** Local nose direction (Graphics angle 0 points right; the ship's nose is -y). */
const NOSE_RAD = -Math.PI / 2;
const DIM_ALPHA = 0.3;
const DIM_LINE_PX = 1.25;
const ACTIVE_ALPHA = 0.9;
const ACTIVE_LINE_PX = 2.5;
const ACTIVE_FILL_ALPHA = 0.08;
/** The wedge starts this far outside the status ring (world px). */
const WEDGE_INNER_GAP = 6;
const HINT_SIZE_PX = 7;
const HINT_LINE_PX = 2;
/** The chevron sits this far outside the arc edge (degrees) and ring (screen px). */
const HINT_EDGE_OFFSET_DEG = 12;
const HINT_RING_GAP_PX = 20;
const STATE_TEXT_PX = 12;
/** The state text hangs this far below the hostile (screen px). */
const STATE_TEXT_DROP_PX = 34;
const TEXT_OUTLINE = "#04101a";
const TEXT_OUTLINE_PX = 3;
const OUT_OF_RANGE_TEXT_ALPHA = 0.7;

function stateColor(state: HostileFireState): number {
  if (state === "in_range") return HOLO_PALETTE.success;
  return state === "out_of_arc" ? HOLO_PALETTE.warning : HOLO_PALETTE.textSecondary;
}

/** One frame of what the cue needs. */
export interface FiringCueFrame {
  readonly player: PlayerHudState | null;
  readonly contacts: ReadonlyArray<ContactHudState>;
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
  readonly zoom: number;
}

/** World-space firing arc, state text and turn hint. */
export class FiringCue {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly ringRadius: number;
  private shownState: HostileFireState | null = null;

  /**
   * @param scene - Owning scene.
   * @param ringRadius - Status ring radius in world px (the wedge starts outside it).
   */
  constructor(scene: Phaser.Scene, ringRadius: number) {
    this.ringRadius = ringRadius;
    this.graphics = scene.add
      .graphics()
      .setDepth(HOLO_DEPTH.worldOverlay - 2)
      .setVisible(false);
    this.stateText = scene.add
      .text(0, 0, "", { ...holoFont(STATE_TEXT_PX, "700") })
      .setOrigin(0.5, 0)
      .setStroke(TEXT_OUTLINE, TEXT_OUTLINE_PX)
      .setDepth(HOLO_DEPTH.worldOverlay + 1)
      .setVisible(false);
  }

  /** @returns True while the cue is on screen. */
  get isShowing(): boolean {
    return this.graphics.visible;
  }

  /**
   * Redraw from the snapshot, or hide when no hostile is near.
   *
   * @param frame - Player, contacts, world size and zoom.
   */
  update(frame: FiringCueFrame): void {
    const { player } = frame;
    const model =
      player === null || player.weaponRangePx === undefined || player.firingArcDeg === undefined
        ? null
        : buildFiringCue({
            pose: player.pose,
            envelope: { rangePx: player.weaponRangePx, arcDeg: player.firingArcDeg },
            contacts: frame.contacts,
            worldSize: frame.worldSize,
          });
    if (model === null || player === null) {
      this.hide();
      return;
    }
    const px = frame.zoom > 0 ? 1 / frame.zoom : 1;
    this.drawWedge(model, player.pose, px);
    this.drawStateText(model, player.pose, px);
  }

  /** Hide the cue. */
  hide(): void {
    if (!this.graphics.visible) return;
    this.graphics.clear();
    this.graphics.setVisible(false);
    this.stateText.setVisible(false);
  }

  /** Destroy the game objects. */
  destroy(): void {
    this.graphics.destroy();
    this.stateText.destroy();
  }

  private drawWedge(
    model: FiringCueModel,
    pose: { readonly x: number; readonly y: number; readonly angle: number },
    px: number,
  ): void {
    const g = this.graphics;
    const active = model.anyInWedge;
    const color = active ? HOLO_PALETTE.accent : HOLO_PALETTE.textSecondary;
    g.clear();
    g.setVisible(true);
    g.setPosition(pose.x, pose.y).setAngle(pose.angle);
    g.lineStyle(
      (active ? ACTIVE_LINE_PX : DIM_LINE_PX) * px,
      color,
      active ? ACTIVE_ALPHA : DIM_ALPHA,
    );
    const { rangePx, arcDeg } = model.envelope;
    if (arcDeg >= 360) {
      g.strokeCircle(0, 0, rangePx);
      return;
    }
    const inner = this.ringRadius + WEDGE_INNER_GAP;
    const half = (arcDeg / 2) * DEG_TO_RAD;
    this.tracePath(inner, rangePx, half);
    if (active) {
      g.fillStyle(color, ACTIVE_FILL_ALPHA);
      g.fillPath();
    }
    g.strokePath();
    if (model.turnHint !== null) this.drawTurnHint(model.turnHint, half, px);
  }

  /** The wedge: out along one edge, around the range arc, back along the other. */
  private tracePath(inner: number, outer: number, half: number): void {
    const g = this.graphics;
    const left = NOSE_RAD - half;
    const right = NOSE_RAD + half;
    g.beginPath();
    g.moveTo(Math.cos(left) * inner, Math.sin(left) * inner);
    g.lineTo(Math.cos(left) * outer, Math.sin(left) * outer);
    g.arc(0, 0, outer, left, right, false);
    g.lineTo(Math.cos(right) * inner, Math.sin(right) * inner);
    g.arc(0, 0, inner, right, left, true);
    g.closePath();
  }

  /** A chevron just outside the arc edge, pointing the way to turn. */
  private drawTurnHint(side: TurnHintSide, half: number, px: number): void {
    const g = this.graphics;
    const sign = side === "left" ? -1 : 1;
    const theta = NOSE_RAD + sign * (half + HINT_EDGE_OFFSET_DEG * DEG_TO_RAD);
    const radius = this.ringRadius + HINT_RING_GAP_PX * px;
    const cx = Math.cos(theta) * radius;
    const cy = Math.sin(theta) * radius;
    const tx = -Math.sin(theta) * sign;
    const ty = Math.cos(theta) * sign;
    const size = HINT_SIZE_PX * px;
    g.lineStyle(HINT_LINE_PX * px, HOLO_PALETTE.warning, ACTIVE_ALPHA);
    g.beginPath();
    g.moveTo(cx - tx * size * 0.6 + ty * size * 0.9, cy - ty * size * 0.6 - tx * size * 0.9);
    g.lineTo(cx + tx * size, cy + ty * size);
    g.lineTo(cx - tx * size * 0.6 - ty * size * 0.9, cy - ty * size * 0.6 + tx * size * 0.9);
    g.strokePath();
  }

  private drawStateText(
    model: FiringCueModel,
    pose: { readonly x: number; readonly y: number },
    px: number,
  ): void {
    const { focus } = model;
    const text = this.stateText;
    if (focus.state !== this.shownState) {
      this.shownState = focus.state;
      text.setText(firingStateText(focus.state));
      text.setColor(toCssColor(stateColor(focus.state)));
      text.setAlpha(focus.state === "out_of_range" ? OUT_OF_RANGE_TEXT_ALPHA : 1);
    }
    text
      .setScale(px)
      .setPosition(pose.x + focus.dx, pose.y + focus.dy + STATE_TEXT_DROP_PX * px)
      .setVisible(true);
  }
}
