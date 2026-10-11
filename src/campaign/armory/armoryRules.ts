/**
 * armoryRules — buying, swapping and refunding campaign Armory mods. One mod
 * per slot; the ledger remembers what was paid so refunds are exact even if
 * prices change. Respec (refund everything) is free between missions. Pure.
 */

import { getArmoryMod, type ArmorySlot } from "../../data/campaign/armory";

/** Installed mods and the price paid for each. */
export interface ArmoryLedger {
  readonly installed: Readonly<Record<string, number>>;
}

/** Why an install was refused. */
export type InstallRefusal =
  "unknown_mod" | "insufficient_credits" | "already_installed";

/** Result of an install attempt. */
export type InstallResult =
  | {
      readonly ok: true;
      readonly credits: number;
      readonly ledger: ArmoryLedger;
    }
  | { readonly ok: false; readonly reason: InstallRefusal };

/** Credits and ledger after a refund. */
export interface RefundResult {
  readonly credits: number;
  readonly ledger: ArmoryLedger;
}

/** An empty armory. */
export const EMPTY_ARMORY: ArmoryLedger = { installed: {} };

/**
 * @param ledger - Armory ledger.
 * @param slot - A slot.
 * @returns Id of the mod installed there, or null.
 */
export function installedInSlot(
  ledger: ArmoryLedger,
  slot: ArmorySlot,
): string | null {
  return (
    Object.keys(ledger.installed).find(
      (id) => getArmoryMod(id)?.slot === slot,
    ) ?? null
  );
}

/**
 * Removes a mod, refunding what was paid for it.
 *
 * @param credits - Current credits.
 * @param ledger - Armory ledger.
 * @param modId - Mod to remove.
 * @returns Credits and ledger after the refund (unchanged if not installed).
 */
export function uninstallMod(
  credits: number,
  ledger: ArmoryLedger,
  modId: string,
): RefundResult {
  const paid = ledger.installed[modId];
  if (paid === undefined) return { credits, ledger };
  const installed = { ...ledger.installed };
  delete installed[modId];
  return { credits: credits + paid, ledger: { installed } };
}

/**
 * Installs a mod, swapping out (and refunding) whatever held its slot.
 *
 * @param credits - Current credits.
 * @param ledger - Armory ledger.
 * @param modId - Mod to install.
 * @returns The new credits/ledger, or why it was refused.
 */
export function installMod(
  credits: number,
  ledger: ArmoryLedger,
  modId: string,
): InstallResult {
  const mod = getArmoryMod(modId);
  if (!mod) return { ok: false, reason: "unknown_mod" };
  if (ledger.installed[modId] !== undefined)
    return { ok: false, reason: "already_installed" };
  const current = installedInSlot(ledger, mod.slot);
  const freed = current
    ? uninstallMod(credits, ledger, current)
    : { credits, ledger };
  if (freed.credits < mod.cost)
    return { ok: false, reason: "insufficient_credits" };
  return {
    ok: true,
    credits: freed.credits - mod.cost,
    ledger: { installed: { ...freed.ledger.installed, [modId]: mod.cost } },
  };
}

/**
 * Free respec: refunds every installed mod.
 *
 * @param credits - Current credits.
 * @param ledger - Armory ledger.
 * @returns Credits with every refund and an empty armory.
 */
export function respecArmory(
  credits: number,
  ledger: ArmoryLedger,
): RefundResult {
  const refund = Object.values(ledger.installed).reduce(
    (sum, paid) => sum + paid,
    0,
  );
  return { credits: credits + refund, ledger: EMPTY_ARMORY };
}
