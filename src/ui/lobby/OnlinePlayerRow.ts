/**
 * OnlinePlayerRow — one seat in the online room's PILOTS panel: name (with
 * YOU / HOST tags), team, ship or squad, ping, and ready / connection state.
 */

import type Phaser from "phaser";
import { describeLoadout } from "../../net/lobby/loadoutChoices";
import type { RoomPlayerView } from "../../net/protocol";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";

/** Ping (ms) up to which the ping reads green, then amber; red beyond the second. */
const PING_GOOD_MS = 80;
const PING_FAIR_MS = 160;
/** Row text sizes. */
const NAME_SIZE = 17;
const DETAIL_SIZE = 13;

/** Row options. */
export interface PlayerRowOptions {
  readonly rect: HoloRect;
  readonly player: RoomPlayerView | undefined;
  readonly isLocal: boolean;
  /** Show the team (team modes). */
  readonly showTeam: boolean;
}

/**
 * @param scene - Lobby scene.
 * @param options - Bounds, player (undefined = open seat), flags.
 * @returns The row's objects.
 */
export function createPlayerRow(
  scene: Phaser.Scene,
  options: PlayerRowOptions,
): Phaser.GameObjects.GameObject[] {
  const { rect, player } = options;
  const frame = scene.add.graphics();
  drawHoloFrame(frame, rect, {
    radius: HOLO_RADIUS.sm,
    accent: options.isLocal ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
    borderWidth: options.isLocal ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
    fill: HOLO_PALETTE.panelFill,
    fillAlpha: 0.75,
  });
  const left = rect.x + 16;
  const top = rect.y + rect.height / 2;
  if (!player) {
    return [
      frame,
      addLobbyText(
        scene,
        { x: left, y: top },
        "Open seat — share the room code",
        {
          size: DETAIL_SIZE,
          color: HOLO_PALETTE.textMuted,
          weight: "italic",
        },
      ),
    ];
  }
  const tags = [options.isLocal ? "YOU" : "", player.isHost ? "HOST" : ""]
    .filter(Boolean)
    .join(" · ");
  const team = options.showTeam
    ? `TEAM ${player.team === 0 ? "A" : "B"}  ·  `
    : "";
  return [
    frame,
    addLobbyText(
      scene,
      { x: left, y: top - 12 },
      `${player.name}${tags ? `  (${tags})` : ""}`,
      { size: NAME_SIZE, weight: "600" },
    ),
    addLobbyText(
      scene,
      { x: left, y: top + 13 },
      `${team}${describeLoadout(player.loadout)}`,
      { size: DETAIL_SIZE, color: HOLO_PALETTE.textSecondary },
    ),
    addLobbyText(
      scene,
      { x: rect.x + rect.width - 150, y: top },
      `${player.pingMs} ms`,
      { size: DETAIL_SIZE, color: pingColor(player.pingMs), originX: 1 },
    ),
    stateLabel(scene, rect, player),
  ];
}

function stateLabel(
  scene: Phaser.Scene,
  rect: HoloRect,
  player: RoomPlayerView,
): Phaser.GameObjects.Text {
  const [text, color] = !player.connected
    ? ["RECONNECTING", HOLO_PALETTE.warning]
    : player.ready
      ? ["READY", HOLO_PALETTE.success]
      : ["NOT READY", HOLO_PALETTE.textMuted];
  const label = addLobbyText(
    scene,
    { x: rect.x + rect.width - 16, y: rect.y + rect.height / 2 },
    text,
    {
      size: DETAIL_SIZE,
      weight: "700",
      color,
      originX: 1,
      letterSpacing: 1,
    },
  );
  label.setName(`seat_state_${player.seat}`);
  return label;
}

function pingColor(pingMs: number): number {
  if (pingMs <= PING_GOOD_MS) return HOLO_PALETTE.success;
  return pingMs <= PING_FAIR_MS ? HOLO_PALETTE.warning : HOLO_PALETTE.danger;
}
