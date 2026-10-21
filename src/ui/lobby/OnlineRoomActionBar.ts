/**
 * OnlineRoomActionBar — the local player's controls under the room (faction /
 * ship or squad, team, scenario, READY / REMATCH, LEAVE): which controls the
 * mode offers and the row of buttons.
 */

import type Phaser from "phaser";
import {
  localPlayer,
  readyBlocker,
  type LobbyState,
} from "../../net/lobby/LobbyModel";
import { MODE_RULES } from "../../net/protocol";
import { createHoverButton } from "../ButtonFactory";
import type { HoloButtonVariant } from "../hud/holoButtonStyle";
import type { HoloPressButton } from "../menu/HoloPressButton";
import type { MenuIconName } from "../menu/MenuIcons";
import { HOLO_PALETTE } from "../theme/HoloTheme";

/** What the room's controls do. */
export interface OnlineRoomActions {
  readonly cycleFaction: () => void;
  readonly cycleShip: () => void;
  readonly editSquad: () => void;
  readonly toggleTeam: () => void;
  readonly cycleScenario: () => void;
  readonly toggleReady: () => void;
  readonly copyCode: () => void;
  readonly leave: () => void;
  readonly focusChat: () => void;
}

const ACTION_BAR = {
  y: 640,
  width: 168,
  height: 40,
  spacing: 180,
} as const;

interface ActionSpec {
  readonly label: string;
  readonly name: string;
  readonly icon: MenuIconName;
  readonly variant: HoloButtonVariant;
  readonly run: () => void;
  readonly enabled?: boolean;
}

function secondary(
  name: string,
  label: string,
  icon: MenuIconName,
  run: () => void,
  enabled: boolean,
): ActionSpec {
  return { label, name, icon, variant: "secondary", run, enabled };
}

/** @returns The controls the mode offers: faction, ship or squad, team, scenario (host). */
function editSpecs(
  state: LobbyState,
  actions: OnlineRoomActions,
  editable: boolean,
): ActionSpec[] {
  const room = state.room!;
  const rules = MODE_RULES[room.mode];
  const team = localPlayer(state)?.team === 1 ? "B" : "A";
  const specs = [
    secondary("online_faction", "FACTION ▶", "flag", actions.cycleFaction, editable),
    rules.maxShips === 1
      ? secondary("online_ship", "SHIP ▶", "dogfight", actions.cycleShip, editable)
      : secondary("online_edit_squad", "EDIT SQUAD", "fleet", actions.editSquad, editable),
  ];
  if (rules.teams)
    specs.push(
      secondary("online_team", `TEAM ${team} ⇄`, "shield", actions.toggleTeam, editable),
    );
  if (room.mode === "scenario" && room.hostId === state.localId)
    specs.push(
      secondary("online_scenario", "SCENARIO ▶", "crosshair", actions.cycleScenario, editable),
    );
  return specs;
}

/** @returns The READY / UNREADY / REMATCH / WITHDRAW label for the local player. */
function readyLabel(ready: boolean, rematch: boolean): string {
  if (rematch) return ready ? "WITHDRAW" : "REMATCH";
  return ready ? "UNREADY" : "READY";
}

/**
 * @param state - Lobby state (in a room).
 * @param actions - Control callbacks.
 * @returns The buttons to show, in reading order.
 */
export function roomActionSpecs(
  state: LobbyState,
  actions: OnlineRoomActions,
): ActionSpec[] {
  const room = state.room!;
  const editable = room.phase !== "playing";
  const ready = localPlayer(state)?.ready ?? false;
  return [
    ...editSpecs(state, actions, editable),
    {
      label: readyLabel(ready, room.rematch !== null),
      name: "online_ready",
      icon: ready ? "close" : "next",
      variant: ready ? "secondary" : "primary",
      run: actions.toggleReady,
      enabled: editable && (ready || readyBlocker(state) === null),
    },
    {
      label: "LEAVE",
      name: "online_leave",
      icon: "back",
      variant: "danger",
      run: actions.leave,
    },
  ];
}

/**
 * @param scene - Lobby scene.
 * @param container - Room container the buttons join.
 * @param specs - Buttons to lay out centred in one row.
 * @returns The focusable buttons.
 */
export function addActionRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  specs: readonly ActionSpec[],
): HoloPressButton[] {
  const firstX =
    scene.scale.width / 2 - ((specs.length - 1) * ACTION_BAR.spacing) / 2;
  return specs.map((spec, i) => {
    const button = createHoverButton(
      scene,
      firstX + i * ACTION_BAR.spacing,
      ACTION_BAR.y,
      {
        width: ACTION_BAR.width,
        height: ACTION_BAR.height,
        color: HOLO_PALETTE.panelFill,
        variant: spec.variant,
        label: spec.label,
        icon: spec.icon,
        font: "600 14px",
      },
      spec.run,
    );
    button.setName(spec.name);
    if (spec.enabled === false) button.setEnabled(false);
    container.add(button);
    return button;
  });
}
