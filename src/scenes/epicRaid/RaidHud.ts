/**
 * RaidHud — the Boss Raid's holographic HUD: BattleHud centred on the
 * flagship (status ring, radar, edge arrows, weapon bar, flight readout),
 * the boss status panel at top centre and a flight-controls card at top
 * left, all pixel-stable at any camera zoom.
 */

import type Phaser from "phaser";
import { BattleHud } from "../../ui/hud/BattleHud";
import { DEFAULT_EDGE_INSETS } from "../../ui/hud/EdgeIndicators";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import type { BattleHudSnapshot } from "../../ui/hud/types";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../ui/theme/HoloTheme";
import { ZoomStableLayer } from "../battleUi/ZoomStableLayer";
import { BossStatusPanel } from "./BossStatusPanel";
import type { BossStatusView } from "./bossStatus";

/** Radar reach: the boss starts ~5600 px from the squad, so read far. */
const RADAR_RANGE_PX = 3000;
/** Boss panel centre distance from the screen top. */
const BOSS_PANEL_CENTER_Y = 58;
/** Flight-controls card geometry. */
const CONTROLS_CARD = { width: 300, height: 112, lineHeight: 17 } as const;
/** Edge arrows stay below the top panels (card bottom + a margin). */
const EDGE_INSETS = {
  ...DEFAULT_EDGE_INSETS,
  top: HOLO_SPACING.lg + CONTROLS_CARD.height + HOLO_SPACING.lg,
} as const;
/** Flight-controls card lines. */
const CONTROLS_LINES: readonly string[] = [
  "↑ / ↓  speed   ·   ↑↑  boost",
  "← / →  tap drift, hold bank",
  "Q / E  hard turn   ·   Z  K-turn",
  "Lasers autofire  ·  wheel zoom  ·  ESC pause",
];

/** Everything the raid HUD shows in one frame. */
export interface RaidHudFrame {
  readonly battle: BattleHudSnapshot;
  /** The boss, or null once destroyed. */
  readonly boss: BossStatusView | null;
  readonly remainingMs: number;
}

/** Boss Raid HUD. */
export class RaidHud {
  private readonly battleHud: BattleHud;
  private readonly layer: ZoomStableLayer;
  private readonly bossPanel: BossStatusPanel;

  /**
   * @param scene - The raid scene.
   * @param bossName - Boss display name.
   * @param worldSize - Battlefield side length.
   */
  constructor(scene: Phaser.Scene, bossName: string, worldSize: number) {
    this.battleHud = new BattleHud(scene, {
      worldSize,
      radarRangePx: RADAR_RANGE_PX,
      edgeInsets: EDGE_INSETS,
    });
    this.layer = new ZoomStableLayer(scene, HOLO_DEPTH.hud);
    this.bossPanel = new BossStatusPanel(
      scene,
      scene.scale.width / 2,
      BOSS_PANEL_CENTER_Y,
      bossName,
    );
    this.layer.add(this.bossPanel.panel, controlsCard(scene));
  }

  /**
   * @param frame - HUD snapshot, boss state and raid clock.
   */
  update(frame: RaidHudFrame): void {
    this.layer.sync(frame.battle.camera);
    this.battleHud.update(frame.battle);
    this.bossPanel.panel.setVisible(frame.boss !== null);
    if (frame.boss) this.bossPanel.update(frame.boss, frame.remainingMs);
  }

  /**
   * @param visible - Whether the HUD shows (hidden under end screens).
   */
  setVisible(visible: boolean): void {
    this.battleHud.setVisible(visible);
    this.layer.setVisible(visible);
  }

  /** Destroy every HUD object. */
  destroy(): void {
    this.battleHud.destroy();
    this.layer.destroy();
  }
}

function controlsCard(scene: Phaser.Scene): HoloPanel {
  const card = new HoloPanel(
    scene,
    HOLO_SPACING.lg + CONTROLS_CARD.width / 2,
    HOLO_SPACING.lg + CONTROLS_CARD.height / 2,
    {
      width: CONTROLS_CARD.width,
      height: CONTROLS_CARD.height,
      title: "Flight controls",
    },
  );
  const left = -CONTROLS_CARD.width / 2 + HOLO_SPACING.md;
  CONTROLS_LINES.forEach((line, index) => {
    const text = createHoloText(
      scene,
      left,
      card.contentTop + CONTROLS_CARD.lineHeight * (index + 0.5),
      line,
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0, 0.5);
    card.add(text);
  });
  return card;
}
