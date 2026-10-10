/**
 * quick-builds.spec.ts — every battle mode flies quick builds: each ship
 * carries a modifier sheet (upgrades + pilot ability) and, in modes without
 * a loadout picker, ships get their default quick build automatically.
 */

import { test, expect } from "@playwright/test";
import {
  ACE_DUEL,
  BOSS_RAID,
  CAMPAIGN,
  CONTINUOUS,
  DOGFIGHT,
  SURVIVAL,
  type BattleEntry,
} from "./helpers/battleEntry";

/** Modes that hand out default quick builds (no loadout picker yet). */
const DEFAULT_BUILD_MODES: readonly BattleEntry[] = [
  DOGFIGHT,
  ACE_DUEL,
  BOSS_RAID,
  SURVIVAL,
  CAMPAIGN,
  CONTINUOUS,
];

for (const battle of DEFAULT_BUILD_MODES) {
  test(`${battle.sceneKey}: ships fly equipped quick builds`, async ({
    page,
  }) => {
    await battle.enter(page, { peaceful: true });
    const ships = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return [...scene.ships.values()].map((ship: any) => ({
        hasSheet: typeof ship.modifiers === "object" && ship.modifiers !== null,
        loadoutId: ship.loadoutId,
        equipped: Object.entries(ship.modifiers ?? {}).some(
          ([key, value]) =>
            (key.endsWith("Multiplier") && value !== 1) ||
            (!key.endsWith("Multiplier") && value !== 0 && value !== false),
        ),
      }));
    }, battle.sceneKey);

    expect(ships.length).toBeGreaterThan(0);
    expect(ships.every((ship) => ship.hasSheet)).toBe(true);
    expect(ships.every((ship) => ship.loadoutId !== undefined)).toBe(true);
    expect(ships.some((ship) => ship.equipped)).toBe(true);
  });
}
