/**
 * onlineNotices — the HUD lines an online battle shows when another player
 * drops, returns or leaves, and while a resync runs. Pure.
 */

import type { MatchStart, PeerStatus } from "../protocol";

/** A HUD notice. */
export interface OnlineNotice {
  readonly text: string;
  readonly tone: "neutral" | "success" | "warning" | "danger";
}

const MS_PER_S = 1000;

/**
 * @param match - The match (seat names).
 * @param seat - The seat whose status changed.
 * @param status - What happened.
 * @param graceMs - Reconnection window left (disconnects).
 * @returns The notice.
 */
export function noticeForPeer(
  match: MatchStart,
  seat: number,
  status: PeerStatus,
  graceMs: number,
): OnlineNotice {
  const name = match.seats[seat]?.name ?? `Seat ${seat + 1}`;
  switch (status) {
    case "disconnected":
      return {
        text: `${name} lost connection — the AI flies their ship (${Math.round(graceMs / MS_PER_S)} s to return)`,
        tone: "warning",
      };
    case "reconnected":
      return { text: `${name} is back`, tone: "success" };
    case "left":
      return {
        text: `${name} left — the AI flies their ship`,
        tone: "warning",
      };
  }
}

/**
 * @param reason - Why the relay asked for a resync.
 * @returns The notice.
 */
export function noticeForResync(reason: "desync" | "reconnect"): OnlineNotice {
  return reason === "desync"
    ? { text: "Out of sync — resyncing…", tone: "warning" }
    : { text: "Rejoining the battle…", tone: "neutral" };
}
