/**
 * battleTypes — the contract between the Campaign battle scene and the
 * mission director: the ship fields the director reads, spawn requests, and
 * the bridge of scene operations it may call.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import type { EffectsManager } from "../../rendering/EffectsManager";

/** A battle ship as the director reads it. */
export interface BattleShipView {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly tags: readonly string[];
  /** Moved by an objective, not flown. */
  readonly scripted: boolean;
  readonly flight: CycleFlightState;
}

/** A ship the director wants on the field. */
export interface BattleSpawnRequest {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly pose: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
  readonly tags: readonly string[];
  readonly hullScale: number;
  readonly scripted: boolean;
  /** Flown by a bot pilot (else static / objective-driven). */
  readonly piloted: boolean;
  readonly isAce: boolean;
  readonly isBoss: boolean;
  /** Removed after this long (summoned drones), or null. */
  readonly lifetimeMs: number | null;
}

/** Scene operations the director may call. */
export interface CampaignBattleBridge {
  readonly scene: Phaser.Scene;
  readonly factionId: FactionId;
  readonly worldSize: number;
  ships(): Iterable<BattleShipView>;
  ship(id: string): BattleShipView | undefined;
  /** The player's flagship, or null when it is gone. */
  flagship(): BattleShipView | null;
  /** The player's mark, else the flagship's HUD target. */
  focusTargetId(): string | null;
  spawn(request: BattleSpawnRequest): void;
  /** Removes a ship without kill credit (expired drones). */
  remove(id: string): void;
  /** Damage (through shields unless told otherwise); destroys it at 0 hull. */
  damage(id: string, amount: number, ignoreShields: boolean): void;
  repair(id: string, hullAmount: number): void;
  setShields(id: string, shields: number): void;
  addStress(id: string, amount: number): void;
  setPose(id: string, x: number, y: number, angle: number): void;
  banner(title: string, subtitle: string): void;
  effects(): EffectsManager;
}
