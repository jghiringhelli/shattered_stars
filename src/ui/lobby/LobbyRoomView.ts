/**
 * LobbyRoomView — the game-room screen: the PILOTS panel (one slot per seat),
 * the COMMS chat panel beside it and the room action row (READY / START GAME
 * / COPY CODE) centred below. Rebuilt from scratch on every room update.
 */

import type Phaser from "phaser";
import type { PlayerInfo, RoomInfo } from "../../services/NetworkService";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloButtonVariant } from "../hud/holoButtonStyle";
import type { MenuIconName } from "../menu/MenuIcons";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createChatPanel, type ChatPanelState } from "./LobbyChatPanel";
import { createPlayerSlot } from "./LobbyPlayerSlot";
import { ROOM_LAYOUT } from "./lobbyLayout";

/** Seats shown when a room reports no maximum. */
const DEFAULT_SEATS = 4;
/** HoloPanel header strip height. */
const PANEL_HEADER = 28;

/** Data rendered by the room view. */
export interface RoomViewModel {
  readonly room: RoomInfo;
  readonly players: ReadonlyArray<PlayerInfo>;
  readonly localPlayerId: string;
  readonly isLocalMode: boolean;
  readonly chat: ChatPanelState;
}

/** Room view callbacks. */
export interface RoomViewActions {
  readonly onToggleReady: () => void;
  readonly onStartGame: () => void;
  readonly onCopyCode: () => void;
  readonly onChangeFaction: () => void;
  readonly onFocusChat: () => void;
}

/** One room action button. */
interface RoomActionSpec {
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly icon?: MenuIconName;
  readonly enabled?: boolean;
  readonly run: () => void;
}

/**
 * Render the room view into a (cleared) container.
 *
 * @param scene - Owning scene.
 * @param container - Room view container.
 * @param model - Room, players and chat state.
 * @param actions - Button callbacks.
 */
export function renderRoomView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  model: RoomViewModel,
  actions: RoomViewActions,
): void {
  const seats = model.room.maxPlayers || DEFAULT_SEATS;
  const L = ROOM_LAYOUT;
  const slotsHeight = seats * L.slotHeight + (seats - 1) * L.slotGap;
  const height = Math.max(
    L.minPanelHeight,
    PANEL_HEADER + HOLO_SPACING.md * 2 + slotsHeight,
  );
  const left = MENU_LAYOUT.margin;
  const top = MENU_LAYOUT.contentTop;
  const players = { x: left, y: top, width: L.playersWidth, height };
  const chatX = left + L.playersWidth + L.columnGap;
  const chat = {
    x: chatX,
    y: top,
    width: scene.scale.width - MENU_LAYOUT.margin - chatX,
    height,
  };
  container.add(createPlayersPanel(scene, players, model, actions));
  container.add(createChatPanel(scene, chat, model.chat, actions.onFocusChat));
  container.add(
    createActionRow(
      scene,
      top + height + L.actionGap,
      roomActions(model, actions),
    ),
  );
}

/** PILOTS panel with one slot per seat. */
function createPlayersPanel(
  scene: Phaser.Scene,
  rect: { x: number; y: number; width: number; height: number },
  model: RoomViewModel,
  actions: RoomViewActions,
): Phaser.GameObjects.GameObject[] {
  const panel = createHoloPanel(
    scene,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    { width: rect.width, height: rect.height, title: "PILOTS" },
  );
  const objects: Phaser.GameObjects.GameObject[] = [panel];
  const seats = model.room.maxPlayers || DEFAULT_SEATS;
  const L = ROOM_LAYOUT;
  const firstY = rect.y + PANEL_HEADER + HOLO_SPACING.md;
  for (let i = 0; i < seats; i++) {
    objects.push(
      ...createPlayerSlot(scene, {
        rect: {
          x: rect.x + HOLO_SPACING.md,
          y: firstY + i * (L.slotHeight + L.slotGap),
          width: rect.width - HOLO_SPACING.md * 2,
          height: L.slotHeight,
        },
        index: i,
        player: model.players[i],
        localPlayerId: model.localPlayerId,
        onChangeFaction: actions.onChangeFaction,
      }),
    );
  }
  return objects;
}

/**
 * Buttons available to the local player: READY toggle for guests; START
 * GAME (local simulation) or COPY CODE + READY (online) for the host.
 */
function roomActions(
  model: RoomViewModel,
  actions: RoomViewActions,
): RoomActionSpec[] {
  const local = model.players.find((p) => p.id === model.localPlayerId);
  if (!local) return [];
  const readyToggle = (notReadyLabel: string): RoomActionSpec => ({
    label: local.isReady ? notReadyLabel : "READY",
    variant: local.isReady ? "secondary" : "primary",
    icon: local.isReady ? "close" : "flag",
    run: actions.onToggleReady,
  });
  if (!local.isHost) return [readyToggle("NOT READY")];
  if (model.isLocalMode) {
    const allReady =
      model.players.length >= 2 &&
      model.players.every((p) => p.isReady || p.isHost);
    return [
      {
        label: "START GAME",
        variant: "primary",
        icon: "next",
        enabled: allReady,
        run: actions.onStartGame,
      },
    ];
  }
  return [
    {
      label: "COPY CODE",
      variant: "secondary",
      icon: "key",
      run: actions.onCopyCode,
    },
    readyToggle("UNREADY"),
  ];
}

/** Centred row of room action buttons. */
function createActionRow(
  scene: Phaser.Scene,
  y: number,
  specs: ReadonlyArray<RoomActionSpec>,
): Phaser.GameObjects.GameObject[] {
  const L = ROOM_LAYOUT;
  const firstX =
    scene.scale.width / 2 - ((specs.length - 1) * L.actionSpacing) / 2;
  return specs.map((spec, i) => {
    const button = createHoverButton(
      scene,
      firstX + i * L.actionSpacing,
      y,
      {
        width: L.actionWidth,
        height: L.actionHeight,
        color: HOLO_PALETTE.panelFill,
        variant: spec.variant,
        label: spec.label,
        font: "600 15px",
        ...(spec.icon !== undefined && { icon: spec.icon }),
      },
      spec.run,
    );
    if (spec.enabled === false) button.setEnabled(false);
    return button;
  });
}
