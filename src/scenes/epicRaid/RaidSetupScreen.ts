/**
 * RaidSetupScreen — the Boss Raid briefing screen in the holographic look:
 * target (boss) and difficulty pickers in HoloPanels, a target-intel panel
 * with the boss's real-time hull/shields, BEGIN ASSAULT and BACK buttons.
 * Shown at camera zoom 1.0 so the buttons hit-test.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import type { EpicDifficulty } from "../../arcade/systems/EpicAiFlight";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { createHoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import {
  BOSS_DEFINITIONS,
  BOSS_FACTIONS,
  RAID_DIFFICULTIES,
  raidIntelLines,
} from "./bossDefinitions";

/** Screen layout (px). The start button's spot is read by e2e specs. */
const LAYOUT = {
  titleY: 34,
  subtitleY: 74,
  columnOffsetX: 200,
  pickerTop: 108,
  pickerWidth: 300,
  optionWidth: 260,
  optionHeight: 36,
  optionPitch: 45,
  pickerHeaderAllowance: 46,
  intelY: 448,
  intelWidth: 700,
  intelHeight: 112,
  intelLinePitch: 24,
  startFromBottom: 100,
  startWidth: 240,
  startHeight: 60,
  backX: 80,
  backY: 40,
  backWidth: 120,
  backHeight: 40,
} as const;
/** Size boost of the screen title over the "title" role. */
const TITLE_SCALE = 1.5;

/** Current choices and what the screen's controls do. */
export interface RaidSetupConfig {
  readonly scene: Phaser.Scene;
  readonly bossFaction: FactionId;
  readonly difficulty: EpicDifficulty;
  readonly onSelectBoss: (faction: FactionId) => void;
  readonly onSelectDifficulty: (difficulty: EpicDifficulty) => void;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

/**
 * Build the setup screen.
 *
 * @param config - Choices and callbacks.
 * @returns Root container (screen space); destroy it to dismiss the screen.
 */
export function buildRaidSetupScreen(
  config: RaidSetupConfig,
): Phaser.GameObjects.Container {
  const { scene } = config;
  const { width, height } = scene.scale;
  const backdrop = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0.85)
    .setOrigin(0);
  const root = scene.add.container(0, 0, [backdrop]);
  root.add(headerTexts(scene, width / 2));
  root.add(bossPicker(config, width / 2 - LAYOUT.columnOffsetX));
  root.add(difficultyPicker(config, width / 2 + LAYOUT.columnOffsetX));
  root.add(intelPanel(config, width / 2));
  root.add(navigationButtons(config, width / 2, height));
  return root.setDepth(HOLO_DEPTH.menuPanel).setScrollFactor(0, 0, true);
}

function headerTexts(
  scene: Phaser.Scene,
  centerX: number,
): Phaser.GameObjects.Text[] {
  const title = createHoloText(
    scene,
    centerX,
    LAYOUT.titleY,
    "CAPITAL ASSAULT",
    "title",
    HOLO_PALETTE.danger,
  );
  title.setScale(TITLE_SCALE);
  const subtitle = createHoloText(
    scene,
    centerX,
    LAYOUT.subtitleY,
    "Destroy the enemy capital ship",
    "body",
    HOLO_PALETTE.textSecondary,
  );
  return [title, subtitle];
}

/** A picker column: a titled panel with one option button per choice. */
function pickerColumn<T>(
  scene: Phaser.Scene,
  x: number,
  title: string,
  options: readonly { readonly id: T; readonly label: string }[],
  selected: T,
  onPick: (id: T) => void,
): Phaser.GameObjects.GameObject[] {
  const height =
    LAYOUT.pickerHeaderAllowance + options.length * LAYOUT.optionPitch;
  const panel = createHoloPanel(scene, x, LAYOUT.pickerTop + height / 2, {
    width: LAYOUT.pickerWidth,
    height,
    title,
  });
  const firstY =
    LAYOUT.pickerTop +
    LAYOUT.pickerHeaderAllowance +
    LAYOUT.optionPitch / 2 -
    6;
  const buttons = options.map((option, index) =>
    createHoloButton(
      scene,
      x,
      firstY + index * LAYOUT.optionPitch,
      {
        width: LAYOUT.optionWidth,
        height: LAYOUT.optionHeight,
        label: option.label,
        variant: option.id === selected ? "primary" : "secondary",
        font: '600 15px "Segoe UI", Roboto, Arial, sans-serif',
      },
      () => onPick(option.id),
    ).setFocused(option.id === selected),
  );
  return [panel, ...buttons];
}

function bossPicker(
  config: RaidSetupConfig,
  x: number,
): Phaser.GameObjects.GameObject[] {
  const options = BOSS_FACTIONS.map((faction) => ({
    id: faction,
    label: BOSS_DEFINITIONS[faction].name,
  }));
  return pickerColumn(
    config.scene,
    x,
    "Select target",
    options,
    config.bossFaction,
    config.onSelectBoss,
  );
}

function difficultyPicker(
  config: RaidSetupConfig,
  x: number,
): Phaser.GameObjects.GameObject[] {
  const options = RAID_DIFFICULTIES.map((d) => ({
    id: d.id,
    label: `${d.name} (${d.multiplier}x)`,
  }));
  return pickerColumn(
    config.scene,
    x,
    "Difficulty",
    options,
    config.difficulty,
    config.onSelectDifficulty,
  );
}

function intelPanel(
  config: RaidSetupConfig,
  centerX: number,
): Phaser.GameObjects.GameObject[] {
  const { scene } = config;
  const panel = createHoloPanel(scene, centerX, LAYOUT.intelY, {
    width: LAYOUT.intelWidth,
    height: LAYOUT.intelHeight,
    title: `Target intel — ${BOSS_DEFINITIONS[config.bossFaction].name}`,
    accentColor: HOLO_PALETTE.danger,
  });
  const top = LAYOUT.intelY + panel.contentTop + LAYOUT.intelLinePitch / 2;
  const lines = raidIntelLines(config.bossFaction, config.difficulty).map(
    (line, index) =>
      createHoloText(
        scene,
        centerX,
        top + index * LAYOUT.intelLinePitch,
        line,
        "body",
      ),
  );
  return [panel, ...lines];
}

function navigationButtons(
  config: RaidSetupConfig,
  centerX: number,
  height: number,
): Phaser.GameObjects.GameObject[] {
  const start = createHoloButton(
    config.scene,
    centerX,
    height - LAYOUT.startFromBottom,
    {
      width: LAYOUT.startWidth,
      height: LAYOUT.startHeight,
      label: "Begin assault",
      variant: "primary",
    },
    config.onStart,
  );
  const back = createHoloButton(
    config.scene,
    LAYOUT.backX,
    LAYOUT.backY,
    {
      width: LAYOUT.backWidth,
      height: LAYOUT.backHeight,
      label: "< Back",
      variant: "secondary",
    },
    config.onBack,
  );
  return [start, back];
}
