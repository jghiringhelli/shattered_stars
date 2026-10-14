/**
 * arcadeStatusModel — the Skirmish HUD's side panels as plain rows: the
 * match clock tone, the squad roster, flight-action readiness and the
 * commander's orders. Pure: no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import type { TeamId } from "../../arcade/teams";
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
 * @returns Snap turn, barrel roll and boost rows.
 */
export function actionRows(control: ShipControlState): StatusRow[] {
  return [
    cooldownRow("Z", "SNAP", control.kturnCooldown),
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
  readonly team: TeamId;
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

/** One team's row in the roster. */
export interface RosterTeam {
  readonly team: TeamId;
  /** Factions flying for it, in order of appearance. */
  readonly factions: readonly string[];
  /** "▲ TERRAN HEGEMONY" (▼ for other teams; mixed teams "▲ HEGEMONY + CORSAIRS"). */
  readonly label: string;
  readonly isPlayerSide: boolean;
  readonly pips: ReadonlyArray<RosterPip>;
}

/** Side glyphs of a roster row: the label never relies on colour alone. */
const ALLY_GLYPH = "▲";
const ENEMY_GLYPH = "▼";

/**
 * Pips a team keeps at most while some are fallen ships: one roster line
 * (184 px panel − 2 × 12 px padding, 14 px per pip). Reinforcement battles
 * deploy many ships; the oldest fallen pips go first, living ships stay.
 */
export const ROSTER_MAX_PIPS = 11;

/**
 * Ships grouped by team, the player's team first.
 *
 * @param ships - Every ship in the battle (dead ones show as empty pips,
 *   the oldest dropped past {@link ROSTER_MAX_PIPS}).
 * @param playerTeam - The viewer's team.
 * @param playerId - The player's ship id.
 * @returns One row per team.
 */
export function rosterTeams(
  ships: Iterable<RosterShipView>,
  playerTeam: TeamId,
  playerId: string | null,
): RosterTeam[] {
  const byTeam = new Map<TeamId, { factions: string[]; pips: RosterPip[] }>();
  for (const ship of ships) {
    const row = byTeam.get(ship.team) ?? { factions: [], pips: [] };
    if (!row.factions.includes(ship.faction)) row.factions.push(ship.faction);
    row.pips.push({
      hullFraction: fraction(ship.hull, ship.maxHull),
      shieldFraction: fraction(ship.shields, ship.maxShields),
      alive: ship.hull > 0,
      isPlayer: ship.id === playerId,
    });
    byTeam.set(ship.team, row);
  }
  const teams = [...byTeam].map(([team, row]) => ({
    team,
    factions: row.factions,
    label: rosterLabel(row.factions, team === playerTeam),
    isPlayerSide: team === playerTeam,
    pips: withoutOldestFallen(row.pips),
  }));
  return teams.sort((a, b) => Number(b.isPlayerSide) - Number(a.isPlayerSide));
}

/**
 * @param factions - A team's factions.
 * @param isPlayerSide - Whether it is the viewer's team.
 * @returns Its row label: glyph, then the faction (full name alone, short names mixed).
 */
function rosterLabel(
  factions: readonly string[],
  isPlayerSide: boolean,
): string {
  const words = factions.map((f) => f.replace(/_/g, " ").toUpperCase());
  const name =
    words.length === 1
      ? words[0]!
      : words.map((w) => w.split(" ").pop()!).join(" + ");
  return `${isPlayerSide ? ALLY_GLYPH : ENEMY_GLYPH} ${name}`;
}

/** @returns The pips minus the oldest fallen ones past {@link ROSTER_MAX_PIPS}. */
function withoutOldestFallen(pips: readonly RosterPip[]): RosterPip[] {
  let excess = pips.length - ROSTER_MAX_PIPS;
  return pips.filter((pip) => {
    if (excess <= 0 || pip.alive) return true;
    excess--;
    return false;
  });
}

function fraction(value: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}
