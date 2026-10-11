import Phaser from "phaser";
import { NetworkService } from "./services/NetworkService";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { SquadBuilderScene } from "./scenes/SquadBuilderScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { ContinuousTacticalScene } from "./scenes/ContinuousTacticalScene";
import { SurvivalScene } from "./scenes/SurvivalScene";
import { SurvivalSetupScene } from "./scenes/SurvivalSetupScene";
import { SurvivalMapScene } from "./scenes/SurvivalMapScene";
import { SurvivalSummaryScene } from "./scenes/SurvivalSummaryScene";
import { EpicBattleScene } from "./scenes/EpicBattleScene";
import { DogfightScene } from "./scenes/DogfightScene";
import { AceDuelScene } from "./scenes/AceDuelScene";
import { CampaignScene } from "./scenes/CampaignScene";
import { CampaignBattleScene } from "./scenes/CampaignBattleScene";
import { DebriefScene } from "./scenes/DebriefScene";
import { CampaignCompleteScene } from "./scenes/CampaignCompleteScene";
import { ArcadeBattleScene } from "./scenes/ArcadeBattleScene";
import { EncyclopediaScene } from "./scenes/EncyclopediaScene";
import { ShipPickerScene } from "./scenes/ShipPickerScene";
import { ControlsScene } from "./scenes/ControlsScene";
import { HudPreviewScene } from "./scenes/HudPreviewScene";
import { FlightSchoolScene } from "./scenes/FlightSchoolScene";
import { bootstrapPlayerPreferences } from "./ui/settings/settingsRuntime";

const forceCanvas =
  typeof window !== "undefined" &&
  (window.location.search.includes("renderer=canvas") ||
    (typeof navigator !== "undefined" && navigator.webdriver === true));
const config: Phaser.Types.Core.GameConfig = {
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO, // AUTO will try WebGL first, then Canvas
  width: 1280,
  height: 720,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  scene: [
    BootScene,
    MainMenuScene,
    SquadBuilderScene,
    SettingsScene,
    CreditsScene,
    LobbyScene,
    ContinuousTacticalScene,
    SurvivalScene,
    SurvivalSetupScene,
    SurvivalMapScene,
    SurvivalSummaryScene,
    EpicBattleScene,
    DogfightScene,
    AceDuelScene,
    CampaignScene,
    CampaignBattleScene,
    DebriefScene,
    CampaignCompleteScene,
    ArcadeBattleScene,
    EncyclopediaScene,
    ShipPickerScene,
    ControlsScene,
    FlightSchoolScene,
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

const game = new Phaser.Game(config);
// Settings (audio buses, palettes, key profile, camera comfort) and the
// local telemetry log apply from boot, before any scene reads them.
bootstrapPlayerPreferences(game);

// Expose for debugging and E2E testing in non-production builds
declare global {
  interface Window {
    game: Phaser.Game;
    networkService: NetworkService;
  }
}
if (import.meta.env.DEV) {
  window.game = game;
  window.networkService = NetworkService.getInstance();
  void import("./debug/verifyHooks").then((m) => m.installVerifyHooks(game));
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
