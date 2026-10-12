/**
 * Campaign Scene
 *
 * Faction selection, the campaign hub and mission briefings:
 * - 5 faction campaigns (15 mission slots each, three acts)
 * - Hub (SC2-style): non-linear mission board (≥2 missions open at once in
 *   most of each act), ARMORY tab (credits → campaign-only ship mods, free
 *   respec), RESEARCH tab (permanent A/B choices), hero card with powers
 * - Terse, mood-driven briefing before launch (story-flag variants applied)
 *
 * Drawing lives in src/ui/campaign/; rules in src/campaign/; this scene owns
 * the phase flow and persists hub actions.
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import {
  FACTION_CAMPAIGNS,
  type FactionCampaign,
  type CampaignMission,
} from "../data/CampaignData";
import type { ArmoryMod } from "../data/campaign/armory";
import type { ResearchPick, ResearchTier } from "../data/campaign/research";
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
import { createCampaignSidebar } from "../ui/campaign/CampaignSquadPanel";
import { createBriefingPanels } from "../ui/campaign/CampaignBriefing";
import { createCampaignHub, type HubTab } from "../ui/campaign/CampaignHub";
import { availableMissions, slotCount } from "../campaign/hub/missionGraph";
import {
  pickResearch,
  respecArmory,
  toggleArmoryMod,
} from "../campaign/hub/hubActions";
import { briefedMission } from "../campaign/mission/briefingPreview";

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

/** Scene input (optional): open straight into a faction's hub. */
interface CampaignSceneData {
  readonly factionId?: FactionId;
}

export class CampaignScene extends Phaser.Scene {
  private currentPhase: CampaignPhase = "faction_select";
  private selectedFaction: FactionId | null = null;
  private selectedMission: CampaignMission | null = null;
  private campaignData: FactionCampaign | null = null;
  private saveData: CampaignSaveData | null = null;
  private hubTab: HubTab = "missions";
  /** Research option awaiting a confirming second click ("tierId:A"). */
  private pendingResearch: string | null = null;
  private phaseContainer: Phaser.GameObjects.Container | null = null;
  private menuFocus: MenuFocus | null = null;

  constructor() {
    super({ key: "CampaignScene" });
  }

  create(data?: CampaignSceneData): void {
    this.phaseContainer = null;
    this.menuFocus = null;
    this.hubTab = "missions";
    this.pendingResearch = null;
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    audioManager.initialize();
    this.input.keyboard?.on("keydown-ESC", this.goBack, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ESC", this.goBack, this);
      this.menuFocus?.destroy();
      this.menuFocus = null;
    });
    if (data?.factionId) this.selectFaction(data.factionId);
    else this.showFactionSelect();
  }

  /** ESC steps back one phase (briefing → hub → factions → main menu). */
  private goBack(): void {
    if (this.currentPhase === "briefing") this.showMissionMap();
    else if (this.currentPhase === "mission_map") this.showFactionSelect();
    else this.scene.start("MainMenuScene");
  }

  /** Tear down the previous phase UI and open a fresh container. */
  private enterPhase(phase: CampaignPhase): Phaser.GameObjects.Container {
    this.currentPhase = phase;
    this.menuFocus?.destroy();
    this.menuFocus = null;
    this.phaseContainer?.destroy();
    this.phaseContainer = this.add.container(0, 0);
    return this.phaseContainer;
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

  // ── Faction select ─────────────────────────────────────────────────────

  private showFactionSelect(): void {
    audioManager.playSubmenuMusic();
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
    const save = CampaignSaveManager.load(campaign.factionId);
    if (!save) return { label: "New Campaign", inProgress: false };
    if (save.campaignComplete)
      return { label: "Campaign Complete", inProgress: true };
    const total = slotCount(campaign);
    return {
      label: `Mission ${Math.min(total, save.currentMission)} / ${total}`,
      inProgress: true,
    };
  }

  private selectFaction(factionId: FactionId): void {
    this.selectedFaction = factionId;
    this.campaignData = FACTION_CAMPAIGNS[factionId];
    this.saveData = CampaignSaveManager.load(factionId);
    if (!this.saveData) {
      this.saveData = CampaignSaveManager.createNew(factionId);
      CampaignSaveManager.save(this.saveData);
    }
    audioManager.playSound("ui_select", 0.7);
    audioManager.playFactionMusic(factionId, "tactical");
    this.showMissionMap();
  }

  // ── Hub ────────────────────────────────────────────────────────────────

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
    const hub = createCampaignHub(this, {
      campaign,
      save,
      accent,
      tab: this.hubTab,
      pendingResearch: this.pendingResearch,
      onSelectTab: (tab) => this.selectHubTab(tab),
      onSelectMission: (mission) => this.selectMission(mission),
      onToggleMod: (mod) => this.toggleMod(mod),
      onRespec: () => this.respec(),
      onPickResearch: (tier, pick) => this.chooseResearch(tier, pick),
      onEpilogue: () =>
        this.scene.start("CampaignCompleteScene", { factionId }),
    });
    const sidebar = createCampaignSidebar(this, factionId, save, accent);
    container.add([
      ...this.headerObjects(header),
      back,
      ...hub.objects,
      ...sidebar,
    ]);
    this.focusPhase("mission_map", [...hub.focusTargets, back]);
  }

  /** @returns Ids of the missions the hub offers now (debug / tests). */
  availableMissionIds(): string[] {
    if (!this.campaignData || !this.saveData) return [];
    return availableMissions(this.campaignData, this.saveData).map((m) => m.id);
  }

  /** @param tab - Hub tab to show. */
  selectHubTab(tab: HubTab): void {
    this.hubTab = tab;
    this.pendingResearch = null;
    audioManager.playSound("ui_select", 0.5);
    this.showMissionMap();
  }

  /** @param mod - Armory mod to buy, or refund when installed. */
  private toggleMod(mod: ArmoryMod): void {
    const result = toggleArmoryMod(this.saveData!, mod.id);
    this.commit(result.save, result.ok);
  }

  /** Free respec: refund every armory mod. */
  private respec(): void {
    this.commit(respecArmory(this.saveData!), true);
  }

  /**
   * First click marks an option; a second click on it makes it permanent.
   *
   * @param tier - Research tier.
   * @param pick - Option clicked.
   */
  private chooseResearch(tier: ResearchTier, pick: ResearchPick): void {
    const key = `${tier.id}:${pick}`;
    if (this.pendingResearch !== key) {
      this.pendingResearch = key;
      this.showMissionMap();
      return;
    }
    this.pendingResearch = null;
    const result = pickResearch(this.saveData!, tier.id, pick);
    this.commit(result.save, result.ok);
  }

  /**
   * @param save - Save after a hub action.
   * @param ok - Whether it was accepted.
   */
  private commit(save: CampaignSaveData, ok: boolean): void {
    audioManager.playSound(ok ? "ui_select" : "ui_back", 0.6);
    if (ok) {
      this.saveData = save;
      CampaignSaveManager.save(save);
    }
    this.showMissionMap();
  }

  private selectMission(mission: CampaignMission): void {
    this.selectedMission = mission;
    audioManager.playSound("ui_select", 0.7);
    this.showBriefing();
  }

  // ── Briefing ───────────────────────────────────────────────────────────

  private showBriefing(): void {
    const container = this.enterPhase("briefing");
    const factionId = this.selectedFaction!;
    const mission = briefedMission(
      this.selectedMission!,
      this.saveData?.storyFlags ?? {},
      factionId,
    );
    const accent = factionAccent(factionId);
    const header = addMenuHeader(this, {
      title: mission.title,
      subtitle: `MISSION ${mission.missionNumber}`,
      accent,
    });
    const back = addBackButton(this, () => this.showMissionMap(), "HUB");
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
    this.scene.start("CampaignBattleScene", {
      factionId: this.selectedFaction,
      mission: this.selectedMission,
      saveData: this.saveData,
    });
  }
}
