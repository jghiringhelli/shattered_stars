/**
 * HintTooltip — a small holographic hover tooltip with a role line and a
 * "best with" line (P2-1 role / synergy hints). One tooltip per scene is
 * shared by every target; it follows the pointer, stays on screen
 * (hintTooltipLayout) and hides when the pointer leaves or the target is
 * destroyed. Screen-space (show it over UI at camera zoom 1).
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "./holoChrome";
import { tooltipPosition } from "./hintTooltipLayout";
import { holoFont } from "../theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** What the tooltip says. */
export interface HintContent {
  readonly role: string;
  readonly bestWith: string;
}

/** Tooltip type sizes and padding (px). */
const TIP = {
  padding: 8,
  roleSize: 13,
  bestSize: 12,
  lineGap: 3,
  wrap: 360,
} as const;
/** Above modal dialogs and their controls. */
const TOOLTIP_DEPTH = HOLO_DEPTH.modal + 20;
/** scene.data key of the shared tooltip. */
const DATA_KEY = "hintTooltip";

/** The scene's one tooltip. */
class HintTooltipView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly roleText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private owner: Phaser.GameObjects.GameObject | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.roleText = scene.add.text(TIP.padding, TIP.padding, "", {
      ...holoFont(TIP.roleSize, "600"),
      color: toCssColor(HOLO_PALETTE.accent),
      wordWrap: { width: TIP.wrap },
    });
    this.bestText = scene.add.text(TIP.padding, 0, "", {
      ...holoFont(TIP.bestSize, "400"),
      color: toCssColor(HOLO_PALETTE.textSecondary),
      wordWrap: { width: TIP.wrap },
    });
    this.root = scene.add
      .container(0, 0, [this.frame, this.roleText, this.bestText])
      .setDepth(TOOLTIP_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    for (const child of this.root.list)
      (child as Phaser.GameObjects.Text).setScrollFactor(0);
  }

  /** The text on show ("" when hidden; e2e / debugging). */
  get shownText(): string {
    return this.root.visible
      ? `${this.roleText.text}\n${this.bestText.text}`
      : "";
  }

  show(
    owner: Phaser.GameObjects.GameObject,
    hint: HintContent,
    pointer: { readonly x: number; readonly y: number },
  ): void {
    this.owner = owner;
    this.roleText.setText(hint.role);
    this.bestText
      .setText(hint.bestWith)
      .setY(TIP.padding + this.roleText.height + TIP.lineGap);
    const width =
      Math.max(this.roleText.width, this.bestText.width) + TIP.padding * 2;
    const height = this.bestText.y + this.bestText.height + TIP.padding;
    this.frame.clear();
    drawHoloFrame(
      this.frame,
      { x: 0, y: 0, width, height },
      { accent: HOLO_PALETTE.accent, fillAlpha: 0.95 },
    );
    this.root.setSize(width, height).setVisible(true);
    this.move(pointer);
  }

  move(pointer: { readonly x: number; readonly y: number }): void {
    const at = tooltipPosition(
      pointer,
      { width: this.root.width, height: this.root.height },
      { width: this.scene.scale.width, height: this.scene.scale.height },
    );
    this.root.setPosition(at.x, at.y);
  }

  hide(owner?: Phaser.GameObjects.GameObject): void {
    if (owner && owner !== this.owner) return;
    this.owner = null;
    this.root.setVisible(false);
  }

  isOwnedBy(owner: Phaser.GameObjects.GameObject): boolean {
    return this.owner === owner;
  }
}

function tooltipOf(scene: Phaser.Scene): HintTooltipView {
  const existing = scene.data.get(DATA_KEY) as HintTooltipView | undefined;
  if (existing) return existing;
  const view = new HintTooltipView(scene);
  scene.data.set(DATA_KEY, view);
  scene.events.once("shutdown", () => scene.data.remove(DATA_KEY));
  return view;
}

/**
 * Show `hint` while the pointer is over `target` (which must be, or will
 * be made, interactive).
 *
 * @param scene - Owning scene.
 * @param target - The hovered object (a card's hit area).
 * @param hint - Role and best-with lines.
 */
export function attachHintTooltip(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  hint: HintContent,
): void {
  if (!target.input) target.setInteractive();
  target.on("pointerover", (pointer: Phaser.Input.Pointer) =>
    tooltipOf(scene).show(target, hint, pointer),
  );
  target.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    const view = tooltipOf(scene);
    if (view.isOwnedBy(target)) view.move(pointer);
  });
  target.on("pointerout", () => tooltipOf(scene).hide(target));
  target.once("destroy", () => {
    const view = scene.data?.get(DATA_KEY) as HintTooltipView | undefined;
    view?.hide(target);
  });
}

/**
 * @param scene - A scene.
 * @returns The tooltip text on show ("" when hidden) — e2e / debugging.
 */
export function shownHintText(scene: Phaser.Scene): string {
  const view = scene.data?.get(DATA_KEY) as HintTooltipView | undefined;
  return view?.shownText ?? "";
}
