/**
 * heroPowerEffects — resolves a hero power activation against the battle
 * into plain commands (damage, repair, statuses, spawns, teleports, mines,
 * delayed strikes, visual cues). The battle scene applies them; nothing here
 * touches Phaser. Pure.
 */

import {
  distanceBetween,
  withinRange,
} from "../../arcade/objectives/objectiveGeometry";
import type { ObjectivePoint } from "../../arcade/objectives";
import type { HeroPowerActivation } from "./heroPowerState";
import type { HeroPowerEffect } from "./heroPowerTypes";
import { ENEMY_SIDE_KEY, type StatusKind } from "./statusEffects";

/** Distance ahead of the flagship a target-less strike lands (px). */
export const STRIKE_FALLBACK_DISTANCE = 400;
/** Lateral spacing of fabricated drones (px). */
const DRONE_SPACING = 60;
/** Weapons-disabled status value (a flag). */
const FLAG_VALUE = 1;

/** A ship as powers see it. */
export interface PowerShipView {
  readonly id: string;
  readonly side: "player" | "enemy";
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise. */
  readonly angle: number;
}

/** The battle as powers see it. */
export interface PowerWorld {
  readonly flagship: PowerShipView;
  /** Every living ship (flagship included). */
  readonly ships: readonly PowerShipView[];
  /** The player's mark, else the HUD target. */
  readonly focusTargetId: string | null;
  readonly worldSize: number;
}

/** What the scene must do. */
export type PowerCommand =
  | {
      readonly cmd: "strike";
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly damage: number;
      readonly delayMs: number;
    }
  | {
      readonly cmd: "damage";
      readonly shipId: string;
      readonly amount: number;
      readonly ignoreShields: boolean;
    }
  | {
      readonly cmd: "repair";
      readonly shipId: string;
      readonly hullFraction: number;
    }
  | { readonly cmd: "refillShields"; readonly shipId: string }
  | { readonly cmd: "stripShields"; readonly shipId: string }
  | { readonly cmd: "stress"; readonly shipId: string; readonly amount: number }
  | {
      readonly cmd: "status";
      readonly shipId: string;
      readonly kind: StatusKind;
      readonly value: number;
      readonly durationMs: number;
    }
  | {
      readonly cmd: "spawnDrones";
      readonly shipId: string;
      readonly count: number;
      readonly lifetimeMs: number;
      readonly points: readonly ObjectivePoint[];
    }
  | {
      readonly cmd: "teleport";
      readonly shipId: string;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly cmd: "mines";
      readonly points: readonly ObjectivePoint[];
      readonly damage: number;
    }
  | {
      readonly cmd: "fx";
      readonly kind: string;
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    };

/**
 * @param ship - A ship.
 * @param distance - Distance along its heading (negative = behind).
 * @returns The point that far ahead.
 */
function ahead(ship: PowerShipView, distance: number): ObjectivePoint {
  const radians = (ship.angle * Math.PI) / 180;
  return {
    x: ship.x + Math.sin(radians) * distance,
    y: ship.y - Math.cos(radians) * distance,
  };
}

/**
 * @param ships - Ships.
 * @param at - Blast centre.
 * @param radius - Blast radius.
 * @param side - Side harmed.
 * @param worldSize - Torus side.
 * @returns Ships of that side caught by the blast.
 */
export function strikeVictims<T extends PowerShipView>(
  ships: readonly T[],
  at: ObjectivePoint,
  radius: number,
  side: "player" | "enemy",
  worldSize: number,
): T[] {
  return ships.filter(
    (s) => s.side === side && withinRange(s, at, radius, worldSize),
  );
}

/**
 * @param world - The battle.
 * @param range - Max distance from the flagship.
 * @returns The focus target if in range, else the nearest enemy in range.
 */
function targetInRange(world: PowerWorld, range: number): PowerShipView | null {
  const { flagship, worldSize } = world;
  const focus = world.ships.find(
    (s) => s.id === world.focusTargetId && s.side === "enemy",
  );
  if (focus && distanceBetween(flagship, focus, worldSize) <= range)
    return focus;
  const inRange = world.ships
    .filter(
      (s) =>
        s.side === "enemy" && distanceBetween(flagship, s, worldSize) <= range,
    )
    .sort(
      (a, b) =>
        distanceBetween(flagship, a, worldSize) -
        distanceBetween(flagship, b, worldSize),
    );
  return inRange[0] ?? null;
}

/**
 * @param effect - Effect being cast.
 * @param world - The battle.
 * @returns Commands for area / support effects.
 */
function supportCommands(
  effect: HeroPowerEffect,
  world: PowerWorld,
): PowerCommand[] | null {
  const { flagship, worldSize } = world;
  const allies = (radius: number): PowerShipView[] =>
    world.ships.filter(
      (s) => s.side === "player" && withinRange(s, flagship, radius, worldSize),
    );
  switch (effect.kind) {
    case "shield_overcharge":
      return [
        { cmd: "refillShields", shipId: flagship.id },
        {
          cmd: "status",
          shipId: flagship.id,
          kind: "damage_taken",
          value: effect.damageTakenMultiplier,
          durationMs: effect.durationMs,
        },
      ];
    case "rally":
      return allies(effect.radius).map((s) => ({
        cmd: "status",
        shipId: s.id,
        kind: "attack_interval",
        value: effect.intervalMultiplier,
        durationMs: effect.durationMs,
      }));
    case "field_repair":
      return allies(effect.radius).map((s) => ({
        cmd: "repair",
        shipId: s.id,
        hullFraction:
          s.id === flagship.id
            ? effect.selfHullFraction
            : effect.allyHullFraction,
      }));
    case "drone_swarm": {
      const points = Array.from({ length: effect.count }, (_, i) =>
        ahead(
          { ...flagship, angle: flagship.angle + 90 },
          (i - (effect.count - 1) / 2) * DRONE_SPACING,
        ),
      );
      return [
        {
          cmd: "spawnDrones",
          shipId: effect.shipId,
          count: effect.count,
          lifetimeMs: effect.lifetimeMs,
          points,
        },
      ];
    }
    case "time_slow":
      return [
        {
          cmd: "status",
          shipId: ENEMY_SIDE_KEY,
          kind: "time_scale",
          value: effect.enemyTimeScale,
          durationMs: effect.durationMs,
        },
      ];
    default:
      return null;
  }
}

/**
 * @param effect - Effect being cast.
 * @param world - The battle.
 * @returns Commands for offensive / movement effects.
 */
function strikeCommands(
  effect: HeroPowerEffect,
  world: PowerWorld,
): PowerCommand[] {
  const { flagship, worldSize } = world;
  switch (effect.kind) {
    case "orbital_strike": {
      const focus = world.ships.find(
        (s) => s.id === world.focusTargetId && s.side === "enemy",
      );
      const at = focus ?? ahead(flagship, STRIKE_FALLBACK_DISTANCE);
      return [
        {
          cmd: "strike",
          x: at.x,
          y: at.y,
          radius: effect.radius,
          damage: effect.damage,
          delayMs: effect.delayMs,
        },
      ];
    }
    case "emp_burst":
      return strikeVictims(
        world.ships,
        flagship,
        effect.radius,
        "enemy",
        worldSize,
      ).flatMap((s): PowerCommand[] => [
        { cmd: "stripShields", shipId: s.id },
        { cmd: "stress", shipId: s.id, amount: effect.stress },
        {
          cmd: "status",
          shipId: s.id,
          kind: "weapons_disabled",
          value: FLAG_VALUE,
          durationMs: effect.disableMs,
        },
      ]);
    case "cloak_dash": {
      const to = ahead(flagship, effect.distance);
      return [
        { cmd: "teleport", shipId: flagship.id, x: to.x, y: to.y },
        {
          cmd: "status",
          shipId: flagship.id,
          kind: "cloaked",
          value: FLAG_VALUE,
          durationMs: effect.durationMs,
        },
      ];
    }
    case "scatter_mines": {
      const points = Array.from({ length: effect.count }, (_, i) =>
        ahead(flagship, -(i + 1) * effect.spacing),
      );
      return [{ cmd: "mines", points, damage: effect.damage }];
    }
    case "psionic_lance": {
      const target = targetInRange(world, effect.range);
      return target
        ? [
            {
              cmd: "damage",
              shipId: target.id,
              amount: effect.damage,
              ignoreShields: true,
            },
          ]
        : [];
    }
    default:
      return [];
  }
}

/**
 * Resolves a cast into commands (plus a visual cue at the flagship).
 *
 * @param activation - The cast.
 * @param world - The battle.
 * @returns Commands for the scene, in order.
 */
export function resolveHeroPower(
  activation: HeroPowerActivation,
  world: PowerWorld,
): PowerCommand[] {
  const { effect } = activation;
  const commands =
    supportCommands(effect, world) ?? strikeCommands(effect, world);
  return [
    ...commands,
    {
      cmd: "fx",
      kind: effect.kind,
      x: world.flagship.x,
      y: world.flagship.y,
      radius: "radius" in effect ? effect.radius : 0,
    },
  ];
}
