/**
 * CreatureBossBar — the top-centre holographic readout of a creature boss:
 * name and epithet, phase pips (squares, the current one boxed), shield and
 * hull gauges, a line of body parts (✛ weak point, ▭ armoured plate, ✖
 * destroyed — with the power its loss switched off), and the telegraph line
 * ("[FAN] CINDER SPRAY 0.8s"), plus PHASE-SHIFTED / FEEDING tags. Everything
 * is text or shape, never colour alone. Redraws only when what it shows
 * changes. Screen-space, zoom-independent like the other mode HUDs.
 */

import Phaser from "phaser";
import {
  bossBarView,
  type BossBarShip,
  type BossBarView,
} from "../../arcade/creatures/bossBarModel";
import type { CreatureEncounter } from "../../arcade/creatures/CreatureEncounter";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";
import {
  cancelCameraZoom,
  pinTree,
  type ZoomCameraLike,
} from "../../ui/modeHud/screenSpace";

const WIDTH = 560;
const HEIGHT = 118;
const TOP_Y = 80;
const INSET = HOLO_SPACING.lg;
const PIP = 12;
const PIP_GAP = 6;
const GAUGE_W = WIDTH - INSET * 2;
const SHIELD_Y = 4;
const SHIELD_H = 6;
const HULL_Y = 14;
const HULL_H = 12;
const TRACK_ALPHA = HOLO_PALETTE.trackAlpha;

/** The boss readout. */
export class CreatureBossBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly gauges: Phaser.GameObjects.Graphics;
  private readonly phaseText: Phaser.GameObjects.Text;
  private readonly partsText: Phaser.GameObjects.Text;
  private readonly telegraphText: Phaser.GameObjects.Text;
  private signature = "";

  /**
   * @param scene - The battle scene.
   * @param title - Boss name for the header.
   */
  constructor(scene: Phaser.Scene, title: string) {
    this.panel = new HoloPanel(scene, scene.scale.width / 2, TOP_Y, {
      width: WIDTH,
      height: HEIGHT,
      title,
      accentColor: HOLO_PALETTE.danger,
    });
    this.gauges = scene.add.graphics();
    this.phaseText = createHoloText(
      scene,
      -WIDTH / 2 + INSET + 90,
      -22,
      "",
      "caption",
    ).setOrigin(0, 0.5);
    this.partsText = createHoloText(
      scene,
      0,
      38,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0.5, 0.5);
    this.telegraphText = createHoloText(
      scene,
      0,
      56,
      "",
      "caption",
      HOLO_PALETTE.warning,
    ).setOrigin(0.5, 0.5);
    this.panel.add([
      this.gauges,
      this.phaseText,
      this.partsText,
      this.telegraphText,
    ]);
    this.root = scene.add
      .container(0, 0, [this.panel])
      .setDepth(HOLO_DEPTH.hud);
    pinTree(this.root);
  }

  /**
   * @param encounter - The creature.
   * @param ship - Its hull and shields.
   * @param nowMs - Sim time (ms).
   */
  update(encounter: CreatureEncounter, ship: BossBarShip, nowMs: number): void {
    const view = bossBarView(encounter, ship, nowMs);
    const signature = signatureOf(view);
    if (signature === this.signature) return;
    this.signature = signature;
    this.draw(view);
  }

  /** @param camera - The scene camera (keeps the bar 1:1 on screen). */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** @param visible - Show or hide the bar. */
  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  /** Removes the bar. */
  destroy(): void {
    this.root.destroy();
  }

  private draw(view: BossBarView): void {
    const g = this.gauges;
    g.clear();
    const left = -GAUGE_W / 2;
    this.drawPips(g, view, left);
    g.fillStyle(HOLO_PALETTE.track, TRACK_ALPHA).fillRect(
      left,
      SHIELD_Y,
      GAUGE_W,
      SHIELD_H,
    );
    g.fillStyle(HOLO_PALETTE.shield, 1).fillRect(
      left,
      SHIELD_Y,
      GAUGE_W * view.shieldFraction,
      SHIELD_H,
    );
    g.fillStyle(HOLO_PALETTE.track, TRACK_ALPHA).fillRect(
      left,
      HULL_Y,
      GAUGE_W,
      HULL_H,
    );
    g.fillStyle(HOLO_PALETTE.danger, 1).fillRect(
      left,
      HULL_Y,
      GAUGE_W * view.hullFraction,
      HULL_H,
    );
    this.phaseText.setText(view.phaseName);
    this.partsText.setText(partsLine(view));
    this.telegraphText.setText(telegraphLine(view));
    this.telegraphText.setColor(
      toCssColor(view.telegraph ? HOLO_PALETTE.danger : HOLO_PALETTE.warning),
    );
  }

  private drawPips(
    g: Phaser.GameObjects.Graphics,
    view: BossBarView,
    left: number,
  ): void {
    view.phases.forEach((phase, i) => {
      const x = left + i * (PIP + PIP_GAP);
      const y = -22 - PIP / 2;
      g.fillStyle(HOLO_PALETTE.danger, phase.reached ? 1 : 0.18).fillRect(
        x,
        y,
        PIP,
        PIP,
      );
      if (phase.current)
        g.lineStyle(2, HOLO_PALETTE.textPrimary, 1).strokeRect(
          x - 3,
          y - 3,
          PIP + 6,
          PIP + 6,
        );
    });
  }
}

function partsLine(view: BossBarView): string {
  return view.parts
    .map((part) => {
      if (part.alive)
        return `${part.kind === "weak" ? "✛" : "▭"} ${part.name.toUpperCase()}`;
      const off =
        part.disables.length > 0 ? ` (${part.disables.join(", ")} OFF)` : "";
      return `✖ ${part.name.toUpperCase()}${off}`;
    })
    .join("   ");
}

function telegraphLine(view: BossBarView): string {
  const tags = [
    view.phased ? "PHASE-SHIFTED" : "",
    view.feeding ? "FEEDING" : "",
  ]
    .filter((t) => t !== "")
    .join("  ");
  const power = view.telegraph
    ? `[${view.telegraph.tag}] ${view.telegraph.label} ${view.telegraph.secondsLeft.toFixed(1)}s`
    : "";
  return [power, tags].filter((t) => t !== "").join("   ");
}

function signatureOf(view: BossBarView): string {
  const parts = view.parts.map((p) => (p.alive ? "1" : "0")).join("");
  const tele = view.telegraph
    ? `${view.telegraph.label}${view.telegraph.secondsLeft.toFixed(1)}`
    : "-";
  const pips = view.phases
    .map((p) => (p.current ? "c" : p.reached ? "r" : "n"))
    .join("");
  return `${Math.ceil(view.hullFraction * 200)}|${Math.ceil(view.shieldFraction * 100)}|${pips}|${parts}|${tele}|${view.phased}|${view.feeding}|${view.phaseName}`;
}
