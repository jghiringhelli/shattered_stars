/**
 * Knob probes — for every CombatModifiers knob, a check that drives the
 * SHARED consumer every battle mode calls and reports whether the sheet
 * changed its outcome (vs a neutral sheet). Typed over every key: a new
 * knob cannot ship without a consumer probe.
 */

import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../../src/core/CombatModifiers";
import {
  resolveDiceAttack,
  type DiceAttackInput,
} from "../../../src/arcade/systems/DiceAttack";
import { damageMitigationOf } from "../../../src/arcade/systems/DamageRules";
import { repairStep } from "../../../src/arcade/systems/repair/HullRepair";
import {
  equipFlight,
  stressModifiersOf,
} from "../../../src/arcade/systems/QuickBuildEquip";
import { createCycleFlight } from "../../../src/arcade/systems/CycleFlight";
import { createArsenal } from "../../../src/arcade/weapons/Arsenal";
import { conditionalLaserBonus } from "../../../src/arcade/ShotConditions";
import {
  deathBlastTargets,
  rewardKill,
  type AbilityCombatant,
} from "../../../src/arcade/PilotAbilityCombat";
import { INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";
import { auraFactsOf } from "../../../src/systems/aura/AuraShipFacts";
import {
  FACTION_AURAS,
  resolveSupportAuras,
  type AuraShip,
} from "../../../src/systems/SupportAura";
import type { FactionId } from "../../../src/config";

type Probe = (sheet: CombatModifiers) => boolean;

function combatant(
  sheet: CombatModifiers,
  over: Partial<AbilityCombatant> = {},
): AbilityCombatant {
  return {
    id: "a",
    x: 1000,
    y: 1000,
    angle: 0,
    hull: 24,
    maxHull: 48,
    shields: 0,
    maxShields: 24,
    stress: INITIAL_STRESS,
    modifiers: sheet,
    frenzyUntilMs: 0,
    ...over,
  };
}

/** A sure, calm hit on an unshielded target crossing the nose. */
function shot(sheet: CombatModifiers): DiceAttackInput {
  return {
    attacker: combatant(sheet),
    target: combatant(NEUTRAL_MODIFIERS, { id: "t", y: 700, angle: 90 }),
    hitChance: 0.6,
    baseDamage: 3,
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: 0,
    roll: 0,
  };
}

const laser: Probe = (sheet) =>
  resolveDiceAttack(shot(sheet)).damage >
  resolveDiceAttack(shot(NEUTRAL_MODIFIERS)).damage;

const conditional: Probe = (sheet) =>
  conditionalLaserBonus(sheet, {
    closeRange: true,
    behindTarget: true,
    inBullseye: true,
    allyNear: true,
    isStressed: true,
    isDamaged: true,
    frenzyActive: true,
  }) > 0;

const mitigation: Probe = (sheet) => damageMitigationOf(sheet, true) !== 1;

const repair: Probe = (sheet) => {
  const step = repairStep({
    hull: 12,
    maxHull: 48,
    shields: 0,
    maxShields: 24,
    shieldRegenPerSecond: sheet.shieldRegenPerSecond,
    hullRepairPerSecond: sheet.hullRepairPerSecond,
    deltaMs: 1000,
    msSinceDamage: 10_000,
  });
  return step.hull > 12 || step.shields > 0;
};

const stress: Probe = (sheet) =>
  JSON.stringify(stressModifiersOf(sheet)) !==
  JSON.stringify(stressModifiersOf(NEUTRAL_MODIFIERS));

const POSE = { x: 0, y: 0, angle: 0 };
const flight: Probe = (sheet) => {
  const control = (s: CombatModifiers) =>
    JSON.stringify(
      equipFlight(createCycleFlight("terran_viper", POSE), s).motion.control,
    );
  return control(sheet) !== control(NEUTRAL_MODIFIERS);
};

/** Armed with a torpedo, a turret and (Owl) a cloak. */
const arsenal: Probe = (sheet) => {
  const arm = (s: CombatModifiers) =>
    JSON.stringify(
      createArsenal({
        definitionId: "confed_owl",
        upgradeIds: ["proton_torpedo", "twin_laser_turret"],
        modifiers: s,
      }),
    );
  return arm(sheet) !== arm(NEUTRAL_MODIFIERS);
};

const FACTIONS = Object.keys(FACTION_AURAS) as FactionId[];

function auraShip(
  id: string,
  faction: FactionId,
  x: number,
  role: AuraShip["role"],
  sheet: CombatModifiers,
): AuraShip {
  return {
    id,
    x,
    y: 0,
    faction,
    role,
    size: "medium",
    isUnique: false,
    equippedUpgrades: [],
    hull: 48,
    shields: 0,
    maxShields: 24,
    ...auraFactsOf(sheet),
  };
}

/** Ally distances sampled, as fractions of the faction aura's radius. */
const AURA_DISTANCE_FRACTIONS = Array.from(
  { length: 31 },
  (_, i) => 0.5 + i * 0.05,
);

/** What an ally receives from a fighter or a support projector, per faction. */
function auraOutcome(sheet: CombatModifiers): string {
  return JSON.stringify(
    FACTIONS.flatMap((faction) =>
      (["heavy_fighter", "support"] as const).flatMap((role) =>
        AURA_DISTANCE_FRACTIONS.map((fraction) => {
          const x = FACTION_AURAS[faction].radius * fraction;
          const projector = auraShip("p", faction, 0, role, sheet);
          const ally = auraShip("a", faction, x, "light_fighter", {
            ...NEUTRAL_MODIFIERS,
          });
          return resolveSupportAuras([projector, ally]).buffs.get("a") ?? null;
        }),
      ),
    ),
  );
}

const aura: Probe = (sheet) =>
  auraOutcome(sheet) !== auraOutcome(NEUTRAL_MODIFIERS);

const kill: Probe = (sheet) =>
  JSON.stringify(rewardKill(combatant(sheet), 0)) !==
  JSON.stringify(rewardKill(combatant(NEUTRAL_MODIFIERS), 0));

const blast: Probe = (sheet) =>
  deathBlastTargets(combatant(sheet), [{ id: "e", x: 1010, y: 1000 }]).length >
  0;

const stressOnHit: Probe = (sheet) =>
  resolveDiceAttack(shot(sheet)).stressOnTarget > 0;

export const KNOB_PROBES: Readonly<Record<keyof CombatModifiers, Probe>> = {
  laserDamageBonus: laser,
  calmLaserDamageBonus: laser,
  bonusDamageVsUnshielded: laser,
  damageTakenMultiplier: mitigation,
  wingmanDamageTakenMultiplier: mitigation,
  shieldRegenPerSecond: repair,
  hullRepairPerSecond: repair,
  stressRateMultiplier: stress,
  stressReliefTiers: stress,
  boostCooldownMultiplier: flight,
  barrelRollCooldownMultiplier: flight,
  kturnCooldownMultiplier: flight,
  maxSpeedBonus: flight,
  ordnanceCooldownMultiplier: arsenal,
  ordnanceBonusCharges: arsenal,
  homingTurnBonus: arsenal,
  turretCooldownMultiplier: arsenal,
  cloakDurationBonus: arsenal,
  stressOnHit,
  projectsAura: aura,
  auraRadiusBonus: aura,
  auraMagnitudeBonus: aura,
  auraStressReliefTiers: aura,
  auraHitChanceBonus: aura,
  auraShieldRegenPerSecond: aura,
  closeRangeLaserBonus: conditional,
  rearArcLaserBonus: conditional,
  bullseyeLaserBonus: conditional,
  wingmanLaserBonus: conditional,
  stressedLaserBonus: conditional,
  damagedLaserBonus: conditional,
  killFrenzyLaserBonus: kill,
  shieldsPerKill: kill,
  deathBlastDamage: blast,
};
