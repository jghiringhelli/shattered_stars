/**
 * ArcadeBattleHud — the Skirmish scene's whole HUD behind one object.
 *
 * Wraps the shared holographic {@link BattleHud} (status ring, radar, flight
 * readout, weapon bar, edge arrows) and adds the Skirmish-only panels: match
 * clock + score, squad roster, crew/commander panel, stress and flee
 * call-outs and a controls hint. The scene builds an {@link ArcadeHudFrame}
 * each rendered frame; nothing here reads scene internals. A read-only
 * {@link ArcadeHudReadout} reports what is on screen (tests, screenshots).
 */

import Phaser from "phaser";
import type { ShipSize } from "../../config";
import type { CommanderOrders, CrewRole } from "../../systems/ShipCrew";
import { formatMatchClock } from "../../systems/arena/MatchTimer";
import {
  BattleHud,
  cameraViewFrom,
  DEFAULT_EDGE_INSETS,
  type CameraLike,
} from "../../ui/hud";
import { createScreenContainer } from "../../ui/hud/holoPrimitives";
import { hudRootTransform } from "../../ui/hud/hudMath";
import type { ScreenRect } from "../../ui/hud/screenRect";
import type { WeaponSlotDescriptor } from "../../ui/hud/types";
import { HOLO_DEPTH } from "../../ui/theme/HoloTheme";
import {
  createControlsHint,
  FleeWarning,
  StressAlert,
} from "./ArcadeHudAlerts";
import {
  CrewStatusPanel,
  MatchClockPanel,
  PANEL_MARGIN,
  SquadRosterPanel,
} from "./ArcadeHudPanels";
import { buildBattleHudSnapshot, type HudShipView } from "./arcadeHudModel";
import {
  actionRows,
  commanderOrderRows,
  crewTitle,
  matchClockTone,
  rosterTeams,
} from "./arcadeStatusModel";

/**
 * Edge arrows run below the top panels (crew, clock, roster) so they never
 * cover them: the tallest top panel (commander orders) ends near 125 px.
 */
const EDGE_ARROW_TOP_INSET = 136;

/** Static HUD configuration. */
export interface ArcadeHudConfig {
  /** Torus side length. */
  readonly worldSize: number;
  /** Size class of a ship definition (radar blip size). */
  readonly sizeOf: (definitionId: string) => ShipSize;
}

/** Everything the HUD shows for one frame. */
export interface ArcadeHudFrame {
  readonly player: HudShipView | null;
  readonly crewMode: CrewRole;
  readonly commanderOrders: CommanderOrders | null;
  readonly ships: ReadonlyArray<HudShipView>;
  readonly playerFaction: string;
  /** The player's weapon bar (primary + secondaries), left to right. */
  readonly weapons: ReadonlyArray<WeaponSlotDescriptor>;
  readonly camera: CameraLike;
  readonly score: number;
  readonly remainingMs: number;
  /** Scene time (ms) — pulses and order cooldowns. */
  readonly nowMs: number;
  /** The player's side's marked target (SquadMark), or null. */
  readonly markedId?: string | null;
}

/** What the HUD showed on its last update. */
export interface ArcadeHudReadout {
  readonly visible: boolean;
  readonly playerShown: boolean;
  readonly speed: number | null;
  readonly stressLevel: number | null;
  /** "STRESSED" while the pilot is stressed, else "". */
  readonly stressLabel: string;
  readonly maneuver: string | null;
  readonly targetId: string | null;
  /** The contact shown as the squad's marked target, or null. */
  readonly markedId: string | null;
  readonly contactCount: number;
  readonly edgeArrowCount: number;
  readonly weaponIds: ReadonlyArray<string>;
  readonly selectedWeaponId: string | null;
  readonly crewTitle: string;
  readonly scoreLabel: string;
}

const EMPTY_READOUT: ArcadeHudReadout = {
  visible: true,
  playerShown: false,
  speed: null,
  stressLevel: null,
  stressLabel: "",
  maneuver: null,
  targetId: null,
  markedId: null,
  contactCount: 0,
  edgeArrowCount: 0,
  weaponIds: [],
  selectedWeaponId: null,
  crewTitle: "",
  scoreLabel: "",
};

/** The Skirmish HUD. */
export class ArcadeBattleHud {
  private readonly battleHud: BattleHud;
  private readonly root: Phaser.GameObjects.Container;
  private readonly clock: MatchClockPanel;
  private readonly roster: SquadRosterPanel;
  private readonly crew: CrewStatusPanel;
  private readonly stress: StressAlert;
  private readonly flee: FleeWarning;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly config: ArcadeHudConfig;
  private lastView = {
    zoom: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  };
  private isShown = true;
  private last: ArcadeHudReadout = EMPTY_READOUT;

  /**
   * @param scene - The battle scene.
   * @param config - World size and ship size lookup.
   */
  constructor(scene: Phaser.Scene, config: ArcadeHudConfig) {
    this.config = config;
    this.battleHud = new BattleHud(scene, {
      worldSize: config.worldSize,
      edgeInsets: { ...DEFAULT_EDGE_INSETS, top: EDGE_ARROW_TOP_INSET },
    });
    this.root = createScreenContainer(scene).setDepth(HOLO_DEPTH.hud);
    this.clock = new MatchClockPanel(scene, this.root);
    this.roster = new SquadRosterPanel(scene, this.root);
    this.crew = new CrewStatusPanel(scene, this.root);
    this.stress = new StressAlert(scene, this.root);
    this.flee = new FleeWarning(scene, this.root);
    this.hint = createControlsHint(scene, this.root);
  }

  /** What the HUD showed on its last update. */
  get readout(): ArcadeHudReadout {
    return this.last;
  }

  /** The flee warning text object. */
  get fleeWarningText(): Phaser.GameObjects.Text {
    return this.flee.text;
  }

  /**
   * Screen rects of every fixed HUD widget, in HUD-root px (screen px at
   * zoom 1) — lets tests check that no two widgets overlap.
   *
   * @returns Named rects; the weapon bar is omitted while empty.
   */
  layoutRects(): Record<string, ScreenRect> {
    const [readout, radar, weapons] = this.battleHud.clusterBounds();
    const rects: Record<string, ScreenRect> = {
      clock: this.clock.bounds(),
      roster: this.roster.bounds(),
      crew: this.crew.bounds(),
    };
    if (readout) rects["readout"] = readout;
    if (radar) rects["radar"] = radar;
    if (weapons) rects["weapons"] = weapons;
    return rects;
  }

  /**
   * Refresh every widget.
   *
   * @param frame - This frame's battle state.
   */
  update(frame: ArcadeHudFrame): void {
    if (!this.isShown) return;
    const camera = cameraViewFrom(frame.camera);
    const { snapshot, targetId } = buildBattleHudSnapshot({
      player: frame.player,
      ships: frame.ships,
      playerFaction: frame.playerFaction,
      weapons: frame.weapons,
      camera,
      worldSize: this.config.worldSize,
      sizeOf: this.config.sizeOf,
      markedId: frame.markedId ?? null,
    });
    this.battleHud.update(snapshot);
    this.applyCamera(camera.zoom, camera.width, camera.height);
    this.updatePanels(frame);
    const player = snapshot.player;
    const selected = snapshot.weapons.find((slot) => slot.selected);
    this.last = {
      visible: true,
      playerShown: player !== null,
      speed: player?.speed ?? null,
      stressLevel: player?.stress ?? null,
      stressLabel: this.stress.label,
      maneuver: player?.maneuver ?? null,
      targetId,
      markedId:
        snapshot.contacts.find((contact) => contact.isMarked)?.id ?? null,
      contactCount: snapshot.contacts.length,
      edgeArrowCount: this.battleHud.edgeArrowCount,
      weaponIds: snapshot.weapons.map((slot) => slot.id),
      selectedWeaponId: selected?.id ?? null,
      crewTitle: this.crew.crewTitle,
      scoreLabel: this.clock.scoreLabel,
    };
  }

  /**
   * Show the flee countdown.
   *
   * @param secondsLeft - Time until the battle ends as a retreat.
   * @param bearingRad - Screen direction to the nearest enemy, or null.
   */
  showFleeWarning(secondsLeft: number, bearingRad: number | null): void {
    this.flee.show(secondsLeft, bearingRad);
  }

  /** Hide the flee countdown. */
  hideFleeWarning(): void {
    this.flee.hide();
  }

  /**
   * Show or hide the whole HUD (pause / end-of-battle overlays).
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    this.isShown = visible;
    this.battleHud.setVisible(visible);
    this.root.setVisible(visible);
    this.last = { ...this.last, visible };
  }

  /** Destroy every HUD game object. */
  destroy(): void {
    this.battleHud.destroy();
    this.root.destroy();
  }

  private updatePanels(frame: ArcadeHudFrame): void {
    const remaining = frame.remainingMs;
    this.clock.update(
      formatMatchClock(remaining),
      matchClockTone(remaining),
      frame.score,
    );
    this.roster.update(
      rosterTeams(frame.ships, frame.playerFaction, frame.player?.id ?? null),
    );
    const rows =
      frame.crewMode === "commander" && frame.commanderOrders
        ? commanderOrderRows(frame.commanderOrders, frame.nowMs)
        : frame.player
          ? actionRows(frame.player.control)
          : [];
    this.crew.update(crewTitle(frame.crewMode), rows);
    const stressed =
      frame.player !== null &&
      frame.player.hull > 0 &&
      frame.player.stress.isStressed;
    this.stress.update(stressed, frame.nowMs);
  }

  private applyCamera(zoom: number, width: number, height: number): void {
    const view = this.lastView;
    if (view.zoom === zoom && view.width === width && view.height === height)
      return;
    this.lastView = { zoom, width, height };
    const t = hudRootTransform(zoom, width, height);
    this.root.setPosition(t.x, t.y).setScale(t.scale);
    this.clock.layout(width);
    this.roster.layout(width);
    this.flee.layout(width);
    this.hint.setPosition(PANEL_MARGIN, height - PANEL_MARGIN);
    this.stress.layout(width, height);
  }
}
