/**
 * CampaignModeHud — Campaign's mission readouts in the holographic style:
 * mission panel (top left), objective tracker (top right), controls hint
 * (top centre), the opening briefing card and the announcement banner.
 * Flight, radar and weapons live in BattleHud. Zoom-independent.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  factionAccent,
  holoTextStyle,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { createHoloText } from "../hud/holoPrimitives";
import { HoloPanel } from "../hud/HoloPanel";
import { createControlsHint } from "./controlsHint";
import { HoloBanner } from "./HoloBanner";
import { objectiveRow, type ObjectiveProgress } from "./objectiveRows";
import { cancelCameraZoom, pinTree, type ZoomCameraLike } from "./screenSpace";
import { createBriefingCard, type BriefingMission } from "./BriefingCard";

/** Mission / objective panel widths (px). */
const MISSION_PANEL_WIDTH = 280;
const OBJECTIVE_PANEL_WIDTH = 300;
/** Mission panel height (px). */
const MISSION_PANEL_HEIGHT = 64;
/** Gap between objective rows (px). */
const ROW_GAP = HOLO_SPACING.xs;

/** Campaign's mission panel, objective tracker, briefing and banner. */
export class CampaignModeHud {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly objectivePanel: HoloPanel;
  private readonly objectiveTexts: Phaser.GameObjects.Text[] = [];
  private readonly banner: HoloBanner;
  private briefing: Phaser.GameObjects.Container | null = null;
  private objectivePanelHeight = 0;

  /**
   * @param scene - The Campaign battle scene.
   * @param faction - Player faction (accents).
   * @param mission - Mission title, numbering, briefing and objectives.
   */
  constructor(
    scene: Phaser.Scene,
    faction: FactionId,
    mission: BriefingMission,
  ) {
    this.scene = scene;
    const missionPanel = this.buildMissionPanel(faction, mission);
    this.objectivePanel = this.buildObjectivePanel(faction, mission);
    const hint = createControlsHint(scene);
    this.banner = new HoloBanner(scene, factionAccent(faction));
    this.root = scene.add
      .container(0, 0, [
        missionPanel,
        this.objectivePanel,
        hint,
        this.banner.container,
      ])
      .setDepth(HOLO_DEPTH.hud);
    pinTree(this.root);
  }

  /** Objective tracker lines currently shown. */
  get objectiveLines(): string[] {
    return this.objectiveTexts.map((text) => text.text);
  }

  /** The banner's current text. */
  get messageText(): string {
    return this.banner.text;
  }

  /**
   * Show the opening briefing card (fades by itself).
   *
   * @param faction - Player faction (accent).
   * @param mission - The mission.
   */
  showBriefing(faction: FactionId, mission: BriefingMission): void {
    this.briefing?.destroy();
    this.briefing = createBriefingCard(this.scene, faction, mission);
    this.root.add(this.briefing);
    pinTree(this.briefing);
  }

  /**
   * Refresh the objective tracker.
   *
   * @param states - Every objective with its progress, in mission order.
   */
  updateObjectives(states: readonly ObjectiveProgress[]): void {
    states.forEach((state, index) => {
      const text = this.objectiveTexts[index];
      if (!text) return;
      const row = objectiveRow(state);
      if (text.text !== row.text) text.setText(row.text);
      const color = row.done
        ? HOLO_PALETTE.success
        : row.optional
          ? HOLO_PALETTE.textSecondary
          : HOLO_PALETTE.textPrimary;
      text.setColor(toCssColor(color));
    });
    this.layoutObjectives();
  }

  /**
   * Announce something in the centre banner.
   *
   * @param title - Main line.
   * @param subtitle - Second line.
   */
  showMessage(title: string, subtitle: string): void {
    this.banner.show(title, subtitle);
  }

  /**
   * Show or hide every readout (hidden under result overlays).
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    if (!visible) {
      this.banner.hide();
      this.briefing?.setVisible(false);
    }
    this.root.setVisible(visible);
  }

  /**
   * Keep the readouts 1:1 on screen under the current camera zoom.
   *
   * @param camera - The scene camera.
   */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** Destroy every readout. */
  destroy(): void {
    this.root.destroy();
  }

  private buildMissionPanel(
    faction: FactionId,
    mission: BriefingMission,
  ): HoloPanel {
    const x = HOLO_SPACING.lg + MISSION_PANEL_WIDTH / 2;
    const y = HOLO_SPACING.lg + MISSION_PANEL_HEIGHT / 2;
    const panel = new HoloPanel(this.scene, x, y, {
      width: MISSION_PANEL_WIDTH,
      height: MISSION_PANEL_HEIGHT,
      faction,
      title: `Act ${mission.act} · Mission ${mission.missionNumber}`,
    });
    this.scene.add.existing(panel);
    const left = -MISSION_PANEL_WIDTH / 2 + HOLO_SPACING.md;
    const title = createHoloText(
      this.scene,
      left,
      panel.contentTop,
      mission.title.toUpperCase(),
      "heading",
    ).setOrigin(0, 0);
    panel.add(title);
    return panel;
  }

  private buildObjectivePanel(
    faction: FactionId,
    mission: BriefingMission,
  ): HoloPanel {
    const x =
      this.scene.scale.width - HOLO_SPACING.lg - OBJECTIVE_PANEL_WIDTH / 2;
    const panel = new HoloPanel(this.scene, x, 0, {
      width: OBJECTIVE_PANEL_WIDTH,
      height: MISSION_PANEL_HEIGHT,
      faction,
      title: "Objectives",
    });
    this.scene.add.existing(panel);
    const wrapWidth = OBJECTIVE_PANEL_WIDTH - HOLO_SPACING.md * 2;
    for (const objective of mission.objectives) {
      const text = this.scene.add
        .text(0, 0, objective.description, {
          ...holoTextStyle("body"),
          wordWrap: { width: wrapWidth },
        })
        .setOrigin(0, 0);
      panel.add(text);
      this.objectiveTexts.push(text);
    }
    this.layoutObjectives(panel);
    return panel;
  }

  /** Stack the rows and fit the tracker to them, top-anchored. */
  private layoutObjectives(panel: HoloPanel = this.objectivePanel): void {
    const rowsHeight = this.objectiveTexts.reduce(
      (sum, text) => sum + text.height + ROW_GAP,
      0,
    );
    const headerAndPadding = MISSION_PANEL_HEIGHT - HOLO_SPACING.lg;
    const height = headerAndPadding + rowsHeight;
    if (height !== this.objectivePanelHeight) {
      this.objectivePanelHeight = height;
      panel.resize(OBJECTIVE_PANEL_WIDTH, height);
      panel.setY(HOLO_SPACING.lg + height / 2);
    }
    let y = panel.contentTop;
    const left = -OBJECTIVE_PANEL_WIDTH / 2 + HOLO_SPACING.md;
    for (const text of this.objectiveTexts) {
      text.setPosition(left, y);
      y += text.height + ROW_GAP;
    }
  }
}
