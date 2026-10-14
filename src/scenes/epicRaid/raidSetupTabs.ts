/**
 * raidSetupTabs — the three tab bodies of the Boss Raid setup: the target
 * list with the selected boss's numbers, what the boss does, and the raid
 * difficulty. Each draws into the screen's root container and explains its
 * numbers on hover.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import type { EpicDifficulty } from "../../arcade/systems/EpicAiFlight";
import { addSelectable } from "../../ui/menu/FlatControls";
import { addTipZone } from "../../ui/menu/tooltipTargets";
import { addPickerText, pickerTextStyle } from "../../ui/picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import {
  BOSS_DEFINITIONS,
  BOSS_FACTIONS,
  RAID_DIFFICULTIES,
} from "./bossDefinitions";
import {
  BOSS_ABILITY_LINES,
  RAID_DIFFICULTY_LINES,
  bossKeyNumbers,
  bossSectionLines,
} from "./raidSetupModel";

/** Current choices and what the screen controls do. */
export interface RaidSetupConfig {
  readonly scene: Phaser.Scene;
  readonly bossFaction: FactionId;
  readonly difficulty: EpicDifficulty;
  readonly onSelectBoss: (faction: FactionId) => void;
  readonly onSelectDifficulty: (difficulty: EpicDifficulty) => void;
  /** A tab was opened: the owner rebuilds the screen. */
  readonly onSelectTab: () => void;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

/** Where a tab body draws. */
export interface RaidArea {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Geometry (px, 8 px grid). */
const GRID = {
  listW: 440,
  rowH: 48,
  rowPitch: 56,
  cardGap: 40,
  numberPitch: 176,
  abilityPitch: 72,
  matchW: 640,
  matchChipH: 40,
} as const;
const DIFFICULTY_TERMS = {
  easy: "raid.diff_easy",
  medium: "raid.diff_medium",
  hard: "raid.diff_hard",
  mythic: "raid.diff_mythic",
} as const;

/**
 * OVERVIEW: the five bosses as rows, the selected boss's key numbers.
 *
 * @param area - Where to draw.
 * @param config - Choices and callbacks.
 */
export function drawTargetTab(area: RaidArea, config: RaidSetupConfig): void {
  const { scene, root } = area;
  BOSS_FACTIONS.forEach((faction, i) => {
    const hull = bossKeyNumbers(faction, config.difficulty).hull;
    addSelectable(scene, root, {
      x: area.x,
      y: area.y + i * GRID.rowPitch,
      width: GRID.listW,
      height: GRID.rowH,
      label: BOSS_DEFINITIONS[faction].name,
      detail: `hull ${hull}`,
      detailRole: "small",
      selected: faction === config.bossFaction,
      accent: HOLO_PALETTE.danger,
      tip: "raid.target",
      onPress: () => config.onSelectBoss(faction),
    });
  });
  drawBossCard(area, config, area.x + GRID.listW + GRID.cardGap);
}

function drawBossCard(
  area: RaidArea,
  config: RaidSetupConfig,
  left: number,
): void {
  const { scene, root } = area;
  const boss = BOSS_DEFINITIONS[config.bossFaction];
  const numbers = bossKeyNumbers(config.bossFaction, config.difficulty);
  const title = addPickerText(scene, { x: left, y: area.y }, boss.name, "title", HOLO_PALETTE.danger);
  root.add(title);
  addTipZone(scene, root, { x: left, y: area.y, width: title.width, height: title.height }, "raid.intel");
  const top = area.y + HOLO_SPACING.xxl + HOLO_SPACING.sm;
  [
    { label: "HULL", value: numbers.hull },
    { label: "SHIELDS", value: numbers.shields },
    { label: "ARMOR", value: numbers.armor },
  ].forEach((stat, i) => {
    const x = left + i * GRID.numberPitch;
    root.add([
      addPickerText(scene, { x, y: top }, String(stat.value), "title", HOLO_PALETTE.textPrimary),
      addPickerText(scene, { x, y: top + HOLO_SPACING.xl }, stat.label, "caption", HOLO_PALETTE.textSecondary),
    ]);
  });
  addTipZone(scene, root, { x: left, y: top, width: GRID.numberPitch * 3, height: HOLO_SPACING.xxl + HOLO_SPACING.lg }, "raid.boss_stats");
  const lines = [
    { text: `Sections: ${boss.sections.map((s) => s.name).join(", ")}`, term: "raid.boss_sections" },
    { text: `Escorts: ${boss.escortCount} fighters`, term: "raid.escorts" },
  ] as const;
  lines.forEach((line, i) => {
    const y = top + HOLO_SPACING.xxl * 2 + i * HOLO_SPACING.xxl;
    const text = scene.add.text(left, y, line.text, pickerTextStyle("body", HOLO_PALETTE.textSecondary));
    root.add(text);
    addTipZone(scene, root, { x: left, y, width: text.width, height: text.height }, line.term);
  });
}

/**
 * ABILITIES: what the boss does and what each of its sections is for.
 *
 * @param area - Where to draw.
 * @param config - Choices and callbacks.
 */
export function drawAbilitiesTab(area: RaidArea, config: RaidSetupConfig): void {
  const { scene, root } = area;
  BOSS_ABILITY_LINES.forEach((ability, i) => {
    const y = area.y + i * GRID.abilityPitch;
    root.add([
      addPickerText(scene, { x: area.x, y }, ability.name, "caption", HOLO_PALETTE.danger),
      scene.add.text(area.x, y + HOLO_SPACING.xl, ability.line, pickerTextStyle("body", HOLO_PALETTE.textPrimary, { wordWrap: { width: area.width } })),
    ]);
    addTipZone(scene, root, { x: area.x, y, width: area.width, height: GRID.abilityPitch - HOLO_SPACING.sm }, "raid.boss_abilities");
  });
  const top = area.y + BOSS_ABILITY_LINES.length * GRID.abilityPitch + HOLO_SPACING.lg;
  root.add(addPickerText(scene, { x: area.x, y: top }, `SECTIONS OF THE ${BOSS_DEFINITIONS[config.bossFaction].name.toUpperCase()}`, "caption", HOLO_PALETTE.textSecondary));
  bossSectionLines(config.bossFaction, config.difficulty).forEach((line, i) => {
    const y = top + HOLO_SPACING.xl + i * HOLO_SPACING.xl;
    const text = scene.add.text(area.x, y, line, pickerTextStyle("body", HOLO_PALETTE.textPrimary));
    root.add(text);
    addTipZone(scene, root, { x: area.x, y, width: text.width, height: text.height }, "raid.boss_sections");
  });
}

/**
 * MATCH: the raid difficulty chips with what they do to the boss.
 *
 * @param area - Where to draw.
 * @param config - Choices and callbacks.
 */
export function drawMatchTab(area: RaidArea, config: RaidSetupConfig): void {
  const { scene, root } = area;
  const left = area.x + (area.width - GRID.matchW) / 2;
  root.add(addPickerText(scene, { x: left, y: area.y }, "RAID DIFFICULTY", "caption", HOLO_PALETTE.textSecondary));
  const gap = HOLO_SPACING.sm;
  const width = (GRID.matchW - gap * (RAID_DIFFICULTIES.length - 1)) / RAID_DIFFICULTIES.length;
  RAID_DIFFICULTIES.forEach((option, i) => {
    addSelectable(scene, root, {
      x: left + i * (width + gap),
      y: area.y + HOLO_SPACING.xl,
      width,
      height: GRID.matchChipH,
      label: `${option.name.toUpperCase()} ${option.multiplier}x`,
      selected: option.id === config.difficulty,
      accent: HOLO_PALETTE.danger,
      tip: DIFFICULTY_TERMS[option.id],
      onPress: () => config.onSelectDifficulty(option.id as EpicDifficulty),
    });
  });
  const textY = area.y + HOLO_SPACING.xl + GRID.matchChipH + HOLO_SPACING.md;
  const numbers = bossKeyNumbers(config.bossFaction, config.difficulty);
  root.add([
    scene.add.text(left, textY, RAID_DIFFICULTY_LINES[config.difficulty], pickerTextStyle("body", HOLO_PALETTE.textPrimary, { wordWrap: { width: GRID.matchW } })),
    addPickerText(scene, { x: left, y: textY + HOLO_SPACING.xxl + HOLO_SPACING.sm }, `${BOSS_DEFINITIONS[config.bossFaction].name}: hull ${numbers.hull} \u00b7 shields ${numbers.shields} \u00b7 armor ${numbers.armor}`, "name", HOLO_PALETTE.danger),
  ]);
}
