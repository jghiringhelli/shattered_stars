/**
 * CampaignHub — the campaign hub between missions (SC2-style): tab strip
 * (MISSIONS / ARMORY / RESEARCH), the tab's content panel, the hero card,
 * a free RESPEC on the Armory tab and an EPILOGUE shortcut once the campaign
 * is complete. Presentation only; the scene owns state and persistence.
 */

import type Phaser from "phaser";
import type { CampaignMission, FactionCampaign } from "../../data/CampaignData";
import type { ArmoryMod } from "../../data/campaign/armory";
import type { ResearchPick, ResearchTier } from "../../data/campaign/research";
import type { CampaignSaveData } from "../../systems/CampaignSaveManager";
import { createHoverButton } from "../ButtonFactory";
import type { FocusTarget } from "../menu";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { createArmoryPanel } from "./ArmoryPanel";
import { createMissionMapPanel } from "./CampaignMissionMap";
import { createHeroCard, HERO_CARD_LAYOUT } from "./HeroCard";
import { createResearchPanel } from "./ResearchPanel";

/** Hub tabs. */
export type HubTab = "missions" | "armory" | "research";

/** Tab strip and action buttons (screen px). */
const TABS: readonly { readonly tab: HubTab; readonly label: string }[] = [
  { tab: "missions", label: "MISSIONS" },
  { tab: "armory", label: "ARMORY" },
  { tab: "research", label: "RESEARCH" },
];
const TAB_BUTTON = {
  width: 112,
  height: 32,
  gap: 8,
  right: 1248,
  y: 50,
  font: "600 13px",
} as const;
const ACTION_BUTTON = {
  width: 200,
  height: 40,
  y: 652,
  font: "600 14px",
} as const;
/** Centre x of the content column. */
const CONTENT_CENTRE_X = 352;

/** Hub inputs and callbacks. */
export interface HubConfig {
  readonly campaign: FactionCampaign;
  readonly save: CampaignSaveData;
  readonly accent: number;
  readonly tab: HubTab;
  /** Research option awaiting confirmation ("tierId:A"). */
  readonly pendingResearch: string | null;
  readonly onSelectTab: (tab: HubTab) => void;
  readonly onSelectMission: (mission: CampaignMission) => void;
  readonly onToggleMod: (mod: ArmoryMod) => void;
  readonly onRespec: () => void;
  readonly onPickResearch: (tier: ResearchTier, pick: ResearchPick) => void;
  readonly onEpilogue: () => void;
}

/** Built hub. */
export interface HubView {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly focusTargets: FocusTarget[];
}

/**
 * @param scene - Owning scene.
 * @param config - Campaign, save, tab and callbacks.
 * @returns Created objects and keyboard-focus order.
 */
export function createCampaignHub(
  scene: Phaser.Scene,
  config: HubConfig,
): HubView {
  const tabs = TABS.map(({ tab, label }, i) =>
    createHoverButton(
      scene,
      tabX(i),
      TAB_BUTTON.y,
      {
        width: TAB_BUTTON.width,
        height: TAB_BUTTON.height,
        color: config.accent,
        variant: tab === config.tab ? "primary" : "secondary",
        label,
        font: TAB_BUTTON.font,
      },
      () => config.onSelectTab(tab),
    ),
  );
  const content = createTabContent(scene, config);
  const hero = createHeroCard(
    scene,
    config.save.factionId,
    config.save.heroPowerRanks,
    config.accent,
  );
  const extras: HoloPressButton[] = [];
  if (config.save.campaignComplete) {
    extras.push(
      actionButton(
        scene,
        HERO_CARD_LAYOUT.x + HERO_CARD_LAYOUT.width / 2,
        "EPILOGUE",
        config,
        config.onEpilogue,
      ),
    );
  }
  if (config.tab === "armory")
    extras.push(
      actionButton(
        scene,
        CONTENT_CENTRE_X,
        "RESPEC (FREE)",
        config,
        config.onRespec,
      ),
    );
  return {
    objects: [...tabs, ...content.objects, hero, ...extras],
    focusTargets: [...content.focusTargets, ...extras, ...tabs],
  };
}

/**
 * @param index - Tab index.
 * @returns Its button centre x (right-aligned strip).
 */
function tabX(index: number): number {
  const fromRight = TABS.length - 1 - index;
  return (
    TAB_BUTTON.right -
    TAB_BUTTON.width / 2 -
    fromRight * (TAB_BUTTON.width + TAB_BUTTON.gap)
  );
}

function actionButton(
  scene: Phaser.Scene,
  x: number,
  label: string,
  config: HubConfig,
  onClick: () => void,
): HoloPressButton {
  return createHoverButton(
    scene,
    x,
    ACTION_BUTTON.y,
    {
      width: ACTION_BUTTON.width,
      height: ACTION_BUTTON.height,
      color: config.accent,
      variant: "secondary",
      label,
      font: ACTION_BUTTON.font,
    },
    onClick,
  );
}

function createTabContent(scene: Phaser.Scene, config: HubConfig): HubView {
  if (config.tab === "armory") {
    const view = createArmoryPanel(scene, {
      credits: config.save.credits,
      installed: Object.keys(config.save.armory.installed),
      accent: config.accent,
      onToggle: config.onToggleMod,
    });
    return { objects: [view.panel], focusTargets: view.cards };
  }
  if (config.tab === "research") {
    const view = createResearchPanel(scene, {
      points: config.save.researchPoints,
      choices: config.save.research,
      pending: config.pendingResearch,
      accent: config.accent,
      onPick: config.onPickResearch,
    });
    return { objects: [view.panel], focusTargets: view.cards };
  }
  const map = createMissionMapPanel(scene, {
    campaign: config.campaign,
    save: config.save,
    accent: config.accent,
    onSelectMission: config.onSelectMission,
  });
  return { objects: [map.panel], focusTargets: [...map.focusTargets] };
}
