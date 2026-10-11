/**
 * SquadRosterPanel — every side's ships as hull / shield pips, top right of
 * the Skirmish HUD (player's side first, the player's own pip boxed).
 */

import Phaser from "phaser";
import type { HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import type { ScreenRect } from "../../ui/hud/screenRect";
import { toCssColor } from "../../ui/theme/colorMath";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../../ui/theme/HoloTheme";
import type { RosterPip, RosterTeam } from "./arcadeStatusModel";
import {
  HEADER_HEIGHT,
  PANEL_MARGIN,
  panelRect,
  pinnedPanel,
  setText,
} from "./hudPanelParts";

const ROSTER = {
  width: 184,
  rowHeight: 20,
  pipRadius: 5,
  pipPitch: 14,
} as const;

/** Every side's ships as hull/shield pips. */
export class SquadRosterPanel {
  private readonly scene: Phaser.Scene;
  private readonly panel: HoloPanel;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private screenWidth = 0;
  private shownHeight = 0;

  /**
   * @param scene - Owning scene.
   * @param parent - Screen-space HUD root.
   */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.panel = pinnedPanel(
      scene,
      parent,
      ROSTER.width,
      HEADER_HEIGHT * 2,
      "Squadrons",
    );
    this.pips = scene.add.graphics();
    addPinned(this.panel, this.pips);
  }

  /**
   * @param width - Screen width.
   */
  layout(width: number): void {
    this.screenWidth = width;
    this.place();
  }

  /**
   * @param teams - One row per faction, player side first.
   */
  update(teams: ReadonlyArray<RosterTeam>): void {
    const perLine = Math.max(
      1,
      Math.floor((ROSTER.width - HOLO_SPACING.md * 2) / ROSTER.pipPitch),
    );
    const lineCounts = teams.map((t) =>
      Math.max(1, Math.ceil(t.pips.length / perLine)),
    );
    const height =
      HEADER_HEIGHT +
      HOLO_SPACING.md +
      lineCounts.reduce(
        (sum, lines) => sum + ROSTER.rowHeight + lines * ROSTER.pipPitch,
        0,
      );
    if (height !== this.shownHeight) {
      this.shownHeight = height;
      this.panel.resize(ROSTER.width, height);
      this.place();
    }
    this.pips.clear();
    this.labels.forEach((label) => label.setVisible(false));
    let y = -height / 2 + HEADER_HEIGHT + HOLO_SPACING.sm;
    teams.forEach((team, i) => {
      this.drawLabel(i, team, y);
      y += ROSTER.rowHeight;
      this.drawPips(team.pips, y, perLine);
      y += (lineCounts[i] ?? 1) * ROSTER.pipPitch;
    });
  }

  /** @returns Panel rect in HUD-root px. */
  bounds(): ScreenRect {
    return panelRect(this.panel, ROSTER.width, this.shownHeight);
  }

  private place(): void {
    this.panel.setPosition(
      this.screenWidth - PANEL_MARGIN - ROSTER.width / 2,
      PANEL_MARGIN + this.shownHeight / 2,
    );
  }

  private drawLabel(index: number, team: RosterTeam, y: number): void {
    while (this.labels.length <= index) {
      const label = createHoloText(this.scene, 0, 0, "", "caption").setOrigin(
        0,
        0,
      );
      addPinned(this.panel, label);
      this.labels.push(label);
    }
    const label = this.labels[index] as Phaser.GameObjects.Text;
    const color = team.isPlayerSide ? SIDE_COLORS.ally : SIDE_COLORS.enemy;
    setText(label, team.label);
    label
      .setColor(toCssColor(color))
      .setPosition(-ROSTER.width / 2 + HOLO_SPACING.md, y)
      .setVisible(true);
  }

  private drawPips(
    pips: ReadonlyArray<RosterPip>,
    y: number,
    perLine: number,
  ): void {
    const left = -ROSTER.width / 2 + HOLO_SPACING.md + ROSTER.pipRadius;
    pips.forEach((pip, i) => {
      const x = left + (i % perLine) * ROSTER.pipPitch;
      const py =
        y + Math.floor(i / perLine) * ROSTER.pipPitch + ROSTER.pipRadius;
      drawRosterPip(this.pips, pip, x, py);
    });
  }
}

function drawRosterPip(
  g: Phaser.GameObjects.Graphics,
  pip: RosterPip,
  x: number,
  y: number,
): void {
  if (!pip.alive) {
    g.fillStyle(HOLO_PALETTE.textMuted, 0.35);
    g.fillCircle(x, y, ROSTER.pipRadius - 1);
    return;
  }
  const hullColor =
    pip.hullFraction > 0.5
      ? HOLO_PALETTE.success
      : pip.hullFraction > 0.25
        ? HOLO_PALETTE.warning
        : HOLO_PALETTE.danger;
  g.fillStyle(hullColor, 1);
  g.fillCircle(x, y, ROSTER.pipRadius - 1);
  if (pip.shieldFraction > 0) {
    g.lineStyle(1.5, HOLO_PALETTE.shield, pip.shieldFraction);
    g.strokeCircle(x, y, ROSTER.pipRadius + 1);
  }
  if (pip.isPlayer) {
    g.lineStyle(1, SIDE_COLORS.player, 1);
    g.strokeRect(
      x - ROSTER.pipRadius - 2,
      y - ROSTER.pipRadius - 2,
      (ROSTER.pipRadius + 2) * 2,
      (ROSTER.pipRadius + 2) * 2,
    );
  }
}
