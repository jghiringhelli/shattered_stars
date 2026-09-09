/**
 * Credits Scene
 *
 * Shows game credits with scrolling text
 */

import Phaser from "phaser";
import { renderMenuStarfield } from "../rendering/Starfield";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";

export class CreditsScene extends Phaser.Scene {
  private creditsContainer!: Phaser.GameObjects.Container;
  private creditsTotalHeight = 0;
  private scrollSpeed = 0.5;

  constructor() {
    super({ key: "CreditsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);

    addPaintedSpaceBackground(this, "galaxy_spiral");
    this.createStarfield();
    this.createCredits();
    this.createBackButton();
    this.setupInput();
  }

  update(): void {
    // Scroll credits up
    this.creditsContainer.y -= this.scrollSpeed;

    // Reset when fully scrolled
    if (this.creditsContainer.y < -this.creditsTotalHeight) {
      this.creditsContainer.y = this.scale.height;
    }
  }

  private createStarfield(): void {
    renderMenuStarfield(this, {
      starCount: 100,
      starSizeRange: [0.5, 1.5],
      alphaRange: [0.2, 0.6],
    });
  }

  private createCredits(): void {
    this.creditsContainer = this.add.container(
      this.scale.width / 2,
      this.scale.height,
    );

    const credits = [
      { text: "SHATTERED STARS", style: "title" },
      { text: "", style: "spacer" },
      { text: "A Tactical Starship Combat Game", style: "subtitle" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "--- DEVELOPMENT ---", style: "section" },
      { text: "", style: "spacer" },
      { text: "Game Design", style: "role" },
      { text: "Shattered Stars Team", style: "name" },
      { text: "", style: "spacer" },
      { text: "Programming", style: "role" },
      { text: "Built with Claude AI", style: "name" },
      { text: "", style: "spacer" },
      { text: "Art Direction", style: "role" },
      { text: "Procedural Generation", style: "name" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "--- TECHNOLOGY ---", style: "section" },
      { text: "", style: "spacer" },
      { text: "Game Engine", style: "role" },
      { text: "Phaser 3", style: "name" },
      { text: "", style: "spacer" },
      { text: "Language", style: "role" },
      { text: "TypeScript", style: "name" },
      { text: "", style: "spacer" },
      { text: "Build Tool", style: "role" },
      { text: "Vite", style: "name" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "--- INSPIRATION ---", style: "section" },
      { text: "", style: "spacer" },
      { text: "X-Wing Miniatures Game", style: "name" },
      { text: "Fantasy Flight Games", style: "small" },
      { text: "", style: "spacer" },
      { text: "Star Wars", style: "name" },
      { text: "Lucasfilm", style: "small" },
      { text: "", style: "spacer" },
      { text: "Wing Commander", style: "name" },
      { text: "Origin Systems", style: "small" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "--- SPECIAL THANKS ---", style: "section" },
      { text: "", style: "spacer" },
      { text: "Playtesters", style: "role" },
      { text: "You!", style: "name" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "Thank you for playing!", style: "subtitle" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
      { text: "", style: "spacer" },
    ];

    let y = 0;

    credits.forEach((credit) => {
      let text: Phaser.GameObjects.Text;

      switch (credit.style) {
        case "title":
          text = this.add
            .text(0, y, credit.text, {
              font: "bold 48px Arial",
              color: "#ffffff",
            })
            .setOrigin(0.5);
          y += 60;
          break;

        case "subtitle":
          text = this.add
            .text(0, y, credit.text, {
              font: "24px Arial",
              color: "#88aacc",
            })
            .setOrigin(0.5);
          y += 40;
          break;

        case "section":
          text = this.add
            .text(0, y, credit.text, {
              font: "bold 28px Arial",
              color: "#ffaa44",
            })
            .setOrigin(0.5);
          y += 50;
          break;

        case "role":
          text = this.add
            .text(0, y, credit.text, {
              font: "18px Arial",
              color: "#888888",
            })
            .setOrigin(0.5);
          y += 25;
          break;

        case "name":
          text = this.add
            .text(0, y, credit.text, {
              font: "bold 22px Arial",
              color: "#ffffff",
            })
            .setOrigin(0.5);
          y += 35;
          break;

        case "small":
          text = this.add
            .text(0, y, credit.text, {
              font: "14px Arial",
              color: "#666666",
            })
            .setOrigin(0.5);
          y += 25;
          break;

        case "spacer":
        default:
          y += 20;
          return;
      }

      this.creditsContainer.add(text);
    });

    this.creditsTotalHeight = y;
  }

  private createBackButton(): void {
    const btn = this.add.container(100, this.scale.height - 50);

    const bg = this.add.graphics();
    bg.fillStyle(0x333344, 0.8);
    bg.fillRoundedRect(-60, -20, 120, 40, 8);
    btn.add(bg);

    const text = this.add
      .text(0, 0, "BACK", {
        font: "bold 20px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    btn.add(text);

    btn.setInteractive(
      new Phaser.Geom.Rectangle(-60, -20, 120, 40),
      Phaser.Geom.Rectangle.Contains,
    );

    btn.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x444466, 0.9);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
    });

    btn.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x333344, 0.8);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
    });

    btn.on("pointerdown", () => {
      this.scene.start("MainMenuScene");
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard!.on("keydown-SPACE", () => {
      this.scene.start("MainMenuScene");
    });

    // Speed up scroll with arrow keys
    this.input.keyboard!.on("keydown-UP", () => {
      this.scrollSpeed = 2;
    });

    this.input.keyboard!.on("keyup-UP", () => {
      this.scrollSpeed = 0.5;
    });

    this.input.keyboard!.on("keydown-DOWN", () => {
      this.scrollSpeed = -1;
    });

    this.input.keyboard!.on("keyup-DOWN", () => {
      this.scrollSpeed = 0.5;
    });
  }
}
