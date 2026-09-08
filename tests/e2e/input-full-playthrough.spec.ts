/**
 * input-full-playthrough.spec.ts — regression suite for the unified
 * keyboard/touch/gamepad input system, focused on ArcadeBattleScene (the
 * richest control surface: gestures, crew modes, weapon cycling, commander
 * orders) plus a cross-scene input-fuzz crash hunt.
 *
 * Philosophy: verify WIRING (does the intent reach the scene and produce its
 * expected effect?) via direct state reads and call-count monkeypatches,
 * not gameplay outcomes like hull damage — those also depend on aim/range/
 * RNG that are unrelated to whether an input binding is correctly connected.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  suppressWebGLNoise,
  collectErrors,
  holdGameKey,
  injectFakeGamepad,
  setFakeGamepadAxes,
  tapFakeGamepadButton,
} from "./helpers/game";

interface ArcadeFactionSlot {
  factionId: string;
  controller: "player" | "ai";
  ships: string[];
  loadoutChoices?: Record<string, string>;
}

const CONFED_KESTREL: ArcadeFactionSlot = {
  factionId: "free_confederation",
  controller: "player",
  ships: ["confed_kestrel"],
};
const DEFAULT_ENEMY: ArcadeFactionSlot = {
  factionId: "void_corsairs",
  controller: "ai",
  ships: ["corsair_venom"],
};

async function openArcade(
  page: Page,
  playerSlot: ArcadeFactionSlot,
  enemySlot: ArcadeFactionSlot = DEFAULT_ENEMY,
): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(
    ([p, e]: [ArcadeFactionSlot, ArcadeFactionSlot]) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", { factions: [p, e] });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    },
    [playerSlot, enemySlot],
  );
  await waitForScene(page, "ArcadeBattleScene");
  await page.waitForFunction(
    () => {
      const scene = (window as any).game?.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return scene?.playerShipId != null;
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(200); // clear the framesAlive > 5 autofire gate
}

async function getPlayerShip(page: Page): Promise<any> {
  return page.evaluate(() => {
    const scene = (window as any).game.scene.getScene(
      "ArcadeBattleScene",
    ) as any;
    return scene.ships.get(scene.playerShipId);
  });
}

/** Monkeypatch a scene method to count invocations; returns a reader for the live count. */
async function countSceneCalls(
  page: Page,
  method: string,
): Promise<() => Promise<number>> {
  await page.evaluate((m: string) => {
    const scene = (window as any).game.scene.getScene(
      "ArcadeBattleScene",
    ) as any;
    const orig = scene[m].bind(scene);
    const w = window as any;
    w.__calls = w.__calls ?? {};
    w.__calls[m] = 0;
    scene[m] = (...args: unknown[]) => {
      w.__calls[m]++;
      return orig(...args);
    };
  }, method);
  return () =>
    page.evaluate((m: string) => (window as any).__calls[m] as number, method);
}

test.describe("ArcadeBattleScene — keyboard playthrough", () => {
  test("primary weapon autofires with zero player input", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getFireCalls = await countSceneCalls(page, "fireSelectedWeapon");
    await page.waitForTimeout(2_000);
    expect(await getFireCalls()).toBeGreaterThan(5);
  });

  test("one quick UP press adds exactly one speed step; a longer hold adds no extra step", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const before = (await getPlayerShip(page)).control.speed;

    await holdGameKey(page, "ArrowUp", 120);
    await page.waitForTimeout(100);
    const afterOnePress = (await getPlayerShip(page)).control.speed;
    expect(afterOnePress).toBe(before + 1);

    await holdGameKey(page, "ArrowUp", 700); // long hold — still exactly ONE more step
    await page.waitForTimeout(100);
    const afterLongHold = (await getPlayerShip(page)).control.speed;
    expect(afterLongHold).toBe(afterOnePress + 1);
  });

  test("holding LEFT queues a bank_left maneuver", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          code: "ArrowLeft",
          keyCode: 37,
          which: 37,
          bubbles: true,
        }),
      ),
    );
    await page.waitForTimeout(150);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe("bank_left");
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "ArrowLeft",
          code: "ArrowLeft",
          keyCode: 37,
          which: 37,
          bubbles: true,
        }),
      ),
    );
  });

  test("Q reaches the discrete sharp-turn handler", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getTurnCalls = await countSceneCalls(page, "executeDiscreteTurn");
    await holdGameKey(page, "Q", 100);
    await page.waitForTimeout(50);
    expect(await getTurnCalls()).toBe(1);
  });

  test("Shift+Q queues a segnor loop (distinct from plain Q)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "Q", 100, { shift: true });
    await page.waitForTimeout(50);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe(
      "segnor_left",
    );
  });

  test("T queues a tallon roll", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "T", 100);
    await page.waitForTimeout(50);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe(
      "tallon_left",
    );
  });

  test("C toggles cloak on", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "C", 100);
    await page.waitForTimeout(50);
    expect((await getPlayerShip(page)).isCloaked).toBe(true);
  });

  test("Shift+Space (FIRE_SECONDARY) reaches deployBomb without disabling autofire", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getBombCalls = await countSceneCalls(page, "deployBomb");
    const getFireCalls = await countSceneCalls(page, "fireSelectedWeapon");
    await holdGameKey(page, "Space", 100, { shift: true });
    await page.waitForTimeout(500);
    expect(await getBombCalls()).toBeGreaterThanOrEqual(1);
    expect(await getFireCalls()).toBeGreaterThan(0);
  });

  test("G cycles pilot -> gunner -> commander on a capital ship with a turret", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "terran_hegemony",
      controller: "player",
      ships: ["terran_imperator"],
      loadoutChoices: { "0": "imperator_flagship" },
    });
    expect((await getPlayerShip(page)).crewMode).toBe("pilot");
    await holdGameKey(page, "G", 100);
    await page.waitForTimeout(50);
    expect((await getPlayerShip(page)).crewMode).toBe("gunner");
    await holdGameKey(page, "G", 100);
    await page.waitForTimeout(50);
    expect((await getPlayerShip(page)).crewMode).toBe("commander");
  });

  test("TAB cycles the selected weapon slot on a ship with ordnance equipped", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "terran_hegemony",
      controller: "player",
      ships: ["terran_vindicator"],
      loadoutChoices: { "0": "vindicator_strike" },
    });
    // Capture selectedWeaponSlot immediately inside selectNextWeapon — autofire
    // may fire-and-exhaust the newly selected ordnance within the same tick,
    // and fireSelectedWeapon's "nothing ready" fallback then resets the slot
    // back to -1 (pre-existing, intentional weapon-cycling behavior — not an
    // input-wiring defect). Reading immediately avoids that race.
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const orig = scene.selectNextWeapon.bind(scene);
      const w = window as any;
      w.__slotAfterSelect = null;
      scene.selectNextWeapon = (ship: unknown) => {
        const r = orig(ship);
        w.__slotAfterSelect = scene.selectedWeaponSlot;
        return r;
      };
    });
    await holdGameKey(page, "Tab", 100);
    await page.waitForTimeout(20);
    const slotAfterSelect = await page.evaluate(
      () => (window as any).__slotAfterSelect,
    );
    expect(slotAfterSelect).toBe(0);
  });
});

test.describe("ArcadeBattleScene — touch controls", () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 720 } });

  // Stick center (140, height-150) and action-zone center (width-120, height-150)
  // per src/ui/input/TouchFlightControls.ts — kept in sync manually since the
  // constants are private to that class.
  const STICK = { x: 140, y: 570 };
  const ACTION = { x: 1160, y: 570 };

  test("dragging the movement stick right queues a bank_right maneuver", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await page.mouse.move(STICK.x, STICK.y);
    await page.mouse.down();
    await page.mouse.move(STICK.x + 70, STICK.y);
    await page.waitForTimeout(150);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe("bank_right");
    await page.mouse.up();
  });

  test("double-tap UP on the stick triggers BOOST (regression: touch BOOST intent was previously dropped)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    expect((await getPlayerShip(page)).control.boostCooldown).toBe(0);

    for (let i = 0; i < 2; i++) {
      await page.mouse.move(STICK.x, STICK.y);
      await page.mouse.down();
      await page.mouse.move(STICK.x, STICK.y - 70);
      await page.waitForTimeout(30);
      await page.mouse.up();
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(100);
    expect((await getPlayerShip(page)).control.boostCooldown).toBeGreaterThan(
      0,
    );
  });

  test("double-tap DOWN on the stick triggers KTURN", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    for (let i = 0; i < 2; i++) {
      await page.mouse.move(STICK.x, STICK.y);
      await page.mouse.down();
      await page.mouse.move(STICK.x, STICK.y + 70);
      await page.waitForTimeout(30);
      await page.mouse.up();
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(100);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe("kturn");
  });

  test("a single tap on the action zone reaches deployBomb (FIRE_SECONDARY)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getBombCalls = await countSceneCalls(page, "deployBomb");
    await page.mouse.move(ACTION.x, ACTION.y);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(500); // single-tap fires after the 350ms double-tap window
    expect(await getBombCalls()).toBeGreaterThanOrEqual(1);
  });

  test("holding the action zone toggles cloak on", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await page.mouse.move(ACTION.x, ACTION.y);
    await page.mouse.down();
    await page.waitForTimeout(500); // hold threshold is 400ms
    expect((await getPlayerShip(page)).isCloaked).toBe(true);
    await page.mouse.up();
  });
});

test.describe("ArcadeBattleScene — gamepad controls", () => {
  test.setTimeout(20_000);

  async function gamepadIsAvailable(page: Page): Promise<boolean> {
    await injectFakeGamepad(page);
    return page
      .waitForFunction(
        () => {
          const scene = (window as any).game?.scene.getScene(
            "ArcadeBattleScene",
          ) as any;
          return (scene?.input?.gamepad?.total ?? 0) > 0;
        },
        { timeout: 3_000 },
      )
      .then(() => true)
      .catch(() => false);
  }

  test("holding the left stick left queues a bank_left maneuver", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    test.skip(
      !(await gamepadIsAvailable(page)),
      "Phaser did not register the fake gamepad in this environment",
    );

    await setFakeGamepadAxes(page, [-1, 0, 0, 0]);
    await page.waitForTimeout(200);
    expect((await getPlayerShip(page)).control.nextManeuver).toBe("bank_left");
    await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  });

  test("tapping face button 2 reaches deployBomb (FIRE_SECONDARY)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    test.skip(
      !(await gamepadIsAvailable(page)),
      "Phaser did not register the fake gamepad in this environment",
    );

    const getBombCalls = await countSceneCalls(page, "deployBomb");
    await tapFakeGamepadButton(page, 2, 150);
    await page.waitForTimeout(200);
    expect(await getBombCalls()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Cross-scene input fuzz — crash hunt", () => {
  const RANDOM_KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "Q",
    "E",
    "T",
    "Z",
    "C",
    "G",
    "Tab",
    "Escape",
  ];

  async function mashRandomKeys(page: Page, durationMs: number): Promise<void> {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
      const key = RANDOM_KEYS[Math.floor(Math.random() * RANDOM_KEYS.length)]!;
      const shift = Math.random() < 0.3;
      await holdGameKey(page, key, 40 + Math.floor(Math.random() * 80), {
        shift,
      });
    }
  }

  async function assertFiniteShipPositions(page: Page): Promise<void> {
    const bad = await page.evaluate(() => {
      const g = (window as any).game;
      const scene = g.scene.getScenes(true)[0] as any;
      const ships: any[] = scene?.ships ? Array.from(scene.ships.values()) : [];
      return ships.filter(
        (s) =>
          !Number.isFinite(s.x) ||
          !Number.isFinite(s.y) ||
          !Number.isFinite(s.angle),
      ).length;
    });
    expect(bad).toBe(0);
  }

  test("ArcadeBattleScene survives random full-keyboard input mashing", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openArcade(page, CONFED_KESTREL);
    await mashRandomKeys(page, 3_000);
    await assertFiniteShipPositions(page);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("DogfightScene survives random full-keyboard input mashing", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.scene.start("DogfightScene", {});
    });
    await waitForScene(page, "DogfightScene");
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("DogfightScene") as any;
      scene.startMatch?.();
    });
    await page.waitForTimeout(500);
    await mashRandomKeys(page, 3_000);
    await assertFiniteShipPositions(page);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("ContinuousTacticalScene survives random full-keyboard input mashing", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        factions: [
          {
            factionId: "free_confederation",
            controller: "player",
            ships: ["confed_sparrow", "confed_wasp"],
          },
          {
            factionId: "terran_hegemony",
            controller: "ai",
            ships: ["terran_viper", "terran_gladius"],
          },
        ],
      });
      setTimeout(() => g.scene.start("ContinuousTacticalScene"), 100);
    });
    await waitForScene(page, "ContinuousTacticalScene");
    await page.waitForTimeout(500);
    await mashRandomKeys(page, 3_000);
    await assertFiniteShipPositions(page);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });
});
