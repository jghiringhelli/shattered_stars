/**
 * ReinforcementController — runs a reinforcement-pool battle inside the
 * Skirmish scene behind a few one-line hooks. It registers the opening
 * squads with the pure ReinforcementDirector, notices destroyed ships,
 * spawns every reinforcement the director deploys (warped in at its side's
 * edge with arrival protection, AI ships enlisted with the bot fleet by the
 * scene's adopt hook), drives the HUD panel and the player's picker, keeps
 * the camera on a wingman while the player's ship is down, and ends the
 * match (unless a scenario owns the result).
 */

import type Phaser from "phaser";
import {
  ArrivalShield,
  ReinforcementDirector,
  parseReinforcementSetup,
  type Deployment,
  type ReinforcedResult,
  type ReinforcementRules,
  type ReinforcementSetup,
} from "../../../arcade/reinforcements";
import type { ScenarioSide } from "../../../arcade/scenarios";
import type { ArcadeShip } from "../arcadeShipFactory";
import type { CameraFocus, ReinforcementSceneLink } from "./reinforcementLink";
import { spawnArcadeShip } from "../arcadeShipFactory";
import { matchStats } from "../../../telemetry/matchTelemetry";
import { ReinforcementHud } from "./ReinforcementHud";
import { ReinforcementPicker } from "./ReinforcementPicker";
import { deployToast } from "./reinforcementHudModel";
import { showSummaryStrip } from "./reinforcementSummaryStrip";
import {
  endDetails,
  endOverlayExtras,
  telemetryDetails,
  type EndOverlayExtras,
} from "./reinforcementEndModel";
import {
  buildReadout,
  type ReinforcementReadout,
} from "./reinforcementReadout";
import {
  buildDirectorSetup,
  freshShipId,
  openingRegistrations,
  reinforcementPose,
  sideOrder,
} from "./reinforcementSetup";

/** Ships previewed from the player's reserve on the HUD. */
const PREVIEW_COUNT = 3;

/**
 * @param scene - The battle scene.
 * @param battleConfig - The registry's battle config.
 * @param link - Scene accessors.
 * @returns A controller for a reinforced battle, else null (classic).
 */
export function createReinforcementController(
  scene: Phaser.Scene,
  battleConfig: unknown,
  link: ReinforcementSceneLink,
): ReinforcementController | null {
  const setup = parseReinforcementSetup(battleConfig);
  return setup ? new ReinforcementController(scene, setup, link) : null;
}

export class ReinforcementController {
  private readonly director: ReinforcementDirector;
  private readonly shield = new ArrivalShield();
  private readonly alive = new Set<string>();
  private readonly issuedIds = new Set<string>();
  private readonly sides: string[];
  private readonly hud: ReinforcementHud;
  private readonly picker: ReinforcementPicker;
  private ended = false;
  private nowMs = 0;

  /**
   * @param scene - The battle scene.
   * @param setup - Parsed rules and side plans.
   * @param link - Scene accessors.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    setup: ReinforcementSetup,
    private readonly link: ReinforcementSceneLink,
  ) {
    const opening = [...link.ships.values()].map((ship) => ({
      id: ship.id,
      faction: ship.faction,
      definitionId: ship.definitionId,
      loadoutId: ship.loadoutId,
      owner: ship.owner,
    }));
    this.sides = sideOrder(link.playerFaction, opening);
    this.director = new ReinforcementDirector(
      buildDirectorSetup({
        setup,
        playerFaction: link.playerFaction,
        ships: opening,
        ownsOutcome: !link.hasScenario,
        nextShipId: (_faction, pilot) => this.issueId(pilot),
      }),
    );
    for (const reg of openingRegistrations(opening)) {
      this.director.registerInitial(
        reg.shipId,
        reg.faction,
        reg.option,
        reg.pilot,
      );
      this.alive.add(reg.shipId);
    }
    this.hud = new ReinforcementHud(scene, this.sides.length);
    this.picker = new ReinforcementPicker(scene, (index) => this.choose(index));
  }

  /** The match rules. */
  get rules(): ReinforcementRules {
    return this.director.rules;
  }

  /** Battle time left on the 3:00 clock (ms). */
  get remainingMs(): number {
    return this.director.remainingMs;
  }

  /** How the reinforcement rules ended the match, or null. */
  get result(): ReinforcedResult | null {
    return this.director.result;
  }

  /** Everything the battle shows and knows (e2e / telemetry). */
  get readout(): ReinforcementReadout {
    return buildReadout(this.director, this.hud.readout, this.picker.readout);
  }

  /**
   * One logic tick: losses, deployments, picker, HUD, end of match.
   * @param deltaMs - Tick length.
   * @param nowMs - Battle time.
   * @returns True (the reinforcement rules own victory, flee and the clock).
   */
  tick(deltaMs: number, nowMs: number): true {
    if (this.ended) return true;
    this.nowMs = nowMs;
    this.noteLosses();
    for (const deployment of this.director.tick(deltaMs))
      this.spawn(deployment);
    this.refreshViews();
    const result = this.director.result;
    if (result) {
      this.ended = true;
      this.picker.update(null);
      this.link.onEnd(result.winner === "player");
    }
    return true;
  }

  /**
   * The player picks a picker row (click, key 1–6, Enter, e2e).
   * @param index - Row index.
   * @returns Whether a ship deployed.
   */
  choose(index: number): boolean {
    if (this.ended) return false;
    const deployment = this.director.choose(index);
    if (!deployment) return false;
    this.spawn(deployment);
    this.refreshViews();
    return true;
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Battle time.
   * @returns Whether it is inside its arrival protection.
   */
  isShielded(shipId: string, nowMs: number): boolean {
    return this.shield.isProtected(shipId, nowMs);
  }

  /** @returns Where the camera looks while the player's ship is down, else null. */
  cameraFocus(): CameraFocus | null {
    if (this.director.playerShipId !== null) return null;
    const wingman = [...this.link.ships.values()].find(
      (s) =>
        s.hull > 0 && s.owner === "ai" && s.faction === this.link.playerFaction,
    );
    const at = wingman ?? this.pose(this.link.playerFaction, 0);
    return { x: at.x, y: at.y, control: { speed: 1 } };
  }

  /** @returns Whether each scenario side can still field a ship. */
  reserves(): Readonly<Record<ScenarioSide, boolean>> {
    return {
      player: this.director.canField("player"),
      enemy: this.director.canField("enemy"),
    };
  }

  /** @returns Extra end-screen content (reinforcement points, deploys, pool left, DRAW). */
  endOverlayExtras(): EndOverlayExtras {
    return endOverlayExtras(this.director.matchStats(), this.director.result);
  }

  /** @returns Flat telemetry fields for the end of the match. */
  telemetryDetails(): Record<string, number | string> {
    return telemetryDetails({
      stats: this.director.matchStats(),
      result: this.director.result,
      format: this.director.rules.format,
      elapsedMs: this.director.elapsedMs,
    });
  }

  /** The match is over: close the picker, hide the panel; under a scenario result, add the summary. */
  finish(): void {
    this.ended = true;
    this.picker.update(null);
    this.hud.setVisible(false);
    if (this.link.hasScenario)
      showSummaryStrip(this.scene, endDetails(this.director.matchStats()));
  }

  /** @param visible - Show or hide the panel and picker (pause). */
  setHudVisible(visible: boolean): void {
    this.hud.setVisible(visible);
    this.picker.setVisible(visible);
  }

  /** Debug hook (e2e): move the 3:00 clock on. @param ms - Battle time to skip. */
  debugAdvanceClock(ms: number): void {
    this.director.debugAdvanceClock(ms);
  }

  /** Debug hook (e2e): destroy a ship. @param shipId - The ship. */
  debugDestroy(shipId: string): void {
    const ship = this.link.ships.get(shipId);
    if (ship) ship.hull = ship.shields = 0;
  }

  /** Destroy the views. */
  destroy(): void {
    this.hud.destroy();
    this.picker.destroy();
    this.shield.clear();
  }

  private noteLosses(): void {
    for (const id of [...this.alive]) {
      const ship = this.link.ships.get(id);
      if (ship && ship.hull > 0) continue;
      // The picker's buttons hit-test correctly only at zoom 1.
      if (id === this.director.playerShipId) this.scene.cameras.main.setZoom(1);
      this.alive.delete(id);
      this.shield.forget(id);
      this.director.shipDestroyed(id);
    }
  }

  private spawn(deployment: Deployment): void {
    const pose = this.pose(deployment.faction, deployment.slot);
    const ship = spawnArcadeShip({
      id: deployment.shipId,
      definitionId: deployment.option.definitionId,
      loadoutId: deployment.option.loadoutId,
      faction: deployment.faction as ArcadeShip["faction"],
      pilot: deployment.pilot,
      ...pose,
    });
    this.link.adopt(ship);
    this.alive.add(ship.id);
    this.shield.protect(
      ship.id,
      this.nowMs,
      this.director.rules.arrivalProtectionMs,
    );
    this.hud.notify(
      deployToast(deployment, this.link.playerFaction),
      this.scene.time.now,
    );
    matchStats.record({
      kind: "deploy",
      friendly: deployment.faction === this.link.playerFaction,
      count: 1,
    });
  }

  private pose(
    faction: string,
    slot: number,
  ): { x: number; y: number; angle: number } {
    return reinforcementPose({
      faction,
      slot,
      sides: this.sides,
      worldSize: this.link.worldSize,
      scenario: this.link.hasScenario,
    });
  }

  private refreshViews(): void {
    this.hud.update({
      sides: this.director.summaries(),
      preview: this.director.reservePreview(PREVIEW_COUNT),
      camera: this.scene.cameras.main,
      nowMs: this.scene.time.now,
    });
    this.picker.update(this.director.picker);
  }

  private issueId(pilot: Parameters<typeof freshShipId>[0]): string {
    const id = freshShipId(
      pilot,
      (candidate) =>
        this.link.ships.has(candidate) || this.issuedIds.has(candidate),
    );
    this.issuedIds.add(id);
    return id;
  }
}
