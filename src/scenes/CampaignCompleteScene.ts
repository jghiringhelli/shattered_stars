/**
 * CampaignCompleteScene — shown after a faction's final mission is won: the
 * epilogue this playthrough earned (lines change with the story flags the
 * player's choices set) beside a service record, then back to the campaign
 * hub (the playthrough stays saved as complete) or the main menu. Finishing
 * the Coalition (Act V) first asks for the final choice (Answer / Sever /
 * Seal — The Quiet when unity is too low), then shows that ending's epilogue.
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import { COALITION_CAMPAIGN, FACTION_CAMPAIGNS } from "../data/CampaignData";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";
import { ChronicleManager } from "../systems/ChronicleManager";
import { effectiveFlags } from "../campaign/chronicle/chronicleRules";
import {
  endingOptions,
  type EndingOptions,
} from "../campaign/chronicle/endings";
import {
  endingEpilogueLines,
  epilogueLines,
  serviceRecord,
} from "../campaign/hub/campaignCompletion";
import {
  COALITION_SLOT,
  type CampaignSlot,
} from "../campaign/save/campaignSaveTypes";
import { ENDING_TEXT } from "../data/campaign/coalitionEpilogues";
import type { EndingId } from "../data/campaign/crossovers";
import { createEndingChoice } from "../ui/campaign/EndingChoicePanel";
import type { SelectableCard } from "../ui/campaign/SelectableCard";
import type { EpilogueLine } from "../data/campaign/epilogues";
import {
  MenuFocus,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
  MENU_LAYOUT,
} from "../ui/menu";
import { createHoverButton } from "../ui/ButtonFactory";
import { createHoloPanel } from "../ui/hud/HoloPanel";
import { factionAccent, HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "../ui/campaign/campaignUi";
import { audioManager } from "../audio/AudioManager";

/** Layout (screen px). */
const LAYOUT = {
  top: 110,
  height: 470,
  epilogueX: 40,
  epilogueWidth: 720,
  recordX: 790,
  recordWidth: 450,
  padding: 22,
  header: 28,
  lineGap: 14,
  recordRow: 52,
} as const;
const BUTTON = { width: 220, height: 46, gap: 24, font: "600 15px" } as const;
const BACKDROP_TEXTURE = "starfield_deep";

/** Scene input. */
interface CompleteData {
  readonly factionId: FactionId;
  /** The Coalition slot when the Coalition was finished. */
  readonly slot?: CampaignSlot;
}

export class CampaignCompleteScene extends Phaser.Scene {
  private factionId: FactionId = "terran_hegemony";
  private slot: CampaignSlot = "terran_hegemony";
  private menuFocus: MenuFocus | null = null;
  /** Act V ending chosen (null while the choice is open; debug / tests). */
  ending: EndingId | null = null;
  /** What the Chronicle allows at the end of Act V (Coalition only). */
  endingChoices: EndingOptions | null = null;
  private choiceCards: SelectableCard[] = [];
  /** Epilogue lines shown (debug / tests). */
  epilogue: EpilogueLine[] = [];

  constructor() {
    super({ key: "CampaignCompleteScene" });
  }

  create(data: CompleteData): void {
    this.choiceCards = [];
    this.factionId = data?.factionId ?? "terran_hegemony";
    this.slot = data?.slot ?? this.factionId;
    const coalition = this.slot === COALITION_SLOT;
    const save =
      CampaignSaveManager.load(this.slot) ??
      CampaignSaveManager.createNew(this.factionId, [], this.slot);
    const accent = factionAccent(this.factionId);
    const chronicle = ChronicleManager.load();
    const flags = effectiveFlags(save.storyFlags, chronicle);
    this.ending = coalition ? this.resolveEnding(chronicle.ending, flags) : null;
    this.epilogue = coalition
      ? this.ending
        ? endingEpilogueLines(this.ending, flags)
        : []
      : epilogueLines(this.factionId, flags);
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    const campaignName = coalition
      ? COALITION_CAMPAIGN.name
      : FACTION_CAMPAIGNS[this.factionId].name;
    addMenuHeader(this, {
      title: this.ending
        ? ENDING_TEXT[this.ending].title.toUpperCase()
        : "CAMPAIGN COMPLETE",
      subtitle: `${campaignName}  ·  ${coalition && !this.ending ? "The final choice" : "Epilogue"}`,
      accent,
    });
    audioManager.playFactionStinger(this.factionId, "victory");
    if (coalition && !this.ending) this.buildChoice(accent);
    else this.buildEpilogue(accent);
    this.buildRecord(accent, serviceRecord(save));
    this.buildButtons(accent);
    addFooterHint(this, "ENTER to select  ·  ESC for the campaign hub");
    this.input.keyboard?.once("keydown-ESC", () => this.toHub());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menuFocus?.destroy();
      this.menuFocus = null;
      this.choiceCards = [];
    });
  }

  /**
   * @param stored - The ending already recorded in the Chronicle.
   * @param flags - Chronicle flags.
   * @returns The ending to show; a forced Quiet is recorded at once. Null
   *   while the player still has to choose.
   */
  private resolveEnding(
    stored: EndingId | null,
    flags: Readonly<Record<string, boolean>>,
  ): EndingId | null {
    this.endingChoices = endingOptions(flags);
    if (stored) return stored;
    if (!this.endingChoices.forced) return null;
    ChronicleManager.chooseEnding("quiet");
    return "quiet";
  }

  private buildChoice(accent: number): void {
    const view = createEndingChoice(this, {
      options: this.endingChoices!,
      accent,
      onChoose: (ending) => this.chooseEnding(ending),
    });
    this.choiceCards = [...view.cards];
  }

  /** @param ending - The ending the player picks (refused when not allowed). */
  chooseEnding(ending: EndingId): void {
    ChronicleManager.chooseEnding(ending);
    this.scene.restart({ factionId: this.factionId, slot: this.slot });
  }

  private buildEpilogue(accent: number): void {
    const L = LAYOUT;
    const panel = createHoloPanel(
      this,
      L.epilogueX + L.epilogueWidth / 2,
      L.top + L.height / 2,
      {
        width: L.epilogueWidth,
        height: L.height,
        accentColor: accent,
        title: "EPILOGUE",
      },
    );
    let y = -L.height / 2 + L.header + L.padding;
    const left = -L.epilogueWidth / 2 + L.padding;
    for (const line of this.epilogue) {
      const speaker = addHoloText(this, left, y, line.speaker, {
        ...CAMPAIGN_TEXT.caption,
        color: accent,
      });
      const text = addHoloText(this, left, y + 16, line.text, {
        ...CAMPAIGN_TEXT.body,
        color: HOLO_PALETTE.textPrimary,
        wrapWidth: L.epilogueWidth - L.padding * 2,
      });
      panel.add([speaker, text]);
      y += 16 + text.height + L.lineGap;
    }
  }

  private buildRecord(
    accent: number,
    entries: ReturnType<typeof serviceRecord>,
  ): void {
    const L = LAYOUT;
    const panel = createHoloPanel(
      this,
      L.recordX + L.recordWidth / 2,
      L.top + L.height / 2,
      {
        width: L.recordWidth,
        height: L.height,
        accentColor: accent,
        title: "SERVICE RECORD",
      },
    );
    const left = -L.recordWidth / 2 + L.padding;
    entries.forEach((entry, i) => {
      const y = -L.height / 2 + L.header + L.padding + i * L.recordRow;
      panel.add([
        addHoloText(this, left, y, entry.label, CAMPAIGN_TEXT.caption),
        addHoloText(this, left, y + 16, entry.value, {
          ...CAMPAIGN_TEXT.numeric,
          wrapWidth: L.recordWidth - L.padding * 2,
        }),
      ]);
    });
  }

  private buildButtons(accent: number): void {
    const y = this.scale.height - MENU_LAYOUT.primaryInset;
    const cx = this.scale.width / 2;
    const offset = (BUTTON.width + BUTTON.gap) / 2;
    const hub = createHoverButton(
      this,
      cx - offset,
      y,
      {
        width: BUTTON.width,
        height: BUTTON.height,
        color: accent,
        variant: "primary",
        label: "CAMPAIGN HUB",
        font: BUTTON.font,
        icon: "next",
      },
      () => this.toHub(),
    );
    const menu = createHoverButton(
      this,
      cx + offset,
      y,
      {
        width: BUTTON.width,
        height: BUTTON.height,
        color: accent,
        variant: "secondary",
        label: "MAIN MENU",
        font: BUTTON.font,
        icon: "back",
      },
      () => this.scene.start("MainMenuScene"),
    );
    this.menuFocus = new MenuFocus(this, [...this.choiceCards, hub, menu]);
  }

  private toHub(): void {
    this.scene.start("CampaignScene", { factionId: this.factionId });
  }
}
