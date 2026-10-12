/**
 * onlineModes — how the online lobby names and explains each match mode.
 * Pure data.
 */

import { MODE_RULES, type MatchMode } from "../../net/protocol";

/** Display data of a mode. */
export interface OnlineModeInfo {
  readonly label: string;
  /** "1v1" / "up to 2v2". */
  readonly size: string;
  readonly description: string;
}

/** Display data per mode. */
export const ONLINE_MODE_INFO: Readonly<Record<MatchMode, OnlineModeInfo>> = {
  dogfight: {
    label: "DOGFIGHT",
    size: "1v1",
    description: "One ship each, best of three rounds. Pure piloting.",
  },
  skirmish: {
    label: "SKIRMISH",
    size: `up to ${MODE_RULES.skirmish.maxPlayers / 2}v${MODE_RULES.skirmish.maxPlayers / 2}`,
    description:
      "Squad battle: you fly your flagship, AI wingmen fly the rest. Last team standing wins.",
  },
  scenario: {
    label: "SCENARIO",
    size: "1v1",
    description:
      "Squad battle over objectives (satellites, salvage, transmissions). Host picks the scenario.",
  },
  reinforcements: {
    label: "REINFORCEMENTS",
    size: "1v1",
    description:
      "Squad battle with a 1000-point reserve pool per faction: lost ships warp back in until the pool runs dry.",
  },
};

/** @param mode - A mode. @returns "DOGFIGHT 1v1". */
export function modeTitle(mode: MatchMode): string {
  const info = ONLINE_MODE_INFO[mode];
  return `${info.label} ${info.size}`;
}
