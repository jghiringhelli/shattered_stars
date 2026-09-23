/**
 * Gate: the ship roster and the ship art on disk stay in step.
 *
 * Two failure modes, both of which have already happened:
 *   - a ship with no art falls back to a plain vector triangle in battle,
 *     which is what "every ship has a sprite" is meant to rule out;
 *   - art left behind by a renamed or deleted ship sits in the repo forever,
 *     never loaded, still shipped to players.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

const SHIP_ART_ROOT = join(process.cwd(), "public", "assets", "ships");

/**
 * Every ship id that has a battle sprite on disk.
 *
 * @returns Ship ids, derived from the PNG filenames.
 */
function shipIdsWithArt(): string[] {
  return readdirSync(SHIP_ART_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((faction) =>
      readdirSync(join(SHIP_ART_ROOT, faction.name))
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(/\.png$/, "")),
    );
}

describe("ship art coverage", () => {
  const definitions = Object.values(SHIP_DEFINITIONS);

  it("gives every ship in the roster its own battle sprite", () => {
    const missing = definitions
      .filter(
        (def) => !existsSync(join(SHIP_ART_ROOT, def.faction, `${def.id}.png`)),
      )
      .map((def) => def.id);

    expect(missing).toEqual([]);
  });

  it("keeps no ship art for ships that no longer exist", () => {
    const known = new Set(definitions.map((def) => def.id));
    const orphaned = shipIdsWithArt().filter((id) => !known.has(id));

    expect(orphaned.sort()).toEqual([]);
  });
});
