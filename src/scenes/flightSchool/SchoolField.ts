/**
 * SchoolField — the ships on the Flight School range for the current lesson
 * scenario: the player alone, an indestructible drone ahead, a friendly
 * beacon behind, or one novice bot (the final exam) — plus the DuelBotCrew
 * that holds squad marks and flies the bot.
 */

import Phaser from "phaser";
import { BATTLEFIELD_SIZE } from "../../config";
import { TRAINING_SKILL } from "../../arcade/ai/BotDifficulty";
import { DuelBotCrew } from "../../arcade/systems/DuelBotCrew";
import type { FlightSchoolScenario } from "../../tutorial/FlightSchoolSteps";
import { random } from "../../utils/random";
import {
  destroySchoolShip,
  poseFromPlayer,
  spawnSchoolShip,
  type SchoolRole,
  type SchoolShip,
} from "./schoolShips";

/** Spawn layout per scenario (px, degrees relative to the player). */
const LAYOUT = {
  /**
   * Drone distance as a fraction of the player's primary range. The drone
   * flies straight ahead at cruise speed like a towed target: the lesson is
   * keeping it inside the forward arc.
   */
  droneRangeFraction: 0.6,
  /** Just past the top of the screen behind the player (half-height 360). */
  beacon: { distance: 650, bearing: 180 },
  bot: { distance: 700, bearing: 0, facing: 180 },
} as const;

/** Side keys of the course. */
const PLAYER_SIDE = "player";
const AI_SIDE = "ai";

/** Ships and squad layer for the current lesson. */
export class SchoolField {
  readonly ships = new Map<string, SchoolShip>();
  private scenarioNow: FlightSchoolScenario | null = null;
  private crewNow: DuelBotCrew | null = null;

  /** @param scene - Flight School scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.spawnPlayer();
  }

  /** The player's ship. */
  get player(): SchoolShip {
    const ship = this.ships.get("player_0");
    if (!ship) throw new Error("SchoolField: player ship missing");
    return ship;
  }

  /** The squad layer (marks, bot), rebuilt per scenario. */
  get crew(): DuelBotCrew | null {
    return this.crewNow;
  }

  /** @returns Living final-exam bots. */
  enemiesAlive(): number {
    return [...this.ships.values()].filter(
      (s) => s.role === "bot" && s.hull > 0,
    ).length;
  }

  /**
   * Set up a lesson's scenario (no-op when it is already set up).
   *
   * @param scenario - The lesson's scenario.
   */
  setScenario(scenario: FlightSchoolScenario): void {
    if (scenario === this.scenarioNow) return;
    this.scenarioNow = scenario;
    for (const ship of [...this.ships.values()]) {
      if (ship.role === "player") continue;
      destroySchoolShip(ship);
      this.ships.delete(ship.id);
    }
    if (scenario !== "open_space") this.spawnPlayer();
    if (scenario === "drone")
      this.addRelative("drone", this.droneDistance(), 0, 0);
    if (scenario === "beacon")
      this.addRelative(
        "beacon",
        LAYOUT.beacon.distance,
        LAYOUT.beacon.bearing,
        0,
      );
    if (scenario === "bot")
      this.addRelative(
        "bot",
        LAYOUT.bot.distance,
        LAYOUT.bot.bearing,
        LAYOUT.bot.facing,
      );
    this.crewNow = this.createCrew();
  }

  /** Put the player back at the range centre at full strength. */
  spawnPlayer(): void {
    const existing = this.ships.get("player_0");
    if (existing) destroySchoolShip(existing);
    const centre = BATTLEFIELD_SIZE / 2;
    const ship = spawnSchoolShip(this.scene, "player", {
      x: centre,
      y: centre,
      angle: 0,
    });
    this.ships.set(ship.id, ship);
  }

  /**
   * @param camera - Main camera.
   * @returns Whether the beacon is inside the camera view.
   */
  beaconOnScreen(camera: Phaser.Cameras.Scene2D.Camera): boolean {
    const beacon = this.ships.get("beacon");
    return (
      beacon !== undefined && camera.worldView.contains(beacon.x, beacon.y)
    );
  }

  private droneDistance(): number {
    return this.player.combatStats.weaponRange * LAYOUT.droneRangeFraction;
  }

  private addRelative(
    role: SchoolRole,
    distance: number,
    bearing: number,
    facing: number,
  ): void {
    const ship = spawnSchoolShip(
      this.scene,
      role,
      poseFromPlayer(this.player, distance, bearing, facing),
    );
    this.ships.set(ship.id, ship);
  }

  private createCrew(): DuelBotCrew {
    const novice = TRAINING_SKILL;
    return new DuelBotCrew({
      roster: [...this.ships.values()]
        .filter((ship) => ship.role !== "beacon")
        .map((ship) => ({
          shipId: ship.id,
          side: ship.owner === "player" ? PLAYER_SIDE : AI_SIDE,
          skill: ship.role === "bot" ? novice : null,
        })),
      playerSide: PLAYER_SIDE,
      random: () => random.next(),
      worldSize: BATTLEFIELD_SIZE,
    });
  }
}
