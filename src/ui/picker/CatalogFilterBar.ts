/**
 * CatalogFilterBar — the row of chips above the ship catalog: ALL plus one
 * chip per role present (the role filter) and a sort-by-points chip. Each
 * chip explains itself on hover or keyboard focus. Chips are plain
 * containers parented to the catalog's container, so they die with it.
 */

import Phaser from "phaser";
import type { ShipRole } from "../../core/types";
import { ROLE_CHIP_LABELS } from "../../data/roleHints/roleSections";
import { roleTermId, type TermId } from "../../data/tooltips";
import { drawHoloFrame } from "../menu/holoChrome";
import { attachTermTooltip } from "../menu/HintTooltip";
import { focusTipTarget } from "../menu/tooltipTargets";
import type { FocusTarget } from "../menu/MenuFocus";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { sortLabel, type CatalogFilters } from "./catalogSections";
import { addPickerText } from "./pickerStyle";

/** Height of the chip row (px). */
export const FILTER_BAR_H = 26;
/** Share of the bar given to the sort chip (the rest is split by role chips). */
const SORT_CHIP_W = 52;
/** Opacity of the epic-only (unavailable) capital chip. */
const DIM_ALPHA = 0.45;
/** Fill opacity of the active chip. */
const ACTIVE_FILL_ALPHA = 0.24;

/** What the bar offers and does. */
export interface FilterBarSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  /** Roles with ships to show (section order). */
  readonly roles: readonly ShipRole[];
  /** Show a dimmed CAP chip: capitals exist but need the Epic format. */
  readonly epicOnlyCapitals: boolean;
  readonly filters: CatalogFilters;
  readonly onRole: (role: ShipRole | null) => void;
  readonly onSort: () => void;
}

interface ChipSpec {
  readonly label: string;
  readonly active: boolean;
  readonly dim: boolean;
  readonly term: TermId;
  readonly onPress: () => void;
}

/**
 * Draws the chip row.
 *
 * @param scene - Owning scene.
 * @param container - Container the chips join.
 * @param spec - Bounds, roles, state and callbacks.
 * @returns Focus targets in reading order (for MenuFocus).
 */
export function drawFilterBar(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: FilterBarSpec,
): FocusTarget[] {
  const chips: ChipSpec[] = [
    {
      label: "ALL",
      active: spec.filters.role === null,
      dim: false,
      term: "ui.role_filter_all",
      onPress: () => spec.onRole(null),
    },
    ...spec.roles.map((role) => ({
      label: ROLE_CHIP_LABELS[role],
      active: spec.filters.role === role,
      dim: false,
      term: roleTermId(role),
      onPress: () => spec.onRole(role),
    })),
    ...(spec.epicOnlyCapitals && !spec.roles.includes("capital")
      ? [
          {
            label: ROLE_CHIP_LABELS.capital,
            active: spec.filters.role === "capital",
            dim: true,
            term: "ui.epic_only" as TermId,
            onPress: () => spec.onRole("capital"),
          },
        ]
      : []),
  ];
  const gap = HOLO_SPACING.xs;
  const roleW = spec.width - SORT_CHIP_W - gap * chips.length;
  const chipW = Math.min(roleW / chips.length, 64);
  const targets = chips.map((chip, i) =>
    createChip(scene, container, spec, chip, {
      x: spec.x + i * (chipW + gap),
      width: chipW,
    }),
  );
  const sortChip: ChipSpec = {
    label: sortLabel(spec.filters.sort),
    active: spec.filters.sort !== "default",
    dim: false,
    term: "ui.sort_points",
    onPress: spec.onSort,
  };
  targets.push(
    createChip(scene, container, spec, sortChip, {
      x: spec.x + spec.width - SORT_CHIP_W,
      width: SORT_CHIP_W,
    }),
  );
  return targets;
}

function createChip(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  bar: FilterBarSpec,
  chip: ChipSpec,
  box: { readonly x: number; readonly width: number },
): FocusTarget {
  const chipC = scene.add.container(box.x, bar.y);
  const bg = scene.add.graphics();
  const paint = (hover: boolean): void => {
    bg.clear();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: box.width, height: FILTER_BAR_H },
      {
        radius: HOLO_RADIUS.sm,
        accent: chip.active || hover ? bar.accent : HOLO_PALETTE.border,
        fill: chip.active ? bar.accent : HOLO_PALETTE.panelFill,
        fillAlpha: chip.active ? ACTIVE_FILL_ALPHA : 0.6,
      },
    );
  };
  paint(false);
  const label = addPickerText(
    scene,
    { x: box.width / 2, y: FILTER_BAR_H / 2 },
    chip.label,
    "micro",
    chip.active ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
  ).setOrigin(0.5);
  chipC.add([bg, label]);
  if (chip.dim) label.setAlpha(DIM_ALPHA);
  chipC.setSize(box.width, FILTER_BAR_H).setInteractive(
    new Phaser.Geom.Rectangle(0, 0, box.width, FILTER_BAR_H),
    Phaser.Geom.Rectangle.Contains,
  );
  if (chipC.input) chipC.input.cursor = "pointer";
  chipC.on("pointerover", () => paint(true));
  chipC.on("pointerout", () => paint(false));
  chipC.on("pointerdown", chip.onPress);
  attachTermTooltip(scene, chipC, chip.term);
  container.add(chipC);
  return focusTipTarget(chipC, chip.onPress);
}
