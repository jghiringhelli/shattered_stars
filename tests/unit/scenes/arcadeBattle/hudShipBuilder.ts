/**
 * Test-data builder for the Skirmish HUD's ship view.
 */

import { createControlState } from "../../../../src/core/ArcadeControls";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { HudShipView } from "../../../../src/scenes/arcadeBattle/arcadeHudModel";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Builds a HudShipView with sensible defaults; override only what matters. */
export class HudShipBuilder {
  private ship: Mutable<HudShipView>;

  private constructor(id: string, faction: string, team: number) {
    const pose = { x: 1000, y: 1000, angle: 0 };
    this.ship = {
      id,
      faction,
      team,
      definitionId: "confed_kestrel",
      ...pose,
      hull: 12,
      maxHull: 12,
      shields: 4,
      maxShields: 4,
      isCloaked: false,
      stress: INITIAL_STRESS,
      control: createControlState(pose, 32),
    };
  }

  /** @returns A player-side ship. */
  static aPlayer(id = "player_0"): HudShipBuilder {
    return new HudShipBuilder(id, "free_confederation", 0);
  }

  /** @returns An enemy ship. */
  static anEnemy(id = "enemy_0"): HudShipBuilder {
    return new HudShipBuilder(id, "void_corsairs", 1);
  }

  at(x: number, y: number, angle = 0): this {
    this.ship.x = x;
    this.ship.y = y;
    this.ship.angle = angle;
    return this;
  }

  withHull(hull: number, maxHull = this.ship.maxHull): this {
    this.ship.hull = hull;
    this.ship.maxHull = maxHull;
    return this;
  }

  withShields(shields: number, maxShields = this.ship.maxShields): this {
    this.ship.shields = shields;
    this.ship.maxShields = maxShields;
    return this;
  }

  onTeam(team: number): this {
    this.ship.team = team;
    return this;
  }

  ofFaction(faction: string): this {
    this.ship.faction = faction;
    return this;
  }

  cloaked(): this {
    this.ship.isCloaked = true;
    return this;
  }

  stressed(level = 0.9): this {
    this.ship.stress = { level, isStressed: true };
    return this;
  }

  withControl(patch: Partial<HudShipView["control"]>): this {
    this.ship.control = { ...this.ship.control, ...patch };
    return this;
  }

  build(): HudShipView {
    return { ...this.ship };
  }
}
