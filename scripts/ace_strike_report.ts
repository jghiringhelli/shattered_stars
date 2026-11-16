/**
 * ace_strike_report — what the ace hit-and-run mechanics (docs/specs/aces.md)
 * do to the balance, measured on the real engine with the mechanics OFF
 * (the "before" arm: SquadList.aceMechanics = false) and ON, same seeds:
 *
 * 1. Classic Skirmish faction totals (auto-fill lists, average v average;
 *    must stay 45–55 %).
 * 2. An ACE IN A SQUAD v the same squad with a non-ace build of the same
 *    hull (equal companions): the ace squad's win % per arm, and the shift.
 * 3. Gate 2 with aces: a coordinated average squad (non-ace builds) v solo
 *    experts flying ACE builds of the same hulls (must stay >= 70 %).
 *
 * Usage: npx tsx scripts/ace_strike_report.ts [--seeds 20] [--workers n] [--sections factions,aces,gate2]
 */

import type { FactionId } from "../src/config";
import { isAceLoadout } from "../src/data/aceStatus";
import { getShipDefinition } from "../src/data/ShipDefinitions";
import {
  getEquippableLoadouts,
  SHIP_LOADOUTS,
} from "../src/data/ShipLoadouts";
import {
  formatInterval,
  gamesOf,
  shareInterval,
  type WinTally,
  addTallies,
  EMPTY_TALLY,
  flipTally,
} from "../src/simulation/balance/balanceStats";
import { factionPairs } from "../src/simulation/balance/factionMatrix";
import type { PairResult } from "../src/simulation/balance/factionMatrix";
import {
  BALANCE_FACTIONS,
  FACTION_SHORT,
  listCost,
  shipCost,
  skirmishAutoFillList,
  type ListShip,
  type SquadList,
} from "../src/simulation/balance/squadLists";
import { runBattle } from "../src/simulation/skill/SkillArena";
import { gate2Compositions } from "../src/simulation/skill/SkillGate2";
import { runPool, type KeyedJob } from "./balance/pool";

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SEEDS = Number(arg("--seeds") ?? 20);
const WORKERS = arg("--workers") ? Number(arg("--workers")) : undefined;
const SECTIONS = (arg("--sections") ?? "factions,aces,gate2").split(",");
const ARMS = [false, true] as const;
const ACES_PER_FACTION = 4;
const COMPANIONS = 2;
const SEED_BASE = 9100;

const armLabel = (on: boolean): string => (on ? "on" : "off");
const withArm = (list: SquadList, on: boolean): SquadList => ({
  ...list,
  label: `${list.label} [ace ${armLabel(on)}]`,
  aceMechanics: on,
});
const pct = (tally: WinTally): string => formatInterval(shareInterval(tally));

/** A non-ace quick build of a hull (the cheapest), or null. */
function plainBuild(hull: string, maxCost = Infinity): string | null {
  const plain = getEquippableLoadouts(hull)
    .filter((b) => !isAceLoadout(b.id))
    .sort((a, b) => a.pointCost - b.pointCost);
  const fits = plain.filter((b) => b.pointCost <= maxCost);
  return (fits.length ? fits[fits.length - 1] : plain[0])?.id ?? null;
}

function companionsOf(faction: FactionId): ListShip[] {
  return skirmishAutoFillList(faction)
    .ships.slice(0, COMPANIONS)
    .map((ship) => ({
      definitionId: ship.definitionId,
      loadoutId: isAceLoadout(ship.loadoutId)
        ? plainBuild(ship.definitionId)
        : ship.loadoutId,
    }));
}

/** Ace builds of a faction's non-capital hulls, spread across the price range. */
function aceBuildsOf(faction: FactionId): Array<{ hull: string; id: string }> {
  const all = Object.entries(SHIP_LOADOUTS)
    .filter(([hull]) => {
      const def = getShipDefinition(hull);
      return def?.faction === faction && def.role !== "capital";
    })
    .flatMap(([hull, builds]) =>
      builds.filter((b) => isAceLoadout(b.id)).map((b) => ({ hull, ...b })),
    )
    .sort((a, b) => a.pointCost - b.pointCost || a.id.localeCompare(b.id));
  const picks = Math.min(ACES_PER_FACTION, all.length);
  return Array.from({ length: picks }, (_, i) => {
    const pick = all[Math.floor((i * all.length) / picks)]!;
    return { hull: pick.hull, id: pick.id };
  });
}

interface AceCase {
  readonly key: string;
  readonly faction: FactionId;
  readonly aceBuild: string;
  readonly aceCost: number;
  readonly plainCost: number;
  readonly ace: SquadList;
  readonly plain: SquadList;
}

function aceCases(): AceCase[] {
  return BALANCE_FACTIONS.flatMap((faction) =>
    aceBuildsOf(faction).map(({ hull, id }) => {
      const aceShip: ListShip = { definitionId: hull, loadoutId: id };
      const aceCost = shipCost(aceShip);
      const plainShip: ListShip = {
        definitionId: hull,
        loadoutId: plainBuild(hull, aceCost),
      };
      const companions = companionsOf(faction);
      const mk = (label: string, ship: ListShip): SquadList => ({
        label,
        faction,
        ships: [ship, ...companions],
      });
      return {
        key: `${FACTION_SHORT[faction]} ${id}`,
        faction,
        aceBuild: id,
        aceCost,
        plainCost: shipCost(plainShip),
        ace: mk("ace squad", aceShip),
        plain: mk("plain squad", plainShip),
      };
    }),
  );
}

type Results = Map<string, PairResult>;

async function runJobs(jobs: KeyedJob[]): Promise<Results> {
  const done = await runPool(jobs, WORKERS);
  return done as unknown as Results;
}

const seeds = { base: SEED_BASE, count: SEEDS };

async function factionSection(): Promise<void> {
  const jobs: KeyedJob[] = ARMS.flatMap((on) =>
    factionPairs().map(([a, b]) => ({
      key: `f:${on}:${a}:${b}`,
      job: {
        kind: "squads" as const,
        a: withArm(skirmishAutoFillList(a), on),
        b: withArm(skirmishAutoFillList(b), on),
        seeds,
      },
    })),
  );
  const results = await runJobs(jobs);
  console.log("\n## Classic faction totals (auto-fill lists, average v average)\n");
  console.log("| faction | ace mechanics off | ace mechanics on |");
  console.log("|---|---|---|");
  for (const faction of BALANCE_FACTIONS) {
    const cells = ARMS.map((on) => {
      let total: WinTally = EMPTY_TALLY;
      for (const [a, b] of factionPairs()) {
        if (a !== faction && b !== faction) continue;
        const tally = results.get(`f:${on}:${a}:${b}`)!.tally;
        total = addTallies(total, a === faction ? tally : flipTally(tally));
      }
      const share = shareInterval(total).share * 100;
      return `${pct(total)}${share < 45 || share > 55 ? " ✘" : ""}`;
    });
    console.log(`| ${FACTION_SHORT[faction]} | ${cells.join(" | ")} |`);
  }
}

async function aceSection(): Promise<void> {
  const cases = aceCases();
  const jobs: KeyedJob[] = ARMS.flatMap((on) =>
    cases.map((c) => ({
      key: `a:${on}:${c.key}`,
      job: {
        kind: "squads" as const,
        a: withArm(c.ace, on),
        b: withArm(c.plain, on),
        seeds,
      },
    })),
  );
  const results = await runJobs(jobs);
  console.log("\n## Ace in a squad v the same squad with a non-ace build of the hull\n");
  console.log("Win % of the ace squad (draws ½). Ace cost / plain cost in points.\n");
  console.log("| ace build | pts ace/plain | off | on | shift |");
  console.log("|---|---|---|---|---|");
  const totals = ARMS.map(() => EMPTY_TALLY as WinTally);
  for (const c of cases) {
    const tallies = ARMS.map((on) => results.get(`a:${on}:${c.key}`)!.tally);
    tallies.forEach((t, i) => (totals[i] = addTallies(totals[i]!, t)));
    const [off, on] = tallies.map((t) => shareInterval(t).share * 100) as [number, number];
    console.log(
      `| ${c.key} | ${c.aceCost}/${c.plainCost} | ${pct(tallies[0]!)} | ${pct(tallies[1]!)} | ${on - off >= 0 ? "+" : ""}${(on - off).toFixed(1)} |`,
    );
  }
  const [off, on] = totals.map((t) => shareInterval(t).share * 100) as [number, number];
  console.log(
    `| **all (${gamesOf(totals[0]!)} games/arm)** | | ${pct(totals[0]!)} | ${pct(totals[1]!)} | ${on - off >= 0 ? "+" : ""}${(on - off).toFixed(1)} |`,
  );
}

function gate2Section(): void {
  const ships = Object.keys(SHIP_LOADOUTS)
    .map((id) => getShipDefinition(id))
    .filter((def): def is NonNullable<typeof def> => def !== undefined);
  const fighters = ships.filter((def) => def.role !== "capital");
  console.log("\n## Gate 2 with ACES: coordinated average squad (non-ace) v solo experts on ace builds\n");
  console.log("| arm | squad win % | battles |");
  console.log("|---|---|---|");
  const compositions = gate2Compositions(fighters);
  for (const on of ARMS) {
    let tally: WinTally = EMPTY_TALLY;
    for (const composition of compositions) {
      for (let s = 0; s < SEEDS; s += 1) {
        tally = addTallies(tally, gate2Battle(composition, SEED_BASE + s, on));
      }
    }
    console.log(`| ace ${armLabel(on)} | ${pct(tally)} | ${gamesOf(tally)} |`);
  }
}

function gate2Battle(
  composition: readonly string[],
  seed: number,
  on: boolean,
): WinTally {
  const aceBuild = (hull: string): string | null =>
    getEquippableLoadouts(hull).find((b) => isAceLoadout(b.id))?.id ??
    plainBuild(hull);
  const result = runBattle({
    A: {
      ships: composition.map((definitionId) => ({
        definitionId,
        tier: "average" as const,
        loadoutId: plainBuild(definitionId),
        aceMechanics: on,
      })),
      squad: {},
    },
    B: {
      ships: composition.map((definitionId) => ({
        definitionId,
        tier: "expert" as const,
        loadoutId: aceBuild(definitionId),
        aceMechanics: on,
      })),
      squad: null,
    },
    seed,
  });
  if (result.winner === "draw") return { wins: 0, losses: 0, draws: 1 };
  return result.winner === "A"
    ? { wins: 1, losses: 0, draws: 0 }
    : { wins: 0, losses: 1, draws: 0 };
}

async function main(): Promise<void> {
  console.log(`# Ace strike report (${SEEDS} seeds x 2 seatings per cell)`);
  if (SECTIONS.includes("factions")) await factionSection();
  if (SECTIONS.includes("aces")) await aceSection();
  if (SECTIONS.includes("gate2")) gate2Section();
}

void main();
