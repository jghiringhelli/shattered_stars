/**
 * Main Menu Scene
 *
 * Entry point for the game with navigation to every mode and system screen.
 * Holo layout: wide-tracked title, a centred column of menu rows in a
 * translucent panel (grouped PLAY / MULTIPLAYER / SYSTEM), and a briefing
 * panel describing the highlighted entry. Rows sit at x = centre,
 * y = 220 + 40·i — tests/e2e/helpers/game.ts clicks them by those positions.
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import {
  applyMenuSelection,
  MENU_BUTTON_WIDTH,
  MENU_BUTTON_HEIGHT,
} from "../ui/MenuSelection";
import { punch } from "../ui/UIJuice";
import { openBugReport } from "../utils/BugReport";
import { BUILD_INFO, formatVersionTag } from "../buildInfo";
import { addFooterHint, addMenuBackdrop } from "../ui/menu/MenuScaffold";
import {
  MAIN_MENU_ENTRIES,
  type MainMenuEntry,
} from "../ui/menu/mainMenuEntries";
import { MainMenuBriefing } from "../ui/menu/MainMenuBriefing";
import { FlightSchoolCard } from "../ui/menu/FlightSchoolCard";
import {
  fadeInMenu,
  goToScene,
  playUiHover,
  playUiPress,
} from "../ui/menu/menuTransitions";
import {
  MAIN_MENU_LAYOUT,
  addMainMenuChrome,
  createMainMenuRow,
  createMainMenuTitle,
} from "../ui/menu/mainMenuLayout";

/** Entrance animation timings (ms). */
const ENTRANCE = {
  titleMs: 700,
  rowDelayMs: 150,
  rowStaggerMs: 35,
  rowMs: 320,
  rowSlide: 80,
  briefingDelayMs: 450,
} as const;

export class MainMenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  /** Build tag in the bottom-right corner (e2e reads it). */
  private versionTag: Phaser.GameObjects.Text | null = null;
  private menuItems: Phaser.GameObjects.Container[] = [];
  private selectedIndex = 0;
  private briefing!: MainMenuBriefing;

  constructor() {
    super({ key: "MainMenuScene" });
  }

  create(): void {
    addMenuBackdrop(this, {
      textureId: "nebula_purple",
      scrimAlpha: MAIN_MENU_LAYOUT.scrimAlpha,
    });

    // Defer AudioContext creation until the first user gesture (Chrome autoplay policy).
    const initAudio = (): void => {
      audioManager.initialize();
      audioManager.playMenuMusic();
    };
    // Returning from a mode: the context already exists, so crossfade now.
    audioManager.playMenuMusic();
    this.input.once("pointerdown", initAudio);
    this.input.keyboard!.once("keydown", initAudio);

    this.titleText = createMainMenuTitle(this);
    addMainMenuChrome(this, MAIN_MENU_ENTRIES);
    // Briefing first: row selection refreshes it, and the scene instance (and
    // its fields) survive restarts, so a stale panel must never be touched.
    this.briefing = new MainMenuBriefing(
      this,
      MAIN_MENU_LAYOUT.briefingX,
      MAIN_MENU_LAYOUT.briefingY,
    );
    this.createMenuItems();
    const flightSchool = new FlightSchoolCard(this, () =>
      this.startFlightSchool(),
    );
    this.createFooter();
    this.setupInput();
    this.playEntrance(flightSchool.container);
    fadeInMenu(this);
  }

  /** Main menu → Flight School (card button or F). */
  private startFlightSchool(): void {
    playUiPress();
    goToScene(this, "FlightSchoolScene");
  }

  private playEntrance(card: Phaser.GameObjects.Container): void {
    const centerX = this.scale.width / 2;
    this.titleText.setAlpha(0);
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: MAIN_MENU_LAYOUT.titleY,
      duration: ENTRANCE.titleMs,
      ease: "Cubic.Out",
    });
    this.menuItems.forEach((item, i) => {
      item.setAlpha(0);
      item.x = centerX - ENTRANCE.rowSlide;
      this.tweens.add({
        targets: item,
        alpha: 1,
        x: centerX,
        duration: ENTRANCE.rowMs,
        delay: ENTRANCE.rowDelayMs + i * ENTRANCE.rowStaggerMs,
        ease: "Cubic.Out",
      });
    });
    const briefing = this.briefing.container.setAlpha(0);
    card.setAlpha(0);
    this.tweens.add({
      targets: [briefing, card],
      alpha: 1,
      delay: ENTRANCE.briefingDelayMs,
      duration: ENTRANCE.rowMs,
    });
  }

  private createFooter(): void {
    const { width, height } = this.scale;
    addFooterHint(
      this,
      "↑ ↓  NAVIGATE        ENTER  SELECT        F  FLIGHT SCHOOL",
    );
    const muted = MAIN_MENU_LAYOUT.footerColor;
    this.versionTag = this.add
      .text(
        width - MAIN_MENU_LAYOUT.margin,
        height - 16,
        formatVersionTag(BUILD_INFO),
        muted,
      )
      .setLetterSpacing(1.5)
      .setOrigin(1, 0.5);

    // Pointer-only, deliberately outside the keyboard-navigable menuItems array
    // so it doesn't shift MENU_POSITIONS/ArrowDown-count assumptions in e2e tests.
    this.add
      .text(MAIN_MENU_LAYOUT.margin, height - 16, "REPORT A BUG", muted)
      .setLetterSpacing(1.5)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", function (this: Phaser.GameObjects.Text) {
        this.setColor(MAIN_MENU_LAYOUT.linkHoverColor);
      })
      .on("pointerout", function (this: Phaser.GameObjects.Text) {
        this.setColor(muted.color);
      })
      .on("pointerdown", () => openBugReport({ sceneKey: "MainMenuScene" }));
  }

  private createMenuItems(): void {
    this.menuItems = [];
    this.selectedIndex = 0;
    MAIN_MENU_ENTRIES.forEach((entry, index) => {
      const row = createMainMenuRow(this, entry, index);
      row.setData("action", () => this.startEntry(entry));
      this.attachMenuItemInput(row);
      this.menuItems.push(row);
    });
    this.refreshSelection();
  }

  private startEntry(entry: MainMenuEntry): void {
    goToScene(this, entry.target, entry.data);
  }

  /**
   * Wire pointer events on a menu item container.
   *
   * @param container - The menu item container to make interactive.
   */
  private attachMenuItemInput(container: Phaser.GameObjects.Container): void {
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -MENU_BUTTON_WIDTH / 2,
        -MENU_BUTTON_HEIGHT / 2,
        MENU_BUTTON_WIDTH,
        MENU_BUTTON_HEIGHT,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    if (container.input) container.input.cursor = "pointer";
    container.on("pointerover", () => {
      const index = this.menuItems.indexOf(container);
      if (index !== this.selectedIndex) playUiHover();
      this.selectedIndex = index;
      this.refreshSelection();
    });
    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) this.selectMenuItem();
    });
  }

  private refreshSelection(): void {
    applyMenuSelection(this, this.menuItems, this.selectedIndex);
    const entry = MAIN_MENU_ENTRIES[this.selectedIndex];
    if (entry) this.briefing.show(entry);
  }

  private moveSelection(step: number): void {
    const count = this.menuItems.length;
    do {
      this.selectedIndex = (this.selectedIndex + step + count) % count;
    } while (!this.menuItems[this.selectedIndex]?.getData("enabled"));
    playUiHover();
    this.refreshSelection();
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard!.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard!.on("keydown-ENTER", () => {
      this.selectMenuItem();
    });
    this.input.keyboard!.on("keydown-SPACE", () => {
      this.selectMenuItem();
    });
    this.input.keyboard!.on("keydown-F", () => this.startFlightSchool());
  }

  private selectMenuItem(): void {
    const item = this.menuItems[this.selectedIndex];
    if (!item) return;
    if (!(item.getData("enabled") as boolean)) return;

    playUiPress();
    this.cameras.main.flash(100, 20, 60, 90, false);
    punch(this, item, { scale: 1.04, durationMs: 160 });
    (item.getData("action") as () => void)();
  }
}
