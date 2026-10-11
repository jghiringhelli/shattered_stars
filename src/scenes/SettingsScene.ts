/**
 * Settings Scene — every player preference in one screen, saved on change.
 *
 * Tabs: Audio · Controls (keyboard rebinding, profiles) · Gamepad ·
 * Accessibility (colour vision, high contrast, shake, flashes, text size) ·
 * Gameplay · Advanced (local telemetry export/clear, reset all).
 * Keys: 1–6 tabs, ↑/↓ select, ←/→ adjust, ENTER toggle/rebind, ESC / B /
 * right-click back. Launched over a battle (`returnScene`) it closes back
 * onto the paused battle and re-binds that battle's keyboard.
 */

import Phaser from "phaser";
import { rebuildSceneInput } from "../input/activeBindings";
import { chordFromKeyEvent, type KeyChord } from "../input/KeyBindings";
import { loadSettings, type GameSettings } from "../systems/SettingsStorage";
import { createHoloPanel } from "../ui/hud/HoloPanel";
import { MenuFocus, type FocusTarget } from "../ui/menu/MenuFocus";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
} from "../ui/menu/MenuScaffold";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
} from "../ui/menu/menuTransitions";
import { buildControlsTab, buildGamepadTab } from "../ui/settings/controlsTabs";
import { commitSettings } from "../ui/settings/settingsRuntime";
import { SettingsChoiceRow } from "../ui/settings/settingsChoiceRows";
import { SettingsSliderRow } from "../ui/settings/settingsRows";
import {
  buildAccessibilityTab,
  buildAdvancedTab,
  buildAudioTab,
  buildGameplayTab,
} from "../ui/settings/settingsTabs";
import {
  SETTINGS_TABS,
  type NoticeTone,
  type SettingsTabContext,
  type SettingsTabId,
} from "../ui/settings/settingsTabContext";
import { createSettingsTabBar } from "../ui/settings/SettingsTabBar";
import { holoFont } from "../ui/theme/holoFont";
import { HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { toCssColor } from "../ui/theme/colorMath";

/** Content panel geometry (1280×720). */
const PANEL = {
  top: 140,
  bottom: 660,
  marginX: 96,
  inset: 20,
  noticeY: 676,
} as const;
const NOTICE_SIZE = 13;
/** DOM keyCode of Escape (cancels key capture). */
const ESC_KEY_CODE = 27;

/**
 * Phaser can deliver one physical key event more than once — even re-emit
 * an older queued event a frame later (see MenuFocus); wrap a handler so it
 * only runs for events newer than the last one it handled.
 *
 * @param handler - Key handler.
 * @returns The guarded handler.
 */
function firstDelivery(
  handler: (event: KeyboardEvent) => void,
): (event: KeyboardEvent) => void {
  let lastTimeStamp = -Infinity;
  return (event) => {
    if (event.timeStamp <= lastTimeStamp) return;
    lastTimeStamp = event.timeStamp;
    handler(event);
  };
}

const BUILDERS: Readonly<
  Record<SettingsTabId, (ctx: SettingsTabContext) => void>
> = {
  audio: buildAudioTab,
  controls: buildControlsTab,
  gamepad: buildGamepadTab,
  accessibility: buildAccessibilityTab,
  gameplay: buildGameplayTab,
  advanced: buildAdvancedTab,
};

/** Scene start data. */
interface SettingsSceneData {
  readonly returnScene?: string;
  readonly tab?: SettingsTabId;
  /** Skip the fade (tab switch / rebuild). */
  readonly instant?: boolean;
}

export class SettingsScene extends Phaser.Scene {
  private settings: GameSettings = loadSettings();
  private returnScene: string | null = null;
  private tab: SettingsTabId = "audio";
  private instant = false;
  private controlsChanged = false;
  private targets: FocusTarget[] = [];
  private focus: MenuFocus | null = null;
  private capturing = false;
  private notice: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "SettingsScene" });
  }

  init(data: SettingsSceneData = {}): void {
    this.returnScene = data.returnScene ?? null;
    this.tab = data.tab ?? "audio";
    this.instant = data.instant ?? false;
    this.capturing = false;
  }

  create(): void {
    this.settings = loadSettings();
    this.targets = [];
    addMenuBackdrop(this, { textureId: "nebula_blue" });
    addMenuHeader(this, {
      title: "Settings",
      subtitle: "Saved automatically · applies everywhere",
    });
    const back = addBackButton(this, () => this.exitSettings());
    createSettingsTabBar(this, this.tab, (tab) => this.openTab(tab));
    this.createContent();
    this.focus = new MenuFocus(this, [...this.targets, back], {
      isActive: () => !this.capturing,
    });
    this.notice = this.add
      .text(
        this.scale.width / 2,
        PANEL.noticeY,
        "",
        holoFont(NOTICE_SIZE, "600"),
      )
      .setOrigin(0.5);
    addFooterHint(
      this,
      "1–6  TABS      ↑ ↓  SELECT      ← →  ADJUST      ENTER  TOGGLE / REBIND      ESC  BACK",
    );
    this.setupInput();
    if (!this.instant) fadeInMenu(this);
  }

  /** The open tab (e2e / debugging). */
  get activeTab(): SettingsTabId {
    return this.tab;
  }

  /** Keyboard-focusable controls of the open tab, in order (e2e / debugging). */
  get focusTargets(): readonly FocusTarget[] {
    return this.targets;
  }

  private createContent(): void {
    const { width } = this.scale;
    const panelWidth = width - PANEL.marginX * 2;
    createHoloPanel(this, width / 2, (PANEL.top + PANEL.bottom) / 2, {
      width: panelWidth,
      height: PANEL.bottom - PANEL.top,
    });
    BUILDERS[this.tab](
      this.tabContext({
        x: PANEL.marginX + PANEL.inset,
        y: PANEL.top + PANEL.inset,
        width: panelWidth - PANEL.inset * 2,
        height: PANEL.bottom - PANEL.top - PANEL.inset * 2,
      }),
    );
  }

  private tabContext(area: SettingsTabContext["area"]): SettingsTabContext {
    return {
      scene: this,
      area,
      settings: () => this.settings,
      update: (next) => this.updateSettings(next),
      rebuild: () => this.openTab(this.tab),
      addFocus: (target) => this.targets.push(target),
      captureKey: (onChord, onDone) => this.captureKey(onChord, onDone),
      notify: (message, tone) => this.showNotice(message, tone),
    };
  }

  private updateSettings(next: GameSettings): void {
    if (next.controls !== this.settings.controls) this.controlsChanged = true;
    this.settings = next;
    commitSettings(next, this.registry);
  }

  private openTab(tab: SettingsTabId): void {
    const data: SettingsSceneData = {
      ...(this.returnScene ? { returnScene: this.returnScene } : {}),
      tab,
      instant: true,
    };
    this.scene.restart(data);
  }

  private showNotice(message: string, tone: NoticeTone = "info"): void {
    const color =
      tone === "warning" ? HOLO_PALETTE.warning : HOLO_PALETTE.accent;
    this.notice?.setText(message).setColor(toCssColor(color));
  }

  /**
   * Wait for the next real key chord; modifiers alone keep waiting, ESC
   * cancels. Armed on the next tick so the ENTER that opened it is ignored.
   *
   * @param onChord - Receives the chord pressed.
   * @param onDone - Called when capture ends (chord or cancel).
   */
  private captureKey(
    onChord: (chord: KeyChord) => void,
    onDone: () => void,
  ): void {
    const keyboard = this.input.keyboard;
    if (!keyboard || this.capturing) return;
    this.capturing = true;
    const finish = (): void => {
      keyboard.off("keydown", listener);
      onDone();
      // Cleared next tick so the same ESC press does not also leave Settings.
      this.time.delayedCall(0, () => (this.capturing = false));
    };
    const armedAt = performance.now();
    const listener = (event: KeyboardEvent): void => {
      // Ignore re-delivered events from before capture was armed.
      if (event.timeStamp < armedAt) return;
      event.preventDefault();
      if (event.keyCode === ESC_KEY_CODE) {
        this.showNotice("Rebinding cancelled.");
        finish();
        return;
      }
      const chord = chordFromKeyEvent(event);
      if (!chord) return;
      onChord(chord);
      finish();
    };
    this.time.delayedCall(0, () => keyboard.on("keydown", listener));
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    bindMenuBack(this, () => this.exitSettings(), {
      isActive: () => !this.capturing,
    });
    keyboard.on(
      "keydown-LEFT",
      firstDelivery(() => this.adjustFocused(-1)),
    );
    keyboard.on(
      "keydown-RIGHT",
      firstDelivery(() => this.adjustFocused(1)),
    );
    keyboard.on(
      "keydown",
      firstDelivery((event) => {
        if (this.capturing) return;
        const tab = SETTINGS_TABS[Number.parseInt(event.key, 10) - 1];
        if (tab && tab.id !== this.tab) this.openTab(tab.id);
      }),
    );
  }

  private adjustFocused(steps: number): void {
    if (this.capturing) return;
    const row = this.targets[this.focus?.focusedIndex ?? -1];
    if (row instanceof SettingsSliderRow || row instanceof SettingsChoiceRow)
      row.adjust(steps);
  }

  private exitSettings(): void {
    if (this.returnScene) {
      const battle = this.scene.get(this.returnScene);
      if (this.controlsChanged && battle) rebuildSceneInput(battle);
      this.scene.stop();
      return;
    }
    goToScene(this, "MainMenuScene");
  }
}
