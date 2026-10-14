/**
 * Map theme data types (see mapThemes.ts for the catalog and selection).
 */

import type { BackgroundId } from "../../assets/assetManifest";

/** Kinds of decorative drifting things. */
export type DecorKind = "rock" | "debris" | "shard";

/** Planet sprite flavours (procedural). */
export type PlanetKind = "rocky" | "gas" | "ice" | "ringed";

/** A large body whose limb crosses the far parallax layer. */
export interface PlanetSpec {
  readonly kind: PlanetKind;
  readonly color: number;
  /** Display scale of the 256 px planet texture. */
  readonly scale: number;
}

/** One selectable look. */
export interface MapTheme {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Painted backdrop (tiled, slow parallax); null = pure procedural sky. */
  readonly backdrop: BackgroundId | null;
  readonly backdropTint: number;
  readonly backdropAlpha: number;
  /** Camera background colour behind every layer. */
  readonly skyColor: number;
  /** 1 = baseline star count per layer. */
  readonly starDensity: number;
  readonly starTints: readonly number[];
  /** Dust specks (0 = none) and their tint. */
  readonly dustAmount: number;
  readonly dustColor: number;
  /** Soft nebula wisps drawn additively. */
  readonly wispCount: number;
  readonly wispColors: readonly number[];
  readonly wispAlpha: number;
  /** Decoration counts in the decor field (see decorField.ts). */
  readonly rocks: number;
  readonly debris: number;
  readonly shards: number;
  readonly rockTint: number;
  readonly debrisTint: number;
  readonly shardTint: number;
  readonly planet: PlanetSpec | null;
}
