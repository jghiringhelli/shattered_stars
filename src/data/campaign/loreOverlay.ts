/**
 * loreOverlay — applies a faction's {@link FactionLore} to its merged
 * missions: text swaps, field overrides, replaced/added objectives, enemies,
 * beats, debrief lines and variants. Pure; never mutates its input.
 */

import type { CampaignMission, MissionObjective } from "./campaignTypes";
import type { FactionLore, MissionLore, TextSwap } from "./loreTypes";

/** Fields a swap must never touch. */
const SWAP_SKIP_KEYS: ReadonlySet<string> = new Set(["id"]);

/**
 * @param value - Any plain-data value.
 * @param swaps - Replacements to apply to every string.
 * @param hits - Receives the index of every swap that matched.
 * @returns The value with the swaps applied.
 */
function swapDeep<T>(value: T, swaps: readonly TextSwap[], hits: Set<number>): T {
  if (typeof value === "string") {
    let text: string = value;
    swaps.forEach(([from, to], index) => {
      if (!text.includes(from)) return;
      hits.add(index);
      text = text.split(from).join(to);
    });
    return text as T;
  }
  if (Array.isArray(value))
    return value.map((entry) => swapDeep(entry, swaps, hits)) as T;
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value))
      out[key] = SWAP_SKIP_KEYS.has(key) ? entry : swapDeep(entry, swaps, hits);
    return out as T;
  }
  return value;
}

/**
 * @param objectives - Mission objectives.
 * @param text - Objective id → new description.
 * @returns The objectives with descriptions replaced.
 */
function retextObjectives(
  objectives: readonly MissionObjective[],
  text: Readonly<Record<string, string>>,
): MissionObjective[] {
  return objectives.map((o) =>
    text[o.id] === undefined ? o : { ...o, description: text[o.id]! },
  );
}

/**
 * @param mission - A merged mission.
 * @param lore - Its edits.
 * @param hits - Receives matched swap indexes.
 * @returns The mission with the edits applied.
 */
export function applyMissionLore(
  mission: CampaignMission,
  lore: MissionLore,
  hits: Set<number> = new Set(),
): CampaignMission {
  let objectives: MissionObjective[] = [
    ...(lore.replaceObjectives ?? mission.objectives),
  ];
  if (lore.objectiveText)
    objectives = retextObjectives(objectives, lore.objectiveText);
  objectives = [...objectives, ...(lore.addObjectives ?? [])];
  const edited: CampaignMission = {
    ...mission,
    ...(lore.title !== undefined ? { title: lore.title } : {}),
    ...(lore.tagline !== undefined ? { tagline: lore.tagline } : {}),
    ...(lore.briefing !== undefined ? { briefing: lore.briefing } : {}),
    ...(lore.mood !== undefined ? { mood: lore.mood } : {}),
    ...(lore.style !== undefined ? { style: lore.style } : {}),
    ...(lore.day !== undefined ? { day: lore.day } : {}),
    ...(lore.location !== undefined ? { location: lore.location } : {}),
    ...(lore.crossover !== undefined ? { crossover: lore.crossover } : {}),
    objectives,
    enemies: [
      ...(lore.replaceEnemies ?? mission.enemies),
      ...(lore.addEnemies ?? []),
    ],
    script: [
      ...(lore.replaceScript ?? mission.script ?? []),
      ...(lore.script ?? []),
    ],
    debrief: [
      ...(lore.replaceDebrief ?? mission.debrief ?? []),
      ...(lore.debriefAppend ?? []),
    ],
    variants: [...(mission.variants ?? []), ...(lore.variants ?? [])],
    victoryFlags: {
      ...(mission.victoryFlags ?? {}),
      ...(lore.victoryFlags ?? {}),
    },
  };
  return lore.textSwaps ? swapDeep(edited, lore.textSwaps, hits) : edited;
}

/**
 * @param missions - A faction's merged missions.
 * @param lore - Its lore.
 * @returns The missions with the lore applied.
 */
export function applyLore(
  missions: readonly CampaignMission[],
  lore: FactionLore,
): CampaignMission[] {
  return missions.map((m) => {
    const edit = lore.missions[m.id];
    return edit ? applyMissionLore(m, edit) : m;
  });
}

/**
 * @param missions - A faction's merged missions (before the lore).
 * @param lore - Its lore.
 * @returns Mission ids with lore that matches no mission, and swaps
 *   (`id#index`) that matched no string — stale edits the lore test rejects.
 */
export function staleLore(
  missions: readonly CampaignMission[],
  lore: FactionLore,
): string[] {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const stale: string[] = [];
  for (const [id, edit] of Object.entries(lore.missions)) {
    const mission = byId.get(id);
    if (!mission) {
      stale.push(`${id}: no such mission`);
      continue;
    }
    const hits = new Set<number>();
    applyMissionLore(mission, edit, hits);
    (edit.textSwaps ?? []).forEach((swap, index) => {
      if (!hits.has(index)) stale.push(`${id}#${index}: "${swap[0]}"`);
    });
  }
  return stale;
}
