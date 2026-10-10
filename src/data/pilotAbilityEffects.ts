/**
 * pilotAbilityEffects — what every pilot-card ability does in real time.
 *
 * X-Wing abilities are written for dice and rounds; each entry here is the
 * real-time reading of the card text (src/systems/PilotAbilities.ts):
 * - Dice/reroll bonuses become laser damage or damage-taken knobs, gated by
 *   the card's condition (range 1, behind the target, bullseye, wingman,
 *   stressed, damaged, after a kill) — see src/arcade/ShotConditions.ts.
 * - "Free boost / barrel roll" becomes a faster recharge of that action.
 * - Support abilities that act on friendlies project the faction aura.
 * - Force "Action:" abilities fire on their own on a recharge, read as a
 *   steady rate (shield regeneration, stress inflicted per hit).
 *
 * A pilot's price is derived from this effect (abilityPricing.ts).
 */

import type { RealtimeEffect } from "../core/CombatModifiers";

export const PILOT_ABILITY_REALTIME: Readonly<Record<string, RealtimeEffect>> =
  {
    // --- Offensive -----------------------------------------------------------
    ambush: { rearArcLaserBonus: 1 },
    calculate_strike: { calmLaserDamageBonus: 1 },
    convergence_strike: { wingmanLaserBonus: 1, auraRadiusBonus: 0.1 },
    crack_shot: { bullseyeLaserBonus: 1 },
    dead_eye: { bullseyeLaserBonus: 2 },
    fearless: { stressedLaserBonus: 1 },
    focused_volley: { wingmanLaserBonus: 1 },
    force_fury: { laserDamageBonus: 1 },
    guerrilla_tactics: {
      rearArcLaserBonus: 1,
      barrelRollCooldownMultiplier: 0.85,
    },
    heavy_gunner: { closeRangeLaserBonus: 1 },
    intimidation: { closeRangeLaserBonus: 1, stressOnHit: 0.05 },
    marksman: { bonusDamageVsUnshielded: 1 },
    predator: { bonusDamageVsUnshielded: 1, bullseyeLaserBonus: 1 },
    ruthless: { laserDamageBonus: 1, damageTakenMultiplier: 1.1 },
    saturation_fire: { closeRangeLaserBonus: 1, turretCooldownMultiplier: 0.8 },
    bombardier: { ordnanceBonusCharges: 1, ordnanceCooldownMultiplier: 0.8 },

    // --- Defensive -----------------------------------------------------------
    elusive: { damageTakenMultiplier: 0.9 },
    hold_the_line: { wingmanDamageTakenMultiplier: 0.8 },
    radiant_judgment: { closeRangeLaserBonus: 1, damageTakenMultiplier: 0.95 },
    regenerative_matrix: { shieldRegenPerSecond: 0.15 },
    smugglers_luck: { damageTakenMultiplier: 0.92, cloakDurationBonus: 0.5 },
    stalwart: { damageTakenMultiplier: 0.85 },

    // --- Movement ------------------------------------------------------------
    afterburners: { boostCooldownMultiplier: 0.6 },
    daredevil: { boostCooldownMultiplier: 0.7, stressRateMultiplier: 1.1 },
    drone_overclock: { maxSpeedBonus: 1 },
    evasive_roll: { barrelRollCooldownMultiplier: 0.6 },
    hit_and_run: {
      boostCooldownMultiplier: 0.7,
      barrelRollCooldownMultiplier: 0.85,
    },
    phantom_strike: { rearArcLaserBonus: 1, boostCooldownMultiplier: 0.8 },
    prescience: {
      damageTakenMultiplier: 0.9,
      barrelRollCooldownMultiplier: 0.8,
    },
    raider_cadence: { stressReliefTiers: 1 },
    rapid_redeploy: { boostCooldownMultiplier: 0.5 },
    supernatural_reflexes: {
      boostCooldownMultiplier: 0.7,
      barrelRollCooldownMultiplier: 0.7,
    },

    // --- Stress --------------------------------------------------------------
    iron_discipline: { stressRateMultiplier: 0.7 },
    righteous_anger: { damagedLaserBonus: 1, stressRateMultiplier: 0.8 },

    // --- After a kill / on destruction ---------------------------------------
    assimilation: { wingmanDamageTakenMultiplier: 0.9 },
    blood_frenzy: { killFrenzyLaserBonus: 1 },
    plunder: { shieldsPerKill: 1 },
    self_destruct: { deathBlastDamage: 2 },

    // --- Support (acts on friendlies: projects the faction aura) -------------
    coordinated_assault: { projectsAura: true, auraRadiusBonus: 0.2 },
    covering_fire: { projectsAura: true, wingmanDamageTakenMultiplier: 0.9 },
    data_link: { projectsAura: true, auraRadiusBonus: 0.25 },
    healing_aura: { projectsAura: true, shieldRegenPerSecond: 0.1 },
    hive_mind: { wingmanLaserBonus: 1, wingmanDamageTakenMultiplier: 0.9 },
    informant: { projectsAura: true },
    inspiring_presence: { projectsAura: true, stressReliefTiers: 1 },
    networked_aim: { projectsAura: true, wingmanLaserBonus: 1 },
    rally: { projectsAura: true, auraRadiusBonus: 0.1 },
    shield_transfer: { projectsAura: true, shieldRegenPerSecond: 0.05 },
    swarm_tactics: { wingmanLaserBonus: 1, auraRadiusBonus: 0.05 },

    // --- Force (automatic on a recharge) -------------------------------------
    force_barrier: { projectsAura: true, wingmanDamageTakenMultiplier: 0.85 },
    force_guidance: { projectsAura: true, auraRadiusBonus: 0.15 },
    force_heal: { projectsAura: true, shieldRegenPerSecond: 0.2 },
    force_push: { stressOnHit: 0.1 },
    force_shield: { shieldRegenPerSecond: 0.3 },
    force_suppression: { stressOnHit: 0.15 },
  };
