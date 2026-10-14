/**
 * BuildsTabView — the BUILDS tab: a chip per quick build (BASE first, in
 * wrapping rows, paged when a hull has many), then the selected build's
 * explanation in two columns (what it is for / example / best with /
 * counter, and how to fly / strengths / weaknesses) with a one-line cost.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { explainBaseShip, explainQuickBuild } from "../../data/roleHints";
import { getEquippableLoadouts, type ShipLoadout } from "../../data/ShipLoadouts";
import { attachHintTooltip, attachTermTooltip } from "../menu/HintTooltip";
import { topLeftHitArea } from "../menu/hitArea";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { BuildGuideView } from "./BuildGuideView";
import { buildToggleTooltip } from "./buildTooltips";
import { pageChips } from "./buildChipLayout";
import { buildsSections, costSummary } from "./guideSections";
import { addPickerText } from "./pickerStyle";

/** Chip metrics (px). */
const CHIP = { height: 24, padX: 8, gap: 8, maxRows: 2 } as const;
/** Below this panel width the two columns stack into one. */
const TWO_COLUMN_MIN_WIDTH = 560;
const COLUMN_GAP = 24;

/** Where and what to draw. */
export interface BuildsTabArgs {
  readonly def: ShipDefinition;
  readonly selectedLoadoutId: string | null;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly bottom: number;
  readonly accent: number;
  readonly onSelect: (loadoutId: string | null) => void;
  readonly onPage: (page: number) => void;
}

interface ChipOption {
  readonly id: string | null;
  readonly label: string;
  readonly loadout?: ShipLoadout;
}

/**
 * Draws the tab.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param args - Ship, selection, box and callbacks.
 * @returns y just below the tab's content.
 */
export function drawBuildsTab(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: BuildsTabArgs,
): number {
  const loadouts = getEquippableLoadouts(args.def.id);
  // A ship with builds always flies one (the first when none is chosen), so
  // BASE is only offered for a hull that has none.
  const options: ChipOption[] =
    loadouts.length === 0
      ? [{ id: null, label: `BASE \u00b7 ${args.def.baseStats.pointCost}` }]
      : loadouts.map((ld) => ({
          id: ld.id,
          label: `${ld.name.toUpperCase()} \u00b7 ${ld.pointCost}`,
          loadout: ld,
        }));
  const chipsBottom = drawChips(scene, container, options, args);
  const selected = loadouts.find((l) => l.id === args.selectedLoadoutId);
  const guide = selected
    ? explainQuickBuild(selected)
    : explainBaseShip(args.def.id);
  const top = chipsBottom + HOLO_SPACING.md;
  const narrow = args.width < TWO_COLUMN_MIN_WIDTH;
  const { left, right } = buildsSections(guide, narrow);
  const view = new BuildGuideView(scene, container);
  const colW = narrow ? args.width : (args.width - COLUMN_GAP) / 2;
  const box = { x: args.x, y: top, width: colW, bottom: args.bottom };
  const limited = { ...box, bottom: args.bottom - HOLO_SPACING.xl };
  const contentBottom = narrow
    ? view.renderSections([...left, ...right], limited)
    : Math.max(
        view.renderSections(left, limited),
        view.renderSections(right, { ...limited, x: args.x + colW + COLUMN_GAP }),
      );
  const costY = Math.min(
    contentBottom + HOLO_SPACING.lg,
    args.bottom - HOLO_SPACING.lg,
  );
  drawCostLine(scene, container, args, costSummary(guide), costY);
  return costY + HOLO_SPACING.lg;
}

function drawChips(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: readonly ChipOption[],
  args: BuildsTabArgs,
): number {
  const labels = options.map((option) =>
    addPickerText(scene, { x: 0, y: 0 }, option.label, "micro", HOLO_PALETTE.textSecondary),
  );
  const widths = labels.map((label) => label.width + CHIP.padX * 2);
  const pager = widths.length > 0 ? CHIP.height + CHIP.gap : 0;
  const pages = pageChips(widths, {
    maxWidth: args.width - pager,
    gap: CHIP.gap,
    maxRows: CHIP.maxRows,
  });
  const page = args.page % pages.length;
  pages[page]!.forEach((row, r) => {
    let cx = args.x;
    const cy = args.y + r * (CHIP.height + CHIP.gap);
    for (const index of row) {
      const option = options[index]!;
      drawChip(scene, container, labels[index]!, { x: cx, y: cy, width: widths[index]! }, {
        active: option.id === args.selectedLoadoutId,
        accent: args.accent,
        onPress: () => args.onSelect(option.id),
        option,
      });
      cx += widths[index]! + CHIP.gap;
    }
  });
  labels.forEach((label, index) => {
    if (!pages[page]!.flat().includes(index)) label.destroy();
  });
  const rows = pages[page]!.length;
  if (pages.length > 1) drawPager(scene, container, args, page, pages.length);
  return args.y + Math.max(1, rows) * (CHIP.height + CHIP.gap) - CHIP.gap;
}

function drawChip(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  label: Phaser.GameObjects.Text,
  box: { readonly x: number; readonly y: number; readonly width: number },
  look: {
    readonly active: boolean;
    readonly accent: number;
    readonly onPress: () => void;
    readonly option: ChipOption;
  },
): void {
  const chip = scene.add.container(box.x, box.y);
  const bg = scene.add.graphics();
  const paint = (hover: boolean): void => {
    bg.clear();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: box.width, height: CHIP.height },
      {
        radius: HOLO_RADIUS.sm,
        accent: look.active || hover ? look.accent : HOLO_PALETTE.border,
        fill: look.active ? look.accent : HOLO_PALETTE.panelFill,
        fillAlpha: look.active ? 0.28 : 0.4,
      },
    );
  };
  paint(false);
  label
    .setPosition(CHIP.padX, CHIP.height / 2)
    .setOrigin(0, 0.5)
    .setColor(
      toCssColor(look.active ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary),
    );
  chip.add([bg, label]);
  chip.setSize(box.width, CHIP.height).setInteractive(
    topLeftHitArea(box.width, CHIP.height),
    Phaser.Geom.Rectangle.Contains,
  );
  if (chip.input) chip.input.cursor = "pointer";
  chip.on("pointerover", () => paint(true));
  chip.on("pointerout", () => paint(false));
  chip.on("pointerdown", look.onPress);
  if (look.option.loadout)
    attachHintTooltip(scene, chip, buildToggleTooltip(look.option.loadout));
  else attachTermTooltip(scene, chip, "ui.build_base");
  container.add(chip);
}

function drawPager(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: BuildsTabArgs,
  page: number,
  pages: number,
): void {
  const label = addPickerText(
    scene,
    { x: args.x + args.width - CHIP.height / 2, y: args.y + CHIP.height / 2 },
    `${page + 1}/${pages}`,
    "micro",
    HOLO_PALETTE.accent,
  ).setOrigin(0.5);
  const zone = scene.add
    .rectangle(label.x, label.y, CHIP.height + 8, CHIP.height, 0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerdown", () => args.onPage((page + 1) % pages));
  attachTermTooltip(scene, zone, "ui.build_pager");
  container.add([label, zone]);
}

function drawCostLine(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: BuildsTabArgs,
  text: string,
  y: number,
): void {
  const line = addPickerText(scene, { x: args.x, y }, text, "name", HOLO_PALETTE.accent);
  container.add(line);
  const zone = scene.add
    .rectangle(args.x + args.width / 2, y + line.height / 2, args.width, line.height, 0, 0)
    .setInteractive();
  attachTermTooltip(scene, zone, "ui.cost_breakdown");
  container.add(zone);
}
