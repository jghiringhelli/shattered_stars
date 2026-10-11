/**
 * ArmoryPanel — the hub's Armory tab: one row per slot with its two
 * campaign-only modifications (name, effect, cost, INSTALLED / BUY state)
 * and a free RESPEC button refunding every installed mod.
 */

import type Phaser from "phaser";
import {
  ARMORY_MODS,
  ARMORY_SLOTS,
  type ArmoryMod,
} from "../../data/campaign/armory";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";
import { SelectableCard } from "./SelectableCard";

/** Panel layout (screen px). */
export const ARMORY_LAYOUT = {
  x: 32,
  top: 104,
  width: 640,
  height: 520,
  padding: 16,
  header: 28,
  rowHeight: 104,
  rowGap: 12,
  cardGap: 12,
  cardHeight: 78,
} as const;

/** Inputs of the panel. */
export interface ArmoryPanelConfig {
  readonly credits: number;
  /** Installed mod ids. */
  readonly installed: readonly string[];
  readonly accent: number;
  readonly onToggle: (mod: ArmoryMod) => void;
}

/** Built panel plus its selectable cards. */
export interface ArmoryPanelView {
  readonly panel: HoloPanel;
  readonly cards: SelectableCard[];
}

/**
 * @param scene - Owning scene.
 * @param config - Credits, installed mods, accent, toggle callback.
 * @returns The panel and its cards.
 */
export function createArmoryPanel(
  scene: Phaser.Scene,
  config: ArmoryPanelConfig,
): ArmoryPanelView {
  const L = ARMORY_LAYOUT;
  const panel = createHoloPanel(
    scene,
    L.x + L.width / 2,
    L.top + L.height / 2,
    {
      width: L.width,
      height: L.height,
      accentColor: config.accent,
      title: `ARMORY · ${config.credits} CREDITS`,
    },
  );
  const cards: SelectableCard[] = [];
  const innerWidth = L.width - L.padding * 2;
  const cardWidth = (innerWidth - L.cardGap) / 2;
  ARMORY_SLOTS.forEach((slot, row) => {
    const top =
      -L.height / 2 + L.header + L.padding + row * (L.rowHeight + L.rowGap);
    panel.add(
      addHoloText(
        scene,
        -innerWidth / 2,
        top,
        slot.toUpperCase(),
        CAMPAIGN_TEXT.caption,
      ),
    );
    ARMORY_MODS.filter((m) => m.slot === slot).forEach((mod, col) => {
      const x = -innerWidth / 2 + cardWidth / 2 + col * (cardWidth + L.cardGap);
      const card = modCard(
        scene,
        mod,
        { x, y: top + 18 + L.cardHeight / 2, width: cardWidth },
        config,
      );
      panel.add(card);
      cards.push(card);
    });
  });
  return { panel, cards };
}

/**
 * @param scene - Owning scene.
 * @param mod - The modification.
 * @param place - Card centre and width.
 * @param config - Panel inputs.
 * @returns Its card.
 */
function modCard(
  scene: Phaser.Scene,
  mod: ArmoryMod,
  place: { x: number; y: number; width: number },
  config: ArmoryPanelConfig,
): SelectableCard {
  const L = ARMORY_LAYOUT;
  const installed = config.installed.includes(mod.id);
  const affordable = config.credits >= mod.cost;
  const card = new SelectableCard(
    scene,
    place.x,
    place.y,
    {
      width: place.width,
      height: L.cardHeight,
      accent: config.accent,
      idleBorder: installed ? HOLO_PALETTE.success : HOLO_PALETTE.border,
      ...(installed
        ? { idleFill: { color: HOLO_PALETTE.success, alpha: 0.12 } }
        : {}),
    },
    () => config.onToggle(mod),
  );
  const left = card.left + 10;
  const state = installed
    ? "INSTALLED · CLICK TO REFUND"
    : `BUY · ${mod.cost} CR${affordable ? "" : " (NEED MORE)"}`;
  card.add([
    addHoloText(scene, left, -L.cardHeight / 2 + 8, mod.name, {
      size: 14,
      weight: "600",
    }),
    addHoloText(scene, left, -L.cardHeight / 2 + 28, mod.description, {
      ...CAMPAIGN_TEXT.body,
      size: 12,
      wrapWidth: place.width - 20,
    }),
    addHoloText(scene, left, L.cardHeight / 2 - 18, state, {
      ...CAMPAIGN_TEXT.caption,
      color: installed
        ? HOLO_PALETTE.success
        : affordable
          ? config.accent
          : HOLO_PALETTE.textMuted,
    }),
  ]);
  return card;
}
