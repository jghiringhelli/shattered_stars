/**
 * tooltipTargets — helpers that give tooltips to things that are not
 * interactive objects on their own: an invisible hover zone over a label or
 * chip, and a keyboard-focus adapter for MenuFocus.
 */

import type Phaser from "phaser";
import type { TermId } from "../../data/tooltips";
import { attachHintTooltip, type TooltipSource } from "./HintTooltip";
import { contentFromTerm } from "./tooltipContent";
import type { FocusTarget } from "./MenuFocus";

/** A rectangle in the coordinates of the container it is added to. */
export interface ZoneRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a zone explains: a catalog term or ready-made content. */
export type TipSubject = TermId | TooltipSource;

/**
 * @param subject - Term id or content.
 * @returns Tooltip content.
 */
export function contentOf(subject: TipSubject): TooltipSource {
  return typeof subject === "string" ? contentFromTerm(subject) : subject;
}

/**
 * Adds an invisible hover zone (top-left rect) that shows a tooltip.
 *
 * @param scene - Owning scene.
 * @param container - Container the zone joins (its objects share its fate).
 * @param rect - Zone bounds in container coordinates.
 * @param subject - What to explain.
 * @param onPress - Optional press handler (lets a zone over a clickable card still click).
 * @returns The zone.
 */
export function addTipZone(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container | null,
  rect: ZoneRect,
  subject: TipSubject,
  onPress?: () => void,
): Phaser.GameObjects.Rectangle {
  const zone = scene.add
    .rectangle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      0,
      0,
    )
    .setInteractive({ useHandCursor: onPress !== undefined });
  attachHintTooltip(scene, zone, contentOf(subject));
  if (onPress) zone.on("pointerdown", onPress);
  container?.add(zone);
  return zone;
}

/**
 * Gives a toggle button (ButtonFactory's createToggleButton container, whose
 * hit area is its last child) a tooltip.
 *
 * @param scene - Owning scene.
 * @param toggle - The toggle container.
 * @param subject - What to explain.
 * @returns The object the tooltip is attached to (for focus adapters).
 */
export function attachToggleTooltip(
  scene: Phaser.Scene,
  toggle: Phaser.GameObjects.Container,
  subject: TipSubject,
): Phaser.GameObjects.GameObject {
  const hit = toggle.list[toggle.list.length - 1] as
    | Phaser.GameObjects.GameObject
    | undefined;
  const target = hit?.input ? hit : toggle;
  attachHintTooltip(scene, target, contentOf(subject));
  return target;
}

/**
 * Makes an object a MenuFocus target that shows its tooltip while focused
 * (keyboard / gamepad) and runs `onActivate` on ENTER / A.
 *
 * @param target - The object the tooltip is attached to (see attachHintTooltip).
 * @param onActivate - Activation handler.
 * @returns A focus target.
 */
export function focusTipTarget(
  target: Phaser.GameObjects.GameObject,
  onActivate: () => void,
): FocusTarget {
  return {
    setFocused: (focused: boolean) => target.emit("focuschanged", focused),
    activate: onActivate,
    get visible(): boolean {
      return target.active;
    },
  };
}
