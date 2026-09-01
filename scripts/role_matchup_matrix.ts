/**
 * Role Matchup Matrix CLI
 *
 * Validates whether ship ROLES form a healthy rock-paper-scissors counter
 * system at equal point cost (a support ship should usually lose to an ace
 * in equal conditions; other roles carve out their own niches) rather than
 * a strict dominance hierarchy where one role beats everything.
 *
 * Usage:
 *   npx tsx scripts/role_matchup_matrix.ts [--budget 200] [--battles 100] [--mode arcade] [--export path.json]
 */

import * as fs from "fs";
import {
  ALL_ROLES,
  ROLE_REPRESENTATIVES,
  buildEqualPointSquad,
  runRoleMatchupMatrix,
  summarizeByRole,
  findDominantRole,
  findUnderpoweredRole,
  roleAWinShare,
} from "../src/simulation/RoleMatchup";
import { STOMP_FLOOR, type DuelMode } from "../src/simulation/DuelBalance";

function argValue(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

const budget = Number(argValue("--budget", "200"));
const battles = Number(argValue("--battles", "100"));
const mode = argValue("--mode", "arcade") as DuelMode;
const exportPath = process.argv.includes("--export")
  ? argValue("--export", "")
  : null;

function printSquadSizes(): void {
  console.log("Squad sizes at this budget:");
  for (const role of ALL_ROLES) {
    const shipId = ROLE_REPRESENTATIVES[role];
    const size = buildEqualPointSquad(shipId, budget).length;
    console.log(`  ${role.padEnd(14)} ${shipId.padEnd(18)} x${size}`);
  }
}

function printPairResults(
  results: ReturnType<typeof runRoleMatchupMatrix>,
): void {
  console.log("\nPairwise results:");
  for (const r of results) {
    const share = roleAWinShare(r);
    const stomp = share >= 1 - STOMP_FLOOR || share <= STOMP_FLOOR;
    const drawPct = (r.outcome.drawRate * 100).toFixed(0);
    console.log(
      `  ${r.roleA} (${(share * 100).toFixed(0)}%) vs ${r.roleB} (${((1 - share) * 100).toFixed(0)}%)` +
        `  [${r.squadASize}v${r.squadBSize} ships, ${drawPct}% draws]${stomp ? "  <- STOMP" : ""}`,
    );
  }
}

function printRoleSummaries(
  summaries: ReturnType<typeof summarizeByRole>,
): void {
  console.log("\nPer-role summary:");
  for (const s of summaries) {
    console.log(
      `  ${s.role.padEnd(14)} avg win share ${(s.avgWinShare * 100).toFixed(0)}%` +
        ` | beats [${s.beats.join(", ") || "none"}]` +
        ` | loses to [${s.losesTo.join(", ") || "none"}]`,
    );
  }
}

function main(): void {
  console.log(
    `\nRole Matchup Matrix — budget=${budget}pts, ${battles} battles/pair, mode=${mode}\n`,
  );
  printSquadSizes();

  const results = runRoleMatchupMatrix(ALL_ROLES, budget, battles, 42, {
    mode,
    maxTurns: 150,
  });
  printPairResults(results);

  const summaries = summarizeByRole(results);
  printRoleSummaries(summaries);

  const dominant = findDominantRole(summaries);
  const underpowered = findUnderpoweredRole(summaries);
  console.log(
    `\nDominant role (beats everyone): ${dominant ?? "none — healthy"}`,
  );
  console.log(
    `Underpowered role (loses to everyone): ${underpowered ?? "none — healthy"}`,
  );

  if (exportPath) {
    fs.writeFileSync(
      exportPath,
      JSON.stringify(
        { budget, battles, mode, results, summaries, dominant, underpowered },
        null,
        2,
      ),
    );
    console.log(`\nExported: ${exportPath}`);
  }
}

main();
