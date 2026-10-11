/**
 * HudPreviewScene — dev-only showcase of the holographic HUD and menu look.
 *
 * Renders BattleHud (status ring, radar, weapon bar, flight readout, edge
 * arrows) over deterministic fake contacts that cross the torus seam, plus a
 * HoloPanel with every HoloButton state. `setPreviewState` freezes time and
 * pins values so Playwright can take reproducible screenshots.
 *
 * Keys: Z / X zoom in / out, SPACE freeze, ESC back to the main menu.
 */

import Phaser from "phaser";
import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../config";
import { BattleHud } from "../ui/hud/BattleHud";
import { createHoloButton } from "../ui/hud/HoloButton";
import { createHoloPanel, type HoloPanel } from "../ui/hud/HoloPanel";
import { fillBlip } from "../ui/hud/HudIcons";
import { cameraViewFrom, shortestDelta } from "../ui/hud/hudMath";
import type { ScreenRect } from "../ui/hud/screenRect";
import type { ContactHudState, HudPoint, HudPose } from "../ui/hud/types";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../ui/theme/HoloTheme";
import {
  previewContacts,
  previewPlayer,
  previewWeapons,
  type PreviewPlayerOverrides,
} from "./hudPreview/previewScenario";

const DEG_TO_RAD = Math.PI / 180;
const BACKGROUND = 0x050a14;
const RADAR_RANGE_PX = 1800;
const SHIP_DEPTH = 10;
const STAR = {
  count: 900,
  bandHalfHeight: 1300,
  seamMargin: 1000,
  minSize: 1,
  maxSize: 2,
  minAlpha: 0.15,
  maxAlpha: 0.7,
  seed: "hud-preview",
} as const;
/** Ship marker radius as a fraction of SHIP_SIZES (blip glyph is ~1.5r long). */
const SHIP_MARKER_SCALE = 0.4;
const SHIP_ALPHA = 0.9;
const ZOOM = { min: 0.5, max: 2, step: 0.1 } as const;
const MENU = {
  width: 280,
  height: 238,
  buttonWidth: 240,
  buttonHeight: 34,
  buttonPitch: 44,
} as const;

/** Values the e2e spec (or a developer) can pin. */
export interface HudPreviewState extends PreviewPlayerOverrides {
  readonly timeMs?: number;
  readonly frozen?: boolean;
  readonly zoom?: number;
  readonly showMenu?: boolean;
}

/** Dev-only HUD showcase scene. */
export class HudPreviewScene extends Phaser.Scene {
  private hud: BattleHud | null = null;
  private ships: Phaser.GameObjects.Graphics | null = null;
  private menu: HoloPanel | null = null;
  private elapsedMs = 0;
  private frozen = false;
  private showMenu = true;
  private overrides: PreviewPlayerOverrides = {};

  constructor() {
    super({ key: "HudPreviewScene" });
  }

  create(): void {
    this.elapsedMs = 0;
    this.frozen = false;
    this.showMenu = true;
    this.overrides = {};
    this.cameras.main.setBackgroundColor(BACKGROUND).setZoom(1);
    this.drawStarfield();
    this.ships = this.add.graphics().setDepth(SHIP_DEPTH);
    this.hud = new BattleHud(this, {
      worldSize: BATTLEFIELD_SIZE,
      radarRangePx: RADAR_RANGE_PX,
    });
    this.menu = this.createMenuSample();
    this.bindKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.renderFrame();
  }

  update(_time: number, delta: number): void {
    if (!this.frozen) this.elapsedMs += delta;
    this.renderFrame();
  }

  /**
   * Pin preview values; keys present with `undefined` clear an override.
   *
   * @param state - Values to apply.
   */
  setPreviewState(state: HudPreviewState): void {
    if (state.timeMs !== undefined) this.elapsedMs = state.timeMs;
    if (state.frozen !== undefined) this.frozen = state.frozen;
    if (state.zoom !== undefined) this.cameras.main.setZoom(state.zoom);
    if (state.showMenu !== undefined) this.showMenu = state.showMenu;
    this.overrides = {
      stress: "stress" in state ? state.stress : this.overrides.stress,
      isStressed:
        "isStressed" in state ? state.isStressed : this.overrides.isStressed,
      hull: "hull" in state ? state.hull : this.overrides.hull,
      shields: "shields" in state ? state.shields : this.overrides.shields,
    };
    this.renderFrame();
  }

  /**
   * Screen positions of the edge arrows currently shown.
   *
   * @returns Arrow positions in screen px.
   */
  edgeArrowPositions(): HudPoint[] {
    return this.hud?.edgeArrowPositions() ?? [];
  }

  /**
   * Screen bounds of the bottom HUD cluster.
   *
   * @returns Widget rects in screen px.
   */
  hudClusterBounds(): ScreenRect[] {
    return this.hud?.clusterBounds() ?? [];
  }

  private renderFrame(): void {
    const player = previewPlayer(this.elapsedMs, this.overrides);
    const contacts = previewContacts(this.elapsedMs, player.pose);
    const camera = this.cameras.main;
    camera.centerOn(player.pose.x, player.pose.y);
    this.menu?.setVisible(this.showMenu && camera.zoom === 1);
    this.drawShips(player.pose, contacts);
    this.hud?.update({
      player,
      contacts,
      weapons: previewWeapons(this.elapsedMs),
      camera: cameraViewFrom(camera),
    });
  }

  private drawShips(
    player: HudPose,
    contacts: ReadonlyArray<ContactHudState>,
  ): void {
    const g = this.ships;
    if (g === null) return;
    g.clear();
    for (const contact of contacts) {
      if (!contact.alive) continue;
      const rel = shortestDelta(player, contact.pose, BATTLEFIELD_SIZE);
      g.fillStyle(SIDE_COLORS[contact.side], SHIP_ALPHA);
      fillBlip(
        g,
        player.x + rel.x,
        player.y + rel.y,
        SHIP_SIZES[contact.sizeClass] * SHIP_MARKER_SCALE,
        contact.pose.angle * DEG_TO_RAD,
      );
    }
    g.fillStyle(SIDE_COLORS.player, 1);
    fillBlip(
      g,
      player.x,
      player.y,
      SHIP_SIZES.small * SHIP_MARKER_SCALE,
      player.angle * DEG_TO_RAD,
    );
  }

  private drawStarfield(): void {
    const rng = new Phaser.Math.RandomDataGenerator([STAR.seed]);
    const g = this.add.graphics();
    const centerY = BATTLEFIELD_SIZE / 2;
    for (let i = 0; i < STAR.count; i++) {
      const x = rng.between(0, BATTLEFIELD_SIZE);
      const y =
        centerY + rng.between(-STAR.bandHalfHeight, STAR.bandHalfHeight);
      const size = rng.between(STAR.minSize, STAR.maxSize);
      g.fillStyle(
        HOLO_PALETTE.textPrimary,
        rng.realInRange(STAR.minAlpha, STAR.maxAlpha),
      );
      g.fillRect(x, y, size, size);
      if (x < STAR.seamMargin) g.fillRect(x + BATTLEFIELD_SIZE, y, size, size);
      if (x > BATTLEFIELD_SIZE - STAR.seamMargin)
        g.fillRect(x - BATTLEFIELD_SIZE, y, size, size);
    }
  }

  private createMenuSample(): HoloPanel {
    const panel = createHoloPanel(
      this,
      HOLO_SPACING.lg + MENU.width / 2,
      HOLO_SPACING.lg + MENU.height / 2,
      {
        width: MENU.width,
        height: MENU.height,
        faction: "free_confederation",
        title: "Squadron command",
      },
    );
    const size = { width: MENU.buttonWidth, height: MENU.buttonHeight };
    const firstY = panel.contentTop + MENU.buttonHeight / 2;
    const buttons = [
      createHoloButton(
        this,
        0,
        firstY,
        { ...size, label: "Launch", variant: "primary" },
        () => undefined,
      ),
      createHoloButton(
        this,
        0,
        firstY + MENU.buttonPitch,
        { ...size, label: "Loadout" },
        () => undefined,
      ).setFocused(true),
      createHoloButton(
        this,
        0,
        firstY + MENU.buttonPitch * 2,
        { ...size, label: "Retreat", variant: "danger" },
        () => undefined,
      ),
      createHoloButton(
        this,
        0,
        firstY + MENU.buttonPitch * 3,
        { ...size, label: "Locked", disabled: true },
        () => undefined,
      ),
    ];
    panel.add(buttons);
    return panel.setScrollFactor(0, 0, true).setDepth(HOLO_DEPTH.menuPanel);
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const zoomBy = (step: number): void => {
      const camera = this.cameras.main;
      camera.setZoom(Phaser.Math.Clamp(camera.zoom + step, ZOOM.min, ZOOM.max));
    };
    keyboard.on("keydown-Z", () => zoomBy(ZOOM.step));
    keyboard.on("keydown-X", () => zoomBy(-ZOOM.step));
    keyboard.on("keydown-SPACE", () => {
      this.frozen = !this.frozen;
    });
    keyboard.on("keydown-ESC", () => this.scene.start("MainMenuScene"));
  }

  private teardown(): void {
    this.hud?.destroy();
    this.hud = null;
    this.ships = null;
    this.menu = null;
  }
}
