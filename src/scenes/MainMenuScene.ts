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
import { openFeedbackDialog } from "../ui/feedback/feedbackDialog";
import { openWelcomeDialog } from "../ui/welcome/welcomeDialog";
import { openProgressDialog } from "../ui/progress/progressDialog";
import {
  pageWelcomeEnvironment,
  shouldAutoOpenWelcome,
} from "../ui/welcome/welcomeState";
import { addFooterLinks } from "../ui/menu/MenuFooterLinks";
import { BUILD_INFO, formatVersionTag } from "../buildInfo";
import { addFooterHint, addMenuBackdrop } from "../ui/menu/MenuScaffold";
import {
  MAIN_MENU_ENTRIES,
  type MainMenuEntry,
} from "../ui/menu/mainMenuEntries";
import { MainMenuBriefing } from "../ui/menu/MainMenuBriefing";
import { FlightSchoolCard } from "../ui/menu/FlightSchoolCard";
import { ContinueCard } from "../ui/menu/ContinueCard";
import { launchOfEntry } from "../ui/menu/continueModel";
import {
  loadLastLaunch,
  saveLastLaunch,
} from "../systems/setup/setupMemory";
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
  /** Whether a last launch is remembered (R and the footer hint). */
  private continueAvailable = false;

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
    const continueCard = new ContinueCard(this, () => this.continueLast());
    this.continueAvailable = continueCard.canContinue;
    this.createFooter();
    this.setupInput();
    this.playEntrance(
      flightSchool.container,
      ...(continueCard.container ? [continueCard.container] : []),
    );
    fadeInMenu(this);
    if (shouldAutoOpenWelcome(pageWelcomeEnvironment())) this.openWelcome();
  }

  /** Main menu → Flight School (card button or F). */
  private startFlightSchool(): void {
    playUiPress();
    goToScene(this, "FlightSchoolScene");
  }

  private playEntrance(
    card: Phaser.GameObjects.Container,
    ...extraCards: Phaser.GameObjects.Container[]
  ): void {
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
    const cards = [card, ...extraCards];
    cards.forEach((c) => c.setAlpha(0));
    this.tweens.add({
      targets: [briefing, ...cards],
      alpha: 1,
      delay: ENTRANCE.briefingDelayMs,
      duration: ENTRANCE.rowMs,
    });
  }

  private createFooter(): void {
    const { width, height } = this.scale;
    addFooterHint(
      this,
      this.continueAvailable
        ? "↑ ↓  NAVIGATE      ENTER  SELECT      F  FLIGHT SCHOOL      R  CONTINUE LAST"
        : "↑ ↓  NAVIGATE        ENTER  SELECT        F  FLIGHT SCHOOL",
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
    addFooterLinks(
      this,
      [
        { label: "SEND FEEDBACK", onPress: () => this.openFeedback() },
        { label: "TESTER INFO", onPress: () => this.openWelcome() },
        { label: "PROFILE", onPress: () => openProgressDialog() },
      ],
      { x: MAIN_MENU_LAYOUT.margin, y: height - 16 },
      {
        style: muted,
        hoverColor: MAIN_MENU_LAYOUT.linkHoverColor,
        letterSpacing: 1.5,
      },
    );
  }

  private openFeedback(): void {
    openFeedbackDialog({ game: this.game, sceneKey: this.scene.key });
  }

  /** Tester welcome: first launch (once) and from the TESTER INFO link. */
  private openWelcome(): void {
    openWelcomeDialog({
      onFlightSchool: () => this.startFlightSchool(),
      onFeedback: () => this.openFeedback(),
    });
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
    const launch = launchOfEntry(entry);
    if (launch) saveLastLaunch(launch);
    goToScene(this, entry.target, entry.data);
  }

  /** CONTINUE LAST (card button / R): relaunch the last mode, a builder battle straight into the fight. */
  private continueLast(): void {
    const launch = loadLastLaunch();
    if (!launch) return;
    if (launch.battleConfig !== undefined)
      this.registry.set("battleConfig", launch.battleConfig);
    playUiPress();
    goToScene(this, launch.scene, launch.data);
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
    this.input.keyboard!.on("keydown-R", () => {
      if (this.continueAvailable) this.continueLast();
    });
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
