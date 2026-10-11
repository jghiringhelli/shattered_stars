/**
 * DebriefScene
 *
 * SC1-style post-mission debrief scene showing:
 * 1. Dialogue lines with portrait + typewriter effect
 * 2. Mission stats panel with animated pilot XP bars
 * 3. Evolution choice panel (on pivot missions)
 *
 * Triggered by CampaignBattleScene after victory. Presentation lives in
 * src/ui/campaign/; this scene owns the state machine and input.
 */

import Phaser from "phaser";
import {
  FACTION_CAMPAIGNS,
  type DebriefLine,
  type EvolutionOption,
} from "../data/CampaignData";
import type { CampaignSaveData } from "../systems/CampaignSaveManager";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";
import {
  applyEvolution,
  getPilotDefinition,
} from "../systems/CampaignPilotManager";
import { MenuFocus, addMenuBackdrop, addMenuHeader } from "../ui/menu";
import type { HoloPressButton } from "../ui/menu/HoloPressButton";
import { factionAccent } from "../ui/theme/HoloTheme";
import { DebriefDialogueView } from "../ui/campaign/DebriefDialogueView";
import {
  needsEvolutionChoice,
  type DebriefSceneData,
} from "../ui/campaign/debriefTypes";
import { createDebriefStatsView } from "../ui/campaign/DebriefStatsView";
import { createEvolutionView } from "../ui/campaign/DebriefEvolutionView";

type DebriefState =
  | "dialogue_typing"
  | "dialogue_waiting"
  | "stats_animating"
  | "stats_waiting"
  | "evolution"
  | "transitioning";

const TYPEWRITER_INTERVAL_MS = 28;

/** Painted background behind the debrief. */
const BACKDROP_TEXTURE = "starfield_deep";
/** Fade-in of the stats / evolution containers. */
const PANEL_FADE_MS = 240;
/** Fade to black before returning to the campaign map. */
const EXIT_FADE_MS = 600;

export class DebriefScene extends Phaser.Scene {
  private data_!: DebriefSceneData;
  private state: DebriefState = "dialogue_typing";

  // Dialogue
  private lines: DebriefLine[] = [];
  private lineIndex: number = 0;
  private charIndex: number = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | undefined = undefined;
  private currentPortraitTex: string = "portrait_command";

  // UI objects
  private dialogue!: DebriefDialogueView;
  private statsContainer!: Phaser.GameObjects.Container;
  private evolutionContainer!: Phaser.GameObjects.Container;
  private continueButton: HoloPressButton | null = null;
  private menuFocus: MenuFocus | null = null;

  // Input
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "DebriefScene" });
  }

  create(data: DebriefSceneData): void {
    this.data_ = data;
    this.lines = [...(data.mission.debrief ?? [])];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.state = "dialogue_typing";
    this.continueButton = null;
    this.menuFocus = null;

    const accent = factionAccent(data.factionId);
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    this.createHeader(accent);
    this.dialogue = new DebriefDialogueView(this, accent);
    this.statsContainer = this.add.container(0, 0).setVisible(false);
    this.evolutionContainer = this.add.container(0, 0).setVisible(false);

    // Input: space bar
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      );
    }

    // Input: click anywhere
    this.input.on("pointerdown", this.handleInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menuFocus?.destroy();
      this.menuFocus = null;
    });

    if (this.lines.length === 0) {
      // No debrief text — go straight to stats
      this.state = "stats_animating";
      this.dialogue.hide();
      this.showStatsPanel();
    } else {
      this.showLine(0);
    }
  }

  update(): void {
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.handleInput();
    }
  }

  // ============================================
  // Input Handler
  // ============================================

  private handleInput(): void {
    switch (this.state) {
      case "dialogue_typing":
        this.skipTyping();
        break;
      case "dialogue_waiting":
        this.advanceLine();
        break;
      case "stats_waiting":
        this.proceedFromStats();
        break;
      default:
        break;
    }
  }

  private createHeader(accent: number): void {
    const { mission, factionId } = this.data_;
    const campaignName = FACTION_CAMPAIGNS[factionId]?.name;
    addMenuHeader(this, {
      title: `MISSION ${mission.missionNumber}: ${mission.title.toUpperCase()}`,
      ...(campaignName !== undefined && {
        subtitle: `${campaignName}  ·  Debrief`,
      }),
      accent,
    });
  }

  // ============================================
  // Typewriter Effect
  // ============================================

  private showLine(index: number): void {
    if (index >= this.lines.length) {
      this.state = "stats_animating";
      this.dialogue.hide();
      this.showStatsPanel();
      return;
    }

    const line = this.lines[index]!;
    this.lineIndex = index;
    this.charIndex = 0;
    this.state = "dialogue_typing";
    this.currentPortraitTex = this.dialogue.presentLine(
      line,
      index,
      this.lines.length,
    );

    this.typewriterTimer?.remove();
    this.typewriterTimer = this.time.addEvent({
      delay: TYPEWRITER_INTERVAL_MS,
      repeat: line.text.length - 1,
      callback: () => {
        this.charIndex++;
        this.dialogue.setText(line.text.slice(0, this.charIndex));
        if (this.charIndex >= line.text.length) {
          this.dialogue.stopTalking(this.currentPortraitTex);
          this.state = "dialogue_waiting";
          this.dialogue.showPrompt(true);
        }
      },
    });
  }

  private skipTyping(): void {
    this.typewriterTimer?.remove();
    const line = this.lines[this.lineIndex];
    if (line) {
      this.dialogue.setText(line.text);
    }
    this.dialogue.stopTalking(this.currentPortraitTex);
    this.state = "dialogue_waiting";
    this.dialogue.showPrompt(false);
  }

  private advanceLine(): void {
    this.dialogue.showPrompt(false);
    this.showLine(this.lineIndex + 1);
  }

  // ============================================
  // Stats Panel
  // ============================================

  private showStatsPanel(): void {
    this.statsContainer.removeAll(true);
    this.statsContainer.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.statsContainer,
      alpha: 1,
      duration: PANEL_FADE_MS,
    });
    const view = createDebriefStatsView(this, this.data_, () => {
      if (this.state === "stats_waiting") {
        this.proceedFromStats();
      }
    });
    this.statsContainer.add(view.objects);
    this.continueButton = view.continueButton;
    this.replaceFocus([view.continueButton], "stats_waiting");

    // Set state after XP animations complete
    this.time.delayedCall(view.animationMs, () => {
      if (this.state !== "stats_animating") return;
      this.state = "stats_waiting";
      view.continueButton.setEnabled(true);
    });
  }

  private replaceFocus(
    buttons: HoloPressButton[],
    activeState: DebriefState,
  ): void {
    this.menuFocus?.destroy();
    this.menuFocus = new MenuFocus(this, buttons, {
      isActive: () => this.state === activeState,
    });
  }

  // ============================================
  // Evolution Panel
  // ============================================

  private showEvolutionPanel(): void {
    this.statsContainer.setVisible(false);
    this.evolutionContainer.removeAll(true);
    this.evolutionContainer.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.evolutionContainer,
      alpha: 1,
      duration: PANEL_FADE_MS,
    });

    const { mission, updatedSave } = this.data_;
    const view = createEvolutionView(this, {
      choice: mission.evolutionChoice!,
      accent: factionAccent(this.data_.factionId),
      onChoose: (option) => {
        if (this.state !== "evolution") return;
        this.applyEvolutionChoice(option, updatedSave);
      },
    });
    this.evolutionContainer.add(view.objects);
    this.replaceFocus(view.buttons, "evolution");
  }

  private applyEvolutionChoice(
    option: EvolutionOption,
    save: CampaignSaveData,
  ): void {
    this.state = "transitioning";

    // Find protagonist and apply evolution
    const updatedPilots = save.campaignPilots.map((pilot) => {
      const def = getPilotDefinition(this.data_.factionId, pilot.pilotId);
      if (def?.role === "protagonist") {
        return applyEvolution(pilot, option);
      }
      return pilot;
    });

    const finalSave = CampaignSaveManager.applyEvolutionChoice(
      save,
      updatedPilots,
    );
    void finalSave; // save is applied to localStorage by applyEvolutionChoice

    this.transitionToCampaign();
  }

  // ============================================
  // Flow Control
  // ============================================

  private proceedFromStats(): void {
    const { mission, updatedSave } = this.data_;
    this.continueButton?.setEnabled(false);
    if (needsEvolutionChoice(mission, updatedSave)) {
      this.state = "evolution";
      this.showEvolutionPanel();
    } else {
      this.state = "transitioning";
      this.transitionToCampaign();
    }
  }

  private transitionToCampaign(): void {
    this.cameras.main.fade(
      EXIT_FADE_MS,
      0,
      0,
      0,
      false,
      (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) {
          this.scene.start("CampaignScene", {
            factionId: this.data_.factionId,
          });
        }
      },
    );
  }
}
