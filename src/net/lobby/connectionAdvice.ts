/**
 * Plain-language help under the lobby's connection status: what went wrong,
 * what to try, and the fact that every other mode works offline. Pure.
 */

import type { LobbyState } from "./LobbyModel";

/** Said in every failure state. */
export const OFFLINE_HINT =
  "Skirmish, Survival, Campaign, Ace Duel and Flight School work offline: no server needed.";

/**
 * @param state - Lobby state.
 * @returns Two or three short lines explaining the connection problem and
 *   what to do next (empty while connected or connecting normally).
 */
export function connectionAdvice(state: LobbyState): string {
  if (!state.server.url) {
    return `Online play is not set up in this build. ${OFFLINE_HINT}`;
  }
  switch (state.connection) {
    case "unreachable":
      return `Could not reach the game server. It may be starting up (that can take about 30 s), restarting, or blocked by your network. Try RECONNECT in a moment. ${OFFLINE_HINT}`;
    case "refused":
      return refusalAdvice(state.refusal);
    case "expired":
      return `Your online session timed out. Press RECONNECT to start a new one. ${OFFLINE_HINT}`;
    case "reconnecting":
      return "The connection dropped. Your seat is kept for 30 s while the game reconnects.";
    default:
      return "";
  }
}

function refusalAdvice(refusal: LobbyState["refusal"]): string {
  if (refusal === "version_mismatch") {
    return `Your game is on a different version than the server (older or newer). Reload the page (Ctrl+F5) to get the current build. ${OFFLINE_HINT}`;
  }
  if (refusal === "server_full") {
    return `The server is full right now. Try again in a few minutes. ${OFFLINE_HINT}`;
  }
  return `The server refused the connection. Reload the page and try again. ${OFFLINE_HINT}`;
}
