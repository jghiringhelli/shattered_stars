/**
 * toggleGroup — a group of option toggles for the Skirmish steps: one is
 * selected, hovering or keyboard-focusing one previews it (the caller shows
 * its details in ONE shared line), pressing picks it. Returns the objects to
 * destroy and the keyboard focus targets.
 */

import type Phaser from "phaser";
import { createToggleButton } from "../../ButtonFactory";
import type { FocusTarget } from "../../menu/MenuFocus";
import { HOLO_PALETTE, HOLO_RADIUS } from "../../theme/HoloTheme";
import { SQUAD_TYPE } from "../squadBuilderStyle";

/** Where one toggle goes (centre and size). */
export interface ToggleSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One option. */
export interface ToggleOption<T> {
  readonly value: T;
  readonly label: string;
  /** Scene object name (e2e). */
  readonly name: string;
}

/** What to draw. */
export interface ToggleGroupSpec<T> {
  readonly options: readonly ToggleOption<T>[];
  readonly selected: T;
  readonly accent: number;
  /** Slot of the option at an index. */
  readonly slot: (index: number) => ToggleSlot;
  readonly onPick: (value: T) => void;
  /** Called with the hovered / focused value, or null when nothing is. */
  readonly onPreview: (value: T | null) => void;
}

/** The drawn group. */
export interface ToggleGroup {
  readonly objects: Phaser.GameObjects.Container[];
  readonly targets: FocusTarget[];
}

/**
 * @param scene - Owning scene.
 * @param spec - Options, selection, slots and callbacks.
 * @returns The toggles and their focus targets.
 */
export function drawToggleGroup<T>(scene: Phaser.Scene, spec: ToggleGroupSpec<T>): ToggleGroup {
  const objects: Phaser.GameObjects.Container[] = [];
  const targets: FocusTarget[] = [];
  spec.options.forEach((option, index) => {
    const slot = spec.slot(index);
    const toggle = createToggleButton(
      scene,
      slot.x,
      slot.y,
      option.label,
      option.value === spec.selected,
      {
        width: slot.width,
        height: slot.height,
        radius: HOLO_RADIUS.sm,
        selectedColor: spec.accent,
        normalColor: HOLO_PALETTE.panelFill,
        font: `${SQUAD_TYPE.body}px`,
        selectedFont: `600 ${SQUAD_TYPE.body}px`,
      },
      () => spec.onPick(option.value),
    ).setName(option.name);
    const hit = toggle.list[toggle.list.length - 1] as Phaser.GameObjects.GameObject;
    hit.on("pointerover", () => spec.onPreview(option.value));
    hit.on("pointerout", () => spec.onPreview(null));
    objects.push(toggle);
    targets.push({
      setFocused: (focused: boolean) => spec.onPreview(focused ? option.value : null),
      activate: () => spec.onPick(option.value),
      get visible(): boolean {
        return toggle.active;
      },
    });
  });
  return { objects, targets };
}
