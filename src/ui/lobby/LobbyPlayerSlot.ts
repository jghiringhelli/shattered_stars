/**
 * LobbyPlayerSlot — one seat in the game-room player list: a holo card with
 * a seat number badge, pilot name (local pilot in the accent colour), faction
 * caption in its faction accent, a READY / NOT READY / HOST status chip and,
 * for the local pilot, a "Change Faction" button. Empty seats show a muted
 * "Waiting for player…" card.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type { PlayerInfo } from "../../services/NetworkService";
import { createHoverButton } from "../ButtonFactory";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";
import { FACTION_NAMES } from "./lobbyData";

/** Slot styling. */
const SLOT_STYLE = {
  badgeSize: 36,
  nameSize: 16,
  nameOffsetY: -10,
  factionOffsetY: 13,
  statusChipHeight: 24,
  statusChipPaddingX: HOLO_SPACING.md,
  statusFillAlpha: 0.16,
  changeWidth: 144,
  changeHeight: 30,
  emptyBorderAlpha: 0.35,
  emptyFillAlpha: 0.3,
  playerBorderAlpha: 0.8,
  bodySize: 14,
} as const;

/** Inputs for {@link createPlayerSlot}. */
export interface PlayerSlotSpec {
  readonly rect: HoloRect;
  readonly index: number;
  readonly player: PlayerInfo | undefined;
  readonly localPlayerId: string;
  readonly onChangeFaction: () => void;
}

/**
 * Build one player slot.
 *
 * @param scene - Owning scene.
 * @param spec - Bounds, seat index, player and callbacks.
 * @returns The created objects, back to front.
 */
export function createPlayerSlot(
  scene: Phaser.Scene,
  spec: PlayerSlotSpec,
): Phaser.GameObjects.GameObject[] {
  const { rect, player } = spec;
  const factionId = (player?.factionId ?? undefined) as FactionId | undefined;
  const accent = player ? factionAccent(factionId) : HOLO_PALETTE.border;
  const frame = scene.add.graphics();
  drawHoloFrame(frame, rect, {
    radius: HOLO_RADIUS.md,
    accent,
    borderAlpha: player
      ? SLOT_STYLE.playerBorderAlpha
      : SLOT_STYLE.emptyBorderAlpha,
    fill: player ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
    fillAlpha: player ? HOLO_PALETTE.panelAlpha : SLOT_STYLE.emptyFillAlpha,
  });
  const objects: Phaser.GameObjects.GameObject[] = [
    frame,
    ...createBadge(scene, spec, accent),
  ];
  if (!player) {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    objects.push(
      addLobbyText(scene, center, "Waiting for player…", {
        size: SLOT_STYLE.bodySize,
        weight: "italic",
        color: HOLO_PALETTE.textMuted,
        originX: 0.5,
      }),
    );
    return objects;
  }
  objects.push(...createIdentity(scene, spec, player));
  const chip = createStatusChip(scene, rect, player);
  objects.push(...chip.objects);
  if (player.id === spec.localPlayerId)
    objects.push(createChangeFactionButton(scene, spec, chip.left));
  return objects;
}

/** "Change Faction" button left of the status chip (local pilot only). */
function createChangeFactionButton(
  scene: Phaser.Scene,
  spec: PlayerSlotSpec,
  chipLeft: number,
): Phaser.GameObjects.GameObject {
  return createHoverButton(
    scene,
    chipLeft - HOLO_SPACING.md - SLOT_STYLE.changeWidth / 2,
    spec.rect.y + spec.rect.height / 2,
    {
      width: SLOT_STYLE.changeWidth,
      height: SLOT_STYLE.changeHeight,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "Change Faction",
      font: "600 12px",
      icon: "refresh",
    },
    spec.onChangeFaction,
  );
}

/** Seat-number badge at the left of the slot. */
function createBadge(
  scene: Phaser.Scene,
  spec: PlayerSlotSpec,
  accent: number,
): Phaser.GameObjects.GameObject[] {
  const size = SLOT_STYLE.badgeSize;
  const x = spec.rect.x + HOLO_SPACING.md;
  const cy = spec.rect.y + spec.rect.height / 2;
  const badge = scene.add.graphics();
  drawHoloFrame(
    badge,
    { x, y: cy - size / 2, width: size, height: size },
    {
      radius: HOLO_RADIUS.sm,
      accent,
      fill: accent,
      fillAlpha: spec.player ? SLOT_STYLE.statusFillAlpha : 0,
      borderAlpha: spec.player ? 1 : HOLO_ALPHA.structure * 2,
      borderWidth: HOLO_BORDER.hairline,
    },
  );
  const number = addLobbyText(
    scene,
    { x: x + size / 2, y: cy },
    `${spec.index + 1}`,
    {
      size: HOLO_TYPE_SCALE.numeric.size,
      weight: HOLO_TYPE_SCALE.numeric.weight,
      color: spec.player ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
      originX: 0.5,
    },
  );
  return [badge, number];
}

/** Pilot name and faction caption. */
function createIdentity(
  scene: Phaser.Scene,
  spec: PlayerSlotSpec,
  player: PlayerInfo,
): Phaser.GameObjects.GameObject[] {
  const x = spec.rect.x + HOLO_SPACING.md * 2 + SLOT_STYLE.badgeSize;
  const cy = spec.rect.y + spec.rect.height / 2;
  const isLocal = player.id === spec.localPlayerId;
  const displayName =
    player.name +
    (player.isHost ? " (Host)" : "") +
    (player.latency > 0 ? ` ${player.latency}ms` : "");
  const factionId = player.factionId as FactionId | null;
  const caption = HOLO_TYPE_SCALE.caption;
  return [
    addLobbyText(scene, { x, y: cy + SLOT_STYLE.nameOffsetY }, displayName, {
      size: SLOT_STYLE.nameSize,
      weight: "600",
      color: isLocal ? HOLO_PALETTE.accent : HOLO_PALETTE.textPrimary,
    }),
    addLobbyText(
      scene,
      { x, y: cy + SLOT_STYLE.factionOffsetY },
      (factionId ? FACTION_NAMES[factionId] : "No faction").toUpperCase(),
      {
        size: caption.size,
        weight: caption.weight,
        color: factionId ? factionAccent(factionId) : HOLO_PALETTE.textMuted,
        letterSpacing: caption.letterSpacing,
      },
    ),
  ];
}

/** Right-aligned HOST / READY / NOT READY chip. */
function createStatusChip(
  scene: Phaser.Scene,
  rect: HoloRect,
  player: PlayerInfo,
): {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly left: number;
} {
  const label = player.isHost ? "HOST" : player.isReady ? "READY" : "NOT READY";
  const color = player.isHost
    ? HOLO_PALETTE.warning
    : player.isReady
      ? HOLO_PALETTE.success
      : HOLO_PALETTE.danger;
  const caption = HOLO_TYPE_SCALE.caption;
  const right = rect.x + rect.width - HOLO_SPACING.lg;
  const cy = rect.y + rect.height / 2;
  const text = addLobbyText(
    scene,
    { x: right - SLOT_STYLE.statusChipPaddingX, y: cy },
    label,
    {
      size: caption.size,
      weight: caption.weight,
      color,
      letterSpacing: caption.letterSpacing,
      originX: 1,
    },
  );
  const width = text.width + SLOT_STYLE.statusChipPaddingX * 2;
  const chip = scene.add.graphics();
  drawHoloFrame(
    chip,
    {
      x: right - width,
      y: cy - SLOT_STYLE.statusChipHeight / 2,
      width,
      height: SLOT_STYLE.statusChipHeight,
    },
    {
      accent: color,
      fill: color,
      fillAlpha: SLOT_STYLE.statusFillAlpha,
      borderAlpha: 1,
      radius: SLOT_STYLE.statusChipHeight / 2,
    },
  );
  return { objects: [chip, text], left: right - width };
}
