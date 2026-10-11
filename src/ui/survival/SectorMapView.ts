/**
 * Survival roguelite — the sector map drawing: nodes (distinct icon +
 * colour per type), edges, the path flown so far, reachable nodes
 * highlighted and clickable, and a hover preview line describing what a
 * node offers. Presentation only; the scene decides what a click does.
 */

import Phaser from "phaser";
import { NODE_INFO } from "../../data/survival/nodes";
import type {
  MapNode,
  SectorMap,
} from "../../systems/survival/SectorMapGenerator";
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_PALETTE } from "../theme/HoloTheme";

/** Map drawing area (px, 1280×720 canvas). */
export const MAP_AREA = {
  left: 80,
  right: 860,
  top: 150,
  bottom: 600,
} as const;
/** Node disc radius (px). */
const NODE_RADIUS = 20;
/** Reachable nodes are drawn this much larger. */
const REACHABLE_SCALE = 1.25;
/** Y of the hover preview line. */
const PREVIEW_Y = 650;
/** Edge styles. */
const EDGE_WIDTH = 2;
const PATH_WIDTH = 5;
const EDGE_ALPHA = 0.35;
/** Alpha of nodes that cannot be reached now. */
const DIM_ALPHA = 0.45;
/** Pulse tween period for reachable nodes (ms). */
const PULSE_MS = 700;

/** What the view needs to know about the run's position. */
export interface MapViewState {
  readonly map: SectorMap;
  readonly path: readonly string[];
  readonly currentNodeId: string | null;
  readonly reachable: ReadonlySet<string>;
}

/** Callbacks of the view. */
export interface MapViewHandlers {
  readonly onSelect: (node: MapNode) => void;
  /** Hover preview text for a node. */
  readonly describe: (node: MapNode) => string;
}

export class SectorMapView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private preview!: Phaser.GameObjects.Text;

  /** @param scene - The map scene. */
  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Draws (or redraws) the map.
   *
   * @param state - Map, path, current and reachable nodes.
   * @param handlers - Click and hover callbacks.
   */
  render(state: MapViewState, handlers: MapViewHandlers): void {
    this.clear();
    this.drawEdges(state);
    for (const row of state.map.rows) {
      for (const node of row) this.drawNode(node, state, handlers);
    }
    this.preview = createHoloText(
      this.scene,
      (MAP_AREA.left + MAP_AREA.right) / 2,
      PREVIEW_Y,
      "Hover a node to preview it — click a highlighted node to travel",
      "body",
      HOLO_PALETTE.textSecondary,
    );
    this.objects.push(this.preview);
  }

  /** Destroys everything drawn. */
  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
  }

  /**
   * @param map - The map.
   * @param node - A node.
   * @returns Its screen position.
   */
  static positionOf(map: SectorMap, node: MapNode): { x: number; y: number } {
    const rows = Math.max(1, map.rows.length - 1);
    return {
      x: MAP_AREA.left + (node.row / rows) * (MAP_AREA.right - MAP_AREA.left),
      y: MAP_AREA.top + node.lane * (MAP_AREA.bottom - MAP_AREA.top),
    };
  }

  private drawEdges(state: MapViewState): void {
    const g = this.scene.add.graphics();
    this.objects.push(g);
    const onPath = (a: string, b: string): boolean => {
      const i = state.path.indexOf(a);
      return i >= 0 && state.path[i + 1] === b;
    };
    for (const row of state.map.rows) {
      for (const node of row) {
        const from = SectorMapView.positionOf(state.map, node);
        for (const nextId of node.next) {
          const next = state.map.rows[node.row + 1]?.find(
            (n) => n.id === nextId,
          );
          if (!next) continue;
          const to = SectorMapView.positionOf(state.map, next);
          const traveled = onPath(node.id, nextId);
          g.lineStyle(
            traveled ? PATH_WIDTH : EDGE_WIDTH,
            traveled ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
            traveled ? 1 : EDGE_ALPHA,
          );
          g.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }
  }

  private drawNode(
    node: MapNode,
    state: MapViewState,
    handlers: MapViewHandlers,
  ): void {
    const info = NODE_INFO[node.type];
    const { x, y } = SectorMapView.positionOf(state.map, node);
    const reachable = state.reachable.has(node.id);
    const visited = state.path.includes(node.id);
    const radius = node.type === "boss" ? NODE_RADIUS * 1.5 : NODE_RADIUS;
    const container = this.scene.add.container(x, y).setName(`node:${node.id}`);
    const disc = this.scene.add.circle(
      0,
      0,
      radius,
      info.color,
      visited ? 0.35 : 0.9,
    );
    disc.setStrokeStyle(
      node.id === state.currentNodeId ? 4 : 2,
      reachable ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
    );
    const icon = this.scene.add
      .text(0, 0, info.icon, {
        font: `${Math.round(radius)}px Arial`,
        color: "#ffffff",
      })
      .setOrigin(0.5);
    container.add([disc, icon]);
    container.setAlpha(reachable || visited ? 1 : DIM_ALPHA);
    if (reachable) this.makeReachable(container, radius, node, handlers);
    else
      disc
        .setInteractive()
        .on("pointerover", () => this.preview.setText(handlers.describe(node)));
    this.objects.push(container);
  }

  private makeReachable(
    container: Phaser.GameObjects.Container,
    radius: number,
    node: MapNode,
    handlers: MapViewHandlers,
  ): void {
    container.setScale(REACHABLE_SCALE);
    this.scene.tweens.add({
      targets: container,
      scale: REACHABLE_SCALE * 1.1,
      duration: PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
    const hit = this.scene.add
      .circle(0, 0, radius)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => this.preview.setText(handlers.describe(node)));
    hit.on("pointerdown", () => handlers.onSelect(node));
    container.add(hit);
  }
}
