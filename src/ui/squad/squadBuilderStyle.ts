/**
 * squadBuilderStyle — shared holo styling for the squad builder widgets:
 * text roles, team / squad accents and flash colours. Pure helpers built on
 * the HoloTheme tokens so every squad widget reads from one place.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { TEAM_COLORS } from "../../core/squadTypes";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_PALETTE,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "../theme/HoloTheme";
import { liftColor, toCssColor } from "../theme/colorMath";

/** How far raw team colours are lifted to read as borders/captions. */
const TEAM_ACCENT_LIFT = 0.35;

/** Font sizes used by squad widgets (never below 12 px). */
export const SQUAD_TYPE = {
  caption: HOLO_TYPE_SCALE.caption.size,
  small: 12,
  label: 12,
  body: 13,
  name: 14,
} as const;

/** Text colours used when flashing feedback on the instruction line. */
export const FLASH_COLORS = {
  warning: toCssColor(HOLO_PALETTE.warning),
  danger: toCssColor(HOLO_PALETTE.danger),
} as const;

/** Options for {@link addSquadText}. */
export interface SquadTextOptions {
  readonly size: number;
  readonly weight?: string;
  readonly color?: number;
  readonly letterSpacing?: number;
}

/**
 * Create a text object in the holo family.
 *
 * @param scene - Owning scene.
 * @param x - Local x (origin 0,0 unless changed by the caller).
 * @param y - Local y.
 * @param content - Text content (kept verbatim).
 * @param options - Size, weight, colour and tracking.
 * @returns The text object (on the scene display list).
 */
export function addSquadText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  options: SquadTextOptions,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, content, {
      ...holoFont(options.size, options.weight ?? "400"),
      color: toCssColor(options.color ?? HOLO_PALETTE.textPrimary),
    })
    .setLetterSpacing(options.letterSpacing ?? 0);
}

/**
 * Uppercase tracked caption (section headings, lane titles).
 *
 * @param scene - Owning scene.
 * @param x - Local x.
 * @param y - Local y.
 * @param content - Caption text (uppercased).
 * @param color - Caption colour. Default: secondary text.
 * @returns The text object.
 */
export function addCaption(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  color: number = HOLO_PALETTE.textSecondary,
): Phaser.GameObjects.Text {
  return addSquadText(scene, x, y, content.toUpperCase(), {
    size: SQUAD_TYPE.caption,
    weight: HOLO_TYPE_SCALE.caption.weight,
    color,
    letterSpacing: HOLO_TYPE_SCALE.caption.letterSpacing,
  });
}

/**
 * Legible accent for a team (T1–T4).
 *
 * @param teamId - Team number 1–4.
 * @returns Lifted team colour, or the neutral border colour when unknown.
 */
export function teamAccent(teamId: number): number {
  const raw = TEAM_COLORS[teamId - 1];
  return raw === undefined
    ? HOLO_PALETTE.border
    : liftColor(raw, TEAM_ACCENT_LIFT);
}

/**
 * Accent for a squad: its faction accent, or the neutral border colour.
 *
 * @param factionId - Squad faction (null when unset).
 * @returns Border / header colour.
 */
export function squadAccent(factionId: FactionId | null): number {
  return factionId === null ? HOLO_PALETTE.border : factionAccent(factionId);
}

/**
 * Shorten a string to at most `maxChars` characters, ending with an ellipsis.
 *
 * @param text - Source text.
 * @param maxChars - Maximum length including the ellipsis.
 * @returns The original or truncated text.
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}\u2026`;
}
