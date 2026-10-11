/**
 * DebriefDialogueView — the comm-link area of the debrief: a portrait
 * HoloPanel (border tinted by the speaker's mood, CRT scanlines, flash on
 * speaker change) beside a dialogue HoloPanel whose header strip names the
 * speaker. Owns only presentation; DebriefScene drives the typewriter.
 */

import type Phaser from "phaser";
import type { DebriefLine } from "../../data/CampaignData";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";

/** Portrait border colour per speaker mood (holo palette). */
export const MOOD_COLORS: Readonly<Record<string, number>> = {
  neutral: HOLO_PALETTE.border,
  proud: HOLO_PALETTE.warning,
  solemn: HOLO_PALETTE.shield,
  urgent: HOLO_PALETTE.target,
  grim: HOLO_PALETTE.danger,
};

/** Dialogue layout (screen coordinates). */
export const DIALOGUE_LAYOUT = {
  left: 112,
  top: 216,
  height: 264,
  portraitPanelWidth: 176,
  portraitWidth: 152,
  portraitHeight: 228,
  gap: 16,
  textPanelWidth: 864,
  padding: 24,
  /** HoloPanel header strip height. */
  headerHeight: 28,
  footerInset: 20,
  textSize: 18,
  lineSpacing: 8,
  scanSpacing: 4,
  scanAlpha: 0.2,
  scanPeriodMs: 200,
  flashAlpha: 0.55,
  flashMs: 280,
  talkFrameMs: 120,
  blinkAlpha: 0.2,
  blinkMs: 600,
  fadeMs: 220,
} as const;

/** Fallback portrait texture. */
export const DEFAULT_PORTRAIT = "portrait_command";

/** Presentation of the debrief dialogue (portrait + text box). */
export class DebriefDialogueView {
  private readonly root: Phaser.GameObjects.Container;
  private portraitPanel!: HoloPanel;
  private textPanel!: HoloPanel;
  private portraitImage!: Phaser.GameObjects.Image;
  private scanlines!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Graphics;
  private dialogueText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private talkTimer: Phaser.Time.TimerEvent | undefined;

  /**
   * @param scene - Owning scene.
   * @param accent - Faction accent for the dialogue panel.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    accent: number,
  ) {
    this.root = scene.add.container(0, 0);
    this.buildPortraitPanel();
    this.buildTextPanel(accent);
    this.root.add([this.portraitPanel, this.textPanel]);
  }

  private buildPortraitPanel(): void {
    const L = DIALOGUE_LAYOUT;
    this.portraitPanel = createHoloPanel(
      this.scene,
      L.left + L.portraitPanelWidth / 2,
      L.top + L.height / 2,
      {
        width: L.portraitPanelWidth,
        height: L.height,
        accentColor: MOOD_COLORS["neutral"]!,
      },
    );
    this.portraitImage = this.scene.add
      .image(0, 0, DEFAULT_PORTRAIT)
      .setDisplaySize(L.portraitWidth, L.portraitHeight);
    this.scanlines = this.createScanlines();
    this.flash = this.scene.add.graphics();
    this.flash.fillStyle(HOLO_PALETTE.textPrimary, 1);
    this.flash.fillRect(
      -L.portraitWidth / 2,
      -L.portraitHeight / 2,
      L.portraitWidth,
      L.portraitHeight,
    );
    this.flash.setAlpha(0);
    this.portraitPanel.add([this.portraitImage, this.scanlines, this.flash]);
  }

  private buildTextPanel(accent: number): void {
    const L = DIALOGUE_LAYOUT;
    const textLeft = L.left + L.portraitPanelWidth + L.gap;
    this.textPanel = createHoloPanel(
      this.scene,
      textLeft + L.textPanelWidth / 2,
      L.top + L.height / 2,
      { width: L.textPanelWidth, height: L.height, accentColor: accent },
    );
    const inner = -L.textPanelWidth / 2 + L.padding;
    const textTop = -L.height / 2 + L.headerHeight + L.padding;
    this.dialogueText = addHoloText(this.scene, inner, textTop, "", {
      size: L.textSize,
      wrapWidth: L.textPanelWidth - L.padding * 2,
      lineSpacing: L.lineSpacing,
    });
    const footerY = L.height / 2 - L.footerInset;
    this.counterText = addHoloText(this.scene, inner, footerY, "", {
      ...CAMPAIGN_TEXT.caption,
      color: HOLO_PALETTE.textMuted,
    }).setOrigin(0, 0.5);
    this.promptText = addHoloText(
      this.scene,
      -inner,
      footerY,
      "CLICK OR SPACE TO CONTINUE",
      { ...CAMPAIGN_TEXT.caption },
    ).setOrigin(1, 0.5);
    this.textPanel.add([this.dialogueText, this.counterText, this.promptText]);
  }

  private createScanlines(): Phaser.GameObjects.Graphics {
    const L = DIALOGUE_LAYOUT;
    const g = this.scene.add.graphics();
    const left = -L.portraitWidth / 2;
    const top = -L.portraitHeight / 2;
    g.fillStyle(0x000000, L.scanAlpha);
    for (let y = 0; y < L.portraitHeight - L.scanSpacing; y += L.scanSpacing) {
      g.fillRect(left, top + y, L.portraitWidth, 1);
    }
    this.scene.tweens.add({
      targets: g,
      y: L.scanSpacing,
      duration: L.scanPeriodMs,
      repeat: -1,
      ease: "Linear",
    });
    return g;
  }

  /**
   * Switch to a new line: portrait (with flash on speaker change), mood
   * border, speaker strip and counter; clears the text.
   *
   * @param line - Debrief line.
   * @param index - Zero-based line index.
   * @param total - Number of lines.
   * @returns Texture key now shown in the portrait.
   */
  presentLine(line: DebriefLine, index: number, total: number): string {
    const tex = this.scene.textures.exists(line.portraitKey)
      ? line.portraitKey
      : DEFAULT_PORTRAIT;
    const previous = this.portraitImage.texture.key;
    const hasTalk = this.scene.textures.get(tex).has("talk");
    this.portraitImage.setTexture(tex, hasTalk ? "base" : undefined);
    this.portraitImage.setDisplaySize(
      DIALOGUE_LAYOUT.portraitWidth,
      DIALOGUE_LAYOUT.portraitHeight,
    );
    if (tex !== previous) this.flashPortrait();
    this.portraitPanel.setAccent(
      MOOD_COLORS[line.mood ?? "neutral"] ?? MOOD_COLORS["neutral"]!,
    );
    this.textPanel.setTitle(line.speaker);
    this.counterText.setText(`[${index + 1}/${total}]`);
    this.dialogueText.setText("");
    this.stopTalking(tex);
    if (hasTalk) this.startTalking();
    return tex;
  }

  private flashPortrait(): void {
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(DIALOGUE_LAYOUT.flashAlpha);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: DIALOGUE_LAYOUT.flashMs,
      ease: "Cubic.easeOut",
    });
  }

  private startTalking(): void {
    this.talkTimer = this.scene.time.addEvent({
      delay: DIALOGUE_LAYOUT.talkFrameMs,
      loop: true,
      callback: () => {
        const onBase = this.portraitImage.frame.name === "base";
        this.portraitImage.setFrame(onBase ? "talk" : "base");
      },
    });
  }

  /**
   * Stop the talking animation and rest on the base frame.
   *
   * @param textureKey - Portrait texture currently shown.
   */
  stopTalking(textureKey: string): void {
    this.talkTimer?.remove();
    this.talkTimer = undefined;
    if (this.scene.textures.get(textureKey).has("talk")) {
      this.portraitImage.setFrame("base");
    }
  }

  /**
   * Replace the dialogue text.
   *
   * @param text - Visible text.
   */
  setText(text: string): void {
    this.dialogueText.setText(text);
  }

  /**
   * Show the continue prompt, optionally blinking.
   *
   * @param blink - Pulse the prompt while waiting.
   */
  showPrompt(blink: boolean): void {
    this.scene.tweens.killTweensOf(this.promptText);
    this.promptText.setAlpha(1);
    if (!blink) return;
    this.scene.tweens.add({
      targets: this.promptText,
      alpha: DIALOGUE_LAYOUT.blinkAlpha,
      duration: DIALOGUE_LAYOUT.blinkMs,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Fade the whole dialogue area out, then hide it and stop animations. */
  hide(): void {
    this.talkTimer?.remove();
    this.talkTimer = undefined;
    this.scene.tweens.killTweensOf([
      this.promptText,
      this.scanlines,
      this.flash,
    ]);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: DIALOGUE_LAYOUT.fadeMs,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
