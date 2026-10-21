/**
 * lobbyActions — what the online lobby's buttons do: the connection menu's
 * (mode, quick match, rooms, name, server) and the room's (loadout, team,
 * scenario, READY / REMATCH, leave). The scene supplies the few things that
 * need Phaser (prompts, scene changes, chat focus).
 */

import type { FactionId } from "../../config";
import {
  changePilotName,
  changeServer,
  pilotName,
} from "../../net/lobby/createOnlineSession";
import { localPlayer } from "../../net/lobby/LobbyModel";
import {
  cycleFaction,
  cycleShip,
  defaultLoadout,
  type SavedSquad,
} from "../../net/lobby/loadoutChoices";
import { nextScenario, otherTeam } from "../../net/lobby/lobbyEdits";
import type { OnlineSession } from "../../net/lobby/OnlineSession";
import type { SessionRegistry } from "../../net/lobby/createOnlineSession";
import type { OnlineMenuActions } from "../../ui/lobby/OnlineMenuView";
import type { OnlineRoomActions } from "../../ui/lobby/OnlineRoomView";

/** A text prompt the lobby asks the player. */
export interface LobbyPrompt {
  readonly title: string;
  readonly message: string;
  readonly initialValue: string;
  readonly confirmLabel: string;
  /** Whether an empty answer is accepted (the default server). */
  readonly allowEmpty?: boolean;
}

/** What the lobby scene provides to its actions. */
export interface LobbyActionHost {
  /** The current session (replaced when the name or server changes). */
  readonly session: OnlineSession;
  readonly registry: SessionRegistry;
  /** Switch to another session (after a name or server change). */
  attach(session: OnlineSession): void;
  /** Ask for text; `done` gets the trimmed answer. */
  ask(prompt: LobbyPrompt, done: (value: string) => void): void;
  /** The squad saved from the Squad Builder, if any. */
  savedSquad(): SavedSquad | null;
  /** Open the Squad Builder for this room. */
  editSquad(): void;
  /** Focus the chat input. */
  focusChat(): void;
  /** Leave online play for the offline menu. */
  playOffline(): void;
}

/** @param host - The lobby scene. @returns Callbacks for the connection menu. */
export function createMenuActions(host: LobbyActionHost): OnlineMenuActions {
  const s = (): OnlineSession => host.session;
  return {
    selectMode: (mode) => s().selectMode(mode),
    quickMatch: () => s().quickMatch(),
    createRoom: () => s().createRoom(),
    joinByCode: () =>
      host.ask(
        {
          title: "Join by code",
          message: "Room code from your friend:",
          initialValue: "",
          confirmLabel: "JOIN",
        },
        (code) => {
          if (!s().joinRoom(code)) s().notify("Not connected", "danger");
        },
      ),
    cancelQueue: () => s().cancelQueue(),
    editName: () =>
      host.ask(
        {
          title: "Pilot name",
          message: "Shown to other players:",
          initialValue: pilotName(),
          confirmLabel: "SAVE",
        },
        (name) => host.attach(changePilotName(host.registry, name)),
      ),
    editServer: () =>
      host.ask(
        {
          title: "Online server",
          message: "Relay address (leave empty for the default):",
          initialValue:
            s().state.server.source === "settings"
              ? (s().state.server.url ?? "")
              : "",
          confirmLabel: "SAVE",
          allowEmpty: true,
        },
        (url) => host.attach(changeServer(host.registry, url)),
      ),
    reconnect: () => s().connect(),
    playOffline: () => host.playOffline(),
  };
}

/** @param host - The lobby scene. @returns Callbacks for the room's controls. */
export function createRoomActions(host: LobbyActionHost): OnlineRoomActions {
  const s = (): OnlineSession => host.session;
  const me = () => localPlayer(s().state);
  const mode = () => s().state.room?.mode ?? "dogfight";
  return {
    cycleFaction: () =>
      s().setLoadout(
        cycleFaction(mode(), me()?.loadout ?? null, 1, host.savedSquad()),
      ),
    cycleShip: () =>
      s().setLoadout(
        cycleShip(
          me()?.loadout ?? defaultLoadout(mode(), "free_confederation"),
          1,
        ),
      ),
    editSquad: () => host.editSquad(),
    toggleTeam: () => s().setTeam(otherTeam(me()?.team ?? 0)),
    cycleScenario: () =>
      s().setScenario(nextScenario(s().state.room?.options.scenarioId)),
    toggleReady: () => toggleReady(s()),
    copyCode: () => copyCode(s()),
    leave: () => s().leaveRoom(),
    focusChat: () => host.focusChat(),
  };
}

/** READY / UNREADY, or the rematch vote while the room's rematch window is open. */
function toggleReady(session: OnlineSession): void {
  const vote = !(localPlayer(session.state)?.ready ?? false);
  if (session.state.room?.rematch) session.rematch(vote);
  else session.setReady(vote);
}

function copyCode(session: OnlineSession): void {
  const code = session.state.room?.code;
  if (!code) return;
  navigator.clipboard?.writeText(code).catch(() => undefined);
  session.notify(
    `Room code ${code} copied — send it to your wingmate`,
    "success",
  );
}

/** @param registry - The game registry. @returns The squad saved from the Squad Builder, if any. */
export function savedSquadFrom(registry: {
  get(key: string): unknown;
}): SavedSquad | null {
  const faction = registry.get("onlineFaction") as string | undefined;
  const ships = registry.get("onlineSquad") as string[] | undefined;
  return faction && ships && ships.length > 0
    ? { faction: faction as FactionId, ships }
    : null;
}
