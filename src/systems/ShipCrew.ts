/**
 * ShipCrew — multi-seat crew roles for player-controlled ships.
 *
 * Small/medium ships: solo pilot (the default, unchanged).
 * Large ships ("Millennium Falcon" style, one turret): pilot + gunner.
 * Capital-role ships: pilot + gunner + commander.
 *
 * The commander doesn't fly or shoot directly — they issue ship-wide orders
 * that reuse the capital's engines/turrets/bridge subsystem model:
 * concentrate fire (bonus damage against a called target), redirect power
 * (buff one subsystem while it's focused), charge the main beam (a slow,
 * heavy directional shot), and an emergency repair order.
 */

export type CrewRole = "pilot" | "gunner" | "commander";

/** Which crew roles a given ship supports, in cycle order. */
export function getAvailableCrewRoles(
  hasTurret: boolean,
  isCapital: boolean,
): readonly CrewRole[] {
  const roles: CrewRole[] = ["pilot"];
  if (hasTurret) roles.push("gunner");
  if (isCapital) roles.push("commander");
  return roles;
}

/** Cycles to the next role a ship supports, wrapping back to the first. */
export function nextCrewRole(
  current: CrewRole,
  available: readonly CrewRole[],
): CrewRole {
  if (available.length === 0) return "pilot";
  const idx = available.indexOf(current);
  return available[(idx + 1) % available.length] ?? available[0]!;
}

// ============================================
// Concentrate Fire — bonus damage against a called target
// ============================================

export interface ConcentrateFireOrder {
  readonly targetId: string;
  readonly expiresAt: number;
}

export const CONCENTRATE_FIRE_DURATION_MS = 8000;
export const CONCENTRATE_FIRE_DAMAGE_BONUS = 0.25;

export function issueConcentrateFire(
  targetId: string,
  now: number,
): ConcentrateFireOrder {
  return { targetId, expiresAt: now + CONCENTRATE_FIRE_DURATION_MS };
}

/** Damage multiplier for a shot against `targetId` given the current order (1 = no bonus). */
export function concentrateFireMultiplier(
  order: ConcentrateFireOrder | null,
  targetId: string,
  now: number,
): number {
  if (order && order.targetId === targetId && now < order.expiresAt) {
    return 1 + CONCENTRATE_FIRE_DAMAGE_BONUS;
  }
  return 1;
}

// ============================================
// Redirect Power — temporarily focus output on one subsystem
// ============================================

export type PowerFocus = "engines" | "turrets" | "shields";

export interface PowerRedirect {
  readonly focus: PowerFocus;
  readonly expiresAt: number;
}

const POWER_FOCUS_CYCLE: readonly PowerFocus[] = [
  "engines",
  "turrets",
  "shields",
];
export const POWER_REDIRECT_DURATION_MS = 10000;
export const POWER_REDIRECT_COOLDOWN_MS = 15000;
export const POWER_REDIRECT_TURRET_MULTIPLIER = 1.5;
export const POWER_REDIRECT_ENGINE_REPAIR_PER_SEC = 2;
export const POWER_REDIRECT_SHIELD_REGEN_PER_SEC = 2;

export function nextPowerFocus(current: PowerFocus | null): PowerFocus {
  if (current === null) return POWER_FOCUS_CYCLE[0]!;
  const idx = POWER_FOCUS_CYCLE.indexOf(current);
  return POWER_FOCUS_CYCLE[(idx + 1) % POWER_FOCUS_CYCLE.length]!;
}

export function redirectPower(focus: PowerFocus, now: number): PowerRedirect {
  return { focus, expiresAt: now + POWER_REDIRECT_DURATION_MS };
}

export function isPowerFocused(
  redirect: PowerRedirect | null,
  focus: PowerFocus,
  now: number,
): boolean {
  return (
    redirect !== null && redirect.focus === focus && now < redirect.expiresAt
  );
}

export function canRedirectPower(lastIssuedAt: number, now: number): boolean {
  return now - lastIssuedAt >= POWER_REDIRECT_COOLDOWN_MS;
}

// ============================================
// Main Beam — charge-then-fire heavy directional shot
// ============================================

export interface MainBeamState {
  readonly charging: boolean;
  readonly chargeMs: number;
}

export const MAIN_BEAM_CHARGE_DURATION_MS = 1000;
export const MAIN_BEAM_DAMAGE = 15;
export const MAIN_BEAM_COOLDOWN_MS = 12000;

export function createMainBeamState(): MainBeamState {
  return { charging: false, chargeMs: 0 };
}

export function startCharging(state: MainBeamState): MainBeamState {
  return state.charging ? state : { charging: true, chargeMs: 0 };
}

export function tickMainBeam(
  state: MainBeamState,
  deltaMs: number,
): MainBeamState {
  if (!state.charging) return state;
  return {
    charging: true,
    chargeMs: Math.min(MAIN_BEAM_CHARGE_DURATION_MS, state.chargeMs + deltaMs),
  };
}

export function isMainBeamReady(state: MainBeamState): boolean {
  return state.charging && state.chargeMs >= MAIN_BEAM_CHARGE_DURATION_MS;
}

export function resetMainBeam(): MainBeamState {
  return createMainBeamState();
}

// ============================================
// Emergency Repair — instant burst heal, on cooldown
// ============================================

export const EMERGENCY_REPAIR_COOLDOWN_MS = 20000;
export const EMERGENCY_REPAIR_SHIELD_AMOUNT = 5;
export const EMERGENCY_REPAIR_HULL_AMOUNT = 8;

export function canEmergencyRepair(lastUsedAt: number, now: number): boolean {
  return now - lastUsedAt >= EMERGENCY_REPAIR_COOLDOWN_MS;
}

// ============================================
// Composite per-ship commander state
// ============================================

export interface CommanderOrders {
  concentrateFire: ConcentrateFireOrder | null;
  powerRedirect: PowerRedirect | null;
  lastPowerRedirectAt: number;
  mainBeam: MainBeamState;
  lastMainBeamFiredAt: number;
  lastEmergencyRepairAt: number;
}

export function createCommanderOrders(): CommanderOrders {
  return {
    concentrateFire: null,
    powerRedirect: null,
    lastPowerRedirectAt: -Infinity,
    mainBeam: createMainBeamState(),
    lastMainBeamFiredAt: -Infinity,
    lastEmergencyRepairAt: -Infinity,
  };
}

export function canFireMainBeam(lastFiredAt: number, now: number): boolean {
  return now - lastFiredAt >= MAIN_BEAM_COOLDOWN_MS;
}
