/**
 * Settings Scene
 *
 * Audio levels and visual options, saved on every change. Holo layout: two
 * side-by-side panels (AUDIO / VISUAL) of keyboard-focusable rows —
 * ↑/↓ select, ←/→ adjust a slider, ENTER flips a switch, ESC goes back.
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import {
  DEFAULT_SETTINGS,
  loadSettings as loadStoredSettings,
  saveSettings as saveToStorage,
} from "../systems/SettingsStorage";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
} from "../ui/menu/MenuScaffold";
import { createHoloPanel } from "../ui/hud/HoloPanel";
import { MenuFocus, type FocusTarget } from "../ui/menu/MenuFocus";
import { drawMenuIcon, type MenuIconName } from "../ui/menu/MenuIcons";
import {
  SETTINGS_ROW,
  SettingsSliderRow,
  SettingsSwitchRow,
} from "../ui/settings/settingsRows";
import { HOLO_PALETTE, HOLO_SPACING } from "../ui/theme/HoloTheme";

type MutableSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: boolean;
  showDamageNumbers: boolean;
  showMinimap: boolean;
};

/** Panel grid. */
const SETTINGS_LAYOUT = {
  panelWidth: 400,
  panelGap: 40,
  panelTop: 200,
  headerHeight: 28,
  rowGap: HOLO_SPACING.xs,
  inset: HOLO_SPACING.sm,
  iconSize: 14,
  /** Header icon centre, measured from the panel's right edge. */
  iconInset: 20,
  rowsPerPanel: 3,
} as const;

/** A panel's rows to build: label + kind. */
interface PanelSpec {
  readonly title: string;
  readonly icon: MenuIconName;
  readonly centerX: number;
}

export class SettingsScene extends Phaser.Scene {
  private settings: MutableSettings = { ...DEFAULT_SETTINGS };
  private returnScene: string | null = null;
  private rows: FocusTarget[] = [];
  private focus: MenuFocus | null = null;

  constructor() {
    super({ key: "SettingsScene" });
  }

  init(data: { returnScene?: string } = {}): void {
    this.returnScene = data.returnScene ?? null;
  }

  create(): void {
    addMenuBackdrop(this, { textureId: "nebula_blue" });
    this.loadSettings();
    addMenuHeader(this, {
      title: "Settings",
      subtitle: "Audio and display preferences — saved automatically",
    });
    this.rows = [];
    this.createSettingsUI();
    const back = addBackButton(this, () => this.exitSettings());
    this.focus = new MenuFocus(this, [...this.rows, back]);
    addFooterHint(
      this,
      "↑ ↓  SELECT        ← →  ADJUST        ENTER  TOGGLE        ESC  BACK",
    );
    this.setupInput();
  }

  private createSettingsUI(): void {
    const cx = this.scale.width / 2;
    const offset = (SETTINGS_LAYOUT.panelWidth + SETTINGS_LAYOUT.panelGap) / 2;
    this.createAudioSection({
      title: "Audio",
      icon: "speaker",
      centerX: cx - offset,
    });
    this.createVisualSection({
      title: "Visual",
      icon: "eye",
      centerX: cx + offset,
    });
  }

  /**
   * Draw a section panel and return the row placement helper.
   *
   * @param spec - Title, icon and horizontal centre.
   * @returns Row (x, y, width) for each row index.
   */
  private createPanel(spec: PanelSpec): (index: number) => {
    x: number;
    y: number;
    width: number;
  } {
    const { panelWidth, panelTop, headerHeight, rowGap, inset } =
      SETTINGS_LAYOUT;
    const rowsHeight =
      SETTINGS_LAYOUT.rowsPerPanel * (SETTINGS_ROW.height + rowGap) - rowGap;
    const height = headerHeight + inset * 2 + rowsHeight;
    createHoloPanel(this, spec.centerX, panelTop + height / 2, {
      width: panelWidth,
      height,
      title: spec.title,
    });
    const icon = this.add.graphics();
    drawMenuIcon(
      icon,
      spec.icon,
      {
        x: spec.centerX + panelWidth / 2 - SETTINGS_LAYOUT.iconInset,
        y: panelTop + headerHeight / 2,
      },
      SETTINGS_LAYOUT.iconSize,
      HOLO_PALETTE.accent,
    );
    const left = spec.centerX - panelWidth / 2 + inset;
    return (index) => ({
      x: left,
      y:
        panelTop +
        headerHeight +
        inset +
        index * (SETTINGS_ROW.height + rowGap),
      width: panelWidth - inset * 2,
    });
  }

  /**
   * Audio panel: master, music and SFX sliders.
   *
   * @param spec - Panel title/icon/centre.
   */
  private createAudioSection(spec: PanelSpec): void {
    const at = this.createPanel(spec);
    const slider = (
      index: number,
      label: string,
      value: number,
      apply: (v: number) => void,
    ): void => {
      this.rows.push(
        new SettingsSliderRow(this, { ...at(index), label }, value, (v) => {
          apply(v);
          this.saveSettings();
        }),
      );
    };
    slider(0, "Master Volume", this.settings.masterVolume, (v) => {
      this.settings.masterVolume = v;
      audioManager.setMasterVolume(v);
    });
    slider(1, "Music Volume", this.settings.musicVolume, (v) => {
      this.settings.musicVolume = v;
      audioManager.setMusicVolume(v);
    });
    slider(2, "SFX Volume", this.settings.sfxVolume, (v) => {
      this.settings.sfxVolume = v;
      audioManager.setSfxVolume(v);
    });
  }

  /**
   * Visual panel: camera shake, damage numbers, minimap switches.
   *
   * @param spec - Panel title/icon/centre.
   */
  private createVisualSection(spec: PanelSpec): void {
    const at = this.createPanel(spec);
    const toggle = (
      index: number,
      label: string,
      value: boolean,
      apply: (v: boolean) => void,
    ): void => {
      this.rows.push(
        new SettingsSwitchRow(this, { ...at(index), label }, value, (v) => {
          apply(v);
          this.saveSettings();
        }),
      );
    };
    toggle(0, "Camera Shake", this.settings.cameraShake, (v) => {
      this.settings.cameraShake = v;
    });
    toggle(1, "Damage Numbers", this.settings.showDamageNumbers, (v) => {
      this.settings.showDamageNumbers = v;
    });
    toggle(2, "Minimap", this.settings.showMinimap, (v) => {
      this.settings.showMinimap = v;
    });
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    keyboard.on("keydown-ESC", () => {
      this.exitSettings();
    });
    keyboard.on("keydown-LEFT", () => this.adjustFocused(-1));
    keyboard.on("keydown-RIGHT", () => this.adjustFocused(1));
  }

  private adjustFocused(steps: number): void {
    const row = this.rows[this.focus?.focusedIndex ?? -1];
    if (row instanceof SettingsSliderRow) row.adjust(steps);
  }

  private exitSettings(): void {
    if (this.returnScene) {
      this.scene.stop();
    } else {
      this.scene.start("MainMenuScene");
    }
  }

  private loadSettings(): void {
    this.settings = { ...loadStoredSettings() };
    audioManager.setMasterVolume(this.settings.masterVolume);
    audioManager.setMusicVolume(this.settings.musicVolume);
    audioManager.setSfxVolume(this.settings.sfxVolume);
  }

  private saveSettings(): void {
    saveToStorage(this.settings);
    this.registry.set("settings", this.settings);
  }
}
