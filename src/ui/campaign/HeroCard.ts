/**
 * HeroCard — the hub's hero pilot card: portrait, name, title and the two
 * active powers with their key, rank (or LOCKED and when it unlocks) and a
 * one-line description.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  FACTION_HEROES,
  POWER_UNLOCK_SCHEDULE,
} from "../../data/campaign/heroPowers";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";

/** Card layout (screen px). */
export const HERO_CARD_LAYOUT = {
  x: 688,
  top: 104,
  width: 264,
  height: 330,
  padding: 12,
  header: 28,
  portrait: 72,
  powerTop: 112,
  powerGap: 100,
} as const;
/** Key of each power slot (default bindings). */
const KEYS = ["V", "B"] as const;
const FALLBACK_PORTRAIT = "portrait_command";

/**
 * @param slot - Power slot.
 * @returns Missions needed before it unlocks.
 */
function unlockAt(slot: 0 | 1): number {
  return (
    POWER_UNLOCK_SCHEDULE.find((s) => s.slot === slot && s.rank === 1)
      ?.completedMissions ?? 0
  );
}

/**
 * @param scene - Owning scene.
 * @param factionId - Campaign faction.
 * @param ranks - Saved hero power ranks.
 * @param accent - Faction accent.
 * @returns The card.
 */
export function createHeroCard(
  scene: Phaser.Scene,
  factionId: FactionId,
  ranks: Readonly<Record<string, number>>,
  accent: number,
): HoloPanel {
  const L = HERO_CARD_LAYOUT;
  const hero = FACTION_HEROES[factionId];
  const panel = createHoloPanel(
    scene,
    L.x + L.width / 2,
    L.top + L.height / 2,
    {
      width: L.width,
      height: L.height,
      accentColor: accent,
      title: "HERO",
    },
  );
  const left = -L.width / 2 + L.padding;
  const top = -L.height / 2 + L.header + L.padding;
  const portrait = scene.textures.exists(hero.portraitKey)
    ? hero.portraitKey
    : FALLBACK_PORTRAIT;
  panel.add([
    scene.add
      .image(left + L.portrait / 2, top + L.portrait / 2, portrait)
      .setDisplaySize(L.portrait, L.portrait),
    addHoloText(scene, left + L.portrait + 10, top + 8, hero.name, {
      size: 16,
      weight: "600",
    }),
    addHoloText(
      scene,
      left + L.portrait + 10,
      top + 30,
      hero.title.toUpperCase(),
      { ...CAMPAIGN_TEXT.caption, color: accent },
    ),
  ]);
  hero.powers.forEach((power, i) => {
    const y = -L.height / 2 + L.powerTop + i * L.powerGap;
    const rank = ranks[power.id] ?? 0;
    const status =
      rank > 0
        ? `RANK ${"I".repeat(rank)}`
        : `LOCKED · ${unlockAt(i as 0 | 1)} MISSIONS`;
    panel.add([
      addHoloText(
        scene,
        left,
        y,
        `[${KEYS[i]}]  ${power.glyph}  ${power.name.toUpperCase()}`,
        {
          size: 13,
          weight: "600",
          color: rank > 0 ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
        },
      ),
      addHoloText(scene, left, y + 20, status, {
        ...CAMPAIGN_TEXT.caption,
        color: rank > 0 ? accent : HOLO_PALETTE.textMuted,
      }),
      addHoloText(scene, left, y + 38, power.description, {
        ...CAMPAIGN_TEXT.body,
        size: 12,
        wrapWidth: L.width - L.padding * 2,
      }),
    ]);
  });
  return panel;
}
