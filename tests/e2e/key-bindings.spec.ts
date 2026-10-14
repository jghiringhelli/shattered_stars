/**
 * key-bindings.spec.ts — every physical key combination reaches the right
 * maneuver in every direct-pilot battle mode (Dogfight, Ace Duel, Boss
 * Raid, Survival, Campaign, Skirmish), through the shared pilot controls.
 * Continuous Tactical has no direct piloting (dial orders, own specs).
 *
 * The card decides (FlightCapabilities): a special or dash the flown ship's
 * dial / action bar lacks is refused with HUD feedback; a stressed pilot is
 * refused red specials and every action; a huge ship flies none of them.
 * The headless KeyComboTelemetry battery proves each maneuver then ends
 * where X-Wing puts it; this spec proves the keyboard gets there.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  ACE_DUEL,
  BOSS_RAID,
  CAMPAIGN,
  DOGFIGHT,
  SKIRMISH,
  SURVIVAL,
  type BattleEntry,
} from "./helpers/battleEntry";

const PILOTED_BATTLES: readonly BattleEntry[] = [
  DOGFIGHT,
  ACE_DUEL,
  BOSS_RAID,
  SURVIVAL,
  CAMPAIGN,
  SKIRMISH,
];

/** Pause between combos so gesture windows (double taps) close. */
const SETTLE_MS = 450;

type Probe = {
  control: any;
  caps: any;
  label: string | null;
};

/** Installs window.__keys helpers for the scene (reset, read, stress pin). */
async function installProbe(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate(async (key) => {
    const { INITIAL_STRESS } = await import("/src/arcade/ArcadeStress.ts");
    const { flightCapabilitiesOf } =
      await import("/src/arcade/systems/FlightCapabilities.ts");
    const scene = (window as any).game.scene.getScene(key);
    const weapons = scene.secondaryWeapons;
    const ship = () => scene.ships.get(weapons.playerShipId());
    const getControl = (s: any) =>
      s.flight ? s.flight.motion.control : s.control;
    const setFlight = (s: any, control: any, stress: any) => {
      if (s.flight)
        s.flight = { motion: { ...s.flight.motion, control }, stress };
      else {
        s.control = control;
        s.stress = stress;
      }
    };
    const w = window as any;
    w.__keys = {
      stressed: false,
      read: () => {
        const s = ship();
        const control = getControl(s);
        return {
          control: { ...control, maneuverPath: undefined },
          caps: control.capabilities ?? null,
          label: weapons.feedback.lastLabel,
        };
      },
      reset: () => {
        const s = ship();
        s.hull = Math.max(s.hull, s.maxHull);
        const control = {
          ...getControl(s),
          kturnCooldown: 0,
          boostCooldown: 0,
          barrelRollCooldown: 0,
          nextManeuver: null,
        };
        setFlight(s, control, INITIAL_STRESS);
        weapons.feedback.reset();
      },
      setRollCooldown: (ms: number) => {
        const s = ship();
        const control = { ...getControl(s), barrelRollCooldown: ms };
        setFlight(s, control, s.flight ? s.flight.stress : s.stress);
      },
      makeHuge: () => {
        const s = ship();
        const control = {
          ...getControl(s),
          capabilities: flightCapabilitiesOf("terran_imperator"),
        };
        setFlight(s, control, s.flight ? s.flight.stress : s.stress);
      },
    };
    // A stressed pilot stays stressed for the whole check.
    scene.events.on("preupdate", () => {
      if (!w.__keys.stressed) return;
      const s = ship();
      if (!s) return;
      const stress = { level: 0.95, isStressed: true };
      setFlight(s, getControl(s), stress);
    });
  }, sceneKey);
}

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as any).__keys.read());

async function reset(page: Page): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => (window as any).__keys.reset());
}

async function pressKey(page: Page, key: string, shift = false): Promise<void> {
  if (shift) await page.keyboard.down("Shift");
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
  if (shift) await page.keyboard.up("Shift");
}

async function doubleTap(page: Page, key: string): Promise<void> {
  await pressKey(page, key);
  await page.waitForTimeout(60);
  await pressKey(page, key);
}

/** Two quick taps of one arrow (the barrel-roll gesture). */
async function rollDoubleTap(page: Page, key: string): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down(key);
    await page.waitForTimeout(50);
    await page.keyboard.up(key);
    if (i === 0) await page.waitForTimeout(40);
  }
}

/** Hold the maneuver key Z and press an arrow: a Hook Loop. */
async function hookCombo(page: Page, arrow: string): Promise<void> {
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await page.keyboard.down(arrow);
  await page.waitForTimeout(120);
  await page.keyboard.up(arrow);
  await page.keyboard.up("z");
}

/** Double-tap Z, keep the second press down and add an arrow: a Knife Roll. */
async function knifeCombo(page: Page, arrow: string): Promise<void> {
  await page.keyboard.down("z");
  await page.waitForTimeout(50);
  await page.keyboard.up("z");
  await page.waitForTimeout(40);
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await page.keyboard.down(arrow);
  await page.waitForTimeout(120);
  await page.keyboard.up(arrow);
  await page.keyboard.up("z");
}

/** A special the keys ask for, its refusal label and the cards' key. */
interface SpecialCombo {
  readonly name: string;
  readonly press: (page: Page) => Promise<void>;
  readonly maneuver: string;
  readonly cardKey: string;
  readonly label: string;
}

const SPECIALS: readonly SpecialCombo[] = [
  {
    name: "Z",
    press: (p) => pressKey(p, "z"),
    maneuver: "kturn",
    cardKey: "kturn",
    label: "SNAP",
  },
  {
    name: "↓↓",
    press: (p) => doubleTap(p, "ArrowDown"),
    maneuver: "kturn",
    cardKey: "kturn",
    label: "SNAP",
  },
  {
    name: "Z + ←",
    press: (p) => hookCombo(p, "ArrowLeft"),
    maneuver: "segnor_left",
    cardKey: "segnor_left",
    label: "HOOK LOOP",
  },
  {
    name: "Z + →",
    press: (p) => hookCombo(p, "ArrowRight"),
    maneuver: "segnor_right",
    cardKey: "segnor_right",
    label: "HOOK LOOP",
  },
  {
    name: "Z Z + ←",
    press: (p) => knifeCombo(p, "ArrowLeft"),
    maneuver: "tallon_left",
    cardKey: "tallon_left",
    label: "KNIFE ROLL",
  },
  {
    name: "Z Z + →",
    press: (p) => knifeCombo(p, "ArrowRight"),
    maneuver: "tallon_right",
    cardKey: "tallon_right",
    label: "KNIFE ROLL",
  },
];
/** The maneuver queued/flown, or the refusal the card or stress demands. */
async function expectSpecial(
  page: Page,
  combo: SpecialCombo,
  stressed: boolean,
): Promise<void> {
  const { caps } = await probe(page);
  const difficulty = caps?.specials?.[combo.cardKey];
  const expected = !difficulty
    ? `${combo.label} NOT ON DIAL`
    : stressed && difficulty === "red"
      ? `STRESSED: NO ${combo.label}`
      : null;
  await combo.press(page);
  if (expected === null) {
    await expect
      .poll(
        async () => {
          const c = (await probe(page)).control;
          return (
            c.nextManeuver === combo.maneuver ||
            c.currentManeuver === combo.maneuver
          );
        },
        { message: `${combo.name} → ${combo.maneuver}`, timeout: 2_000 },
      )
      .toBe(true);
    return;
  }
  await expect
    .poll(async () => (await probe(page)).label, {
      message: combo.name,
      timeout: 2_000,
    })
    .toBe(expected);
  expect((await probe(page)).control.nextManeuver).not.toBe(combo.maneuver);
}

/** A dash the keys ask for. */
async function expectDash(
  page: Page,
  dash: "boost" | "barrel_roll",
  stressed: boolean,
): Promise<void> {
  const before = await probe(page);
  const onBar = dash === "boost" ? before.caps?.boost : before.caps?.barrelRoll;
  const name = dash === "boost" ? "BOOST" : "BARREL ROLL";
  if (dash === "boost") await doubleTap(page, "ArrowUp");
  else await rollDoubleTap(page, "ArrowLeft");
  await page.waitForTimeout(80);
  const after = await probe(page);
  const cooldown =
    dash === "boost"
      ? after.control.boostCooldown
      : after.control.barrelRollCooldown;
  if (onBar && !stressed) {
    expect(cooldown, `${name} performed`).toBeGreaterThan(0);
  } else {
    expect(cooldown, `${name} refused`).toBe(0);
    if (dash === "boost") {
      await expect
        .poll(async () => (await probe(page)).label, { timeout: 2_000 })
        .toBe(onBar ? `STRESSED: NO ${name}` : `NO ${name} ACTION`);
    } else {
      // A double-tap of ← is ordinary steering when the roll is unavailable:
      // no refusal chatter, the ship just banks.
      expect((await probe(page)).label, `${name} stays silent`).toBeNull();
    }
  }
  if (dash === "boost") expect(after.control.speed).toBe(before.control.speed);
  // A performed roll cancels the drift its first tap queued; a refused one just steers.
  if (dash === "barrel_roll" && onBar && !stressed)
    expect(after.control.nextManeuver).toBeNull();
}

async function enter(page: Page, entry: BattleEntry): Promise<void> {
  await entry.enter(page, { peaceful: true });
  await page.waitForFunction(
    (key) =>
      !!(window as any).game.scene
        .getScene(key)
        .secondaryWeapons?.playerShipId(),
    entry.sceneKey,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);
  await installProbe(page, entry.sceneKey);
}

for (const entry of PILOTED_BATTLES) {
  test.describe(`key bindings — ${entry.sceneKey}`, () => {
    test("every combo reaches its maneuver, or says why the card refuses it", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await enter(page, entry);
      for (const [key, maneuver] of [
        ["q", "turn_left"],
        ["e", "turn_right"],
      ] as const) {
        await reset(page);
        await pressKey(page, key);
        await expect
          .poll(
            async () => {
              const c = (await probe(page)).control;
              return (
                c.nextManeuver === maneuver || c.currentManeuver === maneuver
              );
            },
            { message: `${key} → ${maneuver}` },
          )
          .toBe(true);
      }
      for (const combo of SPECIALS) {
        await reset(page);
        await expectSpecial(page, combo, false);
      }
      await reset(page);
      await expectDash(page, "boost", false);
      await reset(page);
      await expectDash(page, "barrel_roll", false);
      await reset(page);
      const speed = (await probe(page)).control.speed;
      await pressKey(page, "ArrowUp");
      await page.waitForTimeout(60);
      expect((await probe(page)).control.speed).toBe(
        Math.min(speed + 1, (await probe(page)).control.maxSpeed),
      );
    });

    test("a stressed pilot is refused red specials and boost (a roll double-tap just steers)", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await enter(page, entry);
      await page.evaluate(() => ((window as any).__keys.stressed = true));
      for (const combo of SPECIALS) {
        await reset(page);
        await expectSpecial(page, combo, true);
      }
      await reset(page);
      await expectDash(page, "boost", true);
      await reset(page);
      await expectDash(page, "barrel_roll", true);
    });

    test("ordinary steering never rolls: alternating ← →, single taps, and double steering on the roll's recharge", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await enter(page, entry);
      const rollCooldown = async (): Promise<number> =>
        (await probe(page)).control.barrelRollCooldown;
      await reset(page);
      for (let i = 0; i < 6; i++)
        await pressKey(page, i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
      await page.waitForTimeout(80);
      expect(await rollCooldown(), "alternating ← → rolls nothing").toBe(0);
      await reset(page);
      await pressKey(page, "ArrowLeft");
      await page.waitForTimeout(80);
      expect(await rollCooldown(), "a single tap rolls nothing").toBe(0);
      await reset(page);
      await page.evaluate(() => (window as any).__keys.setRollCooldown(2500));
      await rollDoubleTap(page, "ArrowLeft");
      await page.waitForTimeout(60);
      const { control, label } = await probe(page);
      expect(control.barrelRollCooldown, "no new roll started").toBeLessThan(
        2600,
      );
      expect(label, "no refusal chatter").toBeNull();
      expect(
        [control.nextManeuver, control.currentManeuver].some(
          (m: string | null) => m?.endsWith("left"),
        ),
        "the double steering steered left",
      ).toBe(true);
    });

    test("a huge ship flies no Snap turn, Hook, Knife, boost or barrel roll (the roll double-tap steers)", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await enter(page, entry);
      for (const combo of SPECIALS.filter((s) =>
        ["Z", "Z + ←", "Z Z + →"].includes(s.name),
      )) {
        await reset(page);
        await page.evaluate(() => (window as any).__keys.makeHuge());
        await expectSpecial(page, combo, false);
      }
      for (const dash of ["boost", "barrel_roll"] as const) {
        await reset(page);
        await page.evaluate(() => (window as any).__keys.makeHuge());
        await expectDash(page, dash, false);
      }
    });
  });
}

test("R → MARK_TARGET marks the HUD target for the player's side (Dogfight)", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await page.waitForTimeout(400);
  const marked = (): Promise<string | null> =>
    page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.crew.markedTargetOf("player", scene.time.now);
    }, DOGFIGHT.sceneKey);
  expect(await marked()).toBeNull();
  await pressKey(page, "r");
  await expect.poll(marked, { timeout: 2_000 }).toBe("ai_0");
});
