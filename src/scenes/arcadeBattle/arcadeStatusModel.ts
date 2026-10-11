/**
 * arcadeStatusModel — the Skirmish HUD's side panels as plain rows: the
 * match clock tone, the squad roster, flight-action readiness and the
 * commander's orders. Pure: no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import {
  canEmergencyRepair,
  canFireMainBeam,
  canRedirectPower,
  EMERGENCY_REPAIR_COOLDOWN_MS,
  MAIN_BEAM_CHARGE_DURATION_MS,
  MAIN_BEAM_COOLDOWN_MS,
  POWER_REDIRECT_COOLDOWN_MS,
  type CommanderOrders,
  type CrewRole,
} from "../../systems/ShipCrew";

/** Below this much match time the clock turns amber. */
export const CLOCK_WARNING_MS = 60_000;
/** Below this much match time the clock turns red. */
export const CLOCK_DANGER_MS = 30_000;
/** Status text shown for a ready action / order. */
export const READY_LABEL = "READY";

/** Colour tone of a HUD value. */
export type HudTone = "normal" | "warning" | "danger";

/**
 * @param remainingMs - Match time left.
 * @returns The clock's tone.
 */
export function matchClockTone(remainingMs: number): HudTone {
  if (remainingMs <= CLOCK_DANGER_MS) return "danger";
  if (remainingMs <= CLOCK_WARNING_MS) return "warning";
  return "normal";
}

/** One line of the crew panel. */
export interface StatusRow {
  /** Key binding, e.g. "Z". */
  readonly key: string;
  readonly label: string;
  /** "READY" or a countdown / progress. */
  readonly status: string;
  readonly ready: boolean;
}

/** Panel title per crew role. */
const CREW_TITLES: Readonly<Record<CrewRole, string>> = {
  pilot: "PILOT",
  gunner: "◎ GUNNER",
  commander: "★ COMMANDER",
};

/**
 * @param role - The player's crew role.
 * @returns The crew panel title.
 */
export function crewTitle(role: CrewRole): string {
  return CREW_TITLES[role];
}

/**
 * Flight actions with their readiness.
 *
 * @param control - The player's flight control state.
 * @returns K-turn, barrel roll and boost rows.
 */
export function actionRows(control: ShipControlState): StatusRow[] {
  return [
    cooldownRow("Z", "K-TURN", control.kturnCooldown),
    cooldownRow("←+→", "ROLL", control.barrelRollCooldown),
    cooldownRow("↑↑", "BOOST", control.boostCooldown),
  ];
}

/**
 * The commander's four orders with their state.
 *
 * @param orders - The capital ship's order state.
 * @param nowMs - Scene time (ms).
 * @returns Rows for keys 1–4.
 */
export function commanderOrderRows(
  orders: CommanderOrders,
  nowMs: number,
): StatusRow[] {
  const focus = orders.powerRedirect?.focus;
  return [
    { key: "1", label: "CONCENTRATE FIRE", status: READY_LABEL, ready: true },
    sinceRow(
      "2",
      focus ? `POWER → ${focus.toUpperCase()}` : "REDIRECT POWER",
      orders.lastPowerRedirectAt + POWER_REDIRECT_COOLDOWN_MS - nowMs,
      canRedirectPower(orders.lastPowerRedirectAt, nowMs),
    ),
    mainBeamRow(orders, nowMs),
    sinceRow(
      "4",
      "EMERGENCY REPAIR",
      orders.lastEmergencyRepairAt + EMERGENCY_REPAIR_COOLDOWN_MS - nowMs,
      canEmergencyRepair(orders.lastEmergencyRepairAt, nowMs),
    ),
  ];
}

function mainBeamRow(orders: CommanderOrders, nowMs: number): StatusRow {
  if (orders.mainBeam.charging) {
    const pct = Math.round(
      (orders.mainBeam.chargeMs / MAIN_BEAM_CHARGE_DURATION_MS) * 100,
    );
    return { key: "3", label: "MAIN BEAM", status: `${pct}%`, ready: false };
  }
  return sinceRow(
    "3",
    "MAIN BEAM",
    orders.lastMainBeamFiredAt + MAIN_BEAM_COOLDOWN_MS - nowMs,
    canFireMainBeam(orders.lastMainBeamFiredAt, nowMs),
  );
}

function cooldownRow(
  key: string,
  label: string,
  remainingMs: number,
): StatusRow {
  return sinceRow(key, label, remainingMs, remainingMs <= 0);
}

function sinceRow(
  key: string,
  label: string,
  remainingMs: number,
  ready: boolean,
): StatusRow {
  return {
    key,
    label,
    status: ready ? READY_LABEL : formatSeconds(remainingMs),
    ready,
  };
}

/**
 * @param ms - A duration.
 * @returns Seconds with one decimal under 10 s, whole seconds above.
 */
export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.ceil(seconds)}s`;
}

/** What the roster reads of a ship. */
export interface RosterShipView {
  readonly id: string;
  readonly faction: string;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
}

/** One ship's pip in the roster. */
export interface RosterPip {
  readonly hullFraction: number;
  readonly shieldFraction: number;
  readonly alive: boolean;
  readonly isPlayer: boolean;
}

/** One faction's row in the roster. */
export interface RosterTeam {
  readonly factionId: string;
  readonly label: string;
  readonly isPlayerSide: boolean;
  readonly pips: ReadonlyArray<RosterPip>;
}

/**
 * Ships grouped by faction, the player's side first.
 *
 * @param ships - Every ship in the battle (dead ones show as empty pips).
 * @param playerFaction - The player's faction.
 * @param playerId - The player's ship id.
 * @returns One team per faction.
 */
export function rosterTeams(
  ships: Iterable<RosterShipView>,
  playerFaction: string,
  playerId: string | null,
): RosterTeam[] {
  const byFaction = new Map<string, RosterPip[]>();
  for (const ship of ships) {
    const pips = byFaction.get(ship.faction) ?? [];
    pips.push({
      hullFraction: fraction(ship.hull, ship.maxHull),
      shieldFraction: fraction(ship.shields, ship.maxShields),
      alive: ship.hull > 0,
      isPlayer: ship.id === playerId,
    });
    byFaction.set(ship.faction, pips);
  }
  const teams = [...byFaction].map(([factionId, pips]) => ({
    factionId,
    label: factionId.replace(/_/g, " ").toUpperCase(),
    isPlayerSide: factionId === playerFaction,
    pips,
  }));
  return teams.sort((a, b) => Number(b.isPlayerSide) - Number(a.isPlayerSide));
}

function fraction(value: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}
