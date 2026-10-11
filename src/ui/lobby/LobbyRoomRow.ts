/**
 * LobbyRoomRow — one row of the lobby room table: room name, host, player
 * count (success while seats are free, danger when full), a mode chip and the
 * JOIN / LATE JOIN action. Started rooms are dimmed except for LATE JOIN.
 */

import Phaser from "phaser";
import type { RoomInfo } from "../../services/NetworkService";
import { createHoverButton } from "../ButtonFactory";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import {
  HOLO_ALPHA,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { BROWSER_LAYOUT, ROOM_COLUMNS, addLobbyText } from "./lobbyLayout";
import { gameModeLabel } from "./lobbyData";

/** Row styling. */
const ROW_STYLE = {
  idleFillAlpha: 0.35,
  hoverFillAlpha: 0.6,
  idleBorderAlpha: 0.35,
  startedAlpha: 0.4,
  nameSize: 14,
  bodySize: 14,
  countSize: 15,
  modeChipHeight: 20,
  modeChipPaddingX: HOLO_SPACING.sm,
  modeChipAlpha: 0.6,
} as const;

/** A row display object that can be dimmed. */
type RowCell = Phaser.GameObjects.Text | Phaser.GameObjects.Graphics;

/** A room table row; `objects` are handed to the browser container. */
export class LobbyRoomRow {
  /** Every display object of the row, back to front. */
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly background: Phaser.GameObjects.Graphics;

  /**
   * @param scene - Owning scene.
   * @param room - Room to show.
   * @param rect - Row bounds.
   * @param onJoin - Invoked with the room id on JOIN / LATE JOIN.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    room: RoomInfo,
    private readonly rect: HoloRect,
    onJoin: (roomId: string) => void,
  ) {
    this.background = scene.add.graphics();
    this.drawBackground(false);
    const hover = scene.add
      .zone(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
      )
      .setInteractive();
    hover.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      this.drawBackground(true),
    );
    hover.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.drawBackground(false),
    );
    this.objects.push(this.background, hover);
    const cells = this.createCells(room);
    const alpha = room.isStarted ? ROW_STYLE.startedAlpha : 1;
    cells.forEach((cell) => cell.setAlpha(alpha));
    this.objects.push(...cells);
    const action = this.createAction(room, onJoin);
    if (action) this.objects.push(action);
  }

  private get centerY(): number {
    return this.rect.y + this.rect.height / 2;
  }

  /** x of a column, relative to the table's left edge (row inset removed). */
  private columnX(offset: number): number {
    return this.rect.x - HOLO_SPACING.sm + offset;
  }

  private drawBackground(hovered: boolean): void {
    const g = this.background;
    g.clear();
    drawHoloFrame(g, this.rect, {
      radius: HOLO_RADIUS.sm,
      accent: hovered ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
      borderAlpha: hovered
        ? HOLO_PALETTE.borderAlpha
        : ROW_STYLE.idleBorderAlpha,
      fill: hovered ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
      fillAlpha: hovered ? ROW_STYLE.hoverFillAlpha : ROW_STYLE.idleFillAlpha,
    });
  }

  private createCells(room: RoomInfo): RowCell[] {
    const y = this.centerY;
    const full = room.playerCount >= room.maxPlayers;
    return [
      addLobbyText(
        this.scene,
        { x: this.columnX(ROOM_COLUMNS.name), y },
        room.name,
        {
          size: ROW_STYLE.nameSize,
          weight: "600",
        },
      ),
      addLobbyText(
        this.scene,
        { x: this.columnX(ROOM_COLUMNS.host), y },
        room.hostName,
        {
          size: ROW_STYLE.bodySize,
          color: HOLO_PALETTE.textSecondary,
        },
      ),
      addLobbyText(
        this.scene,
        { x: this.columnX(ROOM_COLUMNS.players), y },
        `${room.playerCount}/${room.maxPlayers}`,
        {
          size: ROW_STYLE.countSize,
          weight: HOLO_TYPE_SCALE.numeric.weight,
          color: full ? HOLO_PALETTE.danger : HOLO_PALETTE.success,
        },
      ),
      ...this.createModeChip(gameModeLabel(room.gameMode)),
    ];
  }

  private createModeChip(label: string): RowCell[] {
    const caption = HOLO_TYPE_SCALE.caption;
    const x = this.columnX(ROOM_COLUMNS.mode);
    const text = addLobbyText(
      this.scene,
      { x: x + ROW_STYLE.modeChipPaddingX, y: this.centerY },
      label.toUpperCase(),
      {
        size: caption.size,
        weight: caption.weight,
        color: HOLO_PALETTE.textSecondary,
        letterSpacing: caption.letterSpacing,
      },
    );
    const chip = this.scene.add.graphics();
    drawHoloFrame(
      chip,
      {
        x,
        y: this.centerY - ROW_STYLE.modeChipHeight / 2,
        width: text.width + ROW_STYLE.modeChipPaddingX * 2,
        height: ROW_STYLE.modeChipHeight,
      },
      {
        radius: ROW_STYLE.modeChipHeight / 2,
        borderAlpha: ROW_STYLE.modeChipAlpha,
        fillAlpha: HOLO_ALPHA.structure,
      },
    );
    return [chip, text];
  }

  private createAction(
    room: RoomInfo,
    onJoin: (roomId: string) => void,
  ): Phaser.GameObjects.GameObject | null {
    const x =
      this.columnX(0) +
      this.rect.width +
      HOLO_SPACING.sm * 2 -
      HOLO_SPACING.xl -
      BROWSER_LAYOUT.joinWidth / 2;
    const join = (label: string, variant: "primary" | "secondary") =>
      createHoverButton(
        this.scene,
        x,
        this.centerY,
        {
          width: BROWSER_LAYOUT.joinWidth,
          height: BROWSER_LAYOUT.joinHeight,
          color: HOLO_PALETTE.panelFill,
          variant,
          label,
          font: "600 12px",
          icon: "next",
        },
        () => onJoin(room.id),
      );
    if (room.isStarted) return join("LATE JOIN", "secondary");
    if (room.playerCount < room.maxPlayers) return join("JOIN", "primary");
    return addLobbyText(this.scene, { x, y: this.centerY }, "FULL", {
      size: HOLO_TYPE_SCALE.caption.size,
      weight: HOLO_TYPE_SCALE.caption.weight,
      color: HOLO_PALETTE.textMuted,
      letterSpacing: HOLO_TYPE_SCALE.caption.letterSpacing,
      originX: 0.5,
    });
  }
}
