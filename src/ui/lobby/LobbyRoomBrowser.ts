/**
 * LobbyRoomBrowser — the lobby's room browser: the action row (1v1 DOGFIGHT,
 * CREATE GAME, REFRESH, JOIN CODE, ONLINE) and the room table, a HoloPanel
 * with a caption header row and one holo row per open room.
 *
 * Everything is parented to the scene's browser container so the view
 * toggles as a unit.
 */

import type Phaser from "phaser";
import type { RoomInfo } from "../../services/NetworkService";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloPressButton } from "../menu/HoloPressButton";
import type { MenuIconName } from "../menu/MenuIcons";
import { createMenuIcon } from "../menu/MenuIcons";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import type { HoloButtonVariant } from "../hud/holoButtonStyle";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { BROWSER_LAYOUT, ROOM_COLUMNS, addLobbyText } from "./lobbyLayout";
import { LobbyRoomRow } from "./LobbyRoomRow";

/** Callbacks for the browser's controls. */
export interface RoomBrowserActions {
  readonly onDogfight: () => void;
  readonly onCreate: () => void;
  readonly onRefresh: () => void;
  readonly onJoinCode: () => void;
  readonly onOnline: () => void;
  readonly onJoinRoom: (roomId: string) => void;
}

/** One action-row button. */
interface ActionSpec {
  readonly label: string;
  readonly icon: MenuIconName;
  readonly variant: HoloButtonVariant;
  readonly run: () => void;
}

/** Header strip tint opacity. */
const HEADER_FILL_ALPHA = 0.12;
/** Empty-state icon size. */
const EMPTY_ICON_SIZE = 36;
/** Empty-state message size. */
const EMPTY_TEXT_SIZE = 16;

/** Room browser view. */
export class LobbyRoomBrowser {
  /** Action row buttons in reading order (for keyboard focus). */
  readonly actionButtons: ReadonlyArray<HoloPressButton>;
  private readonly table: HoloRect;
  private entries: Phaser.GameObjects.GameObject[] = [];

  /**
   * @param scene - Owning scene.
   * @param container - Browser view container (receives every object).
   * @param actions - Control callbacks.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
    private readonly actions: RoomBrowserActions,
  ) {
    const { width, height } = scene.scale;
    const B = BROWSER_LAYOUT;
    this.table = {
      x: B.tableX,
      y: B.tableTop,
      width: width - B.tableX * 2,
      height: height - B.tableBottomInset - B.tableTop,
    };
    this.actionButtons = this.createActionRow();
    this.createTable();
  }

  /**
   * Replace the listed rooms.
   *
   * @param rooms - Rooms reported by the network service.
   */
  renderRooms(rooms: ReadonlyArray<RoomInfo>): void {
    this.entries.forEach((entry) => entry.destroy());
    this.entries = [];
    if (rooms.length === 0) {
      this.renderEmptyState();
      return;
    }
    const B = BROWSER_LAYOUT;
    const firstY = this.table.y + B.headerHeight + HOLO_SPACING.sm;
    const pitch = B.rowHeight + B.rowGap;
    const capacity = Math.floor(
      (this.table.y + this.table.height - firstY) / pitch,
    );
    rooms.slice(0, capacity).forEach((room, i) => {
      const row = new LobbyRoomRow(
        this.scene,
        room,
        {
          x: this.table.x + HOLO_SPACING.sm,
          y: firstY + i * pitch,
          width: this.table.width - HOLO_SPACING.sm * 2,
          height: B.rowHeight,
        },
        this.actions.onJoinRoom,
      );
      this.track(...row.objects);
    });
  }

  private track(...objects: Phaser.GameObjects.GameObject[]): void {
    this.container.add(objects);
    this.entries.push(...objects);
  }

  private actionSpecs(): ReadonlyArray<ActionSpec> {
    const a = this.actions;
    return [
      {
        label: "1v1 DOGFIGHT",
        icon: "dogfight",
        variant: "secondary",
        run: a.onDogfight,
      },
      {
        label: "CREATE GAME",
        icon: "plus",
        variant: "primary",
        run: a.onCreate,
      },
      {
        label: "REFRESH",
        icon: "refresh",
        variant: "secondary",
        run: a.onRefresh,
      },
      {
        label: "JOIN CODE",
        icon: "key",
        variant: "secondary",
        run: a.onJoinCode,
      },
      {
        label: "ONLINE",
        icon: "network",
        variant: "secondary",
        run: a.onOnline,
      },
    ];
  }

  private createActionRow(): HoloPressButton[] {
    const specs = this.actionSpecs();
    const B = BROWSER_LAYOUT;
    const total =
      specs.length * B.actionWidth + (specs.length - 1) * B.actionGap;
    const startX = this.scene.scale.width / 2 - total / 2 + B.actionWidth / 2;
    return specs.map((spec, i) => {
      const button = createHoverButton(
        this.scene,
        startX + i * (B.actionWidth + B.actionGap),
        B.actionRowY,
        {
          width: B.actionWidth,
          height: B.actionHeight,
          color: HOLO_PALETTE.panelFill,
          variant: spec.variant,
          label: spec.label,
          font: "600 14px",
          icon: spec.icon,
        },
        spec.run,
      );
      this.container.add(button);
      return button;
    });
  }

  private createTable(): void {
    const t = this.table;
    const panel = createHoloPanel(
      this.scene,
      t.x + t.width / 2,
      t.y + t.height / 2,
      { width: t.width, height: t.height },
    );
    const strip = this.scene.add.graphics();
    const headerHeight = BROWSER_LAYOUT.headerHeight;
    strip.fillStyle(HOLO_PALETTE.accent, HEADER_FILL_ALPHA);
    strip.fillRect(t.x + 1, t.y + 1, t.width - 2, headerHeight - 1);
    strip.lineStyle(
      HOLO_BORDER.hairline,
      HOLO_PALETTE.accent,
      HOLO_ALPHA.structure * 2,
    );
    strip.lineBetween(
      t.x,
      t.y + headerHeight,
      t.x + t.width,
      t.y + headerHeight,
    );
    this.container.add([panel, strip, ...this.createColumnCaptions()]);
  }

  private createColumnCaptions(): Phaser.GameObjects.Text[] {
    const caption = HOLO_TYPE_SCALE.caption;
    const y = this.table.y + BROWSER_LAYOUT.headerHeight / 2;
    const style = {
      size: caption.size,
      weight: caption.weight,
      color: HOLO_PALETTE.textSecondary,
      letterSpacing: caption.letterSpacing,
    };
    const columns: ReadonlyArray<[number, string]> = [
      [ROOM_COLUMNS.name, "ROOM NAME"],
      [ROOM_COLUMNS.host, "HOST"],
      [ROOM_COLUMNS.players, "PLAYERS"],
      [ROOM_COLUMNS.mode, "MODE"],
    ];
    const texts = columns.map(([offset, label]) =>
      addLobbyText(this.scene, { x: this.table.x + offset, y }, label, style),
    );
    const actionX =
      this.table.x +
      this.table.width -
      HOLO_SPACING.xl -
      BROWSER_LAYOUT.joinWidth / 2;
    texts.push(
      addLobbyText(this.scene, { x: actionX, y }, "ACTION", {
        ...style,
        originX: 0.5,
      }),
    );
    return texts;
  }

  private renderEmptyState(): void {
    const cx = this.table.x + this.table.width / 2;
    const cy = this.table.y + this.table.height / 2;
    const frame = this.scene.add.graphics();
    drawHoloFrame(
      frame,
      {
        x: cx - EMPTY_ICON_SIZE,
        y: cy - EMPTY_ICON_SIZE * 2,
        width: EMPTY_ICON_SIZE * 2,
        height: EMPTY_ICON_SIZE * 2,
      },
      {
        radius: EMPTY_ICON_SIZE,
        accent: HOLO_PALETTE.border,
        borderAlpha: HOLO_ALPHA.structure * 2,
      },
    );
    const icon = createMenuIcon(
      this.scene,
      "network",
      { x: cx, y: cy - EMPTY_ICON_SIZE },
      EMPTY_ICON_SIZE,
      HOLO_PALETTE.textMuted,
    );
    const message = addLobbyText(
      this.scene,
      { x: cx, y: cy + HOLO_SPACING.xl },
      "No games available. Create one!",
      {
        size: EMPTY_TEXT_SIZE,
        color: HOLO_PALETTE.textSecondary,
        originX: 0.5,
      },
    );
    this.track(frame, icon, message);
  }
}
