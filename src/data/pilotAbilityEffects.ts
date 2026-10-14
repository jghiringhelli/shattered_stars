/**
 * pilotAbilityEffects — what every pilot-card ability does in real time.
 *
 * X-Wing abilities are written for dice and rounds; each entry here is the
 * real-time reading of the card text (src/systems/PilotAbilities.ts):
 * - Dice/reroll bonuses become laser damage or damage-taken knobs, gated by
 *   the card's condition (range 1, behind the target, bullseye, wingman,
 *   stressed, damaged, after a kill) — see src/arcade/ShotConditions.ts.
 * - "Free boost / barrel roll" becomes a faster recharge of that action.
 * - Support abilities that act on friendlies project the faction aura; the
 *   aura knobs on the pilot's sheet shape it (wider radius, stronger
 *   magnitude, stress relief or hit chance for allies inside) — read by the
 *   aura resolver through AuraShip (src/systems/aura/AuraShipFacts.ts).
 * - Force "Action:" abilities fire on their own on a recharge, read as a
 *   steady rate (shield regeneration, stress inflicted per hit).
 * - Regen / repair rates and shields-per-kill are REAL-TIME hit points
 *   (HP/s, HP per kill), never rescaled: one shield token is
 *   DURABILITY_SCALE (12) HP. Shield regen never pauses, so it is worth
 *   ~34 points per HP/s against the game's AI (abilityPricing): pilot
 *   regen stays at 0.06-0.24 HP/s (a token every 50-200 s) — at 1+ HP/s a
 *   ship out-heals a duelist's fire and cannot be killed.
 * - Abilities whose card text heals or calms FRIENDLY ships act on the
 *   allies inside the pilot's aura (auraShieldRegenPerSecond,
 *   auraStressReliefTiers), never on the pilot itself.
 * - "While no friendly is near" reads as protection that a nearby wingman
 *   cancels (a wingman damage-taken drawback).
 *
 * Campaign pilots collect several of these as they level up
 * (src/arcade/systems/CampaignPilotEquip.ts). A pilot card's price is
 * derived from its ability's effect (abilityPricing.ts); campaign-only
 * entries price no card.
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
    hold_the_line: { wingmanDamageTakenMultiplier: 0.8, wingmanLaserBonus: 1 },
    radiant_judgment: { closeRangeLaserBonus: 1, damageTakenMultiplier: 0.95 },
    regenerative_matrix: { shieldRegenPerSecond: 0.18 },
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
    plunder: { shieldsPerKill: 12 },
    self_destruct: { deathBlastDamage: 2 },

    // --- Support (acts on friendlies: projects the faction aura) -------------
    // Card: friendlies at range 0-2 may Focus / Target Lock -> allies in a
    // 20% wider aura shoot 5% more accurately.
    coordinated_assault: {
      projectsAura: true,
      auraRadiusBonus: 0.2,
      auraHitChanceBonus: 0.05,
    },
    covering_fire: { projectsAura: true, wingmanDamageTakenMultiplier: 0.9 },
    // Card: friendlies at range 0-2 reroll 1 attack die -> a 25% wider,
    // 15% stronger hive link.
    data_link: {
      projectsAura: true,
      auraRadiusBonus: 0.25,
      auraMagnitudeBonus: 0.15,
    },
    // Card: each friendly at range 0-2 recovers 1 shield -> allies inside the
    // pilot's aura regenerate a shield token every ~100 s (not the pilot).
    healing_aura: { projectsAura: true, auraShieldRegenPerSecond: 0.12 },
    hive_mind: { wingmanLaserBonus: 1, wingmanDamageTakenMultiplier: 0.9 },
    // Card: reveal an enemy's planned maneuver -> allies dodge better: the
    // aura is 30% stronger.
    informant: { projectsAura: true, auraMagnitudeBonus: 0.3 },
    // Card: up to 3 friendlies remove 1 stress -> allies inside the aura fly
    // one stress tier easier (the pilot does not).
    inspiring_presence: { projectsAura: true, auraStressReliefTiers: 1 },
    networked_aim: { projectsAura: true, wingmanLaserBonus: 1 },
    // Card: remove 1 stress from a friendly -> allies in a 10% wider aura
    // fly one stress tier easier.
    rally: {
      projectsAura: true,
      auraRadiusBonus: 0.1,
      auraStressReliefTiers: 1,
    },
    // Card: transfer 1 shield to a friendly at range 0-1 -> allies inside the
    // aura regenerate a shield token every ~200 s.
    shield_transfer: { projectsAura: true, auraShieldRegenPerSecond: 0.06 },
    swarm_tactics: { wingmanLaserBonus: 1, auraRadiusBonus: 0.05 },

    // --- Force (automatic on a recharge) -------------------------------------
    force_barrier: { projectsAura: true, wingmanDamageTakenMultiplier: 0.85 },
    // Card: an attacker at range 0-3 rerolls up to 2 dice -> a 15% wider,
    // 20% stronger aura.
    force_guidance: {
      projectsAura: true,
      auraRadiusBonus: 0.15,
      auraMagnitudeBonus: 0.2,
    },
    // Card: friendlies at range 0-2/0-3 recover a shield or remove a red
    // token -> allies inside the aura regenerate 0.12 shield HP/s more and
    // fly one stress tier easier.
    force_heal: {
      projectsAura: true,
      auraShieldRegenPerSecond: 0.12,
      auraStressReliefTiers: 1,
    },
    force_push: { stressOnHit: 0.1 },
    // Card: "When a friendly ship at range 0-1 defends, spend 1 Force: the
    // defender adds 1 evade" — protection for ships flying together, not
    // self-healing. The old self-regen reading (0.3 shield tokens/s = 3.6 HP/s)
    // out-healed most fighters' fire at x12 HP: expert pilots could not
    // finish a novice Paladin in 3 minutes (skill gate 1). Same price (6).
    force_shield: { projectsAura: true, wingmanDamageTakenMultiplier: 0.88 },
    force_suppression: { stressOnHit: 0.15 },

    // --- Campaign pilots (unlocked by level; not on pilot cards) -------------
    predatory_instinct: { bonusDamageVsUnshielded: 1, killFrenzyLaserBonus: 1 },
    fanatical: { damagedLaserBonus: 1 },
    tenacity: { damagedLaserBonus: 1, damageTakenMultiplier: 0.95 },
    outmaneuver: { rearArcLaserBonus: 1, kturnCooldownMultiplier: 0.85 },
    target_lock_mastery: { homingTurnBonus: 60, bullseyeLaserBonus: 1 },
    focus_mastery: { calmLaserDamageBonus: 1, stressRateMultiplier: 0.9 },
    lone_wolf: {
      damageTakenMultiplier: 0.9,
      wingmanDamageTakenMultiplier: 1.1,
    },
    sense: { damageTakenMultiplier: 0.95, kturnCooldownMultiplier: 0.8 },
    evade_mastery: { damageTakenMultiplier: 0.88 },
    defensive_flying: {
      damageTakenMultiplier: 0.92,
      barrelRollCooldownMultiplier: 0.9,
    },
    shield_upgrade: { shieldRegenPerSecond: 0.12 },
    regenerative_shields: { shieldRegenPerSecond: 0.24 },
    barrel_roll_efficiency: { barrelRollCooldownMultiplier: 0.75 },
    boost_expertise: {
      boostCooldownMultiplier: 0.85,
      turretCooldownMultiplier: 0.9,
    },
    stress_recovery: { stressRateMultiplier: 0.8 },
    wingman: { projectsAura: true, wingmanDamageTakenMultiplier: 0.95 },
    squad_leader: { projectsAura: true, auraRadiusBonus: 0.3 },
  };
