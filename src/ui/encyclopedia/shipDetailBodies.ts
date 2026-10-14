/**
 * shipDetailBodies — the four tab bodies of the encyclopedia ship detail:
 * OVERVIEW (art, role line, description, aura, key gauges), STATS (the five
 * codex gauges on the standard 1-5 scale), LOADOUT (the signature quick
 * build and its pilot / slots, cycled with arrows) and LORE. Each draws into
 * the panel's body container and explains every stat, tag and slot on hover.
 */

import type Phaser from "phaser";
import { shipArtAssetById } from "../../assets/assetManifest";
import { requestTexture } from "../../assets/textureLoading";
import type { ShipDefinition } from "../../core/types";
import type { EncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { explainBaseShip, explainQuickBuild, shipHint } from "../../data/roleHints";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import { roleTermId, type TermId } from "../../data/tooltips";
import { addCycler } from "../menu/FlatControls";
import { drawHoloFrame, drawHoloGauge } from "../menu/holoChrome";
import { addTipZone } from "../menu/tooltipTargets";
import { addContainedImage, computeLoadoutBonuses } from "../picker/catalogHelpers";
import { drawStatGauges } from "../picker/detailSections";
import { costSummary } from "../picker/guideSections";
import { factionAuraTag, shortDescription } from "../picker/overviewModel";
import { addPickerText, pickerTextStyle } from "../picker/pickerStyle";
import { QuickBuildDetailView } from "../picker/QuickBuildDetailView";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING, SIDE_COLORS } from "../theme/HoloTheme";
import { LORE_STYLE, fitLoreText } from "./loreFit";

/** What every body draws into. */
export interface ShipTabContext {
  readonly scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly bottom: number;
  readonly entry: EncyclopediaEntry;
  readonly def: ShipDefinition;
  readonly accent: number;
  /** Persistent text the overview fills with the signature build hint. */
  readonly hintText: Phaser.GameObjects.Text;
}

/** Overview geometry (px, 8 px grid). */
const OVERVIEW = { artW: 320, artH: 240, gap: 24, artInset: 4 } as const;
/** Stats geometry (px). */
const STATS = { labelW: 128, valueW: 64, rowH: 40, barH: 10, segmentGap: 2 } as const;
/** Codex stat rows: key in the entry, label, colour and tooltip term. */
const STAT_ROWS = [
  { key: "speed", label: "SPEED", color: HOLO_PALETTE.accent, term: "codex.stat_speed" },
  { key: "maneuverability", label: "MANEUVER", color: HOLO_PALETTE.success, term: "codex.stat_maneuver" },
  { key: "attack", label: "ATTACK", color: HOLO_PALETTE.danger, term: "codex.stat_attack" },
  { key: "defense", label: "DEFENSE", color: SIDE_COLORS.ally, term: "codex.stat_defense" },
  { key: "payload", label: "PAYLOAD", color: HOLO_PALETTE.warning, term: "codex.stat_payload" },
] as const satisfies ReadonlyArray<{ key: string; label: string; color: number; term: TermId }>;
/** Stat value at which the capital (1-10) scale applies. */
const CAPITAL_SCALE_MAX = 10;
/** Height of the build cycler (px). */
const CYCLER_H = 32;

/**
 * OVERVIEW: art, the signature build hint, a short description, the faction
 * aura and the four key gauges.
 *
 * @param ctx - Where and what to draw.
 * @param onArtLoaded - Called when the on-demand art arrives.
 */
export function drawOverview(
  ctx: ShipTabContext,
  onArtLoaded: () => void,
): void {
  const { scene, container, x, y, width, def } = ctx;
  const art = { x, y, width: OVERVIEW.artW, height: OVERVIEW.artH };
  drawArtFrame(ctx, art, onArtLoaded);
  const left = x + OVERVIEW.artW + OVERVIEW.gap;
  const textW = width - OVERVIEW.artW - OVERVIEW.gap;
  const hint = shipHint(ctx.entry.shipId);
  ctx.hintText
    .setText(`${hint.role}\n${hint.bestWith}`)
    .setPosition(left, y)
    .setWordWrapWidth(textW)
    .setVisible(true);
  const description = scene.add.text(
    left,
    y + ctx.hintText.height + HOLO_SPACING.md,
    shortDescription(def.description),
    pickerTextStyle("body", HOLO_PALETTE.textPrimary, { wordWrap: { width: textW } }),
  );
  const aura = factionAuraTag(def.faction);
  const auraY = description.y + description.height + HOLO_SPACING.md;
  const auraText = scene.add.text(
    left,
    auraY,
    `AURA  ${aura.name}`,
    pickerTextStyle("micro", HOLO_PALETTE.accent, { wordWrap: { width: textW } }),
  );
  container.add([description, auraText]);
  addTipZone(scene, container, { x: left, y: auraY, width: textW, height: auraText.height }, "ui.aura_tag");
  addTipZone(scene, container, { x: left, y, width: textW, height: ctx.hintText.height }, "codex.signature_build");
  const gaugesY = y + OVERVIEW.artH + HOLO_SPACING.xl;
  drawStatGauges(
    { scene, container, x, y: gaugesY, width },
    def,
    computeLoadoutBonuses([]),
  );
}

function drawArtFrame(
  ctx: ShipTabContext,
  rect: { x: number; y: number; width: number; height: number },
  onLoaded: () => void,
): void {
  const { scene, container, entry } = ctx;
  const frame = scene.add.graphics();
  drawHoloFrame(frame, rect, {
    accent: ctx.accent,
    fillAlpha: 0.85,
    borderAlpha: 0.6,
    radius: HOLO_RADIUS.sm,
    cornerTicks: true,
  });
  container.add(frame);
  if (scene.textures.exists(entry.artKey)) {
    const inset = OVERVIEW.artInset * 2;
    container.add(
      addContainedImage(
        scene,
        entry.artKey,
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width - inset,
        rect.height - inset,
      ),
    );
    return;
  }
  const asset = shipArtAssetById(entry.shipId);
  const missing = asset?.key === entry.artKey ? "LOADING ART\u2026" : "[ Art not generated ]";
  container.add(
    addPickerText(scene, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, missing, "small", HOLO_PALETTE.textMuted).setOrigin(0.5),
  );
  if (asset && asset.key === entry.artKey) requestTexture(scene, asset, onLoaded, () => undefined);
}

/**
 * STATS: five gauges on the standard (or capital) scale, then the real
 * numbers in one line.
 *
 * @param ctx - Where and what to draw.
 */
export function drawStats(ctx: ShipTabContext): void {
  const { scene, container, x, y, width, entry, def } = ctx;
  const max = entry.stats.maxStat;
  const gaugeX = x + STATS.labelW;
  const gaugeW = width - STATS.labelW - STATS.valueW - HOLO_SPACING.lg;
  const gauges = scene.add.graphics();
  container.add(gauges);
  STAT_ROWS.forEach((row, i) => {
    const top = y + i * STATS.rowH;
    const value = entry.stats[row.key];
    const mid = top + STATS.rowH / 2;
    drawHoloGauge(gauges, { x: gaugeX, y: mid - STATS.barH / 2, width: gaugeW, height: STATS.barH }, value / max, row.color);
    gauges.fillStyle(HOLO_PALETTE.panelFill, 1);
    for (let s = 1; s < max; s++) {
      gauges.fillRect(gaugeX + (gaugeW * s) / max - STATS.segmentGap / 2, mid - STATS.barH / 2, STATS.segmentGap, STATS.barH);
    }
    container.add([
      addPickerText(scene, { x, y: mid }, row.label, "caption", HOLO_PALETTE.textSecondary).setOrigin(0, 0.5),
      addPickerText(scene, { x: x + width, y: mid }, `${value} / ${max}`, "numeric", HOLO_PALETTE.textPrimary).setOrigin(1, 0.5),
    ]);
    addTipZone(scene, container, { x, y: top, width, height: STATS.rowH - HOLO_SPACING.xs }, row.term);
  });
  const below = y + STAT_ROWS.length * STATS.rowH + HOLO_SPACING.sm;
  const s = def.baseStats;
  const scale = addPickerText(scene, { x: x + width, y: below }, max === CAPITAL_SCALE_MAX ? "\u2605 Capital scale (1-10)" : "Standard scale (1-5)", "small", HOLO_PALETTE.textMuted).setOrigin(1, 0);
  const numbers = addPickerText(scene, { x, y: below }, `HULL ${s.hull} \u00b7 SHIELDS ${s.shields} \u00b7 ATTACK ${s.attack} \u00b7 AGILITY ${s.agility} \u00b7 SPEED ${s.speed.min}\u2013${s.speed.max} \u00b7 ${s.pointCost} pt`, "name", HOLO_PALETTE.textPrimary);
  container.add([scale, numbers]);
  addTipZone(scene, container, { x: scale.x - scale.width, y: below, width: scale.width, height: scale.height }, "codex.stats_scale");
  addTipZone(scene, container, { x, y: below, width: numbers.width, height: numbers.height }, "stat.build_stats");
}

/** What the LOADOUT tab needs beyond the context. */
export interface LoadoutView {
  readonly loadouts: readonly ShipLoadout[];
  readonly index: number;
  readonly onStep: (direction: 1 | -1) => void;
}

/**
 * LOADOUT: a cycler over the ship's quick builds, the selected build's pilot
 * and slots, and its flown cost.
 *
 * @param ctx - Where and what to draw.
 * @param view - The builds and the cycle callback.
 */
export function drawLoadout(ctx: ShipTabContext, view: LoadoutView): void {
  const { scene, container, x, y, width, def } = ctx;
  const loadout = view.loadouts[view.index];
  if (view.loadouts.length > 1) {
    addCycler(scene, container, {
      x,
      y,
      width: Math.min(width, 480),
      height: CYCLER_H,
      label: `${loadout!.name.toUpperCase()}  \u00b7  ${loadout!.pointCost} pt  (${view.index + 1}/${view.loadouts.length})`,
      accent: ctx.accent,
      tip: "codex.signature_build",
      onStep: view.onStep,
    });
  }
  const top = y + (view.loadouts.length > 1 ? CYCLER_H + HOLO_SPACING.lg : 0);
  const bottom = new QuickBuildDetailView(scene, container).render({
    shipId: def.id,
    loadout,
    x,
    y: top,
    width,
  });
  const guide = loadout ? explainQuickBuild(loadout) : explainBaseShip(def.id);
  const cost = addPickerText(scene, { x, y: Math.max(bottom, top) + HOLO_SPACING.lg }, `FLOWN COST  ${costSummary(guide)}`.toUpperCase(), "caption", HOLO_PALETTE.accent);
  container.add(cost);
  addTipZone(scene, container, { x: cost.x, y: cost.y, width: cost.width, height: cost.height }, "ui.cost_breakdown");
}

/**
 * LORE: the ship's story, fitted to the body.
 *
 * @param ctx - Where and what to draw.
 */
export function drawLore(ctx: ShipTabContext): void {
  const { scene, container, x, y, width, bottom, entry, def } = ctx;
  const role = addPickerText(scene, { x, y }, `${def.role.replace(/_/g, " ").toUpperCase()}  \u00b7  ${def.faction.replace(/_/g, " ").toUpperCase()}`, "caption", HOLO_PALETTE.textSecondary);
  const lore = scene.add.text(x, y + HOLO_SPACING.xl, "", {
    ...pickerTextStyle("body", HOLO_PALETTE.textPrimary),
    fontSize: `${LORE_STYLE.sizes[0]}px`,
    wordWrap: { width, useAdvancedWrap: true },
    lineSpacing: LORE_STYLE.lineSpacing,
  });
  fitLoreText(lore, entry.lore, bottom - lore.y);
  container.add([role, lore]);
  addTipZone(scene, container, { x, y, width: role.width, height: role.height }, roleTermId(def.role));
  addTipZone(scene, container, { x, y: lore.y, width, height: lore.height }, "codex.lore");
}
