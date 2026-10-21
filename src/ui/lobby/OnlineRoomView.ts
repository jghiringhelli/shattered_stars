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
import { MODE_RULES, type RoomView } from "../../net/protocol";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createChatPanel, type ChatPanelState } from "./LobbyChatPanel";
import { addLobbyText } from "./lobbyLayout";
import { modeTitle } from "./onlineModes";
import { createPlayerRow } from "./OnlinePlayerRow";
import {
  addActionRow,
  roomActionSpecs,
  type OnlineRoomActions,
} from "./OnlineRoomActionBar";

export type { OnlineRoomActions } from "./OnlineRoomActionBar";

/** Data the room renders. */
export interface OnlineRoomModel {
  readonly state: LobbyState;
  readonly chat: ChatPanelState;
  readonly countdowns: {
    readonly start: number | null;
    readonly ready: number | null;
    readonly rematch: number | null;
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
} as const;

/** A scene, the container its objects join and the room being drawn. */
interface RoomCanvas {
  readonly scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;
  readonly model: OnlineRoomModel;
  readonly room: RoomView;
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
  const canvas: RoomCanvas = { scene, container, model, room };
  const height = Math.max(
    LAYOUT.minPanelHeight,
    LAYOUT.panelHeader +
      HOLO_SPACING.md * 2 +
      room.maxPlayers * (LAYOUT.rowHeight + LAYOUT.rowGap),
  );
  addPilotsPanel(canvas, height);
  addChatColumn(canvas, height, actions.focusChat);
  const codeButton = addRoomInfo(
    canvas,
    MENU_LAYOUT.contentTop + height + LAYOUT.infoGap,
    actions,
  );
  return [
    codeButton,
    ...addActionRow(scene, container, roomActionSpecs(model.state, actions)),
  ];
}

function addPilotsPanel(canvas: RoomCanvas, height: number): void {
  const { scene, container, model, room } = canvas;
  const left = MENU_LAYOUT.margin;
  const top = MENU_LAYOUT.contentTop;
  container.add(
    createHoloPanel(scene, left + LAYOUT.playersWidth / 2, top + height / 2, {
      width: LAYOUT.playersWidth,
      height,
      title: "PILOTS",
    }),
  );
  for (let seat = 0; seat < room.maxPlayers; seat++) {
    const player = room.players.find((p) => p.seat === seat);
    const rowTop =
      top +
      LAYOUT.panelHeader +
      HOLO_SPACING.md +
      seat * (LAYOUT.rowHeight + LAYOUT.rowGap);
    container.add(
      createPlayerRow(scene, {
        rect: {
          x: left + HOLO_SPACING.md,
          y: rowTop,
          width: LAYOUT.playersWidth - HOLO_SPACING.md * 2,
          height: LAYOUT.rowHeight,
        },
        player,
        isLocal: player?.id === model.state.localId,
        showTeam: MODE_RULES[room.mode].teams,
      }),
    );
  }
}

function addChatColumn(
  canvas: RoomCanvas,
  height: number,
  focusChat: () => void,
): void {
  const { scene, container, model } = canvas;
  const x = MENU_LAYOUT.margin + LAYOUT.playersWidth + LAYOUT.columnGap;
  container.add(
    createChatPanel(
      scene,
      {
        x,
        y: MENU_LAYOUT.contentTop,
        width: scene.scale.width - MENU_LAYOUT.margin - x,
        height,
      },
      model.chat,
      focusChat,
    ),
  );
}

/** Room code + COPY button + mode line on the left, countdown and ready hint on the right. */
function addRoomInfo(
  canvas: RoomCanvas,
  y: number,
  actions: OnlineRoomActions,
): HoloPressButton {
  const { scene, container, room } = canvas;
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
  addRoomStatus(canvas, y);
  return copy;
}

/** Countdown (or match-in-progress) and the reason READY is blocked, right-aligned. */
function addRoomStatus(canvas: RoomCanvas, y: number): void {
  const { scene, container, model } = canvas;
  const right = scene.scale.width - MENU_LAYOUT.margin;
  const countdown = countdownText(model);
  if (countdown) {
    const text = addLobbyText(scene, { x: right, y }, countdown, {
      size: 18,
      weight: "600",
      color: HOLO_PALETTE.warning,
      originX: 1,
    });
    text.setName("online_countdown");
    container.add(text);
  }
  const blocker = readyBlocker(model.state);
  if (blocker && !localPlayer(model.state)?.ready)
    container.add(
      addLobbyText(scene, { x: right, y: y + 34 }, blocker, {
        size: 13,
        color: HOLO_PALETTE.textMuted,
        originX: 1,
      }),
    );
}

function countdownText(model: OnlineRoomModel): string | null {
  if (model.state.room?.phase === "playing") return "Match in progress";
  if (model.countdowns.start !== null)
    return `Launching in ${model.countdowns.start}…`;
  if (model.countdowns.ready !== null)
    return `Ready check: ${model.countdowns.ready} s`;
  if (model.countdowns.rematch !== null)
    return `Rematch vote: ${model.countdowns.rematch} s`;
  return null;
}

function scenarioName(id: string | undefined): string {
  const scenario = id && isScenarioId(id) ? id : SCENARIO_IDS[0];
  return scenario ? SCENARIO_DEFINITIONS[scenario].shortName : "Scenario";
}
