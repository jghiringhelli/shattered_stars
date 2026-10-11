/**
 * Settings tab builders: Audio, Accessibility, Gameplay and Advanced.
 * (Controls and Gamepad live in controlsTabs.ts.) Each builder creates its
 * rows inside the context's content area, registers them for keyboard
 * focus and writes every change through `ctx.update` (persist + apply).
 */

import {
  COLOR_VISION_MODES,
  DEFAULT_SETTINGS,
  DIFFICULTY_LEVELS,
  TEXT_SCALES,
  type AccessibilityPrefs,
  type AudioPrefs,
  type ColorVisionMode,
  type GameplayPrefs,
} from "../../systems/SettingsStorage";
import {
  clearTelemetry,
  exportTelemetryJson,
  telemetryEvents,
} from "../../telemetry/telemetry";
import { createHoverButton } from "../ButtonFactory";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { downloadTextFile } from "./downloadFile";
import { openTelemetryStats } from "../telemetry/TelemetryStatsScene";
import { PalettePreview } from "./PalettePreview";
import { SettingsChoiceRow } from "./settingsChoiceRows";
import { SettingsSliderRow, SettingsSwitchRow } from "./settingsRows";
import {
  gridRow,
  type RowGrid,
  type SettingsTabContext,
} from "./settingsTabContext";

const ONE_COLUMN: RowGrid = { columns: 1, rowHeight: 60, gap: 8, width: 560 };
/** Horizontal inset that centres a 560-px column in the content area. */
function centeredArea(
  ctx: SettingsTabContext,
  width: number,
): SettingsTabContext["area"] {
  const { area } = ctx;
  return { ...area, x: area.x + (area.width - width) / 2, width };
}

const VISION_LABELS: Readonly<Record<ColorVisionMode, string>> = {
  normal: "Standard",
  protanopia: "Protanopia",
  deuteranopia: "Deuteranopia",
  tritanopia: "Tritanopia",
};

const BUTTON = { width: 240, height: 40, font: "600 14px" } as const;
const INFO_SIZE = 13;
const PREVIEW_WIDTH = 330;

function patchAudio(ctx: SettingsTabContext, patch: Partial<AudioPrefs>): void {
  const s = ctx.settings();
  ctx.update({ ...s, audio: { ...s.audio, ...patch } });
}

function patchAccessibility(
  ctx: SettingsTabContext,
  patch: Partial<AccessibilityPrefs>,
): void {
  const s = ctx.settings();
  ctx.update({ ...s, accessibility: { ...s.accessibility, ...patch } });
}

function patchGameplay(
  ctx: SettingsTabContext,
  patch: Partial<GameplayPrefs>,
): void {
  const s = ctx.settings();
  ctx.update({ ...s, gameplay: { ...s.gameplay, ...patch } });
}

/**
 * Audio: master, music, SFX and UI volume buses.
 *
 * @param ctx - Tab context.
 */
export function buildAudioTab(ctx: SettingsTabContext): void {
  const area = centeredArea(ctx, ONE_COLUMN.width ?? 0);
  const { audio } = ctx.settings();
  const sliders: ReadonlyArray<[string, keyof AudioPrefs]> = [
    ["Master Volume", "master"],
    ["Music Volume", "music"],
    ["Effects Volume", "sfx"],
    ["Interface Volume", "ui"],
  ];
  sliders.forEach(([label, key], row) => {
    const config = gridRow(area, ONE_COLUMN, { column: 0, row, label });
    ctx.addFocus(
      new SettingsSliderRow(ctx.scene, config, audio[key], (v) =>
        patchAudio(ctx, { [key]: v }),
      ),
    );
  });
}

/**
 * Accessibility: colour vision, high-contrast HUD, shake, flashes, text
 * size — with a live HUD glyph preview.
 *
 * @param ctx - Tab context.
 */
export function buildAccessibilityTab(ctx: SettingsTabContext): void {
  const { area } = ctx;
  const rowsArea = { ...area, width: area.width - PREVIEW_WIDTH - 24 };
  const preview = new PalettePreview(ctx.scene, {
    x: area.x + area.width - PREVIEW_WIDTH,
    y: area.y,
    width: PREVIEW_WIDTH,
    height: 300,
  });
  const grid: RowGrid = { columns: 1, rowHeight: 60, gap: 6 };
  const at = (row: number, label: string) =>
    gridRow(rowsArea, grid, { column: 0, row, label });
  const a = ctx.settings().accessibility;
  const after = (patch: Partial<AccessibilityPrefs>): void => {
    patchAccessibility(ctx, patch);
    preview.redraw();
  };
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(0, "Colour Vision"),
      COLOR_VISION_MODES.map((value) => ({
        value,
        label: VISION_LABELS[value],
      })),
      a.colorVision,
      (colorVision) => after({ colorVision }),
    ),
  );
  ctx.addFocus(
    new SettingsSwitchRow(
      ctx.scene,
      at(1, "High-Contrast HUD"),
      a.highContrastHud,
      (v) => after({ highContrastHud: v }),
    ),
  );
  ctx.addFocus(
    new SettingsSliderRow(
      ctx.scene,
      at(2, "Screen Shake"),
      a.screenShake,
      (v) => after({ screenShake: v }),
    ),
  );
  ctx.addFocus(
    new SettingsSwitchRow(
      ctx.scene,
      at(3, "Reduce Flashes"),
      a.reduceFlashes,
      (v) => after({ reduceFlashes: v }),
    ),
  );
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(4, "HUD Text Size"),
      TEXT_SCALES.map((value) => ({
        value,
        label: `${Math.round(value * 100)}%`,
      })),
      a.textScale,
      (textScale) => after({ textScale }),
    ),
  );
}

/**
 * Gameplay: default difficulty, squad mark assist, damage numbers, minimap.
 *
 * @param ctx - Tab context.
 */
export function buildGameplayTab(ctx: SettingsTabContext): void {
  const area = centeredArea(ctx, ONE_COLUMN.width ?? 0);
  const at = (row: number, label: string) =>
    gridRow(area, ONE_COLUMN, { column: 0, row, label });
  const g = ctx.settings().gameplay;
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(0, "Default Difficulty"),
      DIFFICULTY_LEVELS.map((value) => ({ value, label: value })),
      g.defaultDifficulty,
      (defaultDifficulty) => patchGameplay(ctx, { defaultDifficulty }),
    ),
  );
  const toggles: ReadonlyArray<
    [string, "markAssist" | "showDamageNumbers" | "showMinimap"]
  > = [
    ["Wingmen Mark Assist", "markAssist"],
    ["Damage Numbers", "showDamageNumbers"],
    ["Minimap", "showMinimap"],
  ];
  toggles.forEach(([label, key], i) => {
    ctx.addFocus(
      new SettingsSwitchRow(ctx.scene, at(i + 1, label), g[key], (v) =>
        patchGameplay(ctx, { [key]: v }),
      ),
    );
  });
}

/**
 * Advanced: local telemetry opt-in, export / clear the log, reset all.
 *
 * @param ctx - Tab context.
 */
export function buildAdvancedTab(ctx: SettingsTabContext): void {
  const area = centeredArea(ctx, ONE_COLUMN.width ?? 0);
  const s = ctx.settings();
  ctx.addFocus(
    new SettingsSwitchRow(
      ctx.scene,
      gridRow(area, ONE_COLUMN, {
        column: 0,
        row: 0,
        label: "Local Telemetry",
      }),
      s.privacy.telemetryEnabled,
      (telemetryEnabled) =>
        ctx.update({ ...ctx.settings(), privacy: { telemetryEnabled } }),
    ),
  );
  const infoY = area.y + ONE_COLUMN.rowHeight + 24;
  ctx.scene.add
    .text(
      area.x + area.width / 2,
      infoY,
      `${telemetryEvents().length} events stored on this device only — never uploaded.\nExport them to attach to a playtest report.`,
      {
        ...holoFont(INFO_SIZE, "400"),
        color: toCssColor(HOLO_PALETTE.textSecondary),
        align: "center",
      },
    )
    .setOrigin(0.5, 0);
  const buttonY = infoY + 70;
  const cx = area.x + area.width / 2;
  const button = (
    y: number,
    label: string,
    onPress: () => void,
    color = HOLO_PALETTE.panelFill,
  ) =>
    ctx.addFocus(
      createHoverButton(
        ctx.scene,
        cx,
        y,
        { ...BUTTON, label, color, variant: "secondary" },
        onPress,
      ),
    );
  button(buttonY, "EXPORT LOG (JSON)", () => {
    downloadTextFile("shattered-stars-telemetry.json", exportTelemetryJson());
    ctx.notify("Telemetry log exported.");
  });
  button(buttonY + 52, "CLEAR LOG", () => {
    clearTelemetry();
    ctx.notify("Telemetry log cleared.");
    ctx.rebuild();
  });
  button(buttonY + 104, "RESET ALL SETTINGS", () => {
    ctx.update(DEFAULT_SETTINGS);
    ctx.notify("All settings restored to defaults.", "warning");
    ctx.rebuild();
  });
  button(buttonY + 156, "VIEW STATS", () => openTelemetryStats(ctx.scene));
}
