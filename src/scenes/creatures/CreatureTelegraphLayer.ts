/**
 * CreatureTelegraphLayer — draws what a creature is about to do, in world
 * space, so pilots can read it and leave: a fan (cone / sweep), a band (ring),
 * inward chevrons (tractor pull), a dashed cloud with a cross, concentric
 * waves (scream), a lane with an arrowhead (lunge), a diamond (blink
 * destination), spawn triangles (summon) — each with a text label and the
 * seconds left, so nothing relies on colour. Spore clouds that already landed
 * keep a dashed outline. One Graphics and one Text, cleared and redrawn only
 * while something is telegraphed; line widths scale with the camera zoom.
 */

import Phaser from "phaser";
import { POWER_TAGS } from "../../arcade/creatures/bossBarModel";
import {
  DEG_TO_RAD,
  forwardX,
  forwardY,
} from "../../arcade/creatures/creatureMath";
import { telegraphAngle } from "../../arcade/creatures/CreaturePowerEffects";
import {
  MAX_ZONES,
  stageProgress,
  type CreatureTelegraph,
  type CreatureZone,
} from "../../arcade/creatures/CreaturePowerState";
import type { CreatureEncounter } from "../../arcade/creatures/CreatureEncounter";

const WARNING_COLOR = 0xff5a3c;
const ACTIVE_COLOR = 0xffd34a;
const CLOUD_COLOR = 0xa8d848;
const DEPTH = 7;
const BASE_LINE_PX = 3;
const FILL_ALPHA_MIN = 0.1;
const FILL_ALPHA_GAIN = 0.28;
const DASH_SEGMENTS = 28;
const CHEVRONS = 8;
const RING_TICKS = 16;
const WAVE_RINGS = 3;
const LABEL_LIFT_PX = 36;
const LABEL_DEPTH = 17;
const LANE_WIDTH_PX = 44;
const MS_PER_S = 1000;
/** Ship angle 0 is up; Phaser's 0 rad points right. */
const UP_TO_RIGHT_DEG = 90;

/** World-space telegraphs of one creature. */
export class CreatureTelegraphLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private lastLabel = "";
  private drawn = false;

  /** @param scene - The battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH);
    this.label = scene.add
      .text(0, 0, "", {
        font: "700 16px Arial",
        color: "#ffe9a8",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(LABEL_DEPTH)
      .setVisible(false);
  }

  /**
   * @param encounter - The creature.
   * @param nowMs - Sim time (ms).
   */
  update(encounter: CreatureEncounter, nowMs: number): void {
    const tele = encounter.telegraph;
    const zones = encounter.zones;
    let hasZone = false;
    for (let i = 0; i < MAX_ZONES; i++) hasZone ||= zones[i]!.active;
    if (tele.stage === "idle" && !hasZone) {
      if (this.drawn) this.clear();
      return;
    }
    const g = this.graphics;
    g.clear();
    this.drawn = true;
    const px = BASE_LINE_PX / this.scene.cameras.main.zoom;
    for (let i = 0; i < MAX_ZONES; i++)
      if (zones[i]!.active) this.drawZone(zones[i]!, px);
    if (tele.stage === "idle") this.label.setVisible(false);
    else this.drawTelegraph(encounter, tele, nowMs, px);
  }

  /** Removes the layer's objects. */
  destroy(): void {
    this.graphics.destroy();
    this.label.destroy();
  }

  private clear(): void {
    this.graphics.clear();
    this.label.setVisible(false);
    this.drawn = false;
  }

  private drawTelegraph(
    encounter: CreatureEncounter,
    tele: CreatureTelegraph,
    nowMs: number,
    px: number,
  ): void {
    const g = this.graphics;
    const progress = stageProgress(tele, nowMs);
    const color = tele.stage === "windup" ? WARNING_COLOR : ACTIVE_COLOR;
    const alpha = FILL_ALPHA_MIN + FILL_ALPHA_GAIN * progress;
    const { x, y } = encounter;
    g.lineStyle(px * 1.5, color, 0.95);
    g.fillStyle(color, alpha);
    switch (tele.kind) {
      case "cone":
      case "sweep":
        this.fan(x, y, tele, telegraphAngle(tele, nowMs));
        break;
      case "lunge":
        this.lane(x, y, tele, px);
        break;
      case "ring":
        this.band(x, y, tele);
        break;
      case "pull":
        this.chevrons(x, y, tele, px);
        break;
      case "cloud":
        this.dashedCircle(tele.aimX, tele.aimY, tele.rangePx);
        this.cross(tele.aimX, tele.aimY, tele.rangePx * 0.5);
        break;
      case "scream":
        this.waves(x, y, tele);
        break;
      case "summon":
        this.spawnMarks(x, y, encounter.definition.radiusPx);
        break;
      case "blink":
        this.diamond(tele.aimX, tele.aimY, encounter.definition.radiusPx);
        g.lineBetween(x, y, tele.aimX, tele.aimY);
        break;
    }
    this.writeLabel(encounter, tele, nowMs);
  }

  private fan(
    x: number,
    y: number,
    tele: CreatureTelegraph,
    center: number,
  ): void {
    const start = (center - tele.arcDeg / 2 - UP_TO_RIGHT_DEG) * DEG_TO_RAD;
    const end = (center + tele.arcDeg / 2 - UP_TO_RIGHT_DEG) * DEG_TO_RAD;
    this.graphics.slice(x, y, tele.rangePx, start, end, false).fillPath();
    this.graphics.slice(x, y, tele.rangePx, start, end, false).strokePath();
  }

  private lane(
    x: number,
    y: number,
    tele: CreatureTelegraph,
    px: number,
  ): void {
    const g = this.graphics;
    const fx = forwardX(tele.aimAngle);
    const fy = forwardY(tele.aimAngle);
    const half = (LANE_WIDTH_PX * px) / (BASE_LINE_PX * 2);
    const ex = x + fx * tele.rangePx;
    const ey = y + fy * tele.rangePx;
    g.fillTriangle(
      x - fy * half,
      y + fx * half,
      ex - fy * half,
      ey + fx * half,
      ex + fy * half,
      ey - fx * half,
    );
    g.fillTriangle(
      x - fy * half,
      y + fx * half,
      ex + fy * half,
      ey - fx * half,
      x + fy * half,
      y - fx * half,
    );
    g.fillTriangle(
      ex + fx * half * 2,
      ey + fy * half * 2,
      ex - fy * half * 2,
      ey + fx * half * 2,
      ex + fy * half * 2,
      ey - fx * half * 2,
    );
  }

  private band(x: number, y: number, tele: CreatureTelegraph): void {
    const g = this.graphics;
    g.strokeCircle(x, y, tele.rangePx);
    this.dashedCircle(x, y, tele.innerRangePx);
    for (let i = 0; i < RING_TICKS; i++) {
      const a = (i / RING_TICKS) * Math.PI * 2;
      g.lineBetween(
        x + Math.cos(a) * tele.innerRangePx,
        y + Math.sin(a) * tele.innerRangePx,
        x + Math.cos(a) * tele.rangePx,
        y + Math.sin(a) * tele.rangePx,
      );
    }
  }

  private chevrons(
    x: number,
    y: number,
    tele: CreatureTelegraph,
    px: number,
  ): void {
    this.dashedCircle(x, y, tele.rangePx);
    const size = px * 14;
    for (let i = 0; i < CHEVRONS; i++) {
      const a = (i / CHEVRONS) * Math.PI * 2;
      const cx = x + Math.cos(a) * tele.rangePx * 0.8;
      const cy = y + Math.sin(a) * tele.rangePx * 0.8;
      const ix = -Math.cos(a);
      const iy = -Math.sin(a);
      this.graphics.fillTriangle(
        cx + ix * size,
        cy + iy * size,
        cx - iy * size * 0.6,
        cy + ix * size * 0.6,
        cx + iy * size * 0.6,
        cy - ix * size * 0.6,
      );
    }
  }

  private waves(x: number, y: number, tele: CreatureTelegraph): void {
    for (let i = 1; i <= WAVE_RINGS; i++)
      this.graphics.strokeCircle(x, y, (tele.rangePx * i) / WAVE_RINGS);
  }

  private spawnMarks(x: number, y: number, radius: number): void {
    const size = radius * 0.3;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = x + Math.cos(a) * (radius + size * 2);
      const cy = y + Math.sin(a) * (radius + size * 2);
      this.graphics.fillTriangle(
        cx,
        cy - size,
        cx - size,
        cy + size,
        cx + size,
        cy + size,
      );
    }
  }

  private diamond(x: number, y: number, radius: number): void {
    const r = radius * 0.8;
    const g = this.graphics;
    g.lineBetween(x, y - r, x + r, y);
    g.lineBetween(x + r, y, x, y + r);
    g.lineBetween(x, y + r, x - r, y);
    g.lineBetween(x - r, y, x, y - r);
  }

  private cross(x: number, y: number, r: number): void {
    this.graphics.lineBetween(x - r, y - r, x + r, y + r);
    this.graphics.lineBetween(x - r, y + r, x + r, y - r);
  }

  private dashedCircle(x: number, y: number, radius: number): void {
    const step = (Math.PI * 2) / DASH_SEGMENTS;
    for (let i = 0; i < DASH_SEGMENTS; i += 2) {
      this.graphics.beginPath();
      this.graphics.arc(x, y, radius, i * step, (i + 1) * step);
      this.graphics.strokePath();
    }
  }

  private drawZone(zone: CreatureZone, px: number): void {
    const g = this.graphics;
    g.lineStyle(px, CLOUD_COLOR, 0.9);
    g.fillStyle(CLOUD_COLOR, 0.1);
    g.fillCircle(zone.x, zone.y, zone.radiusPx);
    this.dashedCircle(zone.x, zone.y, zone.radiusPx);
    this.cross(zone.x, zone.y, zone.radiusPx * 0.35);
  }

  private writeLabel(
    encounter: CreatureEncounter,
    tele: CreatureTelegraph,
    nowMs: number,
  ): void {
    const seconds = Math.max(0, (tele.endsMs - nowMs) / MS_PER_S).toFixed(1);
    const text = `${tele.name} [${POWER_TAGS[tele.kind]}] ${seconds}s`;
    if (text !== this.lastLabel) {
      this.lastLabel = text;
      this.label.setText(text);
    }
    this.label
      .setScale(1 / this.scene.cameras.main.zoom)
      .setPosition(
        encounter.x,
        encounter.y - encounter.definition.radiusPx - LABEL_LIFT_PX,
      )
      .setVisible(true);
  }
}
