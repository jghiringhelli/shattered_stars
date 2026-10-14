/**
 * Tooltip catalog — every term the setup / picker screens can explain,
 * keyed by term id ("stat.hull", "slot.crew", "role.interceptor"…). Each
 * entry has a title, a plain-language definition, an example and (mostly)
 * how it plays. Text lives per locale so translations can be added later
 * without touching the UI; English is the source and the fallback.
 *
 * Pure data, no Phaser.
 */

import type { ActionType, ShipRole } from "../../core/types";
import type { UpgradeSlotType } from "../../core/upgradeTypes";
import type { FactionId } from "../../config";
import type { AIDifficultyLevel } from "../../ai/AIDifficulty";
import type { Playstyle } from "../roleHints/playstyleCatalog";
import { ACTION_TERMS } from "./actionTerms";
import { BATTLE_TERMS, DIFFICULTY_TERMS, FACTION_TERMS } from "./battleTerms";
import { ROLE_TERMS, STYLE_TERMS } from "./roleTerms";
import { SLOT_TERMS } from "./slotTerms";
import { STAT_TERMS } from "./statTerms";
import type { Locale, TermEntry, TermText } from "./termTypes";
import { UI_TERMS } from "./uiTerms";

export type { Locale, TermEntry, TermGlyph, TermText } from "./termTypes";

const STATIC_TERMS = { ...STAT_TERMS, ...UI_TERMS, ...BATTLE_TERMS };
type StaticTermId = keyof typeof STATIC_TERMS;

/** Every valid term id. */
export type TermId =
  | StaticTermId
  | `action.${ActionType}`
  | `slot.${UpgradeSlotType}`
  | `role.${ShipRole}`
  | `style.${Playstyle}`
  | `faction.${FactionId}`
  | `diff.${AIDifficultyLevel}`;

/** The English catalog (source of truth). */
export const TERM_CATALOG: Readonly<Record<TermId, TermEntry>> = {
  ...STATIC_TERMS,
  ...ACTION_TERMS,
  ...SLOT_TERMS,
  ...ROLE_TERMS,
  ...STYLE_TERMS,
  ...FACTION_TERMS,
  ...DIFFICULTY_TERMS,
};

/** Translations by locale; a missing locale or term falls back to English. */
const TRANSLATIONS: Partial<
  Record<Locale, Partial<Record<TermId, Partial<TermText>>>>
> = {};

/** Locale the UI reads terms in. */
let activeLocale: Locale = "en";

/**
 * Choose the language tooltips are shown in.
 *
 * @param locale - Locale to use (unknown ones read as English).
 */
export function setTermLocale(locale: Locale): void {
  activeLocale = locale;
}

/**
 * @param id - A term id.
 * @param locale - Language (default: the active locale).
 * @returns The entry, translated where a translation exists.
 */
export function termEntry(
  id: TermId,
  locale: Locale = activeLocale,
): TermEntry {
  const base = TERM_CATALOG[id];
  const translated = TRANSLATIONS[locale]?.[id];
  return translated ? { ...base, ...translated } : base;
}

/** @returns Every term id in the catalog. */
export function allTermIds(): readonly TermId[] {
  return Object.keys(TERM_CATALOG) as TermId[];
}

/**
 * @param slot - Upgrade slot type.
 * @returns Its term id.
 */
export function slotTermId(slot: UpgradeSlotType): TermId {
  return `slot.${slot}`;
}

/**
 * @param role - Ship role.
 * @returns Its term id.
 */
export function roleTermId(role: ShipRole): TermId {
  return `role.${role}`;
}

/**
 * @param action - Action key (unknown actions have no term).
 * @returns The term id, or null when the action has no entry.
 */
export function actionTermId(action: string): TermId | null {
  const id = `action.${action}` as TermId;
  return id in TERM_CATALOG ? id : null;
}

/**
 * @param style - Play style.
 * @returns Its term id.
 */
export function styleTermId(style: Playstyle): TermId {
  return `style.${style}`;
}

/**
 * @param faction - Faction id.
 * @returns Its term id.
 */
export function factionTermId(faction: FactionId): TermId {
  return `faction.${faction}`;
}

/**
 * @param level - AI difficulty.
 * @returns Its term id.
 */
export function difficultyTermId(level: AIDifficultyLevel): TermId {
  return `diff.${level}`;
}

/**
 * @param size - Ship size ("small" … "huge").
 * @returns The size's term id.
 */
export function sizeTermId(size: string): TermId {
  return `size.${size}` as TermId;
}
