/**
 * MapThemeButton — the Skirmish "MAP: RANDOM" button: each press cycles
 * Random → every map theme (mapChoice). The choice is kept in the game
 * registry and read into the battle config by the Squad Builder.
 */

import type Phaser from "phaser";
import { termEntry } from "../../data/tooltips";
import { createHoverButton } from "../ButtonFactory";
import { attachHintTooltip } from "../menu/HintTooltip";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import {
  MAP_CHOICE_KEY,
  isMapChoice,
  mapChoiceLabel,
  mapChoiceTagline,
  nextMapChoice,
} from "./mapChoice";
import { RANDOM_MAP_THEME } from "../../rendering/spaceMap/mapThemes";

/** Button height (px) and label size. */
const BUTTON = { height: 30, font: 12 } as const;

/**
 * @param registry - The game registry.
 * @returns The player's map choice (Random when none).
 */
export function readMapChoice(registry: Phaser.Data.DataManager): string {
  const stored: unknown = registry.get(MAP_CHOICE_KEY);
  return isMapChoice(stored) ? stored : RANDOM_MAP_THEME;
}

/**
 * @param scene - Owning scene.
 * @param box - Button centre and width.
 * @returns The button (a keyboard focus target).
 */
export function createMapThemeButton(
  scene: Phaser.Scene,
  box: { readonly x: number; readonly y: number; readonly width: number },
): HoloPressButton {
  const label = (): string => `MAP: ${mapChoiceLabel(readMapChoice(scene.registry))}`;
  const button = createHoverButton(
    scene,
    box.x,
    box.y,
    {
      width: box.width,
      height: BUTTON.height,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: label(),
      font: `600 ${BUTTON.font}px`,
    },
    () => {
      scene.registry.set(MAP_CHOICE_KEY, nextMapChoice(readMapChoice(scene.registry)));
      button.setLabel(label());
    },
  );
  attachHintTooltip(scene, button, () => {
    const choice = readMapChoice(scene.registry);
    const term = termEntry("ui.map_theme");
    return {
      title: `Map: ${mapChoiceLabel(choice)}`,
      body: `${mapChoiceTagline(choice)}. ${term.definition}`,
      example: term.example,
      ...(term.howItPlays ? { howItPlays: term.howItPlays } : {}),
    };
  });
  return button;
}
