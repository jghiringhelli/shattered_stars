/**
 * CreatureView — a creature's body on screen: the art (placeholder first,
 * the PNG once loaded) in a container the scene positions and rotates like a
 * ship sprite, orbiting brood pods, weak-point / plate markers drawn on the
 * parts that are still alive (a crosshair ring for a weak point, a square
 * bracket for an armoured plate — shapes, not colours), world-space body
 * segments trailing a serpent's head, and a ghosted look while phase-shifted.
 * Markers redraw only when a part's state changes; nothing allocates per frame.
 */

import Phaser from "phaser";
import { BodyTrail, type TrailPoint } from "../../arcade/creatures/BodyTrail";
import { forwardX, forwardY } from "../../arcade/creatures/creatureMath";
import type { CreatureEncounter } from "../../arcade/creatures/CreatureEncounter";
import { partBearingDeg } from "../../arcade/creatures/CreatureParts";
import {
  creatureTextureKeys,
  POD_PART_PREFIX,
} from "../../data/creatures/creatureCatalog";
import {
  INITIAL_BANK_STATE,
  type BankState,
} from "../../rendering/ShipBanking";
import { showCreatureArt } from "./creatureTextures";

/** The sprite container as the battle scenes keep it (like a ship sprite). */
export interface CreatureContainer extends Phaser.GameObjects.Container {
  shipId: string;
  image?: Phaser.GameObjects.Image | null;
  imageBaseScaleX?: number;
  imageBaseScaleY?: number;
  bankState: BankState;
}

const BODY_BOX_RADII = 3.4;
const POD_BOX_RADII = 0.7;
const SEGMENT_BOX_RADII = 1.5;
const SEGMENT_SHRINK = 0.12;
const SEGMENT_SPACING_RADII = 0.75;
const TRAIL_CAPACITY = 128;
const TRAIL_STEP_PX = 8;
const PHASED_ALPHA = 0.3;
const BODY_DEPTH = 14;
const SEGMENT_DEPTH = 13;
const MARKER_PX = 12;
const WEAK_COLOR = 0xffe27a;
const PLATE_COLOR = 0x9ec8ff;
const RAD_TO_DEG = 180 / Math.PI;
const HALF_WORLD_JUMP = 3000;

/** One creature's body, pods, markers and segments. */
export class CreatureView {
  readonly container: CreatureContainer;
  private readonly markers: Phaser.GameObjects.Graphics;
  private readonly pods: {
    image: Phaser.GameObjects.Image;
    partIndex: number;
  }[] = [];
  private readonly segments: Phaser.GameObjects.Image[] = [];
  private readonly trail = new BodyTrail(
    TRAIL_CAPACITY,
    TRAIL_STEP_PX,
    HALF_WORLD_JUMP,
  );
  private readonly scratch: TrailPoint = { x: 0, y: 0 };
  private markerSignature = "";

  /**
   * @param scene - The battle scene.
   * @param encounter - The creature.
   * @param shipId - Its ship record's id.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly encounter: CreatureEncounter,
    shipId: string,
  ) {
    const def = encounter.definition;
    const keys = creatureTextureKeys(def);
    const container = scene.add.container(
      encounter.x,
      encounter.y,
    ) as unknown as CreatureContainer;
    container.shipId = shipId;
    container.image = null;
    container.bankState = { ...INITIAL_BANK_STATE, lastAngle: encounter.angle };
    this.container = container;
    const body = scene.add.image(0, 0, "__DEFAULT");
    showCreatureArt(
      scene,
      body,
      keys.body,
      "body",
      def.radiusPx * BODY_BOX_RADII,
    );
    this.markers = scene.add.graphics();
    container.add([body, this.markers]);
    this.buildPods(keys.pod, def.radiusPx);
    this.buildSegments(keys.segment, def.radiusPx, def.segmentCount);
    container
      .setDepth(BODY_DEPTH)
      .setSize(def.radiusPx * 2, def.radiusPx * 2)
      .setInteractive();
  }

  /** @param nowMs - Sim time (ms). */
  update(nowMs: number): void {
    const { encounter, container } = this;
    container.setAlpha(encounter.phased ? PHASED_ALPHA : 1);
    this.updatePods(nowMs);
    this.updateMarkers();
    this.updateSegments();
  }

  /** Removes everything the view created. */
  destroy(): void {
    for (const segment of this.segments) segment.destroy();
    this.container.destroy();
  }

  private buildPods(podKey: string | null, radiusPx: number): void {
    if (!podKey) return;
    this.encounter.parts.forEach((part, partIndex) => {
      if (!part.spec.id.startsWith(POD_PART_PREFIX)) return;
      const image = this.scene.add.image(0, 0, "__DEFAULT");
      showCreatureArt(
        this.scene,
        image,
        podKey,
        "pod",
        radiusPx * POD_BOX_RADII,
      );
      this.container.add(image);
      this.pods.push({ image, partIndex });
    });
  }

  private buildSegments(
    segmentKey: string | null,
    radiusPx: number,
    count: number,
  ): void {
    if (!segmentKey) return;
    for (let i = 0; i < count; i++) {
      const image = this.scene.add
        .image(0, 0, "__DEFAULT")
        .setDepth(SEGMENT_DEPTH);
      const radii = Math.max(0.5, SEGMENT_BOX_RADII - SEGMENT_SHRINK * i);
      showCreatureArt(
        this.scene,
        image,
        segmentKey,
        "segment",
        radiusPx * radii,
      );
      this.segments.push(image);
    }
  }

  private updatePods(nowMs: number): void {
    for (const pod of this.pods) {
      const part = this.encounter.parts[pod.partIndex]!;
      pod.image.setVisible(part.alive);
      if (!part.alive) continue;
      const bearing = partBearingDeg(part, nowMs);
      pod.image
        .setPosition(
          forwardX(bearing) * part.spec.offsetPx,
          forwardY(bearing) * part.spec.offsetPx,
        )
        .setAngle(bearing);
    }
  }

  private updateMarkers(): void {
    const parts = this.encounter.parts;
    let signature = "";
    for (const part of parts) signature += part.alive ? "1" : "0";
    if (signature === this.markerSignature) return;
    this.markerSignature = signature;
    const g = this.markers;
    g.clear();
    for (const part of parts) {
      if (!part.alive || part.spec.id.startsWith(POD_PART_PREFIX)) continue;
      const x = forwardX(part.spec.bearingDeg) * part.spec.offsetPx;
      const y = forwardY(part.spec.bearingDeg) * part.spec.offsetPx;
      if (part.spec.damageMultiplier >= 1) this.weakMarker(g, x, y);
      else this.plateMarker(g, x, y);
    }
  }

  private weakMarker(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
  ): void {
    g.lineStyle(3, WEAK_COLOR, 0.95).strokeCircle(x, y, MARKER_PX);
    g.lineBetween(x - MARKER_PX * 1.6, y, x - MARKER_PX * 0.5, y);
    g.lineBetween(x + MARKER_PX * 0.5, y, x + MARKER_PX * 1.6, y);
    g.lineBetween(x, y - MARKER_PX * 1.6, x, y - MARKER_PX * 0.5);
    g.lineBetween(x, y + MARKER_PX * 0.5, x, y + MARKER_PX * 1.6);
  }

  private plateMarker(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
  ): void {
    const r = MARKER_PX;
    g.lineStyle(3, PLATE_COLOR, 0.9);
    g.lineBetween(x - r, y - r, x - r, y + r);
    g.lineBetween(x + r, y - r, x + r, y + r);
    g.lineBetween(x - r, y - r, x - r * 0.4, y - r);
    g.lineBetween(x + r, y - r, x + r * 0.4, y - r);
    g.lineBetween(x - r, y + r, x - r * 0.4, y + r);
    g.lineBetween(x + r, y + r, x + r * 0.4, y + r);
  }

  private updateSegments(): void {
    if (this.segments.length === 0) return;
    const { encounter, scratch, trail } = this;
    trail.record(encounter.x, encounter.y);
    const spacing = encounter.definition.radiusPx * SEGMENT_SPACING_RADII;
    let previousX = encounter.x;
    let previousY = encounter.y;
    for (let i = 0; i < this.segments.length; i++) {
      trail.pointAt((i + 1) * spacing, scratch);
      this.segments[i]!.setPosition(scratch.x, scratch.y).setAngle(
        Math.atan2(scratch.y - previousY, scratch.x - previousX) * RAD_TO_DEG +
          90,
      );
      previousX = scratch.x;
      previousY = scratch.y;
    }
  }
}
