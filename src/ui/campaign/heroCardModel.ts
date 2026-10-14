/**
 * heroCardModel — what the hero card says on each tab: the overview (hero,
 * key / name / rank of each power), the effects (what each rank does, in
 * numbers) and the lore. Pure: no Phaser.
 */

import {
  POWER_UNLOCK_SCHEDULE,
} from "../../data/campaign/heroPowers";
import type {
  FactionHero,
  HeroPowerDefinition,
  HeroPowerEffect,
} from "../../campaign/powers/heroPowerTypes";
import { termEntry, type TermId } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";

/** Key of each power slot (default bindings). */
export const POWER_KEYS = ["V", "B"] as const;

const PERCENT = 100;
const MS_PER_SECOND = 1000;

/** One power on the overview. */
export interface PowerOverview {
  readonly key: (typeof POWER_KEYS)[number];
  readonly power: HeroPowerDefinition;
  readonly rank: number;
  readonly locked: boolean;
  /** "[V]  ✸  ORBITAL STRIKE · RANK II". */
  readonly line: string;
  readonly term: TermId;
}

const POWER_TERMS: Readonly<Record<string, TermId>> = {
  orbital_strike: "campaign.power_orbital_strike",
  shield_overcharge: "campaign.power_shield_overcharge",
  rally_the_fleet: "campaign.power_rally_the_fleet",
  field_repair: "campaign.power_field_repair",
  drone_swarm: "campaign.power_drone_swarm",
  emp_burst: "campaign.power_emp_burst",
  cloak_dash: "campaign.power_cloak_dash",
  scatter_mines: "campaign.power_scatter_mines",
  time_slow: "campaign.power_time_slow",
  psionic_lance: "campaign.power_psionic_lance",
};

/**
 * @param power - A hero power.
 * @returns The catalog term that explains it.
 */
export function powerTermId(power: HeroPowerDefinition): TermId {
  return POWER_TERMS[power.id] ?? "campaign.hero_key";
}

/**
 * @param slot - Power slot.
 * @returns Completed missions needed before rank I.
 */
export function unlockMissions(slot: 0 | 1): number {
  return (
    POWER_UNLOCK_SCHEDULE.find((s) => s.slot === slot && s.rank === 1)
      ?.completedMissions ?? 0
  );
}

/**
 * @param hero - The faction's hero.
 * @param ranks - Saved power ranks by power id.
 * @returns Name, title and the two powers' overview lines.
 */
export function heroOverview(
  hero: FactionHero,
  ranks: Readonly<Record<string, number>>,
): { name: string; title: string; powers: readonly PowerOverview[] } {
  return {
    name: hero.name,
    title: hero.title,
    powers: hero.powers.map((power, i) => {
      const rank = ranks[power.id] ?? 0;
      const slot = i as 0 | 1;
      const status =
        rank > 0
          ? `RANK ${"I".repeat(rank)}`
          : `LOCKED \u00b7 ${unlockMissions(slot)} MISSIONS`;
      return {
        key: POWER_KEYS[slot],
        power,
        rank,
        locked: rank <= 0,
        line: `[${POWER_KEYS[slot]}]  ${power.glyph}  ${power.name.toUpperCase()} \u00b7 ${status}`,
        term: powerTermId(power),
      };
    }),
  };
}

const seconds = (ms: number): string => `${ms / MS_PER_SECOND} s`;
const percent = (fraction: number): string =>
  `${Math.round(fraction * PERCENT)}%`;

/** @returns The effect's numbers, in reading order. */
function effectFacts(effect: HeroPowerEffect): string[] {
  switch (effect.kind) {
    case "orbital_strike":
      return [`${effect.damage} dmg`, `${effect.radius} radius`];
    case "shield_overcharge":
      return [
        seconds(effect.durationMs),
        `-${percent(1 - effect.damageTakenMultiplier)} damage taken`,
      ];
    case "rally":
      return [
        seconds(effect.durationMs),
        `-${percent(1 - effect.intervalMultiplier)} fire interval`,
      ];
    case "field_repair":
      return [
        `${percent(effect.selfHullFraction)} self`,
        `${percent(effect.allyHullFraction)} allies`,
      ];
    case "drone_swarm":
      return [`${effect.count} drones`, seconds(effect.lifetimeMs)];
    case "emp_burst":
      return [`${seconds(effect.disableMs)} silence`, `${effect.radius} radius`];
    case "cloak_dash":
      return [`${effect.distance} dash`, `${seconds(effect.durationMs)} cloak`];
    case "scatter_mines":
      return [`${effect.count} mines`, `${effect.damage} dmg each`];
    case "time_slow":
      return [
        seconds(effect.durationMs),
        `enemies at ${percent(effect.enemyTimeScale)} speed`,
      ];
    case "psionic_lance":
      return [`${effect.damage} dmg`, `${effect.range} range`];
  }
}

/**
 * @param power - A hero power.
 * @returns One line per rank: "I · recharge · effect numbers".
 */
export function powerRankLines(power: HeroPowerDefinition): string[] {
  return power.ranks.map((rank, i) =>
    [
      "I".repeat(i + 1),
      seconds(rank.cooldownMs),
      ...effectFacts(rank.effect),
    ].join(" \u00b7 "),
  );
}

/**
 * @param campaign - The faction campaign's description and protagonist line.
 * @returns The two lore lines of the lore tab: the story and who the campaign follows.
 */
export function heroLoreLines(campaign: {
  readonly description: string;
  readonly protagonist: string;
}): { story: string; cast: string } {
  return { story: campaign.description, cast: campaign.protagonist };
}

/** Gamepad button that casts each power slot (default bindings). */
const POWER_PADS = ["Y", "L3"] as const;

/**
 * @param overview - One power of the overview.
 * @returns Its tooltip: what it does, its key, what its rank / lock means, an example.
 */
export function powerTooltip(overview: PowerOverview): TooltipContent {
  const entry = termEntry(overview.term);
  const pad = POWER_PADS[POWER_KEYS.indexOf(overview.key)];
  const state = overview.locked
    ? termEntry("campaign.hero_locked").definition
    : termEntry("campaign.hero_rank").definition;
  return {
    title: `${overview.power.name} \u00b7 ${overview.key}`,
    body: entry.definition,
    howItPlays: `Cast with ${overview.key} (gamepad ${pad}). ${state}`,
    example: entry.example,
    ...(entry.glyph ? { glyph: entry.glyph } : {}),
  };
}

/**
 * @param power - The power in a HUD slot.
 * @param slot - Slot index (0 = V, 1 = B).
 * @param rank - Current rank (0 = locked).
 * @param cooldownSeconds - Seconds until it can be cast again (0 = ready).
 * @returns The slot's tooltip: the power's explanation plus its live state.
 */
export function slotTooltip(
  power: HeroPowerDefinition,
  slot: 0 | 1,
  rank: number,
  cooldownSeconds: number,
): TooltipContent {
  const base = powerTooltip({
    key: POWER_KEYS[slot],
    power,
    rank,
    locked: rank <= 0,
    line: "",
    term: powerTermId(power),
  });
  if (rank <= 0 || cooldownSeconds <= 0) return base;
  return {
    ...base,
    howItPlays: `Recharging: ${cooldownSeconds} s left. ${base.howItPlays ?? ""}`.trim(),
  };
}
