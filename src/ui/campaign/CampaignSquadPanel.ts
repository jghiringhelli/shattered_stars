/**
 * CampaignSquadPanel — right-hand panel of the hub: the squadron with ONE
 * tab open at a time (progressive disclosure):
 *
 *   OVERVIEW  campaign totals and the roster (click a pilot to inspect them)
 *   STATS     the selected pilot's ship numbers
 *   LOADOUT   their equipped abilities and slots
 *   PILOT     skill, experience, next unlock and role
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type {
  CampaignPilotState,
  CampaignSaveData,
} from "../../systems/CampaignSaveManager";
import { getPilotDefinition } from "../../systems/CampaignPilotManager";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawDetailTabs } from "../menu/DetailTabs";
import { tabsFor } from "../menu/detailTabsModel";
import type { FocusTarget } from "../menu/MenuFocus";
import { addTipZone, focusTipTarget } from "../menu/tooltipTargets";
import { addPickerText, drawPickerCard } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import type { CampaignPanelTabs } from "./campaignTabsModel";
import { toneColor } from "./OptionRows";
import {
  ROSTER_ROW_STRIDE,
  rosterRows,
  type RosterRow,
  squadPanelHeight,
  squadTotals,
} from "./squadModel";
import { drawPilotTab, type SquadBodyBox } from "./SquadPilotTabs";

/** Sidebar layout (screen coordinates, 8 px grid). */
export const SQUAD_PANEL_LAYOUT = {
  right: 1248,
  top: 104,
  width: 264,
  padding: 16,
  thumbWidth: 32,
  thumbHeight: 40,
  textGap: 12,
  totalsRow: 24,
} as const;

/** Fallback portrait texture. */
const DEFAULT_PORTRAIT = "portrait_command";

/** Built sidebar. */
export interface CampaignSidebar {
  readonly panels: HoloPanel[];
  readonly focusTargets: FocusTarget[];
}

/**
 * Build the squadron panel.
 *
 * @param scene - Owning scene.
 * @param factionId - Campaign faction.
 * @param save - Campaign save.
 * @param accent - Faction accent.
 * @param tabs - Tab state of the hub's tabbed panels.
 * @returns The panel and its focus targets.
 */
export function createCampaignSidebar(
  scene: Phaser.Scene,
  factionId: FactionId,
  save: CampaignSaveData,
  accent: number,
  tabs: CampaignPanelTabs,
): CampaignSidebar {
  const L = SQUAD_PANEL_LAYOUT;
  const pilots = save.campaignPilots;
  const height = squadPanelHeight(pilots.length);
  const panel = createHoloPanel(scene, L.right - L.width / 2, L.top + height / 2, {
    width: L.width,
    height,
    accentColor: accent,
  });
  panel.setSize(L.width, height);
  const x = -L.width / 2 + L.padding;
  const width = L.width - L.padding * 2;
  const open = tabs.tabOf("squad");
  const bar =
    pilots.length === 0
      ? null
      : drawDetailTabs(scene, panel, {
          x,
          y: panel.contentTop,
          width,
          accent,
          tabs: tabsFor("campaignSquad"),
          active: open,
          compact: true,
          showKeyHint: false,
          onSelect: (tab) => tabs.onSelect("squad", tab),
        });
  const top = (bar?.bottom ?? panel.contentTop) + L.padding;
  const box = { scene, container: panel, x, y: top, width, accent };
  const focusTargets = bar ? [...bar.focusTargets] : [];
  const selected =
    pilots.find((p) => p.pilotId === tabs.pilotId) ?? pilots[0] ?? null;
  if (open === "overview" || selected === null) {
    focusTargets.push(...drawOverview(box, factionId, save, tabs));
  } else {
    focusTargets.push(drawPilotHeader(box, factionId, pilots, selected, tabs));
    drawPilotTab(
      { ...box, y: box.y + L.thumbHeight + HOLO_SPACING.md },
      open,
      factionId,
      selected,
    );
  }
  return { panels: [panel], focusTargets };
}

function drawOverview(
  box: SquadBodyBox,
  factionId: FactionId,
  save: CampaignSaveData,
  tabs: CampaignPanelTabs,
): FocusTarget[] {
  const { scene, container, x, y, width } = box;
  const L = SQUAD_PANEL_LAYOUT;
  const cell = width / 2;
  squadTotals(save).forEach((total, i) => {
    const cx = x + (i % 2) * cell;
    const cy = y + Math.floor(i / 2) * L.totalsRow;
    const text = addPickerText(scene, { x: cx, y: cy }, total.text, "numeric", HOLO_PALETTE.textPrimary);
    container.add(text);
    addTipZone(scene, container, { x: cx, y: cy, width: cell, height: L.totalsRow }, total.term);
  });
  const rowsTop = y + L.totalsRow * 2 + HOLO_SPACING.lg;
  const selectedId = tabs.pilotId ?? save.campaignPilots[0]?.pilotId;
  return rosterRows(factionId, save.campaignPilots).map((row, i) =>
    drawRosterRow(box, factionId, row, {
      y: rowsTop + i * ROSTER_ROW_STRIDE,
      selected: row.pilotId === selectedId,
      onSelect: () => tabs.onSelectPilot(row.pilotId),
    }),
  );
}

/** Veterans stand out; a rookie row stays readable instead of muted. */
function rowColor(row: RosterRow, accent: number): number {
  return row.tone === "muted" ? HOLO_PALETTE.textPrimary : toneColor(row.tone, accent);
}

function portraitOf(
  scene: Phaser.Scene,
  factionId: FactionId,
  pilotId: string,
): string {
  const key = getPilotDefinition(factionId, pilotId)?.portraitKey;
  return key && scene.textures.exists(key) ? key : DEFAULT_PORTRAIT;
}

function drawRosterRow(
  box: SquadBodyBox,
  factionId: FactionId,
  row: RosterRow,
  place: { y: number; selected: boolean; onSelect: () => void },
): FocusTarget {
  const { scene, container, x, width, accent } = box;
  const L = SQUAD_PANEL_LAYOUT;
  const rect = { x, y: place.y, width, height: L.thumbHeight };
  const frame = scene.add.graphics();
  const paint = (state: "idle" | "hover" | "selected"): void => {
    frame.clear();
    if (state !== "idle") drawPickerCard(frame, rect, state, accent);
  };
  paint(place.selected ? "selected" : "idle");
  const textX = x + L.thumbWidth + L.textGap;
  const label = addPickerText(scene, { x: textX, y: place.y + HOLO_SPACING.md }, row.text, "name", rowColor(row, accent));
  label.setWordWrapWidth(width - L.thumbWidth - L.textGap);
  container.add([
    frame,
    scene.add
      .image(x + L.thumbWidth / 2, place.y + L.thumbHeight / 2, portraitOf(scene, factionId, row.pilotId))
      .setDisplaySize(L.thumbWidth, L.thumbHeight),
    label,
  ]);
  const zone = addTipZone(scene, container, rect, "campaign.pilot_row", place.onSelect);
  zone.on("pointerover", () => paint(place.selected ? "selected" : "hover"));
  zone.on("pointerout", () => paint(place.selected ? "selected" : "idle"));
  zone.on("focuschanged", (focused: boolean) =>
    paint(place.selected ? "selected" : focused ? "hover" : "idle"),
  );
  return focusTipTarget(zone, place.onSelect);
}

function drawPilotHeader(
  box: SquadBodyBox,
  factionId: FactionId,
  pilots: readonly CampaignPilotState[],
  selected: CampaignPilotState,
  tabs: CampaignPanelTabs,
): FocusTarget {
  const { scene, container, x, y, width } = box;
  const L = SQUAD_PANEL_LAYOUT;
  const callsign =
    getPilotDefinition(factionId, selected.pilotId)?.callsign ??
    selected.pilotId.toUpperCase();
  const next = pilots[(pilots.indexOf(selected) + 1) % pilots.length]!;
  container.add([
    scene.add
      .image(x + L.thumbWidth / 2, y + L.thumbHeight / 2, portraitOf(scene, factionId, selected.pilotId))
      .setDisplaySize(L.thumbWidth, L.thumbHeight),
    addPickerText(scene, { x: x + L.thumbWidth + L.textGap, y: y + HOLO_SPACING.md }, callsign, "name", HOLO_PALETTE.textPrimary),
  ]);
  const cycle = (): void => tabs.onSelectPilot(next.pilotId);
  const zone = addTipZone(scene, container, { x, y, width, height: L.thumbHeight }, "campaign.pilot_row", cycle);
  return focusTipTarget(zone, cycle);
}
