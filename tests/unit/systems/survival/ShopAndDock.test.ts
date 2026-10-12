import { describe, it, expect } from "vitest";
import {
  buyShopItem,
  shopStock,
} from "../../../../src/systems/survival/ShopService";
import {
  dockOptions,
  useDock,
} from "../../../../src/systems/survival/RepairDock";
import {
  adjustFleetHull,
  addEscort,
} from "../../../../src/systems/survival/RunState";
import {
  killSalvage,
  gainSalvage,
  shopPrice,
} from "../../../../src/systems/survival/RunEconomy";
import {
  SHOP_PRICES,
  DOCK_REPAIR_FRACTION,
  SALVAGE_PER_KILL,
} from "../../../../src/data/survival/economy";
import { RunBuilder } from "./survivalRunBuilder";

const SHOP = "s1-r3-c0";

describe("shop stock", () => {
  it("stocks repair, two relics, an escort, a refit and a reroll", () => {
    const kinds = shopStock(RunBuilder.aRun().build(), SHOP).map((i) => i.kind);
    expect(kinds).toEqual([
      "repair",
      "relic",
      "relic",
      "escort",
      "upgrade",
      "reroll",
    ]);
  });

  it("is stable for the same shop node", () => {
    const run = RunBuilder.aRun().build();
    expect(shopStock(run, SHOP)).toEqual(shopStock(run, SHOP));
  });

  it("marks unaffordable and pointless items unavailable", () => {
    const stock = shopStock(
      RunBuilder.aRun().with({ salvage: 0 }).build(),
      SHOP,
    );
    expect(stock.find((i) => i.id === "repair")!.reason).toBe("Hull intact");
    expect(stock.find((i) => i.id === "reroll")!.available).toBe(false);
  });
});

describe("buying", () => {
  it("consumes salvage and delivers the item once", () => {
    const run = RunBuilder.aRun().with({ salvage: 200, rerolls: 0 }).build();
    const bought = buyShopItem(run, SHOP, "reroll")!;
    expect(bought.salvage).toBe(200 - SHOP_PRICES.reroll);
    expect(bought.rerolls).toBe(1);
    expect(buyShopItem(bought, SHOP, "reroll")).toBeNull();
  });

  it("repairs a damaged fleet", () => {
    const run = adjustFleetHull(
      RunBuilder.aRun().with({ salvage: 200 }).build(),
      -0.5,
    );
    expect(buyShopItem(run, SHOP, "repair")!.flagship.hull).toBeCloseTo(0.8);
  });

  it("sells a relic that stays on the shelf as sold", () => {
    const run = RunBuilder.aRun().with({ salvage: 500 }).build();
    const relicItem = shopStock(run, SHOP).find((i) => i.kind === "relic")!;
    const bought = buyShopItem(run, SHOP, relicItem.id)!;
    expect(bought.relics).toEqual([relicItem.relicId]);
    expect(
      shopStock(bought, SHOP).find((i) => i.id === relicItem.id)!.reason,
    ).toBe("Sold");
  });

  it("refuses purchases the run cannot afford", () => {
    expect(
      buyShopItem(
        RunBuilder.aRun().with({ salvage: 1 }).build(),
        SHOP,
        "escort",
      ),
    ).toBeNull();
  });
});

describe("prices and salvage", () => {
  it("marks prices up at ascension 6 and discounts them with Black Market Codes", () => {
    expect(shopPrice(RunBuilder.aRun().withAscension(6).build(), 100)).toBe(
      125,
    );
    expect(
      shopPrice(
        RunBuilder.aRun()
          .with({ relics: ["black_market_codes"] })
          .build(),
        100,
      ),
    ).toBe(80);
  });

  it("cuts salvage gains at ascension 4", () => {
    const run = RunBuilder.aRun().withAscension(4).with({ salvage: 0 }).build();
    expect(gainSalvage(run, 100).salvage).toBe(80);
    expect(gainSalvage(run, 100).stats.salvageEarned).toBe(80);
  });

  it("pays bounties: relic bonuses per kill and for elites", () => {
    const run = RunBuilder.aRun()
      .with({ relics: ["salvage_drones", "bounty_contract"] })
      .build();
    expect(killSalvage(run, "regular")).toBe(SALVAGE_PER_KILL.regular + 1);
    expect(killSalvage(run, "elite")).toBe(
      Math.round(SALVAGE_PER_KILL.elite * 1.5) + 1,
    );
  });
});

describe("repair dock", () => {
  it("offers a repair or one upgrade per ship (the free wingman included)", () => {
    const run = RunBuilder.aRun().build();
    expect(dockOptions(run).map((o) => o.id)).toEqual([
      "repair",
      "upgrade-0",
      "upgrade-1",
    ]);
  });

  it("repairs the fleet by the dock fraction (less at ascension 9)", () => {
    const hurt = adjustFleetHull(RunBuilder.aRun().build(), -0.9);
    expect(useDock(hurt, "repair").flagship.hull).toBeCloseTo(
      0.1 + DOCK_REPAIR_FRACTION,
    );
    const ascended = adjustFleetHull(
      RunBuilder.aRun().withAscension(9).build(),
      -0.9,
    );
    expect(useDock(ascended, "repair").flagship.hull).toBeCloseTo(
      0.1 + DOCK_REPAIR_FRACTION * 0.7,
    );
  });

  it("upgrades the chosen escort", () => {
    const run = addEscort(RunBuilder.aRun().build());
    const next = useDock(run, "upgrade-1");
    expect(next.escorts[0]!.upgrades).toBe(1);
    expect(next.flagship.upgrades).toBe(0);
  });
});
