/**
 * secondary-weapons.spec.ts — every secondary weapon type fires for real
 * in every battle mode, through the shared runtime (BattleWeapons):
 * torpedo and missile (lock, Space, homing hit, ammo, HUD lock ring),
 * turret (auto-tracks a ship astern), bomb (dropped astern, timed blast)
 * and mine (arms, an enemy touching it sets it off). An enemy is pinned
 * where each weapon can reach it; the scene's own damage path must apply
 * the hit (shields + hull drop).
 */

import { test, expect, type Page } from "@playwright/test";
import { ALL_BATTLES, type BattleEntry } from "./helpers/battleEntry";

/** Pins the enemy every frame: ahead/astern of the player, or onto a device. */
async function installPin(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate(async (key) => {
    const { shiftMotion } = await import("/src/arcade/systems/ShipMotion.ts");
    const w = window as any;
    const scene = w.game.scene.getScene(key);
    const weapons = scene.secondaryWeapons;
    const pid = weapons.playerShipId();
    const side = (id: string) =>
      weapons.bodies().find((b: any) => b.id === id)?.side;
    const enemyId = weapons
      .bodies()
      .find((b: any) => b.hull > 0 && b.side !== side(pid)).id;
    const shipOf = (id: string) => scene.ships.get(id);
    const place = (ship: any, x: number, y: number) => {
      const motion = ship.flight ? ship.flight.motion : ship;
      const moved = shiftMotion(motion, x - motion.x, y - motion.y, 6000);
      if (ship.flight) ship.flight = { ...ship.flight, motion: moved };
      else ship.control = moved.control;
      ship.x = moved.x;
      ship.y = moved.y;
    };
    w.__pin = { mode: "ahead", distance: 200 };
    w.__pid = pid;
    w.__enemyId = enemyId;
    w.__hits = [];
    const link = weapons.link;
    const apply = link.applyHit;
    link.applyHit = (hit: any) => {
      w.__hits.push(hit);
      apply(hit);
    };
    scene.events.on("preupdate", () => {
      const p = shipOf(pid);
      const e = shipOf(enemyId);
      if (!p || !e) return;
      e.hull = Math.max(e.hull, 1);
      const pin = w.__pin;
      if (pin.mode === "device") {
        const d = weapons.runtime.devicesOnField.find(
          (device: any) => device.ownerId === pid,
        );
        if (d) place(e, d.x, d.y);
        return;
      }
      if (pin.mode === "free") return;
      const sign = pin.mode === "ahead" ? 1 : -1;
      const rad = ((p.angle - 90) * Math.PI) / 180;
      place(
        e,
        (p.x + Math.cos(rad) * pin.distance * sign + 6000) % 6000,
        (p.y + Math.sin(rad) * pin.distance * sign + 6000) % 6000,
      );
    });
  }, sceneKey);
}

/** Re-arms the player with exactly these cards and makes the enemy sturdy. */
async function arm(
  page: Page,
  sceneKey: string,
  upgradeIds: string[],
): Promise<void> {
  await page.evaluate(
    async ({ key, ids }) => {
      const { NEUTRAL_MODIFIERS } =
        await import("/src/core/CombatModifiers.ts");
      const w = window as any;
      const scene = w.game.scene.getScene(key);
      const weapons = scene.secondaryWeapons;
      const pid = weapons.playerShipId();
      const ship = scene.ships.get(pid);
      for (const body of weapons.bodies()) {
        if (body.id !== pid) weapons.runtime.forget(body.id);
      }
      ship.maxHull = Math.max(ship.maxHull, 400);
      ship.hull = ship.maxHull;
      weapons.runtime.equip(pid, {
        definitionId: ship.definitionId,
        upgradeIds: ids,
        modifiers: NEUTRAL_MODIFIERS,
      });
      const enemy = scene.ships.get(w.__enemyId);
      enemy.maxHull = Math.max(enemy.maxHull, 400);
      enemy.hull = enemy.maxHull;
      // Warheads and turrets roll attack vs agility on impact (X-Wing): a
      // Stiletto dodges a missile ~half the time. Pin the roll to a hit so a
      // single shot proves lock → launch → flight → impact → damage.
      weapons.runtime.config = { ...weapons.runtime.config, random: () => 0 };
      w.__hits = [];
    },
    { key: sceneKey, ids: upgradeIds },
  );
}

async function setPin(page: Page, mode: string, distance = 200): Promise<void> {
  await page.evaluate(
    ({ m, d }) => ((window as any).__pin = { mode: m, distance: d }),
    { m: mode, d: distance },
  );
}

/** Waits for a hit by this weapon on the pinned enemy; returns its damage. */
async function waitForHit(
  page: Page,
  weapon: string,
  anyHostile = false,
): Promise<number> {
  const handle = await page
    .waitForFunction(
      ({ wpn, any }) => {
        const w = window as any;
        const hit = w.__hits.find(
          (h: any) =>
            h.weapon === wpn &&
            h.attackerId === w.__pid &&
            (any || h.targetId === w.__enemyId),
        );
        return hit ? hit.damage : null;
      },
      { wpn: weapon, any: anyHostile },
      { timeout: 15_000 },
    )
    .catch(async (error: Error) => {
      const seen = await page.evaluate(() =>
        ((window as any).__hits as any[]).map(
          (h) => `${h.weapon}:${h.attackerId}->${h.targetId}`,
        ),
      );
      throw new Error(
        `no ${weapon} hit within 15 s (hits seen: ${JSON.stringify(seen)}): ${error.message}`,
      );
    });
  return (await handle.jsonValue()) as number;
}

async function slotState(page: Page, sceneKey: string): Promise<any> {
  return page.evaluate((key) => {
    const weapons = (window as any).game.scene.getScene(key).secondaryWeapons;
    const pid = weapons.playerShipId();
    const arsenal = weapons.runtime.arsenalOf(pid);
    return {
      charges: arsenal.slots[0]?.charges,
      specDamage: arsenal.slots[0]?.spec.damage,
      hud: weapons.hudSlots(),
      outcome: weapons.lastFireOutcome,
    };
  }, sceneKey);
}

async function pressFireSecondary(page: Page): Promise<void> {
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
}

/** Lock, Space, homing hit, ammo and HUD for one launcher card. */
async function launcherRound(
  page: Page,
  sceneKey: string,
  card: string,
  weapon: string,
): Promise<void> {
  await arm(page, sceneKey, [card]);
  await setPin(page, "ahead", 200);
  await page.waitForFunction(
    (key) => {
      const weapons = (window as any).game.scene.getScene(key).secondaryWeapons;
      return weapons.hudSlots()[0]?.lock === 1;
    },
    sceneKey,
    { timeout: 10_000 },
  );
  await pressFireSecondary(page);
  const damage = await waitForHit(page, weapon);
  const state = await slotState(page, sceneKey);
  // Card damage x ORDNANCE_DAMAGE_SCALE, less the target's mitigation.
  expect(damage).toBeGreaterThan(0);
  expect(damage).toBeLessThanOrEqual(state.specDamage);
  expect(state.outcome).toBe("launched");
  expect(state.charges).toBe(state.hud[0].maxCharges - 1);
  expect(state.hud[0].kind).toBe(weapon);
}

/** One device card: drop astern, pin the enemy on it, blast. */
async function deviceRound(
  page: Page,
  sceneKey: string,
  card: string,
  weapon: string,
): Promise<void> {
  await arm(page, sceneKey, [card]);
  await setPin(page, "free");
  await pressFireSecondary(page);
  await page.waitForFunction(
    (key) =>
      (window as any).game.scene
        .getScene(key)
        .secondaryWeapons.runtime.devicesOnField.some(
          (d: any) => d.ownerId === (window as any).__pid,
        ),
    sceneKey,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(weapon === "mine" ? 600 : 0);
  await setPin(page, "device");
  // An escort may trip the mine before the pinned enemy does (Epic): any hostile counts.
  const damage = await waitForHit(page, weapon, weapon === "mine");
  const state = await slotState(page, sceneKey);
  expect(damage).toBeGreaterThan(0);
  expect(damage).toBeLessThanOrEqual(state.specDamage);
  expect(state.outcome).toBe("dropped");
}

function batteryFor(entry: BattleEntry): void {
  test(`secondary weapons fire for real — ${entry.sceneKey}`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await entry.enter(page, { peaceful: true });
    await page.waitForFunction(
      (key) => !!(window as any).game.scene.getScene(key).secondaryWeapons,
      entry.sceneKey,
    );
    await page.waitForTimeout(1500);
    await installPin(page, entry.sceneKey);
    await launcherRound(page, entry.sceneKey, "proton_torpedo", "torpedo");
    await launcherRound(page, entry.sceneKey, "concussion_missile", "missile");
    await arm(page, entry.sceneKey, ["twin_laser_turret"]);
    await setPin(page, "astern", 150);
    // The turret engages the nearest hostile in its band (an escort may be nearer).
    expect(await waitForHit(page, "turret", true)).toBeGreaterThan(0);
    await deviceRound(page, entry.sceneKey, "proton_bomb", "bomb");
    await deviceRound(page, entry.sceneKey, "proximity_mine", "mine");
  });
}

for (const entry of ALL_BATTLES) batteryFor(entry);
