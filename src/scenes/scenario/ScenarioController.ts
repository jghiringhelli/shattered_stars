/**
 * ScenarioController — runs an X-Wing 2.0 scenario inside the Skirmish
 * scene behind a handful of one-line hooks: deploys both sides on their
 * lines, steps the pure match every logic tick (frame from the scene's
 * ship records, evasive actions from its flight hook), drives the AI's
 * objective play through the bot fleet's goal source, draws the objectives
 * (world + HUD) and shows the scenario end screen. The scene keeps its
 * combat; the scenario owns scoring, the clock and how the match ends.
 */

import type Phaser from "phaser";
import {
  SCENARIO_DEFINITIONS,
  createScenarioState,
  isScenarioId,
  stepScenario,
  totalPoints,
  withBonusPoints,
  type ScenarioResult,
  type ScenarioSide,
  type ScenarioState,
} from "../../arcade/scenarios";
import type { FlightEvent } from "../../arcade/systems/PilotFlightTypes";
import type { CameraLike } from "../../ui/hud";
import type { ScreenRect } from "../../ui/hud/screenRect";
import type { ArcadeBotFleet } from "../arcadeBattle/ArcadeBotFleet";
import { ScenarioDirector } from "./ScenarioDirector";
import { deployShips, type DeployableShip } from "./deployShips";
import {
  createScenarioEndOverlay,
  type ScenarioEndActions,
} from "./ScenarioEndOverlay";
import { endSummary } from "./scenarioEndModel";
import {
  ScenarioFrameTracker,
  isEvasiveFlightEvent,
  type ScenarioShipSource,
} from "./scenarioFrameTracker";
import { ScenarioHudView } from "./ScenarioHudView";
import { objectiveGlyphs, scoreboardView } from "./scenarioHudModel";
import { buildReadout, type ScenarioReadout } from "./scenarioReadout";
import { ScenarioWorldView } from "./ScenarioWorldView";

/** A Skirmish ship record, as the scenario reads (and deploys) it. */
export interface ScenarioSceneShip extends ScenarioShipSource, DeployableShip {
  x: number;
  y: number;
  readonly owner: "player" | "ai";
}

/** What the controller needs from the scene. */
export interface ScenarioSceneLink {
  readonly worldSize: number;
  readonly ships: () => Iterable<ScenarioSceneShip>;
  readonly playerShipId: () => string | null;
  /** The player's side's live mark (the player's own, or Mark Assist's), or null. */
  readonly playerMarkedTargetId: () => string | null;
  /** The Skirmish radar's rect (HUD-root px). */
  readonly radarRect: () => ScreenRect | undefined;
  /** Called once when the match ends. */
  readonly onEnd: (result: ScenarioResult) => void;
}

/**
 * @param scene - The battle scene.
 * @param battleConfig - The registry's battle config (its `scenario` field).
 * @param link - Scene accessors.
 * @returns A controller when the config names a scenario, else null.
 */
export function createScenarioController(
  scene: Phaser.Scene,
  battleConfig: { readonly scenario?: unknown } | undefined,
  link: ScenarioSceneLink,
): ScenarioController | null {
  const id = battleConfig?.scenario;
  return isScenarioId(id)
    ? new ScenarioController(scene, SCENARIO_DEFINITIONS[id], link)
    : null;
}

export class ScenarioController {
  private state: ScenarioState;
  private tracker: ScenarioFrameTracker | null = null;
  private readonly director: ScenarioDirector;
  private readonly world: ScenarioWorldView;
  private readonly hud: ScenarioHudView;
  private ended = false;
  /** The target the human player marked last (R); Mark Assist marks do not count. */
  private playerMarkId: string | null = null;

  /**
   * @param scene - The battle scene.
   * @param definition - The scenario.
   * @param link - Scene accessors.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    definition: (typeof SCENARIO_DEFINITIONS)[keyof typeof SCENARIO_DEFINITIONS],
    private readonly link: ScenarioSceneLink,
  ) {
    this.state = createScenarioState(definition, link.worldSize);
    this.director = new ScenarioDirector(link.worldSize);
    this.world = new ScenarioWorldView(scene);
    this.hud = new ScenarioHudView(scene);
  }

  /** Battle time left on the scenario clock (ms). */
  get remainingMs(): number {
    return Math.max(
      0,
      this.state.definition.timeLimitMs - this.state.elapsedMs,
    );
  }

  /** What the scenario shows and knows (e2e / telemetry). */
  get readout(): ScenarioReadout {
    return buildReadout(
      this.state,
      this.director,
      this.hud.boardText,
      this.link.ships(),
    );
  }

  /**
   * Put both sides on their deployment lines (before sprites are made).
   * @param ships - Every ship record (mutated).
   * @param playerFaction - The human player's faction.
   */
  deploy(ships: readonly ScenarioSceneShip[], playerFaction: string): void {
    const tracker = new ScenarioFrameTracker(
      playerFaction,
      this.link.worldSize,
    );
    this.tracker = tracker;
    deployShips(ships, (ship) => tracker.sideOf(ship), this.link.worldSize);
  }

  /** @param fleet - The battle's AI: its ships steer for their objectives. */
  attachFleet(fleet: ArcadeBotFleet): void {
    fleet.setGoalSource((id) => this.director.goalFor(id));
  }

  /**
   * The scene's flight hook: boosts and barrel rolls drop salvage.
   * @param shipId - The ship flown.
   * @param events - Its flight events this frame.
   * @param origin - Where it was before the frame.
   */
  onFlightEvents(
    shipId: string,
    events: readonly FlightEvent[],
    origin: { x: number; y: number },
  ): void {
    if (events.some(isEvasiveFlightEvent))
      this.tracker?.noteEvasive(shipId, origin);
  }

  /**
   * The scene's mark hook: the player pressed R on a target. While that
   * mark lives the wingmen follow it instead of the objectives.
   * @param targetId - The marked ship.
   */
  onPlayerMark(targetId: string): void {
    this.playerMarkId = targetId;
  }

  /**
   * One logic tick: step the match, re-plan the AI, end the match when due.
   * @param deltaMs - Tick length.
   * @param nowMs - Battle time.
   * @returns True (the scenario owns victory, flee and the clock).
   */
  tick(deltaMs: number, nowMs: number): true {
    if (this.ended || !this.tracker) return true;
    const ships = [...this.link.ships()];
    this.state = stepScenario(this.state, this.tracker.build(ships, deltaMs));
    this.director.update({
      nowMs,
      state: this.state,
      ships: ships
        .filter((s) => s.hull > 0)
        .map((s) => ({
          id: s.id,
          side: this.tracker!.sideOf(s),
          x: s.x,
          y: s.y,
          isHuman: s.owner === "player",
        })),
      markActive:
        this.playerMarkId !== null &&
        this.link.playerMarkedTargetId() === this.playerMarkId,
    });
    if (this.state.result) {
      this.ended = true;
      this.link.onEnd(this.state.result);
    }
    return true;
  }

  /**
   * Draw the objectives and the scenario HUD (every rendered frame).
   * @param camera - The main camera.
   * @param nowMs - Scene time (pulses).
   */
  render(camera: CameraLike, nowMs: number): void {
    const glyphs = objectiveGlyphs(this.state);
    const ships = [...this.link.ships()];
    const carriers = this.state.crates.flatMap((crate) => {
      const ship = ships.find((s) => s.id === crate.carrierId && s.hull > 0);
      return ship ? [{ crateId: crate.id, x: ship.x, y: ship.y }] : [];
    });
    this.world.update(glyphs, carriers, nowMs);
    const playerId = this.link.playerShipId();
    const player = ships.find((s) => s.id === playerId && s.hull > 0) ?? null;
    this.hud.update({
      board: scoreboardView(this.state, playerId),
      glyphs,
      player,
      camera,
      radar: this.link.radarRect(),
      worldSize: this.link.worldSize,
    });
  }

  /** @param visible - Show or hide the scenario HUD (pause / end screens). */
  setHudVisible(visible: boolean): void {
    this.hud.setVisible(visible);
  }

  /**
   * Show the scenario end screen (hides the scenario HUD).
   * @param actions - Retry / Menu.
   * @returns Whether it was shown (false until the match has a result).
   */
  showResult(actions: ScenarioEndActions): boolean {
    const result = this.state.result;
    if (!result) return false;
    this.hud.setVisible(false);
    createScenarioEndOverlay(
      this.scene,
      endSummary(result, this.state.definition),
      actions,
    );
    return true;
  }

  /** @returns Whether the player's side won (draws are not wins). */
  get playerWon(): boolean {
    return this.state.result?.winner === "player";
  }

  /**
   * Debug hook (e2e): add objective points to a side.
   * @param side - The side.
   * @param points - Points to add.
   */
  debugAddPoints(side: ScenarioSide, points: number): void {
    this.state = withBonusPoints(this.state, side, points);
  }

  /** @returns Total points per side. */
  get totals(): Readonly<Record<ScenarioSide, number>> {
    return {
      player: totalPoints(this.state.points.player),
      enemy: totalPoints(this.state.points.enemy),
    };
  }

  /** Destroy the views. */
  destroy(): void {
    this.world.destroy();
    this.hud.destroy();
  }
}
