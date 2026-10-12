/**
 * TurretGunnery — one frame of a ship's turret inside the secondary-weapons
 * runtime: pick the target (pilot's first, all round, within band, not
 * cloaked, not immune to this attacker this cycle), swing toward it at the
 * traverse rate (a gunner crew aims it by hand instead: it then fires only
 * at what lies along its aim) and, once on target and reloaded, roll the primary-laser
 * dice for the turret's damage. A hit makes the target immune to this
 * attacker for the cycle (CombatTempo), like any other attack.
 *
 * Pure: no Phaser.
 */

import { calculateHitChance } from "../../data/ModeBalancing";
import type { HitImmunityLedger } from "../systems/CombatTempo";
import type { TurretState } from "./Arsenal";
import {
  pickTurretTarget,
  traverseTurret,
  turretOnTarget,
  weaponHitDamage,
} from "./FireControl";
import { headingTowardDeg } from "./FiringGeometry";
import type { WeaponBody, WeaponEvent } from "./weaponTypes";

/** What a turret needs from the runtime this frame. */
export interface TurretFrame {
  readonly self: WeaponBody;
  readonly turret: TurretState;
  /** Living, uncloaked ships. */
  readonly visible: readonly WeaponBody[];
  readonly preferredId: string | null;
  readonly ledger: HitImmunityLedger;
  readonly random: () => number;
  readonly worldSize: number;
  readonly deltaMs: number;
  readonly nowMs: number;
}

/**
 * Track and fire a turret for one frame (the turret is mutated).
 *
 * @param frame - The ship, its turret and the frame's context.
 * @returns The events of any attack made (turret shot, hit).
 */
export function fireTurret(frame: TurretFrame): WeaponEvent[] {
  const { self, turret, ledger, nowMs, worldSize } = frame;
  const eligible = frame.visible.filter(
    (body) => !ledger.isImmune(self.id, body.id, nowMs),
  );
  const target = turret.manualAim
    ? pickTurretTarget(
        self,
        turret,
        eligible.filter((body) =>
          turretOnTarget(self, turret, body, worldSize),
        ),
        null,
        worldSize,
      )
    : pickTurretTarget(self, turret, eligible, frame.preferredId, worldSize);
  if (!target) return [];
  if (!turret.manualAim) {
    turret.facingDeg = traverseTurret(
      turret.facingDeg,
      headingTowardDeg(self, target, worldSize),
      frame.deltaMs,
    );
  }
  if (turret.cooldownMs > 0) return [];
  if (!turretOnTarget(self, turret, target, worldSize)) return [];
  turret.cooldownMs = turret.spec.cooldownMs;
  return resolveTurretShot(frame, target);
}

function resolveTurretShot(
  frame: TurretFrame,
  target: WeaponBody,
): WeaponEvent[] {
  const { self, turret } = frame;
  const hit =
    frame.random() < calculateHitChance(turret.spec.damage, target.agilityDice);
  const shot: WeaponEvent = {
    kind: "turret",
    shipId: self.id,
    targetId: target.id,
    hit,
    fromX: self.x,
    fromY: self.y,
    toX: target.x,
    toY: target.y,
  };
  if (!hit) return [shot];
  frame.ledger.recordHit(self.id, target.id, frame.nowMs);
  return [
    shot,
    {
      kind: "hit",
      attackerId: self.id,
      targetId: target.id,
      weapon: "turret",
      damage: weaponHitDamage(turret.spec.damage, target, false),
      stress: turret.spec.stressOnHit,
    },
  ];
}
