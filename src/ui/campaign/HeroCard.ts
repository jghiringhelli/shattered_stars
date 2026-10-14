/**
 * HeroCard — the hub's hero pilot card with ONE tab open at a time
 * (progressive disclosure):
 *
 *   OVERVIEW  portrait, name, title and the two powers with key and rank
 *   EFFECTS   what each power does and what every rank adds, in numbers
 *   LORE      the campaign's story and who it follows
 *
 * Every line explains itself on hover (short) or hold / focus (full).
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { FACTION_HEROES } from "../../data/campaign/heroPowers";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawDetailTabs } from "../menu/DetailTabs";
import { tabsFor, type DetailTabId } from "../menu/detailTabsModel";
import type { FocusTarget } from "../menu/MenuFocus";
import { addTipZone } from "../menu/tooltipTargets";
import { addPickerText } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import {
  heroLoreLines,
  heroOverview,
  powerRankLines,
  powerTooltip,
  type PowerOverview,
} from "./heroCardModel";

/** Card layout (screen px, 8 px grid). */
export const HERO_CARD_LAYOUT = {
  x: 688,
  top: 104,
  width: 264,
  height: 328,
  padding: 16,
  portrait: 72,
} as const;

/** Inputs of the card. */
export interface HeroCardConfig {
  readonly factionId: FactionId;
  /** Saved hero power ranks by power id. */
  readonly ranks: Readonly<Record<string, number>>;
  readonly accent: number;
  /** The campaign's description and protagonist line (lore tab). */
  readonly lore: {
    readonly description: string;
    readonly protagonist: string;
  };
  readonly tab: DetailTabId;
  readonly onSelectTab: (tab: DetailTabId) => void;
}

/** Built card plus its keyboard-focus targets (the tabs). */
export interface HeroCardView {
  readonly panel: HoloPanel;
  readonly focusTargets: FocusTarget[];
}

const FALLBACK_PORTRAIT = "portrait_command";
/** Gap between stacked blocks (px). */
const BLOCK_GAP = HOLO_SPACING.lg;

interface Body {
  readonly scene: Phaser.Scene;
  readonly panel: HoloPanel;
  readonly config: HeroCardConfig;
  /** Left edge, top and width of the body (panel coordinates). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/**
 * @param scene - Owning scene.
 * @param config - Faction, ranks, accent, lore, open tab and callback.
 * @returns The card and its focus targets.
 */
export function createHeroCard(
  scene: Phaser.Scene,
  config: HeroCardConfig,
): HeroCardView {
  const L = HERO_CARD_LAYOUT;
  const panel = createHoloPanel(scene, L.x + L.width / 2, L.top + L.height / 2, {
    width: L.width,
    height: L.height,
    accentColor: config.accent,
  });
  const x = -L.width / 2 + L.padding;
  const width = L.width - L.padding * 2;
  const tabs = drawDetailTabs(scene, panel, {
    x,
    y: panel.contentTop,
    width,
    accent: config.accent,
    tabs: tabsFor("heroCard"),
    active: config.tab,
    compact: true,
    showKeyHint: false,
    onSelect: config.onSelectTab,
  });
  const body: Body = { scene, panel, config, x, y: tabs.bottom + L.padding, width };
  if (config.tab === "overview") drawOverview(body);
  else if (config.tab === "effects") drawEffects(body);
  else drawLore(body);
  return { panel, focusTargets: tabs.focusTargets };
}

function drawOverview(body: Body): void {
  const { scene, panel, config, x, y, width } = body;
  const L = HERO_CARD_LAYOUT;
  const hero = FACTION_HEROES[config.factionId];
  const overview = heroOverview(hero, config.ranks);
  const portrait = scene.textures.exists(hero.portraitKey)
    ? hero.portraitKey
    : FALLBACK_PORTRAIT;
  const textX = x + L.portrait + HOLO_SPACING.md;
  const textWidth = width - L.portrait - HOLO_SPACING.md;
  const name = addPickerText(scene, { x: textX, y }, overview.name, "title", HOLO_PALETTE.textPrimary);
  name.setWordWrapWidth(textWidth);
  const title = addPickerText(
    scene,
    { x: textX, y: y + name.height + HOLO_SPACING.xs },
    overview.title.toUpperCase(),
    "caption",
    config.accent,
  );
  title.setWordWrapWidth(textWidth);
  panel.add([
    scene.add
      .image(x + L.portrait / 2, y + L.portrait / 2, portrait)
      .setDisplaySize(L.portrait, L.portrait),
    name,
    title,
  ]);
  addTipZone(scene, panel, { x, y, width, height: L.portrait }, "campaign.hero_title");
  let cursor = y + L.portrait + BLOCK_GAP;
  for (const power of overview.powers) cursor = drawPowerLine(body, power, cursor);
}

function drawPowerLine(body: Body, power: PowerOverview, y: number): number {
  const { scene, panel, x, width } = body;
  const line = addPickerText(
    scene,
    { x, y },
    power.line,
    "name",
    power.locked ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
  );
  line.setWordWrapWidth(width);
  panel.add(line);
  addTipZone(scene, panel, { x, y, width, height: line.height }, powerTooltip(power));
  return y + line.height + BLOCK_GAP;
}

function drawEffects(body: Body): void {
  const { scene, panel, config, x, width } = body;
  const overview = heroOverview(FACTION_HEROES[config.factionId], config.ranks);
  let y = body.y;
  for (const power of overview.powers) {
    const head = addPickerText(
      scene,
      { x, y },
      `[${power.key}]  ${power.power.glyph}  ${power.power.name.toUpperCase()}`,
      "name",
      power.locked ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
    );
    const description = addPickerText(
      scene,
      { x, y: y + head.height + HOLO_SPACING.xs },
      power.power.description,
      "small",
      HOLO_PALETTE.textSecondary,
    );
    description.setWordWrapWidth(width);
    const ranksY = description.y + description.height + HOLO_SPACING.xs;
    const ranks = addPickerText(
      scene,
      { x, y: ranksY },
      powerRankLines(power.power).join("\n"),
      "small",
      config.accent,
    );
    ranks.setLineSpacing(HOLO_SPACING.xs);
    panel.add([head, description, ranks]);
    addTipZone(scene, panel, { x, y, width, height: ranksY - y }, powerTooltip(power));
    addTipZone(scene, panel, { x, y: ranksY, width, height: ranks.height }, "campaign.hero_rank");
    y = ranksY + ranks.height + BLOCK_GAP;
  }
}

function drawLore(body: Body): void {
  const { scene, panel, config, x, y, width } = body;
  const lore = heroLoreLines(config.lore);
  const story = addPickerText(scene, { x, y }, lore.story, "body", HOLO_PALETTE.textSecondary);
  story.setWordWrapWidth(width);
  const castY = y + story.height + BLOCK_GAP;
  const cast = addPickerText(scene, { x, y: castY }, lore.cast, "name", config.accent);
  cast.setWordWrapWidth(width);
  panel.add([story, cast]);
  addTipZone(scene, panel, { x, y, width, height: story.height }, "campaign.hero_lore");
  addTipZone(scene, panel, { x, y: castY, width, height: cast.height }, "campaign.hero_arc");
}
