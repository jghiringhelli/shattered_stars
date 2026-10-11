/**
 * Survival roguelite — shop (pure): seeded stock per shop node and
 * purchases that consume salvage. Each item can be bought once per visit.
 */

import {
  SHOP_PRICES,
  SHOP_REPAIR_FRACTION,
  MAX_SHIP_UPGRADES,
} from "../../data/survival/economy";
import { MAX_ESCORTS } from "../../data/survival/escorts";
import { drawRelics, RELIC_PRICE } from "../../data/survival/relicCatalog";
import { rngFor } from "./RunRng";
import {
  addEscort,
  adjustFleetHull,
  fleetOf,
  upgradeShip,
  withLog,
} from "./RunState";
import { repairFraction, shopPrice, spendSalvage } from "./RunEconomy";
import { grantRelic } from "./RewardFlow";
import type { RunState } from "./RunTypes";

export type ShopItemKind = "repair" | "relic" | "escort" | "upgrade" | "reroll";

/** One item on a shop's shelf. */
export interface ShopItem {
  readonly id: string;
  readonly kind: ShopItemKind;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly price: number;
  readonly relicId?: string;
  /** False when sold out, unaffordable or pointless; `reason` says why. */
  readonly available: boolean;
  readonly reason: string | null;
}

/** Relics a shop stocks. */
export const SHOP_RELIC_SLOTS = 2;

/**
 * @param run - The run.
 * @param nodeId - The shop node (seeds its relic stock).
 * @returns The shelf, with availability judged for the run.
 */
export function shopStock(run: RunState, nodeId: string): ShopItem[] {
  const relics = drawRelics(rngFor(run.seed, "shop", nodeId), {
    owned: [],
    pools: run.pools,
    count: Number.MAX_SAFE_INTEGER,
  })
    .filter(
      (relic) =>
        !run.relics.includes(relic.id) ||
        run.shopBought.includes(`relic:${relic.id}`),
    )
    .slice(0, SHOP_RELIC_SLOTS);
  const repair = Math.round(repairFraction(run, SHOP_REPAIR_FRACTION) * 100);
  const items: Omit<ShopItem, "available" | "reason">[] = [
    {
      id: "repair",
      kind: "repair",
      name: "Hull Repair",
      icon: "🔧",
      description: `Repair ${repair}% hull on every ship`,
      price: shopPrice(run, SHOP_PRICES.repair),
    },
    ...relics.map((relic) => ({
      id: `relic:${relic.id}`,
      kind: "relic" as const,
      name: relic.name,
      icon: relic.icon,
      description: `${relic.description} [${relic.tags.join(", ")}]`,
      price: shopPrice(run, RELIC_PRICE[relic.rarity]),
      relicId: relic.id,
    })),
    {
      id: "escort",
      kind: "escort",
      name: "Hire Escort",
      icon: "🛩",
      description: "Add an escort to your wing",
      price: shopPrice(run, SHOP_PRICES.escort),
    },
    {
      id: "upgrade",
      kind: "upgrade",
      name: "Flagship Refit",
      icon: "⬆",
      description: "+1 upgrade level: +1 damage, +hull",
      price: shopPrice(run, SHOP_PRICES.upgrade),
    },
    {
      id: "reroll",
      kind: "reroll",
      name: "Nav Data",
      icon: "🎲",
      description: "+1 reroll charge",
      price: shopPrice(run, SHOP_PRICES.reroll),
    },
  ];
  return items.map((item) => ({ ...item, ...availability(run, item) }));
}

function availability(
  run: RunState,
  item: Omit<ShopItem, "available" | "reason">,
): { available: boolean; reason: string | null } {
  const blocked = (reason: string) => ({ available: false, reason });
  if (run.shopBought.includes(item.id)) return blocked("Sold");
  if (item.relicId && run.relics.includes(item.relicId))
    return blocked("Owned");
  if (item.kind === "repair" && fleetOf(run).every((s) => s.hull >= 1))
    return blocked("Hull intact");
  if (item.kind === "escort" && run.escorts.length >= MAX_ESCORTS)
    return blocked("Wing full");
  if (item.kind === "upgrade" && run.flagship.upgrades >= MAX_SHIP_UPGRADES)
    return blocked("Max level");
  if (item.price > run.salvage) return blocked(`Needs ${item.price}`);
  return { available: true, reason: null };
}

/**
 * @param run - The run.
 * @param nodeId - The shop node.
 * @param itemId - The item to buy.
 * @returns The run after the purchase, or null when it cannot be bought.
 */
export function buyShopItem(
  run: RunState,
  nodeId: string,
  itemId: string,
): RunState | null {
  const item = shopStock(run, nodeId).find((i) => i.id === itemId);
  if (!item || !item.available) return null;
  const paid = spendSalvage(run, item.price);
  if (!paid) return null;
  const bought = { ...paid, shopBought: [...paid.shopBought, item.id] };
  return withLog(deliver(bought, item), `Bought ${item.name} (-${item.price})`);
}

function deliver(run: RunState, item: ShopItem): RunState {
  switch (item.kind) {
    case "repair":
      return adjustFleetHull(run, repairFraction(run, SHOP_REPAIR_FRACTION));
    case "relic":
      return grantRelic(run, item.relicId ?? "");
    case "escort":
      return addEscort(run);
    case "upgrade":
      return upgradeShip(run, 0);
    case "reroll":
      return { ...run, rerolls: run.rerolls + 1 };
  }
}
