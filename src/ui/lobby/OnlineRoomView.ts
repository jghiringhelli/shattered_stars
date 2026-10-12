/**
 * OnlineRoomView — the online room: PILOTS panel (one row per seat), COMMS
 * chat, the room code to share, countdowns, and the local player's controls
 * (faction / ship / squad, team, scenario, READY, LEAVE). Rebuilt on every
 * lobby state change.
 */

import type Phaser from "phaser";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  isScenarioId,
} from "../../arcade/scenarios";
import {
  localPlayer,
  readyBlocker,
  type LobbyState,
} from "../../net/lobby/LobbyModel";
import { MODE_RULES } from "../../net/protocol";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloButtonVariant } from "../hud/holoButtonStyle";
import type { HoloPressButton } from "../menu/HoloPressButton";
import type { MenuIconName } from "../menu/MenuIcons";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createChatPanel, type ChatPanelState } from "./LobbyChatPanel";
import { addLobbyText } from "./lobbyLayout";
import { modeTitle } from "./onlineModes";
import { createPlayerRow } from "./OnlinePlayerRow";

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

/** Data the room renders. */
export interface OnlineRoomModel {
  readonly state: LobbyState;
  readonly chat: ChatPanelState;
  readonly countdowns: {
    readonly start: number | null;
    readonly ready: number | null;
  };
}

const LAYOUT = {
  playersWidth: 760,
  rowHeight: 62,
  rowGap: 8,
  panelHeader: 30,
  columnGap: HOLO_SPACING.lg,
  minPanelHeight: 200,
  infoGap: 34,
  actionY: 640,
  actionWidth: 168,
  actionHeight: 40,
  actionSpacing: 180,
} as const;

interface ActionSpec {
  readonly label: string;
  readonly name: string;
  readonly icon: MenuIconName;
  readonly variant: HoloButtonVariant;
  readonly run: () => void;
  readonly enabled?: boolean;
}

/**
 * @param scene - Lobby scene.
 * @param container - Cleared room container.
 * @param model - Lobby state, chat and countdowns.
 * @param actions - Control callbacks.
 * @returns Focusable buttons in reading order.
 */
export function renderOnlineRoom(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineRoomModel,
  actions: OnlineRoomActions,
): HoloPressButton[] {
  const room = model.state.room;
  if (!room) return [];
  const seats = room.maxPlayers;
  const height = Math.max(
    LAYOUT.minPanelHeight,
    LAYOUT.panelHeader +
      HOLO_SPACING.md * 2 +
      seats * (LAYOUT.rowHeight + LAYOUT.rowGap),
  );
  const left = MENU_LAYOUT.margin;
  const top = MENU_LAYOUT.contentTop;
  container.add(
    createHoloPanel(scene, left + LAYOUT.playersWidth / 2, top + height / 2, {
      width: LAYOUT.playersWidth,
      height,
      title: "PILOTS",
    }),
  );
  for (let seat = 0; seat < seats; seat++) {
    const player = room.players.find((p) => p.seat === seat);
    container.add(
      createPlayerRow(scene, {
        rect: {
          x: left + HOLO_SPACING.md,
          y:
            top +
            LAYOUT.panelHeader +
            HOLO_SPACING.md +
            seat * (LAYOUT.rowHeight + LAYOUT.rowGap),
          width: LAYOUT.playersWidth - HOLO_SPACING.md * 2,
          height: LAYOUT.rowHeight,
        },
        player,
        isLocal: player?.id === model.state.localId,
        showTeam: MODE_RULES[room.mode].teams,
      }),
    );
  }
  const chatX = left + LAYOUT.playersWidth + LAYOUT.columnGap;
  container.add(
    createChatPanel(
      scene,
      {
        x: chatX,
        y: top,
        width: scene.scale.width - MENU_LAYOUT.margin - chatX,
        height,
      },
      model.chat,
      actions.focusChat,
    ),
  );
  const codeButton = addRoomInfo(
    scene,
    container,
    model,
    top + height + LAYOUT.infoGap,
    actions,
  );
  return [
    codeButton,
    ...addActionRow(scene, container, actionSpecs(model.state, actions)),
  ];
}

function addRoomInfo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineRoomModel,
  y: number,
  actions: OnlineRoomActions,
): HoloPressButton {
  const room = model.state.room!;
  const left = MENU_LAYOUT.margin;
  const code = addLobbyText(scene, { x: left, y }, `ROOM CODE  ${room.code}`, {
    size: 26,
    weight: "700",
    letterSpacing: 4,
    color: HOLO_PALETTE.accent,
  });
  code.setName("online_room_code");
  const copy = createHoverButton(
    scene,
    left + code.width + 100,
    y,
    {
      width: 150,
      height: 34,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "COPY CODE",
      icon: "key",
      font: "600 13px",
    },
    actions.copyCode,
  );
  copy.setName("online_copy_code");
  const scenario =
    room.mode === "scenario"
      ? `  ·  ${scenarioName(room.options.scenarioId)}`
      : "";
  container.add([
    code,
    copy,
    addLobbyText(
      scene,
      { x: left, y: y + 34 },
      `${modeTitle(room.mode)}${scenario}${room.quickMatch ? "  ·  QUICK MATCH" : ""}`,
      { size: 14, color: HOLO_PALETTE.textSecondary },
    ),
  ]);
  const countdown = countdownText(model);
  if (countdown) {
    const text = addLobbyText(
      scene,
      { x: scene.scale.width - MENU_LAYOUT.margin, y },
      countdown,
      { size: 18, weight: "600", color: HOLO_PALETTE.warning, originX: 1 },
    );
    text.setName("online_countdown");
    container.add(text);
  }
  const blocker = readyBlocker(model.state);
  if (blocker && !localPlayer(model.state)?.ready) {
    container.add(
      addLobbyText(
        scene,
        { x: scene.scale.width - MENU_LAYOUT.margin, y: y + 34 },
        blocker,
        { size: 13, color: HOLO_PALETTE.textMuted, originX: 1 },
      ),
    );
  }
  return copy;
}

function countdownText(model: OnlineRoomModel): string | null {
  if (model.state.room?.phase === "playing") return "Match in progress";
  if (model.countdowns.start !== null)
    return `Launching in ${model.countdowns.start}…`;
  if (model.countdowns.ready !== null)
    return `Ready check: ${model.countdowns.ready} s`;
  return null;
}

function actionSpecs(
  state: LobbyState,
  actions: OnlineRoomActions,
): ActionSpec[] {
  const room = state.room!;
  const me = localPlayer(state);
  const rules = MODE_RULES[room.mode];
  const editable = room.phase !== "playing";
  const specs: ActionSpec[] = [
    {
      label: "FACTION ▶",
      name: "online_faction",
      icon: "flag",
      variant: "secondary",
      run: actions.cycleFaction,
      enabled: editable,
    },
  ];
  if (rules.maxShips === 1)
    specs.push({
      label: "SHIP ▶",
      name: "online_ship",
      icon: "dogfight",
      variant: "secondary",
      run: actions.cycleShip,
      enabled: editable,
    });
  else
    specs.push({
      label: "EDIT SQUAD",
      name: "online_edit_squad",
      icon: "fleet",
      variant: "secondary",
      run: actions.editSquad,
      enabled: editable,
    });
  if (rules.teams)
    specs.push({
      label: `TEAM ${me?.team === 1 ? "B" : "A"} ⇄`,
      name: "online_team",
      icon: "shield",
      variant: "secondary",
      run: actions.toggleTeam,
      enabled: editable,
    });
  if (room.mode === "scenario" && room.hostId === state.localId)
    specs.push({
      label: "SCENARIO ▶",
      name: "online_scenario",
      icon: "crosshair",
      variant: "secondary",
      run: actions.cycleScenario,
      enabled: editable,
    });
  const ready = me?.ready ?? false;
  specs.push({
    label: ready ? "UNREADY" : "READY",
    name: "online_ready",
    icon: ready ? "close" : "next",
    variant: ready ? "secondary" : "primary",
    run: actions.toggleReady,
    enabled: editable && (ready || readyBlocker(state) === null),
  });
  specs.push({
    label: "LEAVE",
    name: "online_leave",
    icon: "back",
    variant: "danger",
    run: actions.leave,
  });
  return specs;
}

function addActionRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  specs: readonly ActionSpec[],
): HoloPressButton[] {
  const firstX =
    scene.scale.width / 2 - ((specs.length - 1) * LAYOUT.actionSpacing) / 2;
  return specs.map((spec, i) => {
    const button = createHoverButton(
      scene,
      firstX + i * LAYOUT.actionSpacing,
      LAYOUT.actionY,
      {
        width: LAYOUT.actionWidth,
        height: LAYOUT.actionHeight,
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

function scenarioName(id: string | undefined): string {
  const scenario = id && isScenarioId(id) ? id : SCENARIO_IDS[0];
  return scenario ? SCENARIO_DEFINITIONS[scenario].shortName : "Scenario";
}
