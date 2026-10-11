/**
 * ScenarioWorldView — the scenario's objectives on the battlefield: each
 * satellite / node as its control circle (owner-coloured), its glyph and a
 * caption (letter, owner symbol and tag — never colour alone), scrambling
 * progress on nodes, loose crates with their pick-up ring, and the salvage
 * flag (crate glyph + "SALVAGE") riding above every carrier.
 *
 * Redrawn every rendered frame into two Graphics (objectives below the
 * ships, flags above the ship overlays); captions are pooled per objective.
 */

import Phaser from "phaser";
import { SALVAGE_PICKUP_RADIUS_PX } from "../../arcade/scenarios";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { toCssColor } from "../../ui/theme/colorMath";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import {
  drawObjectiveGlyph,
  drawProgressArc,
  ownerColor,
} from "./scenarioGlyphs";
import {
  OWNER_SYMBOLS,
  OWNER_TAGS,
  type ObjectiveGlyph,
} from "./scenarioHudModel";

/** Objectives draw under the ships (ships sit at depth 10). */
const OBJECTIVE_DEPTH = 4;
/** Salvage flags draw just above the ship overlays. */
const FLAG_DEPTH = HOLO_DEPTH.worldOverlay + 1;
/** Zone fill / outline opacity. */
const ZONE_FILL_ALPHA = 0.07;
const ZONE_LINE_ALPHA = 0.55;
const ZONE_LINE_WIDTH = 3;
/** Glyph half-sizes in world px. */
const ZONE_GLYPH_SIZE = 26;
const CRATE_GLYPH_SIZE = 16;
const FLAG_GLYPH_SIZE = 11;
/** Caption offset above a glyph (px). */
const CAPTION_OFFSET = 46;
/** Scramble progress ring: inset from the zone edge and width (px). */
const PROGRESS_INSET = 10;
const PROGRESS_WIDTH = 6;
/** Flag offset above a carrier, clear of its health overlay (px). */
const FLAG_OFFSET = 62;
/** Pick-up ring pulse rate (rad/ms) and alpha range. */
const PULSE_RATE = 0.004;
const PULSE_MIN_ALPHA = 0.2;
const PULSE_SPAN_ALPHA = 0.4;

/** A carrier's position (its salvage flag rides above it). */
export interface CarrierPose {
  readonly crateId: string;
  readonly x: number;
  readonly y: number;
}

export class ScenarioWorldView {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly flags: Phaser.GameObjects.Graphics;
  private readonly captions = new Map<string, Phaser.GameObjects.Text>();
  private readonly flagTexts = new Map<string, Phaser.GameObjects.Text>();

  /** @param scene - The battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(OBJECTIVE_DEPTH);
    this.flags = scene.add.graphics().setDepth(FLAG_DEPTH);
  }

  /**
   * @param glyphs - Every objective.
   * @param carriers - Carried crates, at their carriers.
   * @param nowMs - Scene time (pulses).
   */
  update(
    glyphs: readonly ObjectiveGlyph[],
    carriers: readonly CarrierPose[],
    nowMs: number,
  ): void {
    this.ground.clear();
    this.flags.clear();
    for (const glyph of glyphs) {
      if (glyph.kind === "crate") this.drawCrate(glyph, nowMs);
      else this.drawZone(glyph);
    }
    const flagged = new Set<string>();
    for (const carrier of carriers) {
      this.drawFlag(
        carrier,
        glyphs.find((g) => g.id === carrier.crateId),
      );
      flagged.add(carrier.crateId);
    }
    for (const [id, text] of this.flagTexts) text.setVisible(flagged.has(id));
  }

  /** Destroy every game object. */
  destroy(): void {
    this.ground.destroy();
    this.flags.destroy();
    for (const text of [...this.captions.values(), ...this.flagTexts.values()])
      text.destroy();
    this.captions.clear();
    this.flagTexts.clear();
  }

  private drawZone(glyph: ObjectiveGlyph): void {
    const g = this.ground;
    const color = ownerColor(glyph.owner);
    g.fillStyle(color, ZONE_FILL_ALPHA);
    g.fillCircle(glyph.x, glyph.y, glyph.radius);
    g.lineStyle(ZONE_LINE_WIDTH, color, ZONE_LINE_ALPHA);
    g.strokeCircle(glyph.x, glyph.y, glyph.radius);
    if (glyph.progressSide) {
      drawProgressArc(
        g,
        { x: glyph.x, y: glyph.y, radius: glyph.radius - PROGRESS_INSET },
        glyph.progress,
        ownerColor(glyph.progressSide),
        PROGRESS_WIDTH,
      );
    }
    drawObjectiveGlyph(g, glyph, {
      x: glyph.x,
      y: glyph.y,
      size: ZONE_GLYPH_SIZE,
    });
    this.caption(
      glyph,
      `${glyph.label} ${OWNER_SYMBOLS[glyph.owner]} ${OWNER_TAGS[glyph.owner]}`,
    );
  }

  private drawCrate(glyph: ObjectiveGlyph, nowMs: number): void {
    const text = this.captions.get(glyph.id);
    if (glyph.carrierId) {
      text?.setVisible(false);
      return;
    }
    const g = this.ground;
    const pulse =
      PULSE_MIN_ALPHA +
      PULSE_SPAN_ALPHA * Math.abs(Math.sin(nowMs * PULSE_RATE));
    g.lineStyle(ZONE_LINE_WIDTH / 2, HOLO_PALETTE.accent, pulse);
    g.strokeCircle(glyph.x, glyph.y, SALVAGE_PICKUP_RADIUS_PX);
    drawObjectiveGlyph(g, glyph, {
      x: glyph.x,
      y: glyph.y,
      size: CRATE_GLYPH_SIZE,
    });
    this.caption(glyph, `SALVAGE ${glyph.label}`);
  }

  private drawFlag(
    carrier: CarrierPose,
    glyph: ObjectiveGlyph | undefined,
  ): void {
    if (!glyph) return;
    const y = carrier.y - FLAG_OFFSET;
    drawObjectiveGlyph(this.flags, glyph, {
      x: carrier.x,
      y,
      size: FLAG_GLYPH_SIZE,
    });
    let text = this.flagTexts.get(carrier.crateId);
    if (!text) {
      text = createHoloText(this.scene, 0, 0, "", "caption").setDepth(
        FLAG_DEPTH,
      );
      this.flagTexts.set(carrier.crateId, text);
    }
    text
      .setText(`${OWNER_SYMBOLS[glyph.owner]} SALVAGE`)
      .setColor(toCssColor(ownerColor(glyph.owner)))
      .setPosition(carrier.x, y - FLAG_GLYPH_SIZE * 2)
      .setVisible(true);
  }

  private caption(glyph: ObjectiveGlyph, content: string): void {
    let text = this.captions.get(glyph.id);
    if (!text) {
      text = createHoloText(this.scene, 0, 0, "", "heading").setDepth(
        OBJECTIVE_DEPTH,
      );
      this.captions.set(glyph.id, text);
    }
    if (text.text !== content) text.setText(content);
    text
      .setColor(toCssColor(ownerColor(glyph.owner)))
      .setPosition(glyph.x, glyph.y - CAPTION_OFFSET)
      .setVisible(true);
  }
}
