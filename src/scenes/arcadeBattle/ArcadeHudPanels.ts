/**
 * ArcadeHudPanels — the Skirmish HUD's side panels in the holographic
 * style: match clock + score (top centre, here), squad roster (top right)
 * and the crew panel with action readiness / commander orders (top left).
 *
 * Each panel is a HoloPanel pinned into a screen-space parent that
 * ArcadeBattleHud keeps zoom-compensated; panels only redraw from plain rows.
 */

import Phaser from "phaser";
import type { HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import type { ScreenRect } from "../../ui/hud/screenRect";
import { toCssColor } from "../../ui/theme/colorMath";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import type { HudTone } from "./arcadeStatusModel";
import { PANEL_MARGIN, panelRect, pinnedPanel, setText } from "./hudPanelParts";

export { PANEL_MARGIN } from "./hudPanelParts";
export { SquadRosterPanel } from "./SquadRosterPanel";
export { CrewStatusPanel } from "./CrewStatusPanel";

const CLOCK_PANEL = { width: 168, height: 64 } as const;

/** Colour of each value tone. */
export const TONE_COLORS: Readonly<Record<HudTone, number>> = {
  normal: HOLO_PALETTE.textPrimary,
  warning: HOLO_PALETTE.warning,
  danger: HOLO_PALETTE.danger,
};

/** Match clock and score, top centre. */
export class MatchClockPanel {
  private readonly panel: HoloPanel;
  private readonly clock: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;

  /**
   * @param scene - Owning scene.
   * @param parent - Screen-space HUD root.
   */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.panel = pinnedPanel(
      scene,
      parent,
      CLOCK_PANEL.width,
      CLOCK_PANEL.height,
    );
    this.clock = createHoloText(scene, 0, -HOLO_SPACING.sm, "", "title");
    this.score = createHoloText(
      scene,
      0,
      HOLO_SPACING.lg + HOLO_SPACING.xxs,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    );
    addPinned(this.panel, this.clock, this.score);
  }

  /**
   * @param width - Screen width.
   */
  layout(width: number): void {
    this.panel.setPosition(width / 2, PANEL_MARGIN + CLOCK_PANEL.height / 2);
  }

  /**
   * @param clock - Formatted remaining time.
   * @param tone - Clock colour tone.
   * @param score - The player's score.
   */
  update(clock: string, tone: HudTone, score: number): void {
    setText(this.clock, clock);
    this.clock.setColor(toCssColor(TONE_COLORS[tone]));
    setText(this.score, `SCORE  ${score}`);
  }

  /** @returns Panel rect in HUD-root px. */
  bounds(): ScreenRect {
    return panelRect(this.panel, CLOCK_PANEL.width, CLOCK_PANEL.height);
  }

  /** Current score label (for tests and screenshots). */
  get scoreLabel(): string {
    return this.score.text;
  }
}
