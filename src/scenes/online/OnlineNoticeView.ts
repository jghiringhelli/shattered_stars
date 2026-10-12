/**
 * OnlineNoticeView — the online battle's notice pill at the top of the
 * screen (a player dropped or came back, a resync), shown for a few seconds
 * at any camera zoom. Presentation only.
 */

import type Phaser from "phaser";
import type { OnlineNotice } from "../../net/battle/OnlineBattleLink";
import { LobbyStatusChip } from "../../ui/lobby/LobbyStatusChip";
import { HOLO_DEPTH } from "../../ui/theme/HoloTheme";
import { ZoomStableLayer } from "../battleUi/ZoomStableLayer";

/** How long a notice stays up (ms). */
const NOTICE_MS = 4000;
/** Pill centre distance from the top edge (px). */
const NOTICE_TOP_PX = 92;

export class OnlineNoticeView {
  private readonly layer: ZoomStableLayer;
  private readonly chip: LobbyStatusChip;
  private hideAt = 0;
  private current: OnlineNotice | null = null;

  /** @param scene - The battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.layer = new ZoomStableLayer(scene, HOLO_DEPTH.hudIndicators);
    this.chip = new LobbyStatusChip(
      scene,
      { x: scene.scale.width / 2, y: NOTICE_TOP_PX },
      "",
    );
    this.layer.add(...this.chip.gameObjects);
    this.layer.setVisible(false);
  }

  /** The notice on screen, or null (e2e). */
  get shown(): OnlineNotice | null {
    return this.current;
  }

  /** @param notice - Show this notice now. */
  show(notice: OnlineNotice): void {
    this.current = notice;
    this.chip.setStatus(notice.text, notice.tone);
    this.hideAt = this.scene.time.now + NOTICE_MS;
    this.layer.setVisible(true);
  }

  /** Every frame: follow the zoom, hide an expired notice. */
  update(): void {
    this.layer.sync(this.scene.cameras.main);
    if (this.current && this.scene.time.now >= this.hideAt) {
      this.current = null;
      this.layer.setVisible(false);
    }
  }

  /** Remove the view. */
  destroy(): void {
    this.layer.destroy();
  }
}
