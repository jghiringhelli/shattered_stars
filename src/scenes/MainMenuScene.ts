/**
 * Main Menu Scene
 *
 * Entry point for the game with navigation to:
 * - Skirmish (Squad builder -> Arcade Battle)
 * - Survival, Epic Battle, Dogfight, Ace Duel, Campaign
 * - Encyclopedia, Settings, Credits
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import {
  applyMenuSelection,
  MENU_BUTTON_WIDTH,
  MENU_BUTTON_HEIGHT,
  MENU_BUTTON_RADIUS,
} from "../ui/MenuSelection";
import { punch } from "../ui/UIJuice";
import {
  createTexturedPanel,
  addSceneBackground,
  addSceneTitleFrame,
  addPaintedSpaceBackground,
} from "../ui/TexturedPanel";
import { renderMenuStarfield } from "../rendering/Starfield";

const HALF_W = MENU_BUTTON_WIDTH / 2;
const HALF_H = MENU_BUTTON_HEIGHT / 2;

export class MainMenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private menuItems: Phaser.GameObjects.Container[] = [];
  private selectedIndex = 0;
  private starfield!: Phaser.GameObjects.Graphics;
  private texturesAvailable = false;

  constructor() {
    super({ key: "MainMenuScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);
    this.texturesAvailable = this.textures.exists("tex_btn_normal");

    addPaintedSpaceBackground(this, "nebula_purple");
    addSceneBackground(this);

    // Defer AudioContext creation until the first user gesture (Chrome autoplay policy).
    const initAudio = (): void => {
      audioManager.initialize();
      audioManager.playMusic("menu_theme");
    };
    this.input.once("pointerdown", initAudio);
    this.input.keyboard!.once("keydown", initAudio);

    this.createStarfield();
    this.createTitle();
    this.createMenuItems();
    this.setupInput();

    this.titleText.setAlpha(0);
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: 120,
      duration: 1000,
      ease: "Power2",
    });

    this.menuItems.forEach((item, i) => {
      item.setAlpha(0);
      item.x = -200;
      this.tweens.add({
        targets: item,
        alpha: 1,
        x: this.scale.width / 2,
        duration: 500,
        delay: 500 + i * 100,
        ease: "Back.out",
      });
    });
  }

  update(): void {
    this.starfield.rotation += 0.0001;
  }

  private createStarfield(): void {
    const wideBounds = { minX: -640, maxX: 1920, minY: -360, maxY: 1080 };
    this.starfield = renderMenuStarfield(this, {
      starCount: 200,
      bounds: wideBounds,
      nebulae: [
        { x: 400, y: 300, color: 0x2244aa, radius: 300 },
        { x: 900, y: 500, color: 0x442266, radius: 250 },
      ],
    });
  }

  private createTitle(): void {
    const centerX = this.scale.width / 2;

    addSceneTitleFrame(this, 130, 160);

    this.titleText = this.add
      .text(centerX, 80, "SHATTERED STARS", {
        font: "bold 72px Arial",
        color: "#ffffff",
        stroke: "#003366",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 180, "Tactical Starship Combat", {
        font: "24px Arial",
        color: "#88aacc",
      })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width - 20, this.scale.height - 20, "v0.1.0 Alpha", {
        font: "14px monospace",
        color: "#444444",
      })
      .setOrigin(1, 1);
  }

  private createMenuItems(): void {
    this.menuItems = [];
    this.selectedIndex = 0;
    const centerX = this.scale.width / 2;
    const startY = 220;
    const spacing = 46;

    const items = [
      {
        label: "SKIRMISH",
        action: () =>
          this.scene.start("SquadBuilderScene", { initialMode: "arcade" }),
      },
      {
        label: "SURVIVAL",
        action: () => this.scene.start("SurvivalSetupScene"),
      },
      {
        label: "EPIC FORMAT",
        action: () =>
          this.scene.start("SquadBuilderScene", { initialMode: "epic" }),
      },
      { label: "BOSS RAID", action: () => this.scene.start("EpicBattleScene") },
      { label: "DOGFIGHT", action: () => this.scene.start("DogfightScene") },
      { label: "ACE DUEL", action: () => this.scene.start("AceDuelScene") },
      { label: "CAMPAIGN", action: () => this.scene.start("CampaignScene") },
      {
        label: "ONLINE",
        action: () =>
          this.scene.start("SquadBuilderScene", { initialMode: "online" }),
      },
      { label: "SETTINGS", action: () => this.scene.start("SettingsScene") },
      {
        label: "CONTROLS",
        action: () => this.scene.start("ControlsScene"),
      },
      {
        label: "ENCYCLOPEDIA",
        action: () => this.scene.start("EncyclopediaScene"),
      },
      { label: "CREDITS", action: () => this.scene.start("CreditsScene") },
    ];

    items.forEach((item, index) => {
      const container = this.createMenuItem(
        centerX,
        startY + index * spacing,
        item.label,
        item.action,
      );
      this.menuItems.push(container);
    });

    // Visual separator between CAMPAIGN and ONLINE (between indices 6 and 7)
    const separatorY = startY + 6 * spacing + spacing / 2;
    const separator = this.add.graphics();
    separator.lineStyle(1, 0x334455, 0.8);
    separator.lineBetween(centerX - 120, separatorY, centerX + 120, separatorY);

    applyMenuSelection(
      this,
      this.menuItems,
      this.selectedIndex,
      this.texturesAvailable,
    );
  }

  private createMenuItem(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const panel = createTexturedPanel(this, {
      x: 0,
      y: 0,
      width: MENU_BUTTON_WIDTH,
      height: MENU_BUTTON_HEIGHT,
      textureKey: "tex_btn_normal",
      fallbackColor: 0x112233,
      fallbackAlpha: 0.6,
      fallbackRadius: MENU_BUTTON_RADIUS,
    });
    container.add(panel);

    const glow = this.add.graphics();
    container.add(glow);

    const text = this.add
      .text(0, 0, label, { font: "bold 28px Arial", color: "#ffffff" })
      .setOrigin(0.5);
    container.add(text);

    container.setData("glow", glow);
    container.setData("text", text);
    container.setData("action", action);
    container.setData("enabled", true);

    this.attachMenuItemInput(container);
    return container;
  }

  /**
   * Wire pointer events on a menu item container.
   *
   * @param container - The menu item container to make interactive.
   */
  private attachMenuItemInput(container: Phaser.GameObjects.Container): void {
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -HALF_W,
        -HALF_H,
        MENU_BUTTON_WIDTH,
        MENU_BUTTON_HEIGHT,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on("pointerover", () => {
      this.selectedIndex = this.menuItems.indexOf(container);
      applyMenuSelection(
        this,
        this.menuItems,
        this.selectedIndex,
        this.texturesAvailable,
      );
    });
    container.on("pointerdown", () => {
      this.selectMenuItem();
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-UP", () => {
      do {
        this.selectedIndex =
          (this.selectedIndex - 1 + this.menuItems.length) %
          this.menuItems.length;
      } while (!this.menuItems[this.selectedIndex]?.getData("enabled"));
      audioManager.playSound("ui_hover", 0.5);
      applyMenuSelection(
        this,
        this.menuItems,
        this.selectedIndex,
        this.texturesAvailable,
      );
    });

    this.input.keyboard!.on("keydown-DOWN", () => {
      do {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      } while (!this.menuItems[this.selectedIndex]?.getData("enabled"));
      audioManager.playSound("ui_hover", 0.5);
      applyMenuSelection(
        this,
        this.menuItems,
        this.selectedIndex,
        this.texturesAvailable,
      );
    });

    this.input.keyboard!.on("keydown-ENTER", () => {
      this.selectMenuItem();
    });
    this.input.keyboard!.on("keydown-SPACE", () => {
      this.selectMenuItem();
    });
  }

  private selectMenuItem(): void {
    const item = this.menuItems[this.selectedIndex];
    if (!item) return;
    if (!(item.getData("enabled") as boolean)) return;

    audioManager.playSound("ui_select", 0.7);
    this.cameras.main.flash(100, 68, 170, 255, false);
    punch(this, item, { scale: 1.12, durationMs: 180 });
    (item.getData("action") as () => void)();
  }
}
