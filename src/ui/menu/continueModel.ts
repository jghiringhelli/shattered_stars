/**
 * continueModel — what the main menu's CONTINUE card shows and does, from
 * the last launch (what CONTINUE LAST starts) and the last finished battle
 * (the "Last: Skirmish — Victory 3:02" line and its details). Pure.
 */

import {
  lastBattleLine,
  type LastBattleRecord,
} from "../../telemetry/lastBattleStore";
import type { LastLaunch } from "../../systems/setup/setupMemory";
import type { MainMenuEntry } from "./mainMenuEntries";

/** The card's content. */
export interface ContinueCardState {
  readonly visible: boolean;
  readonly title: string;
  /** "Last: Skirmish — Victory 3:02", or a hint when no battle is stored. */
  readonly line: string;
  readonly canContinue: boolean;
  readonly canShowDetails: boolean;
}

/**
 * @param launch - The last launch, or null.
 * @param battle - The last finished battle, or null.
 * @returns What the card shows.
 */
export function continueCardState(
  launch: LastLaunch | null,
  battle: LastBattleRecord | null,
): ContinueCardState {
  return {
    visible: launch !== null || battle !== null,
    title: launch ? `Continue · ${launch.label}` : "Last battle",
    line: battle ? lastBattleLine(battle) : "No battle finished yet",
    canContinue: launch !== null,
    canShowDetails: battle !== null,
  };
}

/** Group of entries that are remembered as "the last mode played". */
const REMEMBERED_GROUP: MainMenuEntry["group"] = "play";

/**
 * @param entry - A main-menu entry that was just chosen.
 * @returns The launch to remember, or null for entries that are not modes
 *   (Settings, Controls, Online...).
 */
export function launchOfEntry(
  entry: MainMenuEntry,
): Omit<LastLaunch, "version" | "savedAt"> | null {
  if (entry.group !== REMEMBERED_GROUP) return null;
  const data = Object.fromEntries(
    Object.entries(entry.data ?? {}).filter(([, v]) =>
      ["string", "number", "boolean"].includes(typeof v),
    ),
  ) as Record<string, string | number | boolean>;
  return {
    label: entry.label,
    scene: entry.target,
    ...(Object.keys(data).length > 0 ? { data } : {}),
  };
}
