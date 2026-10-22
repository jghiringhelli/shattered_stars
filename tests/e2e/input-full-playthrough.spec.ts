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
    [playerSlot, enemySlot] as [ArcadeFactionSlot, ArcadeFactionSlot],
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

/**
 * Waits until the player ship has queued or is flying `maneuver`. A queued
 * maneuver can commit on the very next cycle boundary, so checking only
 * nextManeuver after the key is released races the 500 ms cycle.
 */
async function waitForPlayerManeuver(
  page: Page,
  maneuver: string,
  timeout = 2_000,
): Promise<void> {
  await page.waitForFunction(
    (m: string) => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const control = scene.ships.get(scene.playerShipId).control;
      return control.nextManeuver === m || control.currentManeuver === m;
    },
    maneuver,
    { timeout },
  );
}

/** The shared secondary-weapons glue of the Skirmish scene, read in-page. */
async function weaponsProbe<T>(page: Page, read: string): Promise<T> {
  return page.evaluate((expr: string) => {
    const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
    const weapons = scene.secondaryWeapons;
    const pid = weapons.playerShipId();
    return new Function("weapons", "pid", `return ${expr};`)(weapons, pid);
  }, read);
}

const playerCloaked = (page: Page): Promise<boolean> =>
  weaponsProbe(page, "weapons.runtime.isCloaked(pid)");
const feedbackLabel = (page: Page): Promise<string | null> =>
  weaponsProbe(page, "weapons.feedback.lastLabel");
const lastFireOutcome = (page: Page): Promise<string | null> =>
  weaponsProbe(page, "weapons.lastFireOutcome");
const selectedSecondary = (page: Page): Promise<number> =>
  weaponsProbe(page, "weapons.runtime.arsenalOf(pid).selected");

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

/** Hold the maneuver key Z and press ← (a Hook Loop left). */
async function hookLeft(page: Page): Promise<void> {
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(120);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("z");
}
test.describe("ArcadeBattleScene — keyboard playthrough", () => {
  test("primary weapon autofires with zero player input", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getFireCalls = await countSceneCalls(page, "firePrimaries");
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

    // Wait out the double-tap window: a second ↑ inside it is a boost gesture.
    await page.waitForTimeout(400);
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
    // Hold is a 45° bank once the key has been down BANK_HOLD_MS.
    await waitForPlayerManeuver(page, "bank_left", 1_000);
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

  test("Q queues a 90° hard turn left", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "Q", 100);
    await waitForPlayerManeuver(page, "turn_left");
  });

  test("holding Z and pressing ← queues a hook loop on a ship whose dial has it", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "synthetic_collective",
      controller: "player",
      ships: ["synth_stalker"],
    });
    await hookLeft(page);
    await waitForPlayerManeuver(page, "segnor_left");
  });

  test("Z + ← is refused, with HUD feedback, on a ship without Hook", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await hookLeft(page);
    await expect
      .poll(() => feedbackLabel(page))
      .toBe("HOOK LOOP NOT ON DIAL");
  });

  test("Z, then Z held with ← queues a knife roll (and not a Snap turn)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "free_confederation",
      controller: "player",
      ships: ["confed_raven"],
    });
    await page.keyboard.down("z");
    await page.waitForTimeout(50);
    await page.keyboard.up("z");
    await page.waitForTimeout(40);
    await page.keyboard.down("z");
    await page.waitForTimeout(60);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(120);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("z");
    await waitForPlayerManeuver(page, "tallon_left");
  });

  test("tapping Z queues a Snap turn", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "Z", 80);
    await waitForPlayerManeuver(page, "kturn");
  });

  test("double-tapping ← barrel-rolls; alternating ← → does not", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    for (let i = 0; i < 6; i++)
      await holdGameKey(page, i % 2 === 0 ? "ArrowLeft" : "ArrowRight", 50);
    await page.waitForTimeout(100);
    expect((await getPlayerShip(page)).control.barrelRollCooldown).toBe(0);
    await page.waitForTimeout(500);
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(50);
      await page.keyboard.up("ArrowLeft");
      if (i === 0) await page.waitForTimeout(40);
    }
    await expect
      .poll(async () => (await getPlayerShip(page)).control.barrelRollCooldown)
      .toBeGreaterThan(0);
  });
  test("C cloaks a ship with a cloaking device", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "free_confederation",
      controller: "player",
      ships: ["confed_raven"],
    });
    await holdGameKey(page, "C", 100);
    await expect.poll(() => playerCloaked(page)).toBe(true);
  });

  test("C does nothing on a ship without a cloak, and says so", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await holdGameKey(page, "C", 100);
    await page.waitForTimeout(100);
    expect(await playerCloaked(page)).toBe(false);
    expect(await feedbackLabel(page)).toBe("NO CLOAKING DEVICE");
  });

  test("Space (FIRE_SECONDARY) reaches the secondary weapons without disabling autofire", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const getFireCalls = await countSceneCalls(page, "firePrimaries");
    await holdGameKey(page, "Space", 100);
    await expect.poll(() => lastFireOutcome(page)).not.toBeNull();
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

  test("TAB cycles the selected secondary slot on a ship with two", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "terran_hegemony",
      controller: "player",
      ships: ["terran_hammer"],
      loadoutChoices: { "0": "hammer_devastator" },
    });
    expect(await selectedSecondary(page)).toBe(0);
    await holdGameKey(page, "Tab", 100);
    await expect.poll(() => selectedSecondary(page)).toBe(1);
  });
});

test.describe("ArcadeBattleScene — touch controls", () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 720 } });

  // A touch-capable browser without a fine pointer gets the one-time
  // "phones are not supported" notice; these specs test the touch controls
  // themselves, so they start as a player who already dismissed it.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem(
        "shattered_stars_device_notice_dismissed",
        "1",
      ),
    );
  });

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
    // A hold past BANK_HOLD_MS queues one bank; it may already be flying when
    // read (the 500 ms cycle commits it), so accept it queued or in flight.
    await expect
      .poll(
        async () => {
          const { control } = await getPlayerShip(page);
          return [control.nextManeuver, control.currentManeuver].includes(
            "bank_right",
          );
        },
        { timeout: 1_500 },
      )
      .toBe(true);
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
    // Queued Snap turns commit on the next cycle boundary — accept queued or flying.
    await waitForPlayerManeuver(page, "kturn");
    expect((await getPlayerShip(page)).control.kturnCooldown).toBeGreaterThan(
      0,
    );
  });

  // MANEUVER button center (width-250, height-95).
  const MANEUVER = { x: 1030, y: 625 };

  test("double-tapping the left half of the stick barrel-rolls (a single tap does not)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    const tapLeft = async (): Promise<void> => {
      await page.mouse.move(STICK.x - 40, STICK.y);
      await page.mouse.down();
      await page.waitForTimeout(40);
      await page.mouse.up();
    };
    await tapLeft();
    await page.waitForTimeout(150);
    expect((await getPlayerShip(page)).control.barrelRollCooldown).toBe(0);
    await page.waitForTimeout(500);
    await tapLeft();
    await page.waitForTimeout(20);
    await tapLeft();
    await expect
      .poll(async () => (await getPlayerShip(page)).control.barrelRollCooldown)
      .toBeGreaterThan(0);
  });

  test("tapping the MANEUVER button queues a Snap turn", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await page.mouse.move(MANEUVER.x, MANEUVER.y);
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await waitForPlayerManeuver(page, "kturn");
  });

  test("pressing MANEUVER and dragging left queues a Hook Loop (Synthetic Stalker)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "synthetic_collective",
      controller: "player",
      ships: ["synth_stalker"],
    });
    await page.mouse.move(MANEUVER.x, MANEUVER.y);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.move(MANEUVER.x - 36, MANEUVER.y);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await waitForPlayerManeuver(page, "segnor_left");
  });

  test("a single tap on the action zone reaches the secondary weapons (FIRE_SECONDARY)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    await page.mouse.move(ACTION.x, ACTION.y);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    // A single tap fires after the 350 ms double-tap window.
    await expect.poll(() => lastFireOutcome(page)).not.toBeNull();
  });

  test("holding the action zone cloaks a ship with a cloaking device", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, {
      factionId: "free_confederation",
      controller: "player",
      ships: ["confed_raven"],
    });
    await page.mouse.move(ACTION.x, ACTION.y);
    await page.mouse.down();
    await page.waitForTimeout(500); // hold threshold is 400ms
    expect(await playerCloaked(page)).toBe(true);
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
    await waitForPlayerManeuver(page, "bank_left", 1_000);
    await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  });

  test("tapping face button 2 reaches the secondary weapons (FIRE_SECONDARY)", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcade(page, CONFED_KESTREL);
    test.skip(
      !(await gamepadIsAvailable(page)),
      "Phaser did not register the fake gamepad in this environment",
    );

    await tapFakeGamepadButton(page, 2, 150);
    await expect.poll(() => lastFireOutcome(page)).not.toBeNull();
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
