/**
 * OnlineMenuView — the lobby before a room: mode picker, QUICK MATCH /
 * CREATE ROOM / JOIN BY CODE, the quick-match search card, and the pilot
 * name / server settings. Rebuilt on every lobby state change.
 */

import type Phaser from "phaser";
import {
  connectionStatus,
  lobbyScreen,
  type LobbyState,
} from "../../net/lobby/LobbyModel";
import { connectionAdvice } from "../../net/lobby/connectionAdvice";
import { MATCH_MODES, type MatchMode } from "../../net/protocol";
import { createHoverButton, createToggleButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";
import { ONLINE_MODE_INFO } from "./onlineModes";

/** What the menu's controls do. */
export interface OnlineMenuActions {
  readonly selectMode: (mode: MatchMode) => void;
  readonly quickMatch: () => void;
  readonly createRoom: () => void;
  readonly joinByCode: () => void;
  readonly cancelQueue: () => void;
  readonly editName: () => void;
  readonly editServer: () => void;
  readonly reconnect: () => void;
  /** Leave the lobby for the main menu (every other mode works offline). */
  readonly playOffline: () => void;
}

/** Data the menu renders. */
export interface OnlineMenuModel {
  readonly state: LobbyState;
  readonly pilotName: string;
  readonly rttMs: number;
  /** Seconds spent in the quick-match queue. */
  readonly queuedSeconds: number;
}

const LAYOUT = {
  modeY: MENU_LAYOUT.contentTop + 36,
  modeWidth: 230,
  modeHeight: 46,
  modeGap: 14,
  descriptionY: MENU_LAYOUT.contentTop + 92,
  actionY: 310,
  actionWidth: 300,
  actionHeight: 50,
  actionGap: 64,
  adviceOffset: 32,
  adviceWidth: 760,
  buttonsOffset: 130,
  settingsY: 610,
  settingsWidth: 240,
  settingsHeight: 34,
  queueCardWidth: 520,
  queueCardHeight: 190,
} as const;

/**
 * @param scene - Lobby scene.
 * @param container - Cleared menu container.
 * @param model - Lobby state and labels.
 * @param actions - Control callbacks.
 * @returns Focusable buttons in reading order.
 */
export function renderOnlineMenu(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineMenuModel,
  actions: OnlineMenuActions,
): HoloPressButton[] {
  const screen = lobbyScreen(model.state);
  if (screen === "queue")
    return renderQueueCard(scene, container, model, actions);
  addModePicker(scene, container, model.state, actions);
  const buttons =
    screen === "menu"
      ? addMainActions(scene, container, actions)
      : addOfflineCard(scene, container, model, actions);
  return [...buttons, ...addSettingsRow(scene, container, model, actions)];
}

function addModePicker(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: LobbyState,
  actions: OnlineMenuActions,
): void {
  const total =
    MATCH_MODES.length * LAYOUT.modeWidth +
    (MATCH_MODES.length - 1) * LAYOUT.modeGap;
  const left = scene.scale.width / 2 - total / 2 + LAYOUT.modeWidth / 2;
  MATCH_MODES.forEach((mode, i) => {
    const info = ONLINE_MODE_INFO[mode];
    const toggle = createToggleButton(
      scene,
      left + i * (LAYOUT.modeWidth + LAYOUT.modeGap),
      LAYOUT.modeY,
      `${info.label}  ${info.size}`,
      state.mode === mode,
      {
        width: LAYOUT.modeWidth,
        height: LAYOUT.modeHeight,
        selectedColor: HOLO_PALETTE.accent,
        normalColor: HOLO_PALETTE.panelFill,
        font: "600 14px",
        selectedFont: "700 14px",
      },
      () => actions.selectMode(mode),
    );
    toggle.setName(`onlineMode_${mode}`);
    container.add(toggle);
  });
  container.add(
    addLobbyText(
      scene,
      { x: scene.scale.width / 2, y: LAYOUT.descriptionY },
      ONLINE_MODE_INFO[state.mode].description,
      {
        size: 15,
        color: HOLO_PALETTE.textSecondary,
        originX: 0.5,
      },
    ),
  );
}

function addMainActions(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  actions: OnlineMenuActions,
): HoloPressButton[] {
  const specs: Array<
    [string, "primary" | "secondary", () => void, "next" | "plus" | "key"]
  > = [
    ["QUICK MATCH", "primary", actions.quickMatch, "next"],
    ["CREATE ROOM", "secondary", actions.createRoom, "plus"],
    ["JOIN BY CODE", "secondary", actions.joinByCode, "key"],
  ];
  return specs.map(([label, variant, run, icon], i) => {
    const button = createHoverButton(
      scene,
      scene.scale.width / 2,
      LAYOUT.actionY + i * LAYOUT.actionGap,
      {
        width: LAYOUT.actionWidth,
        height: LAYOUT.actionHeight,
        color: HOLO_PALETTE.panelFill,
        variant,
        label,
        font: "600 17px",
        icon,
      },
      run,
    );
    button.setName(`online_${label.replace(/ /g, "_").toLowerCase()}`);
    container.add(button);
    return button;
  });
}

function addOfflineCard(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineMenuModel,
  actions: OnlineMenuActions,
): HoloPressButton[] {
  const status = connectionStatus(model.state, model.rttMs);
  const message = model.state.server.url
    ? status.text
    : "Online play needs a relay server. This build has none configured — set one under SERVER.";
  container.add(
    addLobbyText(
      scene,
      { x: scene.scale.width / 2, y: LAYOUT.actionY },
      message,
      {
        size: 18,
        color:
          status.tone === "danger" ? HOLO_PALETTE.danger : HOLO_PALETTE.warning,
        originX: 0.5,
      },
    ),
  );
  const advice = connectionAdvice(model.state);
  if (advice !== "") {
    const adviceText = addLobbyText(
      scene,
      { x: scene.scale.width / 2, y: LAYOUT.actionY + LAYOUT.adviceOffset },
      advice,
      { size: 14, color: HOLO_PALETTE.textSecondary, originX: 0.5, originY: 0 },
    );
    adviceText.setWordWrapWidth(LAYOUT.adviceWidth).setAlign("center");
    container.add(adviceText);
  }
  const buttons: HoloPressButton[] = [];
  const connecting = ["connecting", "reconnecting"].includes(
    model.state.connection,
  );
  let row = 0;
  const addButton = (
    label: string,
    name: string,
    variant: "primary" | "secondary",
    icon: "refresh" | "back",
    run: () => void,
  ): void => {
    const button = createHoverButton(
      scene,
      scene.scale.width / 2,
      LAYOUT.actionY + LAYOUT.buttonsOffset + row++ * LAYOUT.actionGap,
      {
        width: LAYOUT.actionWidth,
        height: LAYOUT.actionHeight,
        color: HOLO_PALETTE.panelFill,
        variant,
        label,
        icon,
      },
      run,
    );
    button.setName(name);
    container.add(button);
    buttons.push(button);
  };
  if (model.state.server.url && !connecting) {
    addButton(
      "RECONNECT",
      "online_reconnect",
      "primary",
      "refresh",
      actions.reconnect,
    );
  }
  addButton(
    "PLAY OFFLINE INSTEAD",
    "online_play_offline",
    "secondary",
    "back",
    actions.playOffline,
  );
  return buttons;
}

function addSettingsRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineMenuModel,
  actions: OnlineMenuActions,
): HoloPressButton[] {
  const serverLabel =
    model.state.server.source === "settings" ||
    model.state.server.source === "query"
      ? "SERVER: CUSTOM"
      : "SERVER";
  const specs: Array<[string, string, () => void]> = [
    [`PILOT: ${model.pilotName}`, "online_pilot_name", actions.editName],
    [serverLabel, "online_server", actions.editServer],
  ];
  return specs.map(([label, name, run], i) => {
    const x =
      scene.scale.width / 2 +
      (i === 0 ? -1 : 1) * (LAYOUT.settingsWidth / 2 + 8);
    const button = createHoverButton(
      scene,
      x,
      LAYOUT.settingsY,
      {
        width: LAYOUT.settingsWidth,
        height: LAYOUT.settingsHeight,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label,
        font: "500 13px",
        icon: i === 0 ? "star" : "gear",
      },
      run,
    );
    button.setName(name);
    container.add(button);
    return button;
  });
}

function renderQueueCard(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: OnlineMenuModel,
  actions: OnlineMenuActions,
): HoloPressButton[] {
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2 - 20;
  container.add(
    createHoloPanel(scene, cx, cy, {
      width: LAYOUT.queueCardWidth,
      height: LAYOUT.queueCardHeight,
      title: "QUICK MATCH",
    }),
  );
  const mode = model.state.queue?.mode ?? model.state.mode;
  const elapsed = `${Math.floor(model.queuedSeconds / 60)}:${String(model.queuedSeconds % 60).padStart(2, "0")}`;
  container.add(
    addLobbyText(
      scene,
      { x: cx, y: cy - 18 },
      `Searching for a ${ONLINE_MODE_INFO[mode].label} opponent…`,
      { size: 18, originX: 0.5 },
    ),
  );
  const timer = addLobbyText(scene, { x: cx, y: cy + 14 }, elapsed, {
    size: 16,
    color: HOLO_PALETTE.textSecondary,
    originX: 0.5,
  });
  timer.setName("online_queue_timer");
  container.add(timer);
  const cancel = createHoverButton(
    scene,
    cx,
    cy + 60,
    {
      width: 180,
      height: 38,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "CANCEL",
      icon: "close",
    },
    actions.cancelQueue,
  );
  cancel.setName("online_cancel_queue");
  container.add(cancel);
  return [cancel];
}
