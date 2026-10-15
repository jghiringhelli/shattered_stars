import { describe, expect, it } from "vitest";
import { extractTexts } from "../../../scripts/lib/i18nExtract";

describe("extractTexts", () => {
  it("proposes_a_key_from_file_owner_id_and_property", () => {
    const found = extractTexts("ships/Hulls.ts", 'export const S = [{ id: "terran_viper", name: "Viper Mk II" }];');
    expect(found).toEqual([{ key: "ships.hulls.terran_viper.name", text: "Viper Mk II", line: 1 }]);
  });

  it("skips_ids_urls_and_asset_paths", () => {
    const found = extractTexts("a.ts", 'const x = { name: "terran_viper", title: "https://x.y", label: "./art.png", text: "" };');
    expect(found).toEqual([]);
  });

  it("skips_properties_that_are_not_player_text", () => {
    expect(extractTexts("a.ts", 'const x = { faction: "Terran Hegemony" };')).toEqual([]);
  });

  it("numbers_repeated_keys", () => {
    const found = extractTexts("a.ts", 'const x = [{ text: "Hello there" }, { text: "Hello again" }];');
    expect(found.map((entry) => entry.key)).toEqual(["a.text", "a.text.2"]);
  });

  it("finds_nested_object_literals", () => {
    const found = extractTexts("a.ts", 'const x = { list: [{ id: "k", description: "Fires twice." }] };');
    expect(found[0]?.key).toBe("a.k.description");
  });
});
