import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { ControlsScene } from "./scenes/ControlsScene";
import { HudPreviewScene } from "./scenes/HudPreviewScene";
import { bootstrapPlayerPreferences } from "./ui/settings/settingsRuntime";
import { prepareBoot } from "./compat/bootCompat";
import { guardWebGlStartup } from "./compat/webglFallback";
import { installLazyScenes } from "./scenes/lazy/installLazyScenes";
import { initLocale } from "./i18n";

// Probes WebGL/Canvas/APIs and shows the HTML notice if the browser can't play.
// Canvas is chosen for ?renderer=canvas / webdriver (e2e) and as a no-WebGL fallback.
const boot = prepareBoot(window);
// Player-facing text comes from the message catalog (docs/I18N.md); ?lang=xx overrides the browser language.
initLocale(window);
const config: Phaser.Types.Core.GameConfig = {
  type: boot.renderer === "canvas" ? Phaser.CANVAS : Phaser.AUTO, // AUTO will try WebGL first, then Canvas
  width: 1280,
  height: 720,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  scene: [
    BootScene,
    MainMenuScene,
    SettingsScene,
    CreditsScene,
    ControlsScene,
    ...(import.meta.env.DEV ? [HudPreviewScene] : []),
  ],
  physics: {
    // We don't use physics - movement is chart-based
    default: "arcade",
    arcade: {
      // Disabled but available for debug
      debug: false,
    },
  },
  // 3 concurrent pointers: mouse + two simultaneous touches (dual-stick flight controls).
  // gamepad: true — Phaser's gamepad plugin defaults to OFF; without this, GamepadAdapter's
  // scene.input.gamepad is always undefined and every gamepad binding is silently dead.
  input: {
    activePointers: 3,
    gamepad: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

/** Wires a freshly created game: player preferences, then the DEV-only debugging hooks. */
function adoptGame(game: Phaser.Game): void {
  // Settings (audio buses, palettes, key profile, camera comfort) and the
  // local telemetry log apply from boot, before any scene reads them.
  bootstrapPlayerPreferences(game);
  // Every other scene loads (and registers) on first start: see src/scenes/lazy.
  const lazyScenes = installLazyScenes(game);
  // Expose for debugging and E2E testing in non-production builds
  if (!import.meta.env.DEV) return;
  window.game = game;
  window.ensureScene = (key) => lazyScenes.ensureScene(key);
  window.ensureAllScenes = () => lazyScenes.ensureAll();
  void import("./debug/verifyHooks").then((m) => m.installVerifyHooks(game));
  void import("./debug/perfHooks").then((m) => m.installPerfHooks(game));
  void import("./debug/SessionLogger").then(({ SessionLogger }) => {
    if (!SessionLogger.isEnabled()) return;
    const logger = new SessionLogger();
    logger.start();
    (
      window as unknown as {
        __sessionLogger: InstanceType<typeof SessionLogger>;
      }
    ).__sessionLogger = logger;
  });
}

declare global {
  interface Window {
    game: Phaser.Game;
    /** DEV/e2e: loads a lazily registered scene without starting it. */
    ensureScene: (key: string) => Promise<void>;
    /** DEV/e2e: registers every lazy scene (specs that patch scene instances before starting them). */
    ensureAllScenes: () => Promise<void>;
  }
}

const game = boot.start ? new Phaser.Game(config) : undefined;
if (game) {
  adoptGame(game);
  // A WebGL context that fails while Phaser boots would leave a black page: restart on Canvas.
  if (boot.renderer === "auto") {
    guardWebGlStartup(window, game.events, () => {
      // The failed game never finished booting, so destroy() leaves its canvas behind.
      const staleCanvas = game.canvas;
      game.destroy(true);
      staleCanvas.remove();
      adoptGame(new Phaser.Game({ ...config, type: Phaser.CANVAS }));
    });
  }
}