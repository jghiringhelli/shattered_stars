/**
 * campaign-chronicle.spec.ts — the interlocked campaigns: the hub shows act
 * locks with their reasons (Rule of N), finishing Act I in two factions opens
 * Act II, a crossover played from both sides sets canon with the first witness
 * and adapts the second, the Coalition opens after four campaigns with a lead
 * hero, Act V's endings follow unity and keys, and everything survives a reload.
 */

import { test, expect, type Page } from "@playwright/test";
import { clickMenuItem, waitForMenuReady, waitForScene } from "./helpers/game";
import {
  BATTLE,
  launchCampaignMission,
  openCampaignHub,
} from "./helpers/campaignEntry";

const HUB = "CampaignScene";
const COMPLETE = "CampaignCompleteScene";
const ACT_ONE = {
  terran_hegemony: ["heg_1_1", "heg_1_2", "heg_1_3", "heg_1_4"],
  free_confederation: ["conf_1_1", "conf_1_2", "conf_1_3", "conf_1_4"],
} as const;

/** Wins the running campaign mission through the director's debug hook. */
async function winMission(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    scene.director.debugWin();
  }, BATTLE);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.missionComplete === true,
    BATTLE,
    { timeout: 15_000 },
  );
}

/** Reads the stored Chronicle. */
async function chronicle(page: Page): Promise<any> {
  return page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("shattered_stars_chronicle") ?? "null"),
  );
}

/** Opens a faction's hub without touching the stored saves or Chronicle. */
async function openHub(page: Page, factionId: string): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await clickMenuItem(page, "CAMPAIGN");
  await waitForScene(page, HUB);
  await page.evaluate(
    (f) => (window as any).game.scene.getScene("CampaignScene").selectFaction(f),
    factionId,
  );
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("CampaignScene")?.currentPhase ===
      "mission_map",
  );
}

/** Stores a Chronicle in which `count` factions finished Acts I-III. */
async function seedFinishedCampaigns(page: Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const factions = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    const actsComplete: Record<string, number[]> = {};
    factions.slice(0, n).forEach((f) => (actsComplete[f] = [1, 2, 3]));
    window.localStorage.setItem(
      "shattered_stars_chronicle",
      JSON.stringify({ version: 4, flags: {}, crossovers: {}, actsComplete, freeOrder: false, ending: null }),
    );
  }, count);
}

test("the hub shows the locked act with its Rule of N reason", async ({ page }) => {
  await openCampaignHub(
    page,
    "terran_hegemony",
    {
      completedMissions: [...ACT_ONE.terran_hegemony, "heg_1_5"],
      currentMission: 6,
    },
    false,
  );
  const state = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignScene");
    const reason = scene.phaseContainer.getByName("act_lock_reason");
    return {
      ids: scene.availableMissionIds(),
      reason: reason?.text ?? null,
      chips: [1, 2, 3].map((a) => !!scene.phaseContainer.getByName(`act_chip_${a}`)),
    };
  });
  expect(state.ids).toEqual([]);
  expect(state.chips).toEqual([true, true, true]);
  expect(state.reason).toContain("complete Act I in 1 more faction");
});

test("finishing Act I in two factions opens Act II in both", async ({ page }) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_1_5",
    noCombat: true,
    save: { completedMissions: [...ACT_ONE.terran_hegemony], currentMission: 5 },
  });
  await winMission(page);
  expect((await chronicle(page)).actsComplete.terran_hegemony).toEqual([1]);
  await openHub(page, "terran_hegemony");
  expect(
    await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").availableMissionIds()),
  ).toEqual([]);

  await launchCampaignMission(page, {
    factionId: "free_confederation",
    missionId: "conf_1_5",
    noCombat: true,
    save: { completedMissions: [...ACT_ONE.free_confederation], currentMission: 5 },
  });
  await winMission(page);
  expect((await chronicle(page)).actsComplete.free_confederation).toEqual([1]);
  await openHub(page, "terran_hegemony");
  expect(
    await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").availableMissionIds()),
  ).toContain("heg_2_1");
});

test("a crossover played first writes canon and the other side gets the adapted version", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_2_1",
    noCombat: true,
    save: { completedMissions: [...ACT_ONE.terran_hegemony, "heg_1_5"] },
  });
  await winMission(page);
  const afterHeg = await chronicle(page);
  expect(afterHeg.crossovers.X4.canonFaction).toBe("terran_hegemony");
  expect(afterHeg.flags.heg_convoy_intact).toBe(true);

  await launchCampaignMission(page, {
    factionId: "void_corsairs",
    missionId: "cors_2_4",
    noCombat: true,
  });
  const second = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return {
      flag: scene.playFlags.heg_convoy_intact,
      briefing: scene.plan.briefing,
      base: scene.mission.briefing,
    };
  }, BATTLE);
  expect(second.flag).toBe(true);
  expect(second.briefing).not.toBe(second.base);
  await winMission(page);
  const after = await chronicle(page);
  expect(after.crossovers.X4.canonFaction).toBe("terran_hegemony");
  expect(after.crossovers.X4.witnesses).toEqual(["terran_hegemony", "void_corsairs"]);
  expect(after.flags.x4_convoy_gutted).toBeUndefined();
});

test("the other order: the Corsair canon adapts the Hegemony mission", async ({ page }) => {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await page.evaluate(async () => {
    const { ChronicleManager } = await import("/src/systems/ChronicleManager.ts");
    ChronicleManager.reset();
    ChronicleManager.recordVictory({
      missionId: "cors_2_4",
      faction: "void_corsairs",
      campaignId: "void_corsairs",
      storyFlags: { x4_convoy_gutted: true },
      actsComplete: [],
    });
  });
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_2_1",
    noCombat: true,
  });
  const state = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return {
      gutted: scene.playFlags.x4_convoy_gutted,
      intact: scene.playFlags.heg_convoy_intact,
      bonus: scene.plan.objectives.map((o: any) => o.description).join("|"),
    };
  }, BATTLE);
  expect(state.gutted).toBe(true);
  expect(state.intact).toBe(false);
  expect(state.bonus.toLowerCase()).toContain("black box");
});

test("the Coalition opens after four campaigns, with a lead hero and its own save", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await seedFinishedCampaigns(page, 3);
  await clickMenuItem(page, "CAMPAIGN");
  await waitForScene(page, HUB);
  const locked = await page.evaluate(() => {
    const card = (window as any).game.scene.getScene("CampaignScene").phaseContainer.getByName("coalition_card");
    return { enabled: card.enabled };
  });
  expect(locked.enabled).toBe(false);
  await seedFinishedCampaigns(page, 4);
  await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").scene.restart());
  await page.waitForFunction(
    () => (window as any).game.scene.getScene("CampaignScene")?.currentPhase === "faction_select",
  );
  await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").selectCoalition());
  expect(
    await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").currentPhase),
  ).toBe("coalition_lead");
  await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").chooseLead("free_confederation"));
  const hub = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignScene");
    return {
      phase: scene.currentPhase,
      ids: scene.availableMissionIds(),
      save: JSON.parse(window.localStorage.getItem("shattered_stars_campaign_coalition")!),
    };
  });
  expect(hub.phase).toBe("mission_map");
  expect(hub.ids).toEqual(["coal_4_1"]);
  expect(hub.save).toMatchObject({ slot: "coalition", factionId: "free_confederation" });

  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignScene");
    scene.selectMission(scene.campaignData.missions[0]);
    scene.launchMission();
  });
  await waitForScene(page, BATTLE, 30_000);
  await page.waitForFunction(
    (key) => ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) >= 1,
    BATTLE,
  );
  const fly = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return { faction: scene.factionId, ship: scene.mission.playerShips[0], slot: scene.saveData.slot };
  }, BATTLE);
  expect(fly.faction).toBe("free_confederation");
  expect(fly.ship.startsWith("confed_")).toBe(true);
  expect(fly.slot).toBe("coalition");
  await page.evaluate((key) => (window as any).game.scene.getScene(key).processCombat = () => undefined, BATTLE);
  await winMission(page);
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("shattered_stars_campaign_coalition")!),
  );
  expect(saved.completedMissions).toContain("coal_4_1");
  expect(
    await page.evaluate(() => JSON.parse(window.localStorage.getItem("shattered_stars_campaign_free_confederation") ?? "null")),
  ).toBeNull();
});

/** Opens the completion screen of a finished Coalition with the given flags. */
async function openEnding(page: Page, flags: string[]): Promise<void> {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await page.evaluate(async (chronicleFlags) => {
    const { CampaignSaveManager } = await import("/src/systems/CampaignSaveManager.ts");
    const { ChronicleManager } = await import("/src/systems/ChronicleManager.ts");
    const { COALITION_CAMPAIGN } = await import("/src/data/CampaignData.ts");
    CampaignSaveManager.save({
      ...CampaignSaveManager.createNew("void_corsairs", [], "coalition"),
      completedMissions: COALITION_CAMPAIGN.missions.map((m: any) => m.id),
      campaignComplete: true,
    } as any);
    ChronicleManager.reset();
    const flagMap: Record<string, boolean> = {};
    chronicleFlags.forEach((f) => (flagMap[f] = true));
    ChronicleManager.save({
      ...ChronicleManager.load(),
      flags: flagMap,
    });
    const game = (window as any).game;
    game.scene.stop("MainMenuScene");
    game.scene.start("CampaignCompleteScene", { factionId: "void_corsairs", slot: "coalition" });
  }, flags);
  await waitForScene(page, COMPLETE);
}

const UNITY_SEVEN = [
  "x5_joint_breakout", "heg_phoenix_defected", "x7_shards_saved", "x8_node_preserved",
  "x10_chen_held_fire", "x11_betrayal_averted", "x12_sanctuary_reached",
];
const KEYS = ["key_heg_witness", "key_conf_pact", "key_synth_dissent", "key_cors_loyalty", "key_asc_mercy"];

test("low unity forces The Quiet", async ({ page }) => {
  await openEnding(page, ["x7_shards_saved"]);
  const state = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignCompleteScene");
    return { ending: scene.ending, lines: scene.epilogue.length };
  });
  expect(state.ending).toBe("quiet");
  expect(state.lines).toBeGreaterThan(0);
});

test("unity and keys offer Answer; the choice is saved with its epilogue and survives a reload", async ({
  page,
}) => {
  await openEnding(page, [...UNITY_SEVEN, ...KEYS]);
  const options = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignCompleteScene");
    return { ending: scene.ending, available: scene.endingChoices.available };
  });
  expect(options).toEqual({ ending: null, available: ["answer", "sever", "seal"] });
  await page.evaluate(() => (window as any).game.scene.getScene("CampaignCompleteScene").chooseEnding("answer"));
  await page.waitForFunction(
    () => (window as any).game.scene.getScene("CampaignCompleteScene")?.ending === "answer",
  );
  expect(
    await page.evaluate(() => (window as any).game.scene.getScene("CampaignCompleteScene").epilogue.length),
  ).toBeGreaterThan(0);
  await page.reload();
  await waitForMenuReady(page);
  const stored = await chronicle(page);
  expect(stored.ending).toBe("answer");
  expect(stored.freeOrder).toBe(true);
});

test("Sever and Seal are the choices at unity 4; Answer is refused", async ({ page }) => {
  await openEnding(page, UNITY_SEVEN.slice(0, 4));
  const available = await page.evaluate(() =>
    (window as any).game.scene.getScene("CampaignCompleteScene").endingChoices.available,
  );
  expect(available).toEqual(["sever", "seal"]);
  await page.evaluate(() => (window as any).game.scene.getScene("CampaignCompleteScene").chooseEnding("answer"));
  expect((await chronicle(page)).ending).toBeNull();
});

test("Free Order lifts the act lock from the Chronicle tab and persists", async ({ page }) => {
  await openCampaignHub(
    page,
    "terran_hegemony",
    { completedMissions: [...ACT_ONE.terran_hegemony, "heg_1_5"], currentMission: 6 },
    false,
  );
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("CampaignScene");
    scene.selectHubTab("chronicle");
    scene.toggleFreeOrder(false);
  });
  await page.reload();
  await openHub(page, "terran_hegemony");
  expect((await chronicle(page)).freeOrder).toBe(true);
  expect(
    await page.evaluate(() => (window as any).game.scene.getScene("CampaignScene").availableMissionIds()),
  ).toContain("heg_2_1");
});
