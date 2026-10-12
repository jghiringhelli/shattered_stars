/**
 * weaponTypes — data contracts between the shared secondary-weapons
 * runtime (SecondaryWeapons) and the battle scenes and bots that use it.
 * Plain readonly data: no behaviour.
 */

import type { Arsenal } from "./Arsenal";
import type { DeviceKind, LauncherKind, SecondaryKind } from "./weaponSpecs";

/** A ship as the weapons see it (scene glue maps its records to these). */
export interface WeaponBody {
  readonly id: string;
  /** Side key: ships of another side are hostile. */
  readonly side: string;
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise. */
  readonly angle: number;
  /** ≤ 0 = destroyed. */
  readonly hull: number;
  /** Defence dice for the turret's hit roll (ModeCombatStats.agilityDice). */
  readonly agilityDice: number;
  /** Incoming damage multiplier (mitigation, auras); default 1. */
  readonly damageTaken?: number;
  /** Flat damage removed from each hit (ship armour); default 0. */
  readonly armor?: number;
  /** Hit radius of the hull (px); default the fighter radius. */
  readonly hitRadiusPx?: number;
}

/** What the runtime reads from the battle each frame. */
export interface WeaponWorld {
  /** Every ship on the field (destroyed ones are skipped). */
  bodies(): Iterable<WeaponBody>;
  /** The target this ship's pilot wants (HUD target, bot target), or null. */
  wantedTargetOf(shipId: string): string | null;
  /** True when a bot (not the human) flies this ship. */
  isBotControlled(shipId: string): boolean;
}

/** Why FIRE_SECONDARY did or did not fire. */
export type FireOutcome =
  | "launched"
  | "dropped"
  | "no_weapon"
  | "empty"
  | "reloading"
  | "no_target"
  | "locking"
  | "out_of_arc"
  | "out_of_range"
  /** This attacker already attacked the target this cycle (HitImmunityLedger). */
  | "attacked";

/** Something the scene should apply or show. */
export type WeaponEvent =
  | {
      readonly kind: "launch";
      readonly shipId: string;
      readonly weapon: LauncherKind;
      readonly targetId: string;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: "drop";
      readonly shipId: string;
      readonly weapon: DeviceKind;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: "turret";
      readonly shipId: string;
      readonly targetId: string;
      readonly hit: boolean;
      readonly fromX: number;
      readonly fromY: number;
      readonly toX: number;
      readonly toY: number;
    }
  | {
      readonly kind: "hit";
      readonly attackerId: string;
      readonly targetId: string;
      readonly weapon: SecondaryKind | "turret";
      /** Final damage: shields first, then hull. */
      readonly damage: number;
      /** Stress (0–1) to add to the target's pilot. */
      readonly stress: number;
    }
  | {
      readonly kind: "blast";
      readonly ownerId: string;
      readonly weapon: DeviceKind;
      readonly x: number;
      readonly y: number;
      readonly radiusPx: number;
    }
  | {
      readonly kind: "cloak";
      readonly shipId: string;
      readonly cloaked: boolean;
    };

/** One frame's lookups for firing decisions (runtime-internal). */
export interface FireFrame {
  readonly world: WeaponWorld;
  readonly bodies: ReadonlyMap<string, WeaponBody>;
  readonly nowMs: number;
}

/** What a bot sees when it decides on ordnance. */
export interface OrdnanceView {
  readonly self: WeaponBody;
  readonly arsenal: Readonly<Arsenal>;
  /** The enemy its pilot is after, if alive. */
  readonly target: WeaponBody | null;
  /** Living hostile ships. */
  readonly enemies: readonly WeaponBody[];
  /** Living ships of its own side (itself excluded). */
  readonly allies: readonly WeaponBody[];
  readonly worldSize: number;
}

/** A bot's ordnance choice this frame. */
export type OrdnanceDecision =
  | { readonly kind: "fire"; readonly slot: number }
  | { readonly kind: "cloak" }
  | null;

/** Decides a bot's ordnance use (src/arcade/ai/OrdnanceDecision). */
export type OrdnanceDecider = (view: OrdnanceView) => OrdnanceDecision;
