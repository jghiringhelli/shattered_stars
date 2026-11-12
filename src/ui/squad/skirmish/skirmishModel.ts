/**
 * skirmishModel — the Skirmish setup as pure data: the three ordered steps
 * (your ship, your wingmen, the enemy and battle) with their title and one
 * sentence, the text of every wingmen type, the squad list rows and the
 * NEXT / LAUNCH button state. No Phaser.
 */

import { assignQuickBuilds } from "../../../arcade/systems/QuickBuildEquip";
import { SHIP_DEFINITIONS } from "../../../data/ShipDefinitions";
import { getLoadoutById } from "../../../data/ShipLoadouts";
import { ROLE_PLURALS } from "../../../data/roleHints/playstyleCatalog";
import { t, type PlainMessageKey } from "../../../i18n";
import type { WingmenType } from "../../../systems/setup/wingmenTypes";

/** The steps, in the order the player goes through them. */
export const SKIRMISH_STEPS = ["ship", "wingmen", "battle"] as const;

/** One step of the Skirmish setup. */
export type SkirmishStep = (typeof SKIRMISH_STEPS)[number];

const STEP_KEYS: Readonly<Record<SkirmishStep, { title: PlainMessageKey; sentence: PlainMessageKey }>> = {
  ship: { title: "skirmish.step.ship.title", sentence: "skirmish.step.ship.sentence" },
  wingmen: { title: "skirmish.step.wingmen.title", sentence: "skirmish.step.wingmen.sentence" },
  battle: { title: "skirmish.step.battle.title", sentence: "skirmish.step.battle.sentence" },
};

const WINGMEN_KEYS: Readonly<Record<WingmenType, { title: PlainMessageKey; body: PlainMessageKey }>> = {
  auto: { title: "skirmish.wingmen.type.auto.title", body: "skirmish.wingmen.type.auto.body" },
  same_role: { title: "skirmish.wingmen.type.sameRole.title", body: "skirmish.wingmen.type.sameRole.body" },
  fighters: { title: "skirmish.wingmen.type.fighters.title", body: "skirmish.wingmen.type.fighters.body" },
  strikers: { title: "skirmish.wingmen.type.strikers.title", body: "skirmish.wingmen.type.strikers.body" },
  support_heavy: {
    title: "skirmish.wingmen.type.supportHeavy.title",
    body: "skirmish.wingmen.type.supportHeavy.body",
  },
  custom: { title: "skirmish.wingmen.type.custom.title", body: "skirmish.wingmen.type.custom.body" },
};

/**
 * @param step - A step.
 * @returns Its title and the one sentence under it.
 */
export function stepText(step: SkirmishStep): { title: string; sentence: string } {
  const keys = STEP_KEYS[step];
  return { title: t(keys.title), sentence: t(keys.sentence) };
}

/**
 * @param type - A wingmen type.
 * @returns Its label and what it does, in one sentence.
 */
export function wingmenText(type: WingmenType): { title: string; body: string } {
  const keys = WINGMEN_KEYS[type];
  return { title: t(keys.title), body: t(keys.body) };
}

/**
 * @param step - The current step.
 * @returns The step after it, or null on the last one.
 */
export function nextStep(step: SkirmishStep): SkirmishStep | null {
  return SKIRMISH_STEPS[SKIRMISH_STEPS.indexOf(step) + 1] ?? null;
}

/** One ship of the squad list. */
export interface SquadRow {
  readonly shipId: string;
  readonly name: string;
  /** "HEAVY FIGHTER" style role name. */
  readonly roleLabel: string;
  /** Quick build it flies (null = bare hull). */
  readonly buildName: string | null;
  /** Flown cost: the build's points, else the hull's. */
  readonly cost: number;
  readonly isFlagship: boolean;
}

/**
 * @param ships - The squad, flagship first.
 * @param loadoutChoices - Chosen builds by squad index.
 * @returns The rows, priced as the battle flies them (default builds, unique pilots once).
 */
export function squadRows(
  ships: readonly string[],
  loadoutChoices: Readonly<Record<string, string>>,
): SquadRow[] {
  const builds = assignQuickBuilds(
    ships,
    ships.map((_, index) => loadoutChoices[String(index)]),
  );
  return ships.map((shipId, index) => {
    const def = SHIP_DEFINITIONS[shipId];
    const build = builds[index] ? getLoadoutById(builds[index]!) : undefined;
    return {
      shipId,
      name: def?.name ?? shipId,
      roleLabel: (def ? ROLE_PLURALS[def.role] : "").replace(/s$/, "").toUpperCase(),
      buildName: build?.name ?? null,
      cost: build?.pointCost ?? def?.baseStats.pointCost ?? 0,
      isFlagship: index === 0,
    };
  });
}

/** State of the NEXT / LAUNCH button. */
export interface NavButtonState {
  readonly label: string;
  readonly enabled: boolean;
  /** Whether pressing it starts the battle. */
  readonly launches: boolean;
}

/**
 * @param step - The open step.
 * @param hasShip - Whether a ship is staged.
 * @returns NEXT on the first steps, LAUNCH on the last (disabled until a ship is staged).
 */
export function navButton(step: SkirmishStep, hasShip: boolean): NavButtonState {
  if (nextStep(step) !== null) return { label: t("skirmish.nav.next"), enabled: true, launches: false };
  return {
    label: hasShip ? t("skirmish.nav.launch") : t("skirmish.nav.needShip"),
    enabled: hasShip,
    launches: true,
  };
}
