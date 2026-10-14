/**
 * FactionFilterChips — the encyclopedia's faction filter: ALL plus one
 * chip per faction, each in its faction accent (EncyclopediaChipRow).
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { factionTermId } from "../../data/tooltips";
import type { HoloRect } from "../menu/holoChrome";
import { factionAccent } from "../theme/HoloTheme";
import { EncyclopediaChipRow } from "./EncyclopediaChipRow";
import { FACTION_CHIPS } from "./encyclopediaLayout";

/** The faction filter row (value null = every faction). */
export type FactionFilterChips = EncyclopediaChipRow<FactionId | null>;

/**
 * @param scene - Owning scene.
 * @param area - Row bounds; chips share the width evenly.
 * @param onSelect - Invoked with the chip's faction (null = ALL) on press.
 * @returns The chip row, ALL selected.
 */
export function createFactionFilterChips(
  scene: Phaser.Scene,
  area: HoloRect,
  onSelect: (faction: FactionId | null) => void,
): FactionFilterChips {
  const specs = FACTION_CHIPS.map((chip) => ({
    value: chip.faction,
    label: chip.label,
    accent: factionAccent(chip.faction ?? undefined),
    tip: chip.faction ? factionTermId(chip.faction) : ("codex.faction_filter" as const),
  }));
  return new EncyclopediaChipRow(scene, area, specs, onSelect);
}
