/**
 * hubActions — the hub's Armory and Research actions applied to a campaign
 * save: toggle a mod (buy / refund), free respec, permanent research pick.
 * Pure; the hub scene persists the returned save.
 */

import type { ResearchPick } from "../../data/campaign/research";
import {
  installMod,
  respecArmory as respecLedger,
  uninstallMod,
} from "../armory/armoryRules";
import { chooseResearch } from "../armory/researchRules";
import type { CampaignSaveData } from "../save/campaignSaveTypes";

/** Result of a hub action. */
export interface HubActionResult {
  readonly ok: boolean;
  readonly save: CampaignSaveData;
  readonly reason?: string;
}

/**
 * Buys a mod, or refunds it when already installed.
 *
 * @param save - Campaign save.
 * @param modId - Mod to toggle.
 * @returns The new save (unchanged on refusal).
 */
export function toggleArmoryMod(
  save: CampaignSaveData,
  modId: string,
): HubActionResult {
  if (save.armory.installed[modId] !== undefined) {
    const refund = uninstallMod(save.credits, save.armory, modId);
    return {
      ok: true,
      save: {
        ...save,
        credits: refund.credits,
        armory: { installed: { ...refund.ledger.installed } },
      },
    };
  }
  const result = installMod(save.credits, save.armory, modId);
  if (!result.ok) return { ok: false, save, reason: result.reason };
  return {
    ok: true,
    save: {
      ...save,
      credits: result.credits,
      armory: { installed: { ...result.ledger.installed } },
    },
  };
}

/**
 * @param save - Campaign save.
 * @returns It with every mod refunded (free respec between missions).
 */
export function respecArmory(save: CampaignSaveData): CampaignSaveData {
  const refund = respecLedger(save.credits, save.armory);
  return {
    ...save,
    credits: refund.credits,
    armory: { installed: { ...refund.ledger.installed } },
  };
}

/**
 * @param save - Campaign save.
 * @param tierId - Research tier.
 * @param pick - Option chosen.
 * @returns The new save (unchanged on refusal).
 */
export function pickResearch(
  save: CampaignSaveData,
  tierId: string,
  pick: ResearchPick,
): HubActionResult {
  const result = chooseResearch(
    save.research,
    save.researchPoints,
    tierId,
    pick,
  );
  if (!result.ok) return { ok: false, save, reason: result.reason };
  return { ok: true, save: { ...save, research: { ...result.choices } } };
}
