/**
 * Campaign Scene
 *
 * Faction selection and mission progression for story campaigns.
 * Features:
 * - 5 faction campaigns with unique storylines
 * - Mission map showing progression
 * - Save/load campaign progress
 * - Mission briefing before battles
 *
 * Drawing lives in src/ui/campaign/; this scene owns the phase flow.
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import {
  FACTION_CAMPAIGNS,
  type FactionCampaign,
  type CampaignMission,
} from "../data/CampaignData";
import { audioManager } from "../audio/AudioManager";
import {
  CampaignSaveManager,
  type CampaignSaveData,
} from "../systems/CampaignSaveManager";
import {
  MenuFocus,
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
  MENU_LAYOUT,
  type FocusTarget,
  type MenuHeader,
} from "../ui/menu";
import { createHoverButton } from "../ui/ButtonFactory";
import { factionAccent } from "../ui/theme/HoloTheme";
import {
  FACTION_CARD_LAYOUT,
  createFactionCampaignCard,
} from "../ui/campaign/FactionCampaignCard";
import { createMissionMapPanel } from "../ui/campaign/CampaignMissionMap";
import { createCampaignSidebar } from "../ui/campaign/CampaignSquadPanel";
import { createBriefingPanels } from "../ui/campaign/CampaignBriefing";

type CampaignPhase = "faction_select" | "mission_map" | "briefing";

/** Order of the faction cards. */
const FACTION_ORDER: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Painted background behind every campaign phase. */
const BACKDROP_TEXTURE = "planet_rocky";

/** Bottom of the area the faction list is centred in (above the footer). */
const FACTION_LIST_BOTTOM = 672;

/** Primary LAUNCH button on the briefing screen. */
const LAUNCH_BUTTON = { width: 240, height: 48, font: "600 16px" } as const;

export class CampaignScene extends Phaser.Scene {
  private currentPhase: CampaignPhase = "faction_select";
  private selectedFaction: FactionId | null = null;
  private selectedMission: CampaignMission | null = null;
  private campaignData: FactionCampaign | null = null;
  private saveData: CampaignSaveData | null = null;

  // UI containers — one per phase, rebuilt on entry
  private factionSelectContainer: Phaser.GameObjects.Container | null = null;
  private missionMapContainer: Phaser.GameObjects.Container | null = null;
  private briefingContainer: Phaser.GameObjects.Container | null = null;
  private menuFocus: MenuFocus | null = null;

  constructor() {
    super({ key: "CampaignScene" });
  }

  create(): void {
    this.factionSelectContainer = null;
    this.missionMapContainer = null;
    this.briefingContainer = null;
    this.menuFocus = null;
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });

    audioManager.initialize();
    audioManager.playMusic("menu_theme");

    this.input.keyboard?.on("keydown-ESC", this.goBack, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ESC", this.goBack, this);
      this.menuFocus?.destroy();
      this.menuFocus = null;
    });
    this.showFactionSelect();
  }

  /** ESC steps back one phase (briefing → map → factions → main menu). */
  private goBack(): void {
    if (this.currentPhase === "briefing") this.showMissionMap();
    else if (this.currentPhase === "mission_map") this.showFactionSelect();
    else this.scene.start("MainMenuScene");
  }

  /**
   * Tear down the previous phase UI and open a fresh container.
   *
   * @param phase - Phase being entered.
   * @returns The new phase container.
   */
  private enterPhase(phase: CampaignPhase): Phaser.GameObjects.Container {
    this.currentPhase = phase;
    this.menuFocus?.destroy();
    this.menuFocus = null;
    this.factionSelectContainer?.destroy();
    this.missionMapContainer?.destroy();
    this.briefingContainer?.destroy();
    this.factionSelectContainer = null;
    this.missionMapContainer = null;
    this.briefingContainer = null;
    const container = this.add.container(0, 0);
    if (phase === "faction_select") this.factionSelectContainer = container;
    else if (phase === "mission_map") this.missionMapContainer = container;
    else this.briefingContainer = container;
    return container;
  }

  private headerObjects(header: MenuHeader): Phaser.GameObjects.GameObject[] {
    return header.subtitle
      ? [header.title, header.subtitle, header.rule]
      : [header.title, header.rule];
  }

  private focusPhase(phase: CampaignPhase, targets: FocusTarget[]): void {
    this.menuFocus = new MenuFocus(this, targets, {
      isActive: () => this.currentPhase === phase,
    });
  }

  // ==========================================
  // FACTION SELECT
  // ==========================================

  private showFactionSelect(): void {
    const container = this.enterPhase("faction_select");
    const header = addMenuHeader(this, {
      title: "CAMPAIGN",
      subtitle: "Choose your faction",
    });
    const back = addBackButton(this, () => this.scene.start("MainMenuScene"));
    const L = FACTION_CARD_LAYOUT;
    const listHeight =
      FACTION_ORDER.length * L.height + (FACTION_ORDER.length - 1) * L.gap;
    const top = (MENU_LAYOUT.contentTop + FACTION_LIST_BOTTOM - listHeight) / 2;
    const cards = FACTION_ORDER.map((factionId, index) =>
      createFactionCampaignCard(
        this,
        {
          x: this.scale.width / 2,
          y: top + index * (L.height + L.gap) + L.height / 2,
        },
        FACTION_CAMPAIGNS[factionId],
        this.factionProgress(FACTION_CAMPAIGNS[factionId]),
        () => this.selectFaction(factionId),
      ),
    );
    const hint = addFooterHint(
      this,
      "↑ ↓ to browse  ·  ENTER to select  ·  ESC to go back",
    );
    container.add([...this.headerObjects(header), back, ...cards, hint]);
    this.focusPhase("faction_select", [...cards, back]);
  }

  private factionProgress(campaign: FactionCampaign): {
    label: string;
    inProgress: boolean;
  } {
    const saveData = CampaignSaveManager.load(campaign.factionId);
    return saveData
      ? {
          label: `Mission ${saveData.currentMission} / ${campaign.missions.length}`,
          inProgress: true,
        }
      : { label: "New Campaign", inProgress: false };
  }

  private selectFaction(factionId: FactionId): void {
    this.selectedFaction = factionId;
    this.campaignData = FACTION_CAMPAIGNS[factionId];
    this.saveData = CampaignSaveManager.load(factionId);

    // Create new save if none exists
    if (!this.saveData) {
      this.saveData = CampaignSaveManager.createNew(factionId);
      CampaignSaveManager.save(this.saveData);
    }

    audioManager.playSound("ui_select", 0.7);
    this.showMissionMap();
  }

  // ==========================================
  // MISSION MAP
  // ==========================================

  private showMissionMap(): void {
    const container = this.enterPhase("mission_map");
    const factionId = this.selectedFaction!;
    const campaign = this.campaignData!;
    const save = this.saveData!;
    const accent = factionAccent(factionId);
    const header = addMenuHeader(this, {
      title: campaign.name,
      subtitle: campaign.protagonist,
      accent,
    });
    const back = addBackButton(
      this,
      () => this.showFactionSelect(),
      "FACTIONS",
    );
    const map = createMissionMapPanel(this, {
      campaign,
      save,
      accent,
      onSelectMission: (mission) => this.selectMission(mission),
    });
    const sidebar = createCampaignSidebar(this, factionId, save, accent);
    container.add([...this.headerObjects(header), back, map.panel, ...sidebar]);
    this.focusPhase("mission_map", [...map.focusTargets, back]);
  }

  private selectMission(mission: CampaignMission): void {
    this.selectedMission = mission;
    audioManager.playSound("ui_select", 0.7);
    this.showBriefing();
  }

  // ==========================================
  // MISSION BRIEFING
  // ==========================================

  private showBriefing(): void {
    const container = this.enterPhase("briefing");
    const factionId = this.selectedFaction!;
    const mission = this.selectedMission!;
    const accent = factionAccent(factionId);
    const header = addMenuHeader(this, {
      title: mission.title,
      subtitle: `MISSION ${mission.missionNumber}`,
      accent,
    });
    const back = addBackButton(this, () => this.showMissionMap(), "MAP");
    const panels = createBriefingPanels(this, { factionId, mission, accent });
    const launch = createHoverButton(
      this,
      this.scale.width / 2,
      this.scale.height - MENU_LAYOUT.primaryInset,
      {
        width: LAUNCH_BUTTON.width,
        height: LAUNCH_BUTTON.height,
        color: accent,
        variant: "primary",
        label: "LAUNCH MISSION",
        font: LAUNCH_BUTTON.font,
        icon: "next",
      },
      () => this.launchMission(),
    );
    container.add([...this.headerObjects(header), back, ...panels, launch]);
    this.focusPhase("briefing", [launch, back]);
  }

  private launchMission(): void {
    // Store mission data for the battle scene
    this.scene.start("CampaignBattleScene", {
      factionId: this.selectedFaction,
      mission: this.selectedMission,
      saveData: this.saveData,
    });
  }
}
