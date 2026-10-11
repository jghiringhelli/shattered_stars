/**
 * campaign-hub.spec.ts — the SC2-style hub: several missions open at once,
 * Armory purchases spend credits and persist (free respec), Research picks
 * need a confirming click and are permanent.
 */

import { test, expect } from "@playwright/test";
import { openCampaignHub, storedSave } from "./helpers/campaignEntry";

const HUB = "CampaignScene";

test.describe("Campaign hub", () => {
  test("offers at least two missions at once after the opening missions", async ({
    page,
  }) => {
    await openCampaignHub(page, "terran_hegemony", {
      completedMissions: ["heg_1_1", "heg_1_2"],
      currentMission: 3,
    });
    const ids: string[] = await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).availableMissionIds(),
      HUB,
    );
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids).toEqual(
      expect.arrayContaining(["heg_1_3", "heg_1_3b", "heg_1_4"]),
    );
  });

  test("a fresh campaign opens with only the first mission", async ({
    page,
  }) => {
    await openCampaignHub(page, "void_corsairs");
    const ids: string[] = await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).availableMissionIds(),
      HUB,
    );
    expect(ids).toEqual(["cors_1_1"]);
  });

  test("the Armory spends credits on a campaign mod, persists it, and respecs for free", async ({
    page,
  }) => {
    await openCampaignHub(page, "free_confederation", { credits: 500 });
    await page.evaluate((k) => {
      const scene = (window as any).game.scene.getScene(k);
      scene.selectHubTab("armory");
      scene.toggleMod({ id: "capacitor_array" });
    }, HUB);
    let save = await storedSave(page, "free_confederation");
    expect(save.credits).toBe(350);
    expect(save.armory.installed).toEqual({ capacitor_array: 150 });
    await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).respec(),
      HUB,
    );
    save = await storedSave(page, "free_confederation");
    expect(save.credits).toBe(500);
    expect(save.armory.installed).toEqual({});
  });

  test("a Research pick needs a confirming click and is permanent", async ({
    page,
  }) => {
    await openCampaignHub(page, "synthetic_collective", { researchPoints: 3 });
    await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).selectHubTab("research"),
      HUB,
    );
    const pick = (option: "A" | "B") =>
      page.evaluate(
        ({ k, o }) => {
          (window as any).game.scene
            .getScene(k)
            .chooseResearch({ id: "hull_doctrine" }, o);
        },
        { k: HUB, o: option },
      );
    await pick("B");
    expect((await storedSave(page, "synthetic_collective")).research).toEqual(
      {},
    );
    await pick("B");
    expect((await storedSave(page, "synthetic_collective")).research).toEqual({
      hull_doctrine: "B",
    });
    await pick("A");
    await pick("A");
    expect((await storedSave(page, "synthetic_collective")).research).toEqual({
      hull_doctrine: "B",
    });
  });
});
