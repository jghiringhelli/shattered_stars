import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import {
  BACKGROUND_IDS,
  BOOT_ASSETS,
  PORTRAIT_ASSETS,
  allManifestAssets,
  shipArtAsset,
  shipSpriteAsset,
  type AssetEntry,
} from "../../../src/assets/assetManifest";
import {
  SCENE_ASSET_PLANS,
  collectDataIds,
  resolveSceneAssets,
} from "../../../src/assets/sceneAssetPlan";

const PUBLIC = join(process.cwd(), "public");
const SCENES = join(process.cwd(), "src", "scenes");
/** Boot (pre-menu) image budget; JS + fonts ride on top of this. */
const BOOT_IMAGE_BUDGET_BYTES = 3 * 1024 * 1024;

const urlsOf = (entry: AssetEntry): string[] =>
  entry.kind === "atlas" ? [entry.url, entry.atlasUrl] : [entry.url];
const keysOf = (entries: readonly AssetEntry[]): string[] =>
  entries.map((e) => e.key);

describe("assetManifest", () => {
  it("points every manifest entry at a file that ships in public/", () => {
    const missing = allManifestAssets()
      .flatMap(urlsOf)
      .filter((url) => !existsSync(join(PUBLIC, url)));
    expect(missing).toEqual([]);
  });

  it("uses ship_<id> as every definition's sprite key, so one load serves both", () => {
    const mismatched = Object.values(SHIP_DEFINITIONS).filter(
      (def) => def.spriteKey !== shipSpriteAsset(def).key,
    );
    expect(mismatched.map((d) => d.id)).toEqual([]);
  });

  it("keys encyclopedia art as ship_art_<id>", () => {
    const def = Object.values(SHIP_DEFINITIONS)[0]!;
    expect(shipArtAsset(def).key).toBe(`ship_art_${def.id}`);
  });

  it("keeps the pre-menu boot images under the budget", () => {
    const bytes = BOOT_ASSETS.flatMap(urlsOf).reduce(
      (sum, url) => sum + statSync(join(PUBLIC, url)).size,
      0,
    );
    expect(bytes).toBeLessThan(BOOT_IMAGE_BUDGET_BYTES);
  });

  it("does not load ship sprites, encyclopedia art or portraits at boot", () => {
    const heavy = BOOT_ASSETS.filter((e) => /^(ship_|portrait_)/.test(e.key));
    expect(heavy).toEqual([]);
  });

  it("has a command portrait plus three pilots per faction", () => {
    expect(PORTRAIT_ASSETS.length).toBe(16);
    expect(keysOf(PORTRAIT_ASSETS)).toContain("portrait_command");
  });
});

describe("collectDataIds", () => {
  it("finds ids nested in arrays and objects", () => {
    const data = { squads: [{ ships: [{ shipId: "a" }, "b"] }], other: "x" };
    expect(collectDataIds(data, (s) => s === "a" || s === "b")).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("survives cyclic data", () => {
    const data: Record<string, unknown> = { id: "a" };
    data["self"] = data;
    expect(collectDataIds(data, (s) => s === "a")).toEqual(new Set(["a"]));
  });

  it("ignores non-plain objects such as class instances", () => {
    class Holder {
      readonly id = "a";
    }
    expect(collectDataIds({ holder: new Holder() }, () => true).size).toBe(0);
  });
});

describe("resolveSceneAssets", () => {
  const someShip = Object.values(SHIP_DEFINITIONS)[0]!;

  it("preloads the battle sprites of the ships named in the scene data", () => {
    const keys = keysOf(
      resolveSceneAssets("ArcadeBattleScene", {
        teams: [{ ships: [{ definitionId: someShip.id }] }],
      }),
    );
    expect(keys).toContain(`ship_${someShip.id}`);
    expect(keys).toContain("bg_galaxy_spiral");
  });

  it("loads only the campaign faction's portraits when the data names it", () => {
    const keys = keysOf(
      resolveSceneAssets("CampaignScene", { factionId: "void_corsairs" }),
    );
    expect(keys).toContain("portrait_captain_kira");
    expect(keys).toContain("portrait_command");
    expect(keys).not.toContain("portrait_admiral_chen");
  });

  it("loads every portrait for a campaign scene without a faction in its data", () => {
    const keys = keysOf(resolveSceneAssets("CampaignScene", undefined));
    expect(keys).toEqual(expect.arrayContaining(keysOf(PORTRAIT_ASSETS)));
  });

  it("never loads portraits outside the campaign", () => {
    const keys = keysOf(
      resolveSceneAssets("DogfightScene", { factionId: "void_corsairs" }),
    );
    expect(keys.filter((k) => k.startsWith("portrait_"))).toEqual([]);
  });

  it("returns nothing for an unknown scene", () => {
    expect(resolveSceneAssets("NoSuchScene", { id: someShip.id })).toEqual([]);
  });
});

describe("SCENE_ASSET_PLANS stay in sync with the scenes", () => {
  const sceneFiles = readdirSync(SCENES).filter((f) => f.endsWith("Scene.ts"));

  it.each(sceneFiles)(
    "%s: every painted backdrop it names is preloaded",
    (file) => {
      const source = readFileSync(join(SCENES, file), "utf8");
      const named = BACKGROUND_IDS.filter((id) => source.includes(`"${id}"`));
      const planned =
        SCENE_ASSET_PLANS[file.replace(/\.ts$/, "")]?.backgrounds ?? [];
      expect(named.filter((id) => !planned.includes(id))).toEqual([]);
    },
  );
});
