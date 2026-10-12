import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import { rulesFor } from "../../../../src/arcade/reinforcements/reinforcementRules";
import { ReinforcementDirector } from "../../../../src/arcade/reinforcements/ReinforcementDirector";
import type {
  DirectorMemberSetup,
  DirectorSetup,
} from "../../../../src/arcade/reinforcements/directorTypes";
import type { DeployOption } from "../../../../src/arcade/reinforcements/reinforcementTypes";

const opt = (definitionId: string, loadoutId: string | null = null) =>
  toDeployOption({ definitionId, loadoutId })!;

const kestrel = opt("confed_kestrel");
const wasp = opt("confed_wasp");
const venom = opt("corsair_venom");
const talon = opt("corsair_talon");

/** Field cap of the test battles: the two opening Venoms plus room for one more. */
const FIELD_CAP = 3 * venom.cost;

/** Sides (teams) and members (squads). */
const P = "team_1";
const E = "team_2";
const PM = "squad_0";
const EM = "squad_1";
const TICK = 1000 / 60;

function member(
  key: string,
  faction: string,
  human: boolean,
  plan: readonly DeployOption[],
): DirectorMemberSetup {
  return {
    key,
    faction,
    human,
    strategy: "balanced",
    plan,
    catalog: human ? [wasp, kestrel] : [],
  };
}

function director(
  overrides: Partial<DirectorSetup> = {},
): ReinforcementDirector {
  let n = 0;
  const setup: DirectorSetup = {
    rules: rulesFor("skirmish", { poolPoints: 300, fieldCapPoints: FIELD_CAP }),
    playerSide: P,
    sides: [
      {
        key: P,
        members: [member(PM, "free_confederation", true, [wasp, kestrel])],
      },
      { key: E, members: [member(EM, "void_corsairs", false, [venom, talon])] },
    ],
    ownsOutcome: true,
    nextShipId: (memberKey, pilot) => `${pilot}_${memberKey}_${n++}`,
    ...overrides,
  };
  return new ReinforcementDirector(setup);
}

/** Opening squads: the player's kestrel + a wasp wingman; two venoms. */
function opened(d = director()): ReinforcementDirector {
  d.registerInitial("player_0", PM, kestrel, "player");
  d.registerInitial("ally_0", PM, wasp, "wingman");
  d.registerInitial("enemy_0", EM, venom, "ai");
  d.registerInitial("enemy_1", EM, venom, "ai");
  return d;
}

const cost = (options: readonly DeployOption[]) =>
  options.reduce((s, o) => s + o.cost, 0);

describe("ReinforcementDirector", () => {
  it("spends the opening squads from the pools", () => {
    const d = opened();
    expect(d.summary(P).remainingPoints).toBe(300 - cost([kestrel, wasp]));
    expect(d.summary(E).fieldPoints).toBe(cost([venom, venom]));
    expect(d.playerShipId).toBe("player_0");
  });

  it("an AI side fills free field room at once, never past the cap", () => {
    const d = opened();
    const deployed = d.tick(TICK);
    const enemy = deployed.filter((x) => x.side === E);
    expect(enemy.length).toBeGreaterThan(0);
    expect(enemy[0]?.option).toBe(venom);
    expect(enemy[0]?.member).toBe(EM);
    expect(enemy[0]?.faction).toBe("void_corsairs");
    expect(d.summary(E).fieldPoints).toBeLessThanOrEqual(FIELD_CAP);
    expect(enemy.every((x) => x.pilot === "ai")).toBe(true);
  });

  it("replaces a destroyed AI ship immediately and spends its pool", () => {
    const d = opened();
    d.tick(TICK);
    const before = d.summary(E).remainingPoints;
    d.shipDestroyed("enemy_0");
    const deployed = d.tick(TICK).filter((x) => x.side === E);
    expect(deployed.length).toBeGreaterThan(0);
    expect(d.summary(E).remainingPoints).toBe(
      before - cost(deployed.map((x) => x.option)),
    );
    expect(d.summary(E).fieldPoints).toBeLessThanOrEqual(FIELD_CAP);
  });

  it("numbers arrivals per side so they fan out", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.shipDestroyed("enemy_1");
    const slots = d
      .tick(TICK)
      .filter((x) => x.side === E)
      .map((x) => x.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("replaces the player's wingmen from the reserve", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("ally_0");
    const ally = d.tick(TICK).filter((x) => x.side === P);
    expect(ally.length).toBeGreaterThan(0);
    expect(ally.every((x) => x.pilot === "wingman" && x.member === PM)).toBe(
      true,
    );
  });

  it("opens the picker when the player's ship is lost and holds wingmen for it", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    d.shipDestroyed("ally_0");
    expect(d.picker).not.toBeNull();
    expect(d.tick(TICK).filter((x) => x.side === P)).toEqual([]);
    expect(d.picker?.options[0]?.isDefault).toBe(true);
  });

  it("the picker auto-deploys the default after the countdown", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const defaultOption = d.picker!.options[0]!.option;
    let deployed: ReturnType<ReinforcementDirector["tick"]> = [];
    for (let t = 0; t < 5000 + 2 * TICK && deployed.length === 0; t += TICK)
      deployed = d.tick(TICK).filter((x) => x.pilot === "player");
    expect(deployed).toHaveLength(1);
    expect(deployed[0]!.option).toBe(defaultOption);
    expect(d.picker).toBeNull();
    expect(d.playerShipId).toBe(deployed[0]!.shipId);
  });

  it("choosing another allowed option deploys it at once", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const index = d.picker!.options.findIndex(
      (o) => !o.isDefault && o.check.allowed,
    );
    const chosen = d.picker!.options[index]!.option;
    const deployment = d.choose(index);
    expect(deployment?.option).toBe(chosen);
    expect(deployment?.pilot).toBe("player");
    expect(deployment?.member).toBe(PM);
    expect(d.picker).toBeNull();
  });

  it("refuses a disabled option and keeps the picker open", () => {
    const d = opened(
      director({
        rules: rulesFor("skirmish", {
          poolPoints: 120,
          fieldCapPoints: FIELD_CAP,
        }),
      }),
    );
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const index = d.picker!.options.findIndex((o) => !o.check.allowed);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(d.choose(index)).toBeNull();
    expect(d.picker).not.toBeNull();
  });

  it("a side whose pool is exhausted with nothing alive loses", () => {
    const d = opened(
      director({
        rules: rulesFor("skirmish", {
          poolPoints: 70,
          fieldCapPoints: FIELD_CAP,
        }),
      }),
    );
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.shipDestroyed("enemy_1");
    d.tick(TICK);
    expect(d.result).toMatchObject({ winner: "player", reason: "exhaustion" });
    expect(d.canField("enemy")).toBe(false);
    expect(d.canField("player")).toBe(true);
  });

  it("at 3:00 the side that destroyed more points wins", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.debugAdvanceClock(180_000);
    d.tick(TICK);
    expect(d.result).toMatchObject({ winner: "player", reason: "time" });
    expect(d.remainingMs).toBe(0);
  });

  it("leaves the outcome to the scenario when it does not own it", () => {
    const d = opened(director({ ownsOutcome: false }));
    d.debugAdvanceClock(400_000);
    d.tick(TICK);
    expect(d.result).toBeNull();
  });

  it("waits the AI deploy delay after a loss", () => {
    const rules = {
      ...rulesFor("skirmish", { poolPoints: 300, fieldCapPoints: FIELD_CAP }),
      aiDeployDelayMs: 1000,
    };
    const d = opened(director({ rules }));
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    expect(d.tick(TICK).filter((x) => x.side === E)).toEqual([]);
    d.debugAdvanceClock(1000);
    expect(d.tick(TICK).filter((x) => x.side === E).length).toBeGreaterThan(0);
  });

  it("previews the player's next reserve ships", () => {
    const d = opened();
    expect(d.reservePreview(3).map((o) => o.definitionId)).toEqual([
      "confed_wasp",
      "confed_kestrel",
      "confed_wasp",
    ]);
  });

  it("reports deploy and loss counts for the end screen", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    const stats = d.matchStats();
    expect(stats.player.deployed).toBeGreaterThanOrEqual(2);
    expect(stats.player.destroyedPoints).toBe(venom.cost);
    expect(stats.enemy.lostPoints).toBe(venom.cost);
  });
});

describe("ReinforcementDirector — teams", () => {
  it("a mirror match keeps one pool per team even with one faction on both", () => {
    const d = director({
      sides: [
        { key: P, members: [member(PM, "void_corsairs", true, [venom])] },
        { key: E, members: [member(EM, "void_corsairs", false, [venom])] },
      ],
    });
    d.registerInitial("player_0", PM, venom, "player");
    d.registerInitial("enemy_0", EM, venom, "ai");
    d.registerInitial("enemy_1", EM, venom, "ai");
    expect(d.summary(P).remainingPoints).toBe(300 - venom.cost);
    expect(d.summary(E).remainingPoints).toBe(300 - 2 * venom.cost);
    expect(d.summaries().map((s) => s.factions)).toEqual([
      ["void_corsairs"],
      ["void_corsairs"],
    ]);
  });

  it("two squads of a team share the team's pool and field cap", () => {
    const d = director({
      sides: [
        {
          key: P,
          members: [
            member(PM, "free_confederation", true, [wasp]),
            member("squad_2", "void_corsairs", false, [venom]),
          ],
        },
        { key: E, members: [member(EM, "void_corsairs", false, [venom])] },
      ],
    });
    d.registerInitial("player_0", PM, kestrel, "player");
    d.registerInitial("ally_0", "squad_2", venom, "ai");
    d.registerInitial("enemy_0", EM, venom, "ai");
    expect(d.summary(P).remainingPoints).toBe(300 - kestrel.cost - venom.cost);
    expect(d.summary(P).factions).toEqual([
      "free_confederation",
      "void_corsairs",
    ]);
    for (let i = 0; i < 10; i++) d.tick(TICK);
    expect(d.summary(P).fieldPoints).toBeLessThanOrEqual(FIELD_CAP);
    expect(d.summaries()).toHaveLength(2);
  });

  it("each squad of a team deploys from its own sub-reserve, with its own faction", () => {
    const d = director({
      sides: [
        {
          key: P,
          members: [
            member(PM, "free_confederation", true, [wasp]),
            member("squad_2", "void_corsairs", false, [talon]),
          ],
        },
        { key: E, members: [member(EM, "void_corsairs", false, [venom])] },
      ],
    });
    d.registerInitial("player_0", PM, kestrel, "player");
    d.registerInitial("enemy_0", EM, venom, "ai");
    const own = d.tick(TICK).filter((x) => x.side === P);
    const byMember = new Map(own.map((x) => [x.member, x]));
    expect(byMember.get(PM)?.option).toBe(wasp);
    expect(byMember.get(PM)?.faction).toBe("free_confederation");
    expect(byMember.get(PM)?.pilot).toBe("wingman");
    expect(byMember.get("squad_2")?.option).toBe(talon);
    expect(byMember.get("squad_2")?.faction).toBe("void_corsairs");
    expect(byMember.get("squad_2")?.pilot).toBe("ai");
  });

  it("every human squad has its own picker, opened only by its own pilot's loss", () => {
    const A = "squad_0";
    const B = "squad_2";
    const d = director({
      sides: [
        {
          key: P,
          members: [
            member(A, "free_confederation", true, [wasp]),
            member(B, "void_corsairs", true, [talon]),
          ],
        },
        { key: E, members: [member(EM, "void_corsairs", false, [venom])] },
      ],
    });
    d.registerInitial("player_0", A, kestrel, "player");
    d.registerInitial("ally_0", B, talon, "player");
    d.registerInitial("enemy_0", EM, venom, "ai");
    expect(d.humanMembers()).toEqual([A, B]);
    expect(d.pilotShipOf(B)).toBe("ally_0");
    d.shipDestroyed("ally_0");
    expect(d.pickerOf(A)).toBeNull();
    expect(d.pickerOf(B)).not.toBeNull();
    expect(d.pickerOf(B)!.options[0]!.option).toBe(talon);
    expect(d.choose(0, A)).toBeNull();
    const deployment = d.choose(0, B);
    expect(deployment).toMatchObject({ member: B, pilot: "player", side: P });
    expect(deployment?.faction).toBe("void_corsairs");
    expect(d.pilotShipOf(B)).toBe(deployment!.shipId);
    expect(d.pickerOf(B)).toBeNull();
  });
});
