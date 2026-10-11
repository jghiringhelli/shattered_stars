/**
 * ShipClaimOverlay — dialog shown to a late joiner when the room's battle is
 * already running: lists the AI-controlled ships as holo buttons so the
 * player can take one over.
 */

import type Phaser from "phaser";
import type { BattleSnapshot } from "../../multiplayer/BattleStateSerializer";
import { createHoverButton } from "../ButtonFactory";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";
import { createModalFrame, type ModalFrame } from "./lobbyModal";

/** Dialog geometry. */
const CLAIM = {
  width: 640,
  baseHeight: 120,
  titleSize: 20,
  messageSize: 14,
  emptySize: 16,
  messageOffset: HOLO_SPACING.xxl + HOLO_SPACING.sm,
  listOffset: HOLO_SPACING.xxl * 2,
  buttonWidth: 272,
  buttonHeight: 40,
  buttonGap: HOLO_SPACING.md,
  /** Ships per column before a second column is used. */
  columnCapacity: 5,
} as const;

/**
 * Show the claim dialog.
 *
 * @param scene - Lobby scene.
 * @param snapshot - Battle state received on joining.
 * @param onClaim - Invoked with the chosen ship id (the dialog closes first).
 */
export function showShipClaimOverlay(
  scene: Phaser.Scene,
  snapshot: BattleSnapshot,
  onClaim: (shipId: string) => void,
): void {
  const shipIds = snapshot.ships
    .filter((s) => s.owner === "ai")
    .map((s) => s.id);
  const columns = shipIds.length > CLAIM.columnCapacity ? 2 : 1;
  const rows = Math.max(1, Math.ceil(shipIds.length / columns));
  const frame = createModalFrame(scene, {
    width: CLAIM.width,
    height: CLAIM.baseHeight + rows * (CLAIM.buttonHeight + CLAIM.buttonGap),
    title: "Late join",
    accent: HOLO_PALETTE.warning,
  });
  addHeading(scene, frame);
  const listTop = frame.contentTop + CLAIM.listOffset + CLAIM.buttonHeight / 2;
  const cx = frame.left + frame.width / 2;
  if (shipIds.length === 0) {
    frame.container.add(
      addLobbyText(
        scene,
        { x: cx, y: listTop },
        "No unclaimed ships available.",
        { size: CLAIM.emptySize, color: HOLO_PALETTE.danger, originX: 0.5 },
      ),
    );
    return;
  }
  addShipButtons(scene, frame, { shipIds, columns, rows, listTop }, onClaim);
}

/** Title and instruction lines. */
function addHeading(scene: Phaser.Scene, frame: ModalFrame): void {
  const cx = frame.left + frame.width / 2;
  frame.container.add([
    addLobbyText(
      scene,
      { x: cx, y: frame.contentTop + HOLO_SPACING.sm },
      "Battle In Progress — Claim a Ship",
      {
        size: CLAIM.titleSize,
        weight: "600",
        color: HOLO_PALETTE.warning,
        originX: 0.5,
      },
    ),
    addLobbyText(
      scene,
      { x: cx, y: frame.contentTop + CLAIM.messageOffset },
      "Choose an AI-controlled ship to take over:",
      {
        size: CLAIM.messageSize,
        color: HOLO_PALETTE.textSecondary,
        originX: 0.5,
      },
    ),
  ]);
}

/** Ship button grid layout. */
interface ShipGrid {
  readonly shipIds: ReadonlyArray<string>;
  readonly columns: number;
  readonly rows: number;
  readonly listTop: number;
}

/** One button per claimable ship, filled column by column. */
function addShipButtons(
  scene: Phaser.Scene,
  frame: ModalFrame,
  grid: ShipGrid,
  onClaim: (shipId: string) => void,
): void {
  const columnSpacing = CLAIM.buttonWidth + CLAIM.buttonGap;
  const pitch = CLAIM.buttonHeight + CLAIM.buttonGap;
  const cx = frame.left + frame.width / 2;
  const firstX = cx - ((grid.columns - 1) * columnSpacing) / 2;
  grid.shipIds.forEach((shipId, i) => {
    const button = createHoverButton(
      scene,
      firstX + Math.floor(i / grid.rows) * columnSpacing,
      grid.listTop + (i % grid.rows) * pitch,
      {
        width: CLAIM.buttonWidth,
        height: CLAIM.buttonHeight,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: shipId,
        font: "600 14px",
        icon: "crosshair",
      },
      () => {
        frame.container.destroy();
        onClaim(shipId);
      },
    );
    frame.container.add(button);
  });
}
