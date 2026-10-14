/**
 * HintTooltip — the holographic hover tooltip of the menus. It shows a title
 * and plain-language definition, an optional role / best-with hint, how it
 * plays and a concrete example (tooltipContent), with an optional glyph.
 *
 * One tooltip per scene is shared by every target. It appears after a short
 * delay (at once when another tooltip is already open), sits beside the
 * hovered element — never over it, always on screen (hintTooltipLayout) —
 * and follows keyboard / gamepad focus too: any target that emits
 * "focuschanged" (HoloPressButton, focusTipTarget) shows it while focused.
 * Screen-space (show it over UI at camera zoom 1).
 */

import type Phaser from "phaser";
import type { TermId } from "../../data/tooltips";
import { drawHoloFrame } from "./holoChrome";
import { placeBesideTarget } from "./hintTooltipLayout";
import {
  contentFromTerm,
  tooltipBlocks,
  tooltipText,
  type BlockStyle,
  type HintContent,
  type TooltipContent,
  type TooltipLevel,
} from "./tooltipContent";
import { drawTermGlyph, TOOLTIP_GLYPH_SIZE } from "./tooltipGlyphs";
import { holoFont } from "../theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

export type { HintContent, TooltipContent };

/** Content, or a function read each time the tooltip opens (labels that change). */
export type TooltipSource = TooltipContent | (() => TooltipContent);

function resolve(source: TooltipSource): TooltipContent {
  return typeof source === "function" ? source() : source;
}

/** Tooltip padding and wrap width (px). */
const TIP = { padding: 10, blockGap: 4, wrap: 340, glyphGap: 8 } as const;
/** Fill opacity of the tooltip frame. */
const TIP_FILL_ALPHA = 0.96;
/** Pause before a tooltip appears when none is open (ms). */
export const HINT_DELAY_MS = 220;
/** Hover time after which the short tooltip becomes the full explanation (ms). */
export const HINT_HOLD_MS = 800;
/** Footer of a short tooltip. */
const MORE_HINT = "Hold Shift / Y for details";
/** Standard-layout gamepad button (Y) that expands the tooltip. */
const GAMEPAD_EXPAND_BUTTON = 3;
/** Above modal dialogs and their controls. */
const TOOLTIP_DEPTH = HOLO_DEPTH.modal + 20;
/** scene.data key of the shared tooltip. */
const DATA_KEY = "hintTooltip";

type PointerLike = { readonly x: number; readonly y: number };

const BLOCK_LOOK: Readonly<
  Record<
    BlockStyle,
    { size: number; weight: string; color: number; italic?: boolean }
  >
> = {
  title: { size: 14, weight: "600", color: HOLO_PALETTE.accent },
  body: { size: 12, weight: "400", color: HOLO_PALETTE.textPrimary },
  role: { size: 13, weight: "600", color: HOLO_PALETTE.accent },
  best: { size: 12, weight: "400", color: HOLO_PALETTE.textSecondary },
  label: { size: 12, weight: "600", color: HOLO_PALETTE.warning },
  more: { size: 12, weight: "400", color: HOLO_PALETTE.textMuted },
  howItPlays: { size: 12, weight: "400", color: HOLO_PALETTE.textSecondary },
  example: {
    size: 12,
    weight: "400",
    color: HOLO_PALETTE.success,
    italic: true,
  },
};

/** The scene's one tooltip. */
class HintTooltipView {
  private readonly root: Phaser.GameObjects.Container;
  private owner: Phaser.GameObjects.GameObject | null = null;
  private pending: Phaser.Time.TimerEvent | null = null;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private text = "";
  private level: TooltipLevel = "short";
  private shown: {
    content: TooltipContent;
    pointer: PointerLike | undefined;
  } | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add
      .container(0, 0)
      .setDepth(TOOLTIP_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
  }

  /** The text on show ("" when hidden; e2e / debugging). */
  get shownText(): string {
    return this.root.visible ? this.text : "";
  }

  /** True while the full explanation (not the short hover line) is on show. */
  get expanded(): boolean {
    return this.root.visible && this.level === "full";
  }

  /** Swap the short hover tooltip for the full explanation (Shift / Y / hold). */
  expand(): void {
    if (!this.root.visible || !this.owner || !this.shown) return;
    if (this.level === "full") return;
    this.show(this.owner, this.shown.content, this.shown.pointer, "full");
  }

  /**
   * Show for a hovered or focused target, after the delay unless a tooltip
   * is already open.
   *
   * @param owner - The target.
   * @param content - What to say.
   * @param pointer - Pointer position (undefined for keyboard focus).
   * @param immediate - Skip the delay.
   */
  request(
    owner: Phaser.GameObjects.GameObject,
    content: TooltipContent,
    pointer: PointerLike | undefined,
    immediate: boolean,
  ): void {
    this.cancelPending();
    this.owner = owner;
    // Keyboard / gamepad focus has no pointer to hold: it reads in full.
    const level: TooltipLevel = pointer ? "short" : "full";
    if (immediate || this.root.visible) {
      this.show(owner, content, pointer, level);
      return;
    }
    this.pending = this.scene.time.delayedCall(HINT_DELAY_MS, () => {
      this.pending = null;
      if (owner.active && this.owner === owner)
        this.show(owner, content, pointer, level);
    });
  }

  private show(
    owner: Phaser.GameObjects.GameObject,
    content: TooltipContent,
    pointer: PointerLike | undefined,
    level: TooltipLevel,
  ): void {
    this.holdTimer?.remove(false);
    this.holdTimer = null;
    this.level = level;
    this.shown = { content, pointer };
    this.text = tooltipText(content, level);
    if (level === "short") {
      this.holdTimer = this.scene.time.delayedCall(HINT_HOLD_MS, () => {
        this.holdTimer = null;
        if (owner.active && this.owner === owner) this.expand();
      });
    }
    const size = this.build(content, level);
    this.root.setSize(size.width, size.height).setVisible(true);
    const bounds = (
      owner as Phaser.GameObjects.GameObject &
        Phaser.GameObjects.Components.GetBounds
    ).getBounds();
    const at = placeBesideTarget(
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      size,
      { width: this.scene.scale.width, height: this.scene.scale.height },
      pointer,
    );
    this.root.setPosition(at.x, at.y);
  }

  /** Lays the content out and returns the box size. */
  private build(
    content: TooltipContent,
    level: TooltipLevel,
  ): { width: number; height: number } {
    this.root.removeAll(true);
    const indent = content.glyph ? TOOLTIP_GLYPH_SIZE + TIP.glyphGap : 0;
    const texts: Phaser.GameObjects.Text[] = [];
    let y: number = TIP.padding;
    const blocks = tooltipBlocks(content, level);
    if (level === "short" && blocks.length > 0)
      blocks.push({ style: "more", text: MORE_HINT });
    for (const block of blocks) {
      const look = BLOCK_LOOK[block.style];
      const shift = block.style === "title" ? indent : 0;
      const text = this.scene.add.text(TIP.padding + shift, y, block.text, {
        ...holoFont(look.size, look.weight),
        color: toCssColor(look.color),
        ...(look.italic ? { fontStyle: "italic" } : {}),
        wordWrap: { width: TIP.wrap - shift },
      });
      texts.push(text);
      y += text.height + (block.style === "label" ? 1 : TIP.blockGap);
    }
    const width =
      Math.max(0, ...texts.map((text) => text.x + text.width)) + TIP.padding;
    const height = y - TIP.blockGap + TIP.padding;
    const frame = this.scene.add.graphics();
    drawHoloFrame(
      frame,
      { x: 0, y: 0, width, height },
      { accent: HOLO_PALETTE.accent, fillAlpha: TIP_FILL_ALPHA },
    );
    const glyph = this.scene.add.graphics();
    if (content.glyph) {
      const half = (texts[0]?.height ?? TOOLTIP_GLYPH_SIZE) / 2;
      const centre = {
        x: TIP.padding + TOOLTIP_GLYPH_SIZE / 2,
        y: TIP.padding + half,
      };
      drawTermGlyph(glyph, content.glyph, centre, TOOLTIP_GLYPH_SIZE);
    }
    this.root.add([frame, glyph, ...texts]);
    for (const child of this.root.list)
      (child as Phaser.GameObjects.Text).setScrollFactor(0);
    return { width, height };
  }

  private cancelPending(): void {
    this.pending?.remove(false);
    this.pending = null;
    this.holdTimer?.remove(false);
    this.holdTimer = null;
  }

  /**
   * Hide, but only if `owner` is the one that asked (or when no owner given).
   *
   * @param owner - The target that stops being hovered / focused.
   */
  hide(owner?: Phaser.GameObjects.GameObject): void {
    if (owner && owner !== this.owner) return;
    this.cancelPending();
    this.owner = null;
    this.shown = null;
    this.root.setVisible(false);
  }
}

function tooltipOf(scene: Phaser.Scene): HintTooltipView {
  const existing = scene.data.get(DATA_KEY) as HintTooltipView | undefined;
  if (existing) return existing;
  const view = new HintTooltipView(scene);
  scene.data.set(DATA_KEY, view);
  const expand = (): void => view.expand();
  const onPad = (_pad: unknown, button: { index: number }): void => {
    if (button.index === GAMEPAD_EXPAND_BUTTON) expand();
  };
  scene.input.keyboard?.on("keydown-SHIFT", expand);
  scene.input.gamepad?.on("down", onPad);
  scene.events.once("shutdown", () => {
    scene.input.keyboard?.off("keydown-SHIFT", expand);
    scene.input.gamepad?.off("down", onPad);
    scene.data.remove(DATA_KEY);
  });
  return view;
}

/**
 * Show `content` while the pointer is over `target` or the target holds
 * keyboard / gamepad focus.
 *
 * @param scene - Owning scene.
 * @param target - The hovered object (a card's hit area).
 * @param content - What the tooltip says (a role hint works as is), or a
 *   function returning it when it depends on state.
 */
export function attachHintTooltip(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  content: TooltipSource,
): void {
  if (!target.input) target.setInteractive();
  target.on("pointerover", (pointer: Phaser.Input.Pointer) =>
    tooltipOf(scene).request(target, resolve(content), pointer, false),
  );
  target.on("pointerout", () => tooltipOf(scene).hide(target));
  target.on("pointerdown", () => tooltipOf(scene).hide(target));
  target.on("focuschanged", (focused: boolean) => {
    const view = tooltipOf(scene);
    if (focused) view.request(target, resolve(content), undefined, true);
    else view.hide(target);
  });
  target.once("destroy", () => {
    const view = scene.data?.get(DATA_KEY) as HintTooltipView | undefined;
    view?.hide(target);
  });
}

/**
 * Explain a catalog term while `target` is hovered or focused.
 *
 * @param scene - Owning scene.
 * @param target - The hovered object.
 * @param id - Term id from the tooltip catalog.
 */
export function attachTermTooltip(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  id: TermId,
): void {
  attachHintTooltip(scene, target, contentFromTerm(id));
}

/**
 * @param scene - A scene.
 * @returns The tooltip text on show ("" when hidden) — e2e / debugging.
 */
export function shownHintText(scene: Phaser.Scene): string {
  const view = scene.data?.get(DATA_KEY) as HintTooltipView | undefined;
  return view?.shownText ?? "";
}
