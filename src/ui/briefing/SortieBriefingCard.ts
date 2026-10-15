/**
 * SortieBriefingCard — the shared pre-sortie briefing (Dogfight, Ace Duel,
 * Boss Raid): a dimmed screen, a HoloPanel with the codename, one objective
 * line and the intel, a countdown bar, and the mood's stinger. It launches
 * by itself after the countdown (≤ 3 s); ENTER / SPACE / gamepad A / a click
 * launches at once. Screen-space and zoom-agnostic (shown at zoom 1 over a
 * setup screen).
 *
 * Scenes call {@link showSortieBriefing} from their START action; calling it
 * again while a card is open launches that card instead (so START pressed
 * twice never stacks two briefings).
 */

import Phaser from "phaser";
import { HoloPanel } from "../hud/HoloPanel";
import { pinTree } from "../modeHud/screenSpace";
import { holoFont } from "../theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { playBriefingStinger } from "./briefingStinger";
import {
  MAX_SORTIE_BRIEFING_MS,
  SORTIE_BRIEFING_MS,
  type SortieBriefing,
} from "./sortieBriefing";

/** Card geometry and type sizes (px). */
const CARD = {
  width: 600,
  height: 268,
  codenameSize: 28,
  objectiveSize: 18,
  intelSize: 13,
  hintSize: 12,
  intelLineHeight: 20,
  barHeight: 4,
  barInset: 32,
} as const;
/** Vertical offsets inside the card, from its content top (px). */
const ROW = {
  codename: 8,
  objective: 52,
  intel: 92,
  bar: 170,
  hint: 184,
} as const;
/** Backdrop opacity over the setup screen. */
const BACKDROP_ALPHA = 0.72;
/** Card fade-in (ms). */
const FADE_IN_MS = 140;
/** Standard-layout index of gamepad A. */
const GAMEPAD_CONFIRM = 0;
/** scene.data key of the open card (e2e / debugging). */
export const SORTIE_BRIEFING_DATA_KEY = "sortieBriefing";
/** Footer hint. */
const SKIP_HINT = "ENTER · A · CLICK   LAUNCH NOW";

/** Options of one briefing. */
export interface SortieBriefingOptions {
  readonly briefing: SortieBriefing;
  /** Player faction accent. */
  readonly accent: number;
  /** Starts the sortie (called exactly once). */
  readonly onLaunch: () => void;
  /** Time before auto-launch; clamped to {@link MAX_SORTIE_BRIEFING_MS}. */
  readonly durationMs?: number;
}

/** The on-screen briefing. */
export class SortieBriefingCard {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly unbind: Array<() => void> = [];
  private launched = false;
  /** When the card appeared (scene clock, ms). */
  readonly shownAt: number;
  /** Time before auto-launch (ms). */
  readonly durationMs: number;

  /**
   * @param scene - Owning scene.
   * @param options - Briefing, accent, launch callback, duration.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: SortieBriefingOptions,
  ) {
    this.durationMs = Math.min(
      options.durationMs ?? SORTIE_BRIEFING_MS,
      MAX_SORTIE_BRIEFING_MS,
    );
    this.shownAt = scene.time.now;
    this.build();
    playBriefingStinger(scene, options.briefing.mood);
    this.timers.push(
      scene.time.delayedCall(this.durationMs, () => this.launch()),
    );
    // Armed next tick: the press that hit START must not also skip.
    this.timers.push(scene.time.delayedCall(0, () => this.bindSkip()));
  }

  /** The briefing shown. */
  get briefing(): SortieBriefing {
    return this.options.briefing;
  }

  /** True until the sortie launches. */
  get isOpen(): boolean {
    return !this.launched;
  }

  /** Close the card and start the sortie (idempotent). */
  launch(): void {
    if (this.launched) return;
    this.launched = true;
    this.timers.forEach((timer) => timer.remove(false));
    this.unbind.forEach((off) => off());
    this.objects.forEach((obj) => obj.destroy());
    this.scene.data?.remove(SORTIE_BRIEFING_DATA_KEY);
    this.options.onLaunch();
  }

  private build(): void {
    const { width, height } = this.scene.scale;
    const backdrop = this.scene.add
      .rectangle(0, 0, width, height, HOLO_PALETTE.panelFill, BACKDROP_ALPHA)
      .setOrigin(0)
      .setDepth(HOLO_DEPTH.modal);
    const panel = new HoloPanel(this.scene, width / 2, height / 2, {
      width: CARD.width,
      height: CARD.height,
      accentColor: this.options.accent,
      title: `SORTIE BRIEFING · ${this.options.briefing.mode}`,
    });
    this.scene.add.existing(panel);
    panel.setDepth(HOLO_DEPTH.modal + 1).setAlpha(0);
    panel.add(this.contents(panel.contentTop));
    this.objects.push(backdrop, panel);
    pinTree(backdrop);
    pinTree(panel);
    this.scene.tweens.add({ targets: panel, alpha: 1, duration: FADE_IN_MS });
  }

  private contents(top: number): Phaser.GameObjects.GameObject[] {
    const { briefing, accent } = this.options;
    const text = (
      y: number,
      content: string,
      size: number,
      color: number,
      weight = "400",
    ): Phaser.GameObjects.Text =>
      this.scene.add
        .text(0, top + y, content, {
          ...holoFont(size, weight),
          color: toCssColor(color),
          align: "center",
        })
        .setOrigin(0.5, 0);
    const intel = briefing.intel.map((line, i) =>
      text(
        ROW.intel + i * CARD.intelLineHeight,
        line,
        CARD.intelSize,
        HOLO_PALETTE.textSecondary,
        "600",
      ),
    );
    return [
      text(ROW.codename, briefing.codename, CARD.codenameSize, accent, "700"),
      text(
        ROW.objective,
        briefing.objective,
        CARD.objectiveSize,
        HOLO_PALETTE.textPrimary,
        "600",
      ),
      ...intel,
      ...this.countdownBar(top + ROW.bar),
      text(ROW.hint, SKIP_HINT, CARD.hintSize, HOLO_PALETTE.textMuted, "600"),
    ];
  }

  private countdownBar(y: number): Phaser.GameObjects.GameObject[] {
    const barWidth = CARD.width - CARD.barInset * 2;
    const track = this.scene.add
      .rectangle(
        -barWidth / 2,
        y,
        barWidth,
        CARD.barHeight,
        HOLO_PALETTE.border,
      )
      .setOrigin(0, 0.5);
    const fill = this.scene.add
      .rectangle(
        -barWidth / 2,
        y,
        barWidth,
        CARD.barHeight,
        this.options.accent,
      )
      .setOrigin(0, 0.5);
    this.scene.tweens.add({
      targets: fill,
      scaleX: 0,
      duration: this.durationMs,
    });
    return [track, fill];
  }

  private bindSkip(): void {
    if (this.launched) return;
    const skip = (): void => this.launch();
    const keyboard = this.scene.input.keyboard;
    keyboard?.on("keydown-ENTER", skip);
    keyboard?.on("keydown-SPACE", skip);
    const onPad = (_pad: unknown, button: { readonly index: number }): void => {
      if (button.index === GAMEPAD_CONFIRM) skip();
    };
    this.scene.input.gamepad?.on("down", onPad);
    const backdrop = this.objects[0] as Phaser.GameObjects.Rectangle;
    backdrop.setInteractive().on("pointerdown", skip);
    this.unbind.push(() => {
      keyboard?.off("keydown-ENTER", skip);
      keyboard?.off("keydown-SPACE", skip);
      this.scene.input.gamepad?.off("down", onPad);
    });
  }
}

/**
 * Show the briefing, or launch the one already open.
 *
 * @param scene - Owning scene (shown at camera zoom 1).
 * @param options - Briefing, accent, launch callback, duration.
 * @returns The open card.
 */
export function showSortieBriefing(
  scene: Phaser.Scene,
  options: SortieBriefingOptions,
): SortieBriefingCard {
  const open = scene.data?.get(SORTIE_BRIEFING_DATA_KEY) as
    SortieBriefingCard | undefined;
  if (open?.isOpen) {
    open.launch();
    return open;
  }
  const card = new SortieBriefingCard(scene, options);
  scene.data?.set(SORTIE_BRIEFING_DATA_KEY, card);
  return card;
}
