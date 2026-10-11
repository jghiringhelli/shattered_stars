/**
 * FlightSchoolCard — main-menu holo card under the briefing panel that
 * offers Flight School. New pilots see a recommendation with START and SKIP;
 * after completing (or skipping) it shrinks to a refresher link. Never
 * blocks the menu (automation and returning players click straight past).
 * F starts the course from the keyboard.
 */

import type Phaser from "phaser";
import {
  dismissFlightSchoolOffer,
  loadFlightSchoolProgress,
  shouldOfferFlightSchool,
} from "../../tutorial/FlightSchoolProgress";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import type { HoloPressButton } from "./HoloPressButton";

/** Card geometry (centre x matches the briefing panel). */
const CARD = {
  x: 1010,
  y: 470,
  width: 320,
  height: 150,
  bodySize: 13,
  buttonWidth: 132,
  buttonHeight: 32,
  buttonY: 44,
  buttonFont: "600 13px",
} as const;

/** Card copy per state. */
const COPY = {
  offer:
    "New pilot? Learn the 500 ms maneuver cycle, specials, weapons and the HUD in a short, safe course.",
  completed: "Course completed ✓ — fly it again any time for a refresher.",
  skipped: "Refresher course: maneuvers, weapons, marking and HUD reading.",
} as const;

/** Main-menu Flight School card. */
export class FlightSchoolCard {
  private readonly panel: HoloPanel;
  private readonly body: Phaser.GameObjects.Text;
  private skipButton: HoloPressButton | null = null;
  private startButton: HoloPressButton | null = null;

  /**
   * @param scene - Main menu scene.
   * @param onStart - Starts Flight School.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onStart: () => void,
  ) {
    const offered = shouldOfferFlightSchool(loadFlightSchoolProgress());
    this.panel = createHoloPanel(scene, CARD.x, CARD.y, {
      width: CARD.width,
      height: CARD.height,
      title: offered ? "Flight School · Recommended" : "Flight School",
      ...(offered ? { accentColor: HOLO_PALETTE.warning } : {}),
    });
    this.body = scene.add
      .text(
        -CARD.width / 2 + HOLO_SPACING.lg,
        this.panel.contentTop + HOLO_SPACING.xs,
        this.copy(),
        {
          ...holoFont(CARD.bodySize, "400"),
          color: toCssColor(HOLO_PALETTE.textSecondary),
          wordWrap: { width: CARD.width - HOLO_SPACING.lg * 2 },
        },
      )
      .setOrigin(0, 0);
    this.panel.add(this.body);
    this.createButtons(offered);
  }

  /** The card container (entrance tween). */
  get container(): HoloPanel {
    return this.panel;
  }

  private copy(): string {
    const progress = loadFlightSchoolProgress();
    if (progress.completed) return COPY.completed;
    return progress.offerDismissed ? COPY.skipped : COPY.offer;
  }

  private createButtons(offered: boolean): void {
    const y = CARD.y + CARD.buttonY;
    const start = createHoverButton(
      this.scene,
      offered ? CARD.x - CARD.buttonWidth / 2 - HOLO_SPACING.xs : CARD.x,
      y,
      {
        width: CARD.buttonWidth,
        height: CARD.buttonHeight,
        label: "START  [F]",
        color: HOLO_PALETTE.panelFill,
        variant: "primary",
        font: CARD.buttonFont,
      },
      this.onStart,
    );
    start.setName("flightSchoolStart");
    this.startButton = start;
    if (!offered) return;
    this.skipButton = createHoverButton(
      this.scene,
      CARD.x + CARD.buttonWidth / 2 + HOLO_SPACING.xs,
      y,
      {
        width: CARD.buttonWidth,
        height: CARD.buttonHeight,
        label: "SKIP",
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        font: CARD.buttonFont,
      },
      () => this.skip(),
    );
    this.skipButton.setName("flightSchoolSkip");
  }

  private skip(): void {
    dismissFlightSchoolOffer();
    this.skipButton?.destroy();
    this.skipButton = null;
    this.startButton?.setX(CARD.x);
    this.body.setText(this.copy());
  }
}
