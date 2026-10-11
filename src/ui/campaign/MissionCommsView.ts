/**
 * MissionCommsView — in-battle comms: scripted dialogue lines with the
 * speaker's portrait, name (mood-coloured) and text, queued and shown one at
 * a time for a reading time proportional to their length. Screen-space,
 * bottom left above the hero power bar.
 */

import Phaser from "phaser";
import type { DialogueMood } from "../../campaign/scripting/scriptTypes";
import { HOLO_DEPTH, HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { HoloPanel } from "../hud/HoloPanel";
import { createHoloText } from "../hud/holoPrimitives";
import {
  cancelCameraZoom,
  pinTree,
  type ZoomCameraLike,
} from "../modeHud/screenSpace";

/** Panel size (px). */
const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 92;
/** Portrait square (px). */
const PORTRAIT_SIZE = 64;
/** Panel bottom edge above the screen bottom (clears the power bar). */
const BOTTOM_OFFSET = 112;
/** Reading time: base + per character (ms), capped. */
const BASE_MS = 2200;
const PER_CHAR_MS = 45;
const MAX_LINE_MS = 7000;
/** Fallback portrait texture. */
const FALLBACK_PORTRAIT = "portrait_command";

/** A line to show. */
export interface CommsLine {
  readonly speaker: string;
  readonly portraitKey: string;
  readonly text: string;
  readonly mood?: DialogueMood | undefined;
}

/**
 * @param mood - Line mood.
 * @returns Speaker plate colour.
 */
function moodColor(mood: DialogueMood | undefined): number {
  if (mood === "urgent") return HOLO_PALETTE.warning;
  if (mood === "grim" || mood === "solemn") return HOLO_PALETTE.danger;
  if (mood === "proud") return HOLO_PALETTE.success;
  return HOLO_PALETTE.accent;
}

export class MissionCommsView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly speaker: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly queue: CommsLine[] = [];
  private current: CommsLine | null = null;
  private hideAtMs = 0;
  /** Every line shown so far (debug / tests). */
  readonly history: CommsLine[] = [];

  /** @param scene - Battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    const x = HOLO_SPACING.lg + PANEL_WIDTH / 2;
    const y = scene.scale.height - BOTTOM_OFFSET - PANEL_HEIGHT / 2;
    const panel = new HoloPanel(scene, x, y, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      title: "Comms",
    });
    scene.add.existing(panel);
    const left = -PANEL_WIDTH / 2 + HOLO_SPACING.md;
    const top = panel.contentTop;
    this.portrait = scene.add
      .image(
        left + PORTRAIT_SIZE / 2,
        top + PORTRAIT_SIZE / 2 - 6,
        FALLBACK_PORTRAIT,
      )
      .setDisplaySize(PORTRAIT_SIZE - 12, PORTRAIT_SIZE - 12);
    const textLeft = left + PORTRAIT_SIZE;
    this.speaker = createHoloText(
      scene,
      textLeft,
      top - 4,
      "",
      "caption",
    ).setOrigin(0, 0);
    this.body = createHoloText(scene, textLeft, top + 12, "", "body")
      .setOrigin(0, 0)
      .setWordWrapWidth(PANEL_WIDTH - PORTRAIT_SIZE - HOLO_SPACING.md * 2);
    panel.add([this.portrait, this.speaker, this.body]);
    this.root = scene.add
      .container(0, 0, [panel])
      .setDepth(HOLO_DEPTH.hud)
      .setVisible(false);
    pinTree(this.root);
  }

  /** The line on screen, or null. */
  get currentLine(): CommsLine | null {
    return this.current;
  }

  /** @param line - Line to queue. */
  say(line: CommsLine): void {
    this.queue.push(line);
    this.history.push(line);
  }

  /** @param nowMs - Scene time: advances the queue. */
  update(nowMs: number): void {
    if (this.current && nowMs < this.hideAtMs) return;
    const next = this.queue.shift() ?? null;
    this.current = next;
    this.root.setVisible(next !== null);
    if (!next) return;
    this.hideAtMs =
      nowMs + Math.min(MAX_LINE_MS, BASE_MS + next.text.length * PER_CHAR_MS);
    const texture = this.scene.textures.exists(next.portraitKey)
      ? next.portraitKey
      : FALLBACK_PORTRAIT;
    this.portrait
      .setTexture(texture)
      .setDisplaySize(PORTRAIT_SIZE - 12, PORTRAIT_SIZE - 12);
    this.speaker
      .setText(next.speaker)
      .setColor(toCssColor(moodColor(next.mood)));
    this.body.setText(next.text);
  }

  /** @param camera - Scene camera (keeps the panel 1:1 under zoom). */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** @param visible - Whether comms may show (hidden under overlays). */
  setVisible(visible: boolean): void {
    this.root.setVisible(visible && this.current !== null);
  }

  /** Destroy the view. */
  destroy(): void {
    this.root.destroy();
  }
}
