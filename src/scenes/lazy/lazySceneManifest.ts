import type { LazySceneManifest } from "./LazySceneRegistry";

/**
 * Every scene except boot, main menu, settings/controls/credits (small, and the settings
 * overlay must open instantly over a paused battle) loads on first use, each in its own chunk. Keys equal the scene class names (and `super({ key })`).
 * The dev-only HudPreviewScene stays eagerly registered in main.ts.
 */
export const LAZY_SCENES = {
  SquadBuilderScene: () => import("../SquadBuilderScene").then((m) => m.SquadBuilderScene),
  ShipPickerScene: () => import("../ShipPickerScene").then((m) => m.ShipPickerScene),
  LobbyScene: () => import("../LobbyScene").then((m) => m.LobbyScene),
  EncyclopediaScene: () => import("../EncyclopediaScene").then((m) => m.EncyclopediaScene),
  FlightSchoolScene: () => import("../FlightSchoolScene").then((m) => m.FlightSchoolScene),
  ContinuousTacticalScene: () =>
    import("../ContinuousTacticalScene").then((m) => m.ContinuousTacticalScene),
  SurvivalScene: () => import("../SurvivalScene").then((m) => m.SurvivalScene),
  SurvivalSetupScene: () => import("../SurvivalSetupScene").then((m) => m.SurvivalSetupScene),
  SurvivalMapScene: () => import("../SurvivalMapScene").then((m) => m.SurvivalMapScene),
  SurvivalSummaryScene: () => import("../SurvivalSummaryScene").then((m) => m.SurvivalSummaryScene),
  EpicBattleScene: () => import("../EpicBattleScene").then((m) => m.EpicBattleScene),
  DogfightScene: () => import("../DogfightScene").then((m) => m.DogfightScene),
  AceDuelScene: () => import("../AceDuelScene").then((m) => m.AceDuelScene),
  CampaignScene: () => import("../CampaignScene").then((m) => m.CampaignScene),
  CampaignBattleScene: () => import("../CampaignBattleScene").then((m) => m.CampaignBattleScene),
  DebriefScene: () => import("../DebriefScene").then((m) => m.DebriefScene),
  CampaignCompleteScene: () =>
    import("../CampaignCompleteScene").then((m) => m.CampaignCompleteScene),
  ArcadeBattleScene: () => import("../ArcadeBattleScene").then((m) => m.ArcadeBattleScene),
} as const satisfies LazySceneManifest;
