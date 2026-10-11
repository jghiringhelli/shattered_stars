/**
 * ScenarioHudView — the Scenario mode's screen-space HUD, layered over the
 * Skirmish HUD without touching it: the scoreboard (both totals, the
 * threshold, objective chips, round timer and clock, call-outs) under the
 * match clock, objective glyphs on the radar, and edge arrows (on an inner
 * track, so they never sit on the ship arrows) for objectives off screen.
 * Owners read by colour, fill, frame and symbol (scenarioGlyphs).
 */

import Phaser from "phaser";
import {
  DEFAULT_EDGE_INSETS,
  cameraViewFrom,
  type CameraLike,
} from "../../ui/hud";
import {
  addPinned,
  createHoloText,
  createScreenContainer,
} from "../../ui/hud/holoPrimitives";
import {
  hudRootTransform,
  placeEdgeArrow,
  projectToRadar,
} from "../../ui/hud/hudMath";
import type { ScreenRect } from "../../ui/hud/screenRect";
import type { HudPose } from "../../ui/hud/types";
import { toCssColor } from "../../ui/theme/colorMath";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../../ui/theme/HoloTheme";
import type { HoloPanel } from "../../ui/hud/HoloPanel";
import {
  PANEL_MARGIN,
  panelRect,
  pinnedPanel,
  setText,
} from "../arcadeBattle/hudPanelParts";
import { drawObjectiveGlyph, ownerColor } from "./scenarioGlyphs";
import type { ObjectiveGlyph, ScoreboardView } from "./scenarioHudModel";

/** Above the Skirmish HUD root, below its edge arrows. */
const SCENARIO_HUD_DEPTH = HOLO_DEPTH.hud + 1;
/** The Skirmish match clock panel's width: the scoreboard sits right of it. */
const CLOCK_PANEL_WIDTH = 168;
const BOARD = { width: 340, height: 58 } as const;
/** Scoreboard rows (offsets from the panel centre). */
const ROW = { scores: -15, chips: 5, round: 19 } as const;
const SCORE_COLUMN_X = 118;
/** World distance at the Skirmish radar's rim (the Radar default). */
const RADAR_RANGE_PX = 2000;
const RADAR_GLYPH_SIZE = 5;
const RADAR_LABEL_OFFSET = 9;
const RADAR_OUT_OF_RANGE_ALPHA = 0.5;
/** Objective arrows run this far inside the ship-arrow track (px). */
const OBJECTIVE_TRACK_INSET = 34;
/** The Skirmish HUD's ship-arrow top inset (below its top panels). */
const SHIP_ARROW_TOP_INSET = 136;
const ARROW_SIZE = 10;
/** Arrow half-width relative to its length. */
const ARROW_HALF_WIDTH = 0.6;
const EDGE_GLYPH_SIZE = 8;
/** Glyph sits this far inward from its arrow (px). */
const EDGE_GLYPH_BACKOFF = 20;
const SMALL_LABEL_PX = 10;

/** Everything the scenario HUD shows for one frame. */
export interface ScenarioHudFrame {
  readonly board: ScoreboardView;
  readonly glyphs: readonly ObjectiveGlyph[];
  readonly player: HudPose | null;
  readonly camera: CameraLike;
  /** The Skirmish radar's rect (HUD-root px), or undefined when hidden. */
  readonly radar: ScreenRect | undefined;
  readonly worldSize: number;
}

export class ScenarioHudView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly texts: Record<keyof ScoreboardView, Phaser.GameObjects.Text>;
  private readonly radarLayer: Phaser.GameObjects.Graphics;
  private readonly edgeLayer: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private visible = true;

  /** @param scene - The battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.root = createScreenContainer(scene).setDepth(SCENARIO_HUD_DEPTH);
    this.panel = pinnedPanel(scene, this.root, BOARD.width, BOARD.height);
    const text = (
      x: number,
      y: number,
      role: "heading" | "caption" | "body",
      color: number,
    ) => createHoloText(scene, x, y, "", role, color);
    this.texts = {
      title: text(
        0,
        ROW.scores - HOLO_SPACING.sm,
        "caption",
        HOLO_PALETTE.textSecondary,
      ),
      playerScore: text(
        -SCORE_COLUMN_X,
        ROW.scores,
        "heading",
        SIDE_COLORS.player,
      ),
      enemyScore: text(
        SCORE_COLUMN_X,
        ROW.scores,
        "heading",
        SIDE_COLORS.enemy,
      ),
      goal: text(
        0,
        ROW.scores + HOLO_SPACING.xs + HOLO_SPACING.xxs,
        "caption",
        HOLO_PALETTE.textPrimary,
      ),
      chips: text(
        0,
        ROW.chips + HOLO_SPACING.xs,
        "body",
        HOLO_PALETTE.textPrimary,
      ),
      round: text(
        0,
        ROW.round + HOLO_SPACING.xs,
        "caption",
        HOLO_PALETTE.textSecondary,
      ),
      alert: text(
        0,
        BOARD.height / 2 + HOLO_SPACING.md,
        "caption",
        HOLO_PALETTE.warning,
      ),
    };
    addPinned(this.panel, ...Object.values(this.texts));
    this.radarLayer = scene.add.graphics();
    this.edgeLayer = scene.add.graphics();
    addPinned(this.root, this.radarLayer, this.edgeLayer);
  }

  /** Scoreboard rect in HUD-root px (e2e overlap checks). */
  bounds(): ScreenRect {
    return panelRect(this.panel, BOARD.width, BOARD.height);
  }

  /** What the scoreboard reads (e2e). */
  get boardText(): Readonly<Record<keyof ScoreboardView, string>> {
    const out = {} as Record<keyof ScoreboardView, string>;
    for (const [key, text] of Object.entries(this.texts))
      out[key as keyof ScoreboardView] = text.text;
    return out;
  }

  /** @param frame - This frame's scoreboard, objectives and views. */
  update(frame: ScenarioHudFrame): void {
    if (!this.visible) return;
    const camera = cameraViewFrom(frame.camera);
    const t = hudRootTransform(camera.zoom, camera.width, camera.height);
    this.root.setPosition(t.x, t.y).setScale(t.scale);
    this.panel.setPosition(
      camera.width / 2 + CLOCK_PANEL_WIDTH / 2 + PANEL_MARGIN + BOARD.width / 2,
      PANEL_MARGIN + BOARD.height / 2,
    );
    for (const [key, value] of Object.entries(frame.board)) {
      setText(this.texts[key as keyof ScoreboardView], value);
    }
    for (const label of this.labels.values()) label.setVisible(false);
    this.drawRadar(frame);
    this.drawEdges(frame, camera);
  }

  /** @param visible - Show or hide the whole scenario HUD. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.setVisible(visible);
  }

  /** Destroy every game object. */
  destroy(): void {
    this.root.destroy();
    this.labels.clear();
  }

  private drawRadar(frame: ScenarioHudFrame): void {
    const g = this.radarLayer.clear();
    if (!frame.player || !frame.radar) return;
    const radius = frame.radar.width / 2;
    const cx = frame.radar.x + radius;
    const cy = frame.radar.y + radius;
    for (const glyph of frame.glyphs) {
      const p = projectToRadar(frame.player, glyph, {
        rangePx: RADAR_RANGE_PX,
        radiusPx: radius,
        worldSize: frame.worldSize,
      });
      const alpha = p.inRange ? 1 : RADAR_OUT_OF_RANGE_ALPHA;
      drawObjectiveGlyph(
        g,
        glyph,
        { x: cx + p.x, y: cy + p.y, size: RADAR_GLYPH_SIZE },
        alpha,
      );
      this.label(
        `radar:${glyph.id}`,
        glyph,
        cx + p.x + RADAR_LABEL_OFFSET,
        cy + p.y - RADAR_LABEL_OFFSET,
      );
    }
  }

  private drawEdges(
    frame: ScenarioHudFrame,
    camera: ReturnType<typeof cameraViewFrom>,
  ): void {
    const g = this.edgeLayer.clear();
    const insets = {
      top: SHIP_ARROW_TOP_INSET + OBJECTIVE_TRACK_INSET,
      right: DEFAULT_EDGE_INSETS.right + OBJECTIVE_TRACK_INSET,
      bottom: DEFAULT_EDGE_INSETS.bottom + OBJECTIVE_TRACK_INSET,
      left: DEFAULT_EDGE_INSETS.left + OBJECTIVE_TRACK_INSET,
    };
    for (const glyph of frame.glyphs) {
      const at = placeEdgeArrow(camera, glyph, insets, frame.worldSize);
      if (!at) continue;
      const cos = Math.cos(at.angle);
      const sin = Math.sin(at.angle);
      g.fillStyle(ownerColor(glyph.owner), 1);
      g.fillTriangle(
        at.x + cos * ARROW_SIZE,
        at.y + sin * ARROW_SIZE,
        at.x - sin * ARROW_SIZE * ARROW_HALF_WIDTH,
        at.y + cos * ARROW_SIZE * ARROW_HALF_WIDTH,
        at.x + sin * ARROW_SIZE * ARROW_HALF_WIDTH,
        at.y - cos * ARROW_SIZE * ARROW_HALF_WIDTH,
      );
      const gx = at.x - cos * EDGE_GLYPH_BACKOFF;
      const gy = at.y - sin * EDGE_GLYPH_BACKOFF;
      drawObjectiveGlyph(g, glyph, { x: gx, y: gy, size: EDGE_GLYPH_SIZE });
      this.label(`edge:${glyph.id}`, glyph, gx, gy - EDGE_GLYPH_SIZE * 2);
    }
  }

  private label(
    key: string,
    glyph: ObjectiveGlyph,
    x: number,
    y: number,
  ): void {
    let text = this.labels.get(key);
    if (!text) {
      text = createHoloText(
        this.scene,
        0,
        0,
        glyph.label,
        "caption",
      ).setFontSize(SMALL_LABEL_PX);
      addPinned(this.root, text);
      this.labels.set(key, text);
    }
    text
      .setColor(toCssColor(ownerColor(glyph.owner)))
      .setPosition(x, y)
      .setVisible(true);
  }
}
