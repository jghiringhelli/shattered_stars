/**
 * Survival roguelite — text events (pure data contracts).
 *
 * An event is a short encounter with 2–3 choices. A choice can cost
 * salvage, require something (FTL-style "blue" options gated by faction,
 * escorts or relic tags), apply outcomes, or gamble between a success and
 * a failure outcome list. Resolution lives in src/systems/survival/EventResolver.ts.
 */

import type { FactionId } from "../../config";
import type { RelicRarity, SynergyTag } from "./relics";

/** One consequence of an event choice. */
export type EventOutcome =
  | { readonly kind: "salvage"; readonly amount: number }
  /** Fraction of every ship's max hull repaired (negative = damage). */
  | { readonly kind: "hull"; readonly fraction: number }
  | { readonly kind: "relic"; readonly minRarity?: RelicRarity }
  | { readonly kind: "escort" }
  | { readonly kind: "loseEscort" }
  | { readonly kind: "rerolls"; readonly amount: number }
  | { readonly kind: "power" }
  | { readonly kind: "upgrade" }
  /** A battle; `creature` adds that creature (an elite spawn) to its last wave. */
  | {
      readonly kind: "combat";
      readonly elite: boolean;
      readonly creature?: string | undefined;
    }
  | { readonly kind: "meta"; readonly amount: number };

/** Something a choice needs to be selectable. */
export interface EventRequirement {
  readonly faction?: FactionId;
  readonly minEscorts?: number;
  readonly minRerolls?: number;
  readonly relicTag?: SynergyTag;
}

/** A 50/50-or-other gamble between two outcome lists. */
export interface EventGamble {
  readonly chance: number;
  readonly success: readonly EventOutcome[];
  readonly failure: readonly EventOutcome[];
}

/** One option of an event. */
export interface EventChoice {
  readonly label: string;
  readonly description: string;
  /** Salvage paid up front (choice disabled when unaffordable). */
  readonly cost?: number;
  readonly requires?: EventRequirement;
  readonly outcomes?: readonly EventOutcome[];
  readonly gamble?: EventGamble;
}

/** A text event. */
export interface SurvivalEvent {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly text: string;
  /** Flavour faction (shown in the header; does not gate the event). */
  readonly faction?: FactionId;
  readonly choices: readonly EventChoice[];
}
