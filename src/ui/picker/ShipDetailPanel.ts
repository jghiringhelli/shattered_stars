/**
 * ShipDetailPanel — big persistent panel to the right of the ship list.
 * Shows the selected ship's full art (aspect-ratio preserved), stats,
 * actions, description, and the loadout submenu (Base + up to a few
 * quick builds). For the selected quick build it shows what the build
 * really is — pilot (name, initiative, unique), pilot ability (card text +
 * real-time summary), the slot bar filled vs empty, and each upgrade's
 * real-time effect (see QuickBuildDetailView).
 *
 * Narrow or short panels use denser layouts: action chips instead of
 * described actions, then no lore excerpt (the picker roster's hover detail
 * shows it) and tighter section gaps.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { FactionId } from "../../config";
import { getShipLoadouts, type ShipLoadout } from "../../data/ShipLoadouts";
import { getLoadoutPlaystyle } from "../../data/ShipRoleProfiles";
import { drawHoloFrame } from "../menu/holoChrome";
import { factionAccent, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { computeLoadoutBonuses, buildStatLine } from "./catalogHelpers";
import { QuickBuildDetailView } from "./QuickBuildDetailView";
import {
  drawActions,
  drawLore,
  drawStatGauges,
  type SectionArea,
} from "./detailSections";
import {
  artHeight,
  DENSITIES,
  DETAIL_PAD,
  drawDetailEmptyState,
  drawDetailHeader,
  startDensity,
  type Density,
} from "./detailHeader";
import { drawLoadoutRow } from "./LoadoutRow";
import { addPickerText, pickerTextStyle } from "./pickerStyle";

/** Panel bounds (top-left origin). */
interface PanelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Content column: left edge, top and width. */
interface ContentBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

/** Read-only view of the ship/loadout currently staged, owned by CatalogStaging. */
export interface StagingSelection {
  getSelectedShipId(): string | null;
  getSelectedLoadoutId(): string | null;
  selectLoadout(loadoutId: string | null): void;
}

export class ShipDetailPanel {
  private container: Phaser.GameObjects.Container | null = null;
  private loadoutPage = 0;
  private sectionGap: number = DENSITIES[0]!.gap;
  private lastArgs: {
    ships: readonly ShipDefinition[];
    staging: StagingSelection;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Renders the panel for the ship currently selected in `staging`, or an empty prompt. */
  render(
    ships: readonly ShipDefinition[],
    staging: StagingSelection,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    this.lastArgs = { ships, staging, x, y, w, h };
    const rect = { x, y, width: w, height: h };
    const def = ships.find((s) => s.id === staging.getSelectedShipId());
    if (!def) {
      const bg = this.resetContainer();
      drawHoloFrame(bg, rect, { radius: HOLO_RADIUS.lg });
      drawDetailEmptyState(this.scene, this.container!, rect);
      return;
    }
    // Start from the density the panel size calls for; fall back to denser
    // layouts only when a long build would spill past the panel.
    for (let level = startDensity(w, h); level < DENSITIES.length; level++) {
      const bottom = this.build(def, staging, rect, DENSITIES[level]!);
      if (bottom <= y + h - DETAIL_PAD) return;
    }
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.lastArgs = null;
  }

  /**
   * Replace the container with an empty one holding a background graphics.
   *
   * @returns The background graphics.
   */
  private resetContainer(): Phaser.GameObjects.Graphics {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    const bg = this.scene.add.graphics();
    this.container.add(bg);
    return bg;
  }

  /** Re-renders using the args from the last render() call — used after a loadout click. */
  private rerender(): void {
    if (!this.lastArgs) return;
    const { ships, staging, x, y, w, h } = this.lastArgs;
    this.render(ships, staging, x, y, w, h);
  }

  /**
   * Build the panel for a ship at one density.
   *
   * @param def - The selected ship.
   * @param staging - Current selection.
   * @param rect - Panel bounds.
   * @param density - Layout density.
   * @returns y just below the content.
   */
  private build(
    def: ShipDefinition,
    staging: StagingSelection,
    rect: PanelRect,
    density: Density,
  ): number {
    const accent = factionAccent(def.faction as FactionId);
    drawHoloFrame(this.resetContainer(), rect, {
      radius: HOLO_RADIUS.lg,
      accent,
    });
    this.sectionGap = density.gap;
    const box = { x: rect.x + DETAIL_PAD, w: rect.width - DETAIL_PAD * 2 };
    const area = (top: number): SectionArea => ({
      scene: this.scene,
      container: this.container!,
      x: box.x,
      y: top,
      width: box.w,
    });
    const artH = artHeight(rect.height, density);
    const gap = density.gap;
    let cy =
      drawDetailHeader(this.scene, this.container!, {
        def,
        rect,
        artH,
        accent,
      }) + gap;
    const bonuses = computeLoadoutBonuses(
      this.selectedLoadout(def, staging)?.upgrades ?? [],
    );
    cy = drawStatGauges(area(cy), def, bonuses) + gap;
    cy = drawActions(area(cy), def, density.chipActions) + gap;
    if (density.lore) cy = drawLore(area(cy), def) + gap;
    const rowBottom = drawLoadoutRow(this.scene, this.container!, {
      def,
      selectedLoadoutId: staging.getSelectedLoadoutId(),
      page: this.loadoutPage,
      x: box.x,
      y: cy,
      width: box.w,
      accent,
      onSelect: (loadoutId) => {
        staging.selectLoadout(loadoutId);
        this.rerender();
      },
      onPage: (page) => {
        this.loadoutPage = page;
        this.rerender();
      },
    });
    return this.drawLoadoutDetails(def, staging, {
      ...box,
      y: rowBottom + gap,
    });
  }

  /**
   * The staged build, resolved against the full catalogue: a squadron
   * preset may have selected a loadout the button row does not offer.
   *
   * @param def - The selected ship.
   * @param staging - Current selection.
   * @returns The staged build, or undefined for the bare ship.
   */
  private selectedLoadout(
    def: ShipDefinition,
    staging: StagingSelection,
  ): ShipLoadout | undefined {
    return getShipLoadouts(def.id).find(
      (l) => l.id === staging.getSelectedLoadoutId(),
    );
  }

  /**
   * The selected build's price/stat line and description, then what the
   * quick build really is: pilot, ability, slot bar and upgrade effects.
   *
   * @param def - The selected ship.
   * @param staging - Current ship/loadout selection.
   * @param box - Content left, top and width.
   * @returns y just below the block.
   */
  private drawLoadoutDetails(
    def: ShipDefinition,
    staging: StagingSelection,
    box: ContentBox,
  ): number {
    const c = this.container!;
    const selLd = this.selectedLoadout(def, staging);
    const bonuses = computeLoadoutBonuses(selLd?.upgrades ?? []);
    const statT = addPickerText(
      this.scene,
      { x: box.x, y: box.y },
      buildStatLine(bonuses, selLd?.pointCost ?? def.baseStats.pointCost),
      "name",
      selLd ? HOLO_PALETTE.success : HOLO_PALETTE.textSecondary,
    );
    const description = selLd
      ? `${selLd.description} \u2014 ${getLoadoutPlaystyle(selLd.role)}`
      : "Stock ship flown by a rookie \u2014 no pilot ability, no upgrades.";
    const descX = statT.x + statT.width + this.sectionGap;
    const descT = this.scene.add.text(
      descX,
      box.y,
      description,
      pickerTextStyle("small", HOLO_PALETTE.textSecondary, {
        wordWrap: { width: box.x + box.w - descX },
      }),
    );
    c.add([statT, descT]);
    return new QuickBuildDetailView(this.scene, c).render({
      shipId: def.id,
      loadout: selLd,
      x: box.x,
      y: box.y + Math.max(statT.height, descT.height) + this.sectionGap,
      width: box.w,
    });
  }
}
