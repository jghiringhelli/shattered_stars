/**
 * SkirmishFooter — the bottom row of the Skirmish setup, the same on every
 * step: the points bar (where the budget goes) and the NEXT / LAUNCH button
 * at its right end.
 */

import type Phaser from "phaser";
import { createHoverButton } from "../../ButtonFactory";
import type { HoloPressButton } from "../../menu/HoloPressButton";
import { PointsBar, POINTS_BAR_H } from "../../picker/PointsBar";
import type { PointsBudget } from "../../picker/pointsBudget";
import { HOLO_PALETTE, HOLO_SPACING } from "../../theme/HoloTheme";
import { SQUAD_TYPE } from "../squadBuilderStyle";
import type { NavButtonState } from "./skirmishModel";

/** Footer geometry (scene coordinates): the row under the content panels. */
const FOOTER = { margin: 32, y: 672, navW: 200, navH: 30 } as const;

/** Points bar plus the step button. */
export class SkirmishFooter {
  private bar: PointsBar | null = null;
  private nav: HoloPressButton | null = null;

  /**
   * @param scene - Owning scene.
   * @param onNav - Called when NEXT / LAUNCH is pressed.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onNav: () => void,
  ) {}

  /** The NEXT / LAUNCH button (keyboard focus target), once built. */
  get navButton(): HoloPressButton | null {
    return this.nav;
  }

  /** @param accent - Faction accent of the points bar (rebuilds both controls). */
  build(accent: number): void {
    this.destroy();
    const full = this.scene.scale.width - FOOTER.margin * 2;
    this.bar = new PointsBar(
      this.scene,
      { x: FOOTER.margin, y: FOOTER.y, width: full - FOOTER.navW - HOLO_SPACING.sm },
      accent,
    );
    this.nav = createHoverButton(
      this.scene,
      FOOTER.margin + full - FOOTER.navW / 2,
      FOOTER.y + POINTS_BAR_H / 2,
      {
        width: FOOTER.navW,
        height: FOOTER.navH,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label: "",
        font: `600 ${SQUAD_TYPE.name}px`,
        icon: "next",
      },
      this.onNav,
    ).setName("skirmishNav");
  }

  /**
   * @param budget - Spent / limit.
   * @param note - Right-hand note of the bar.
   * @param caption - Left-hand caption of the bar.
   */
  showBudget(budget: PointsBudget, note: string, caption: string): void {
    this.bar?.update(budget, note, caption);
  }

  /** @param state - Label and availability of the step button. */
  showNav(state: NavButtonState): void {
    this.nav?.setLabel(state.label).setEnabled(state.enabled);
  }

  /** Remove the bar and the button. */
  destroy(): void {
    this.bar?.destroy();
    this.nav?.destroy();
    this.bar = null;
    this.nav = null;
  }
}
