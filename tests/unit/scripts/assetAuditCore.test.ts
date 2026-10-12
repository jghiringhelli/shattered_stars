import { describe, it, expect } from "vitest";
import {
  compileReference,
  exactReference,
  findReferences,
  findUnreferenced,
} from "../../../scripts/asset_audit_core";

describe("asset audit core", () => {
  it("finds quoted assets/ paths in any quote style", () => {
    const text = `a("assets/ui/a.png"); b('assets/ui/b.png'); c(\`assets/\${x}/c.png\`);`;
    expect(findReferences(text).map((r) => r.source)).toEqual([
      "assets/ui/a.png",
      "assets/ui/b.png",
      "assets/${x}/c.png",
    ]);
  });

  it("expands ${...} templates to one path segment", () => {
    const ref = compileReference("assets/ships/${faction}/${id}.png");
    expect(ref.pattern.test("assets/ships/void_corsairs/x.png")).toBe(true);
    expect(ref.pattern.test("assets/ships/encyclopedia/void/x.png")).toBe(
      false,
    );
  });

  it("treats an extensionless path as covering its files and siblings by extension", () => {
    const ref = compileReference("assets/portraits/${f}/${n}_sheet");
    expect(ref.pattern.test("assets/portraits/a/b_sheet.png")).toBe(true);
    expect(ref.pattern.test("assets/portraits/a/b_sheet.json")).toBe(true);
    expect(ref.pattern.test("assets/portraits/a/b.png")).toBe(false);
  });

  it("does not let a folder name match a longer sibling folder", () => {
    const ref = compileReference("assets/ships");
    expect(ref.pattern.test("assets/ships/a.png")).toBe(true);
    expect(ref.pattern.test("assets/ships_backup/a.png")).toBe(false);
  });

  it("keeps a trailing-slash prefix's whole subtree", () => {
    const ref = compileReference("/assets/audio/music/");
    expect(ref.pattern.test("assets/audio/music/menu.mp3")).toBe(true);
  });

  it("lists files no reference matches", () => {
    const refs = [exactReference("assets/a.png")];
    expect(findUnreferenced(["assets/a.png", "assets/b.png"], refs)).toEqual([
      "assets/b.png",
    ]);
  });
});
