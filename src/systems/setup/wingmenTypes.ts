/**
 * wingmenTypes — the ids of the Skirmish WINGMEN choice (kept apart from the
 * fill logic so setup memory and share codes can validate them without
 * loading the ship catalog). Pure.
 */

/** Every wingmen choice, in the order the Skirmish screen lists them. */
export const WINGMEN_TYPES = [
  "auto",
  "same_role",
  "fighters",
  "strikers",
  "support_heavy",
  "custom",
] as const;

/** What kind of squad accompanies the player. */
export type WingmenType = (typeof WINGMEN_TYPES)[number];

/** The recommended choice: balanced by role. */
export const DEFAULT_WINGMEN: WingmenType = "auto";

/**
 * @param value - A stored value.
 * @returns Whether it is a known wingmen type.
 */
export function isWingmenType(value: unknown): value is WingmenType {
  return typeof value === "string" && (WINGMEN_TYPES as readonly string[]).includes(value);
}
