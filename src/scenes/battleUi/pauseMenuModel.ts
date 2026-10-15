/**
 * pauseMenuModel — pure description of the ONE pause menu every battle scene
 * shows: which entries, in which order, in which variant. Online battles
 * cannot freeze the shared simulation, so their menu has no RESTART /
 * SETTINGS and offers LEAVE MATCH instead of QUIT.
 */

import type { HoloButtonVariant } from "../../ui/hud/holoButtonStyle";

/** Pause-menu entry ids. */
export type PauseEntryId =
  | "resume"
  | "restart"
  | "settings"
  | "controls"
  | "feedback"
  | "quit"
  | "leave";

/** One menu entry. */
export interface PauseEntrySpec {
  readonly id: PauseEntryId;
  readonly label: string;
  readonly variant: HoloButtonVariant;
}

const RESUME: PauseEntrySpec = {
  id: "resume",
  label: "Resume",
  variant: "primary",
};
const RESTART: PauseEntrySpec = {
  id: "restart",
  label: "Restart",
  variant: "secondary",
};
const SETTINGS: PauseEntrySpec = {
  id: "settings",
  label: "Settings",
  variant: "secondary",
};
const CONTROLS: PauseEntrySpec = {
  id: "controls",
  label: "Controls",
  variant: "secondary",
};
const FEEDBACK: PauseEntrySpec = {
  id: "feedback",
  label: "Send feedback",
  variant: "secondary",
};
const QUIT: PauseEntrySpec = {
  id: "quit",
  label: "Quit to menu",
  variant: "danger",
};
const LEAVE: PauseEntrySpec = {
  id: "leave",
  label: "Leave match",
  variant: "danger",
};

/**
 * @param online - Whether the battle is an online match.
 * @returns The menu entries, top to bottom.
 */
export function pauseEntries(online: boolean): readonly PauseEntrySpec[] {
  return online
    ? [RESUME, CONTROLS, FEEDBACK, LEAVE]
    : [RESUME, RESTART, SETTINGS, CONTROLS, FEEDBACK, QUIT];
}

/** Confirmation text of the destructive exits (e2e matches the prefix). */
export const QUIT_CONFIRM_MESSAGE = "Quit to menu? Battle progress will be lost.";
