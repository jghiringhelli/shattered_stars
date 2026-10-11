/**
 * LobbyChatPanel — the game-room "COMMS" panel: a HoloPanel with the recent
 * chat history (sender in the accent colour) and a holo input field that
 * takes keyboard focus when clicked.
 */

import Phaser from "phaser";
import { createHoloPanel } from "../hud/HoloPanel";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";

/** A chat line. */
export interface ChatLine {
  readonly name: string;
  readonly text: string;
}

/** Chat state rendered by the panel. */
export interface ChatPanelState {
  readonly messages: ReadonlyArray<ChatLine>;
  readonly inputBuffer: string;
  readonly focused: boolean;
  /** Whether the blinking caret is in its visible phase. */
  readonly caretVisible: boolean;
}

/** Panel geometry and type. */
const CHAT_STYLE = {
  headerHeight: 28,
  lineHeight: 20,
  inputHeight: 32,
  textSize: 13,
  focusedFillAlpha: 0.9,
} as const;

/**
 * Build the chat panel.
 *
 * @param scene - Owning scene.
 * @param rect - Panel bounds.
 * @param state - Messages, input buffer and focus.
 * @param onFocus - Invoked when the input field is pressed.
 * @returns The created objects, back to front.
 */
export function createChatPanel(
  scene: Phaser.Scene,
  rect: HoloRect,
  state: ChatPanelState,
  onFocus: () => void,
): Phaser.GameObjects.GameObject[] {
  const panel = createHoloPanel(
    scene,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    { width: rect.width, height: rect.height, title: "COMMS" },
  );
  const pad = HOLO_SPACING.md;
  const inputRect = {
    x: rect.x + pad,
    y: rect.y + rect.height - pad - CHAT_STYLE.inputHeight,
    width: rect.width - pad * 2,
    height: CHAT_STYLE.inputHeight,
  };
  const historyTop = rect.y + CHAT_STYLE.headerHeight + pad;
  const capacity = Math.floor(
    (inputRect.y - HOLO_SPACING.sm - historyTop) / CHAT_STYLE.lineHeight,
  );
  return [
    panel,
    ...createHistory(scene, state.messages.slice(-capacity), {
      x: rect.x + pad,
      y: historyTop,
      width: inputRect.width,
    }),
    ...createInput(scene, inputRect, state, onFocus),
  ];
}

/** Chat history lines, oldest first. */
function createHistory(
  scene: Phaser.Scene,
  messages: ReadonlyArray<ChatLine>,
  area: { readonly x: number; readonly y: number; readonly width: number },
): Phaser.GameObjects.GameObject[] {
  if (messages.length === 0) {
    return [
      addLobbyText(scene, { x: area.x, y: area.y }, "No messages yet.", {
        size: CHAT_STYLE.textSize,
        weight: "italic",
        color: HOLO_PALETTE.textMuted,
        originY: 0,
      }),
    ];
  }
  return messages.map((msg, i) => {
    const line = addLobbyText(
      scene,
      { x: area.x, y: area.y + i * CHAT_STYLE.lineHeight },
      `${msg.name}: ${msg.text}`,
      {
        size: CHAT_STYLE.textSize,
        color: HOLO_PALETTE.textSecondary,
        originY: 0,
      },
    );
    line.setFixedSize(area.width, 0);
    return line;
  });
}

/** Input field with placeholder / buffer + caret and a press zone. */
function createInput(
  scene: Phaser.Scene,
  rect: HoloRect,
  state: ChatPanelState,
  onFocus: () => void,
): Phaser.GameObjects.GameObject[] {
  const frame = scene.add.graphics();
  drawHoloFrame(frame, rect, {
    radius: HOLO_RADIUS.sm,
    accent: state.focused ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
    borderWidth: state.focused ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
    fill: state.focused ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
    fillAlpha: CHAT_STYLE.focusedFillAlpha,
  });
  const caret = state.focused && state.caretVisible ? "|" : "";
  const content = state.focused
    ? state.inputBuffer + caret
    : "Click here to chat…";
  const text = addLobbyText(
    scene,
    { x: rect.x + HOLO_SPACING.sm, y: rect.y + rect.height / 2 },
    content,
    {
      size: CHAT_STYLE.textSize,
      color: state.focused ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
    },
  );
  const zone = scene.add
    .zone(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
    )
    .setInteractive({ useHandCursor: true });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onFocus);
  return [frame, text, zone];
}
