/**
 * Lore distancing gate (docs/lore/glossary.md, "Distancing table"): no
 * Star Wars / X-Wing-specific term may survive in a string literal or comment
 * of any .ts file under src/. Internal ids (slot ids, maneuver ids, card ids)
 * never match the patterns; the few legitimate exceptions are allowlisted
 * below, each with its reason.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { slotDisplayName } from "../../../src/data/encyclopedia/codexTypes";
import { MANEUVER_WORDS } from "../../../src/core/maneuverLabels";
import { abilityDisplayName, shipDisplayName } from "../../../src/ui/idLabels";

interface BannedTerm {
  readonly term: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

const BANNED_TERMS: readonly BannedTerm[] = [
  { term: "Force", pattern: /\bForce\b/, replacement: "psionic / psi" },
  { term: "Battle Meditation", pattern: /Battle Meditation/, replacement: "War Chorus" },
  { term: "Supernatural", pattern: /Supernatural/, replacement: "Precog Reflexes" },
  { term: "astromech", pattern: /(?<![\w"'`])astromechs?(?![\w"'`:])/, replacement: "rigger" },
  { term: "Astromech", pattern: /\bAstromechs?\b/, replacement: "Rigger" },
  { term: "droid", pattern: /\b[Dd]roids?\b/, replacement: "rigger" },
  { term: "Segnor", pattern: /\bSegnor|\bSEGNOR\b/, replacement: "Hook Loop" },
  { term: "segnor", pattern: /\bsegnors?(?![_\w:"'])/, replacement: "hook" },
  { term: "Tallon", pattern: /\bTallon|\bTALLON\b/, replacement: "Knife Roll" },
  { term: "tallon", pattern: /\btallon(?![_\w:"'])/, replacement: "knife" },
  { term: "K-turn", pattern: /\bK-(turn|Turn|TURN)/, replacement: "Snap Turn" },
  { term: "k-turn", pattern: /(?<!["'])\bk-turns?\b(?!["'])/, replacement: "snap turn" },
  { term: "Koiogran", pattern: /Koiogran/, replacement: "Snap" },
  { term: "hyperspace", pattern: /[Hh]yperspace/, replacement: "jump gate" },
  { term: "Imperator", pattern: /\bImperator\b/, replacement: "Aquila" },
  { term: "Executor", pattern: /\bExecutor\b/, replacement: "Lictor" },
  { term: "Grand Inquisitor", pattern: /Grand Inquisitor/, replacement: "First Censor" },
  { term: "Proton", pattern: /\bProton\b/, replacement: "Fusion" },
  { term: "Concussion", pattern: /\bConcussion\b/, replacement: "Burst" },
  { term: "Seismic", pattern: /\bSeismic\b/, replacement: "Quake" },
  { term: "Blaster", pattern: /\b[Bb]laster(?!_)\b/, replacement: "Pulse" },
  { term: "Rebel", pattern: /\b[Rr]ebel(?!_)\b|[Rr]ebellion/, replacement: "Libre / cell / insurgent" },
  { term: "Vorn", pattern: /\bVorn\b/, replacement: "Vosk" },
  { term: "X-Wing", pattern: /X-Wing/i, replacement: "tabletop" },
  { term: "Torpedo Ace Zara", pattern: /Torpedo Ace Zara/, replacement: "Torpedo Ace Zhao" },
];

interface AllowedLine {
  /** Path suffix (posix) the entry applies to; omitted = every file. */
  readonly file?: string;
  readonly term: string;
  readonly line: RegExp;
  readonly why: string;
}

const ALLOWED_LINES: readonly AllowedLine[] = [
  {
    term: "Vorn",
    line: /Crusader Vorn/,
    why: "Ascendant card crusader_vorn keeps its name; only the Corsair usurper became Vosk.",
  },
];

const SRC_ROOT = join(__dirname, "..", "..", "..", "src");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function isAllowed(file: string, term: string, line: string): boolean {
  return ALLOWED_LINES.some(
    (entry) =>
      (entry.file === undefined || file.endsWith(entry.file)) &&
      (entry.term === "*" || entry.term === term) &&
      entry.line.test(line),
  );
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const path of listSourceFiles(SRC_ROOT)) {
    const file = relative(join(SRC_ROOT, ".."), path).split(sep).join("/");
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        for (const banned of BANNED_TERMS) {
          if (!banned.pattern.test(line) || isAllowed(file, banned.term, line)) continue;
          violations.push(
            `${file}:${index + 1} "${banned.term}" -> ${banned.replacement}: ${line.trim()}`,
          );
        }
      });
  }
  return violations;
}

describe("lore distancing", () => {
  it("keeps every Star Wars / X-Wing-specific term out of src strings and comments", () => {
    expect(findViolations()).toEqual([]);
  });

  it("shows the astromech slot as Rigger and the force_power slot as Psionic", () => {
    expect(slotDisplayName("astromech")).toBe("Rigger");
    expect(slotDisplayName("force_power")).toBe("Psionic");
  });

  it("names the special maneuvers Snap, Hook and Knife on every readout", () => {
    expect([MANEUVER_WORDS.kturn, MANEUVER_WORDS.segnor, MANEUVER_WORDS.tallon]).toEqual([
      "SNAP",
      "HOOK",
      "KNIFE",
    ]);
  });

  it("shows renamed ships and abilities by catalog name, not by reworded id", () => {
    expect(shipDisplayName("terran_imperator")).toBe("Aquila Battlecruiser");
    expect(shipDisplayName("terran_executor")).toBe("Lictor Destroyer");
    expect(abilityDisplayName("force_heal")).toBe("Mend");
    expect(abilityDisplayName("unknown_thing")).toBe("unknown thing");
  });

  it("title-cases slot ids without an override", () => {
    expect(slotDisplayName("modification")).toBe("Modification");
  });
});
