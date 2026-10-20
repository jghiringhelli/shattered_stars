import { describe, expect, it } from "vitest";
import { ALL_FACTIONS } from "../../../src/ui/lobby/lobbyData";
import {
  cycleFaction,
  cycleShip,
  defaultLoadout,
  onlineShipChoices,
} from "../../../src/net/lobby/loadoutChoices";
import { MATCH_MODES } from "../../../src/net/protocol";
import { validateLoadout } from "../../../src/net/rules/squadRules";

describe("what the lobby offers is what the relay accepts", () => {
  it.each(MATCH_MODES.flatMap((mode) => ALL_FACTIONS.map((f) => [mode, f] as const)))(
    "default %s loadout of %s passes the relay's rules",
    (mode, faction) => {
      expect(validateLoadout(mode, defaultLoadout(mode, faction))).toBeNull();
    },
  );

  it("passes every ship a duel pilot can cycle to", () => {
    for (const faction of ALL_FACTIONS)
      for (const ship of onlineShipChoices(faction))
        expect(validateLoadout("dogfight", { faction, ships: [ship] })).toBeNull();
    let loadout = defaultLoadout("dogfight", ALL_FACTIONS[0]!);
    for (let i = 0; i < 40; i++) {
      loadout = cycleShip(loadout, 1);
      expect(validateLoadout("dogfight", loadout)).toBeNull();
    }
  });

  it("passes the cycled faction's default in every mode", () => {
    for (const mode of MATCH_MODES) {
      let loadout = defaultLoadout(mode, ALL_FACTIONS[0]!);
      for (let i = 0; i < ALL_FACTIONS.length; i++) {
        loadout = cycleFaction(mode, loadout, 1);
        expect(validateLoadout(mode, loadout)).toBeNull();
      }
    }
  });

  it("trims a saved squad that is over the point limit or holds capital ships", () => {
    const saved = {
      faction: "terran_hegemony",
      ships: ["terran_imperator", ...Array<string>(8).fill("terran_gladius")],
    };
    const loadout = defaultLoadout("reinforcements", "terran_hegemony", saved);
    expect(loadout.ships.length).toBeGreaterThan(0);
    expect(validateLoadout("reinforcements", loadout)).toBeNull();
  });
});
