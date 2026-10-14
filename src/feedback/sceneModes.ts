/**
 * Maps a Phaser scene key to the short mode name used in feedback bundles
 * and issue titles.
 */

const MODE_BY_SCENE: Readonly<Record<string, string>> = {
  MainMenuScene: "menu",
  SettingsScene: "settings",
  CreditsScene: "credits",
  ControlsScene: "controls",
  LobbyScene: "online-lobby",
  SquadBuilderScene: "squad-builder",
  ShipPickerScene: "ship-picker",
  EncyclopediaScene: "encyclopedia",
  FlightSchoolScene: "flight-school",
  DogfightScene: "dogfight",
  AceDuelScene: "ace-duel",
  ArcadeBattleScene: "skirmish",
  EpicBattleScene: "epic",
  ContinuousTacticalScene: "continuous",
  SurvivalSetupScene: "survival",
  SurvivalMapScene: "survival",
  SurvivalScene: "survival",
  SurvivalSummaryScene: "survival",
  CampaignScene: "campaign",
  CampaignBattleScene: "campaign",
  DebriefScene: "campaign",
  CampaignCompleteScene: "campaign",
};

/**
 * @param sceneKey - Phaser scene key.
 * @returns The mode name, or the scene key itself when it is not mapped.
 */
export function describeScene(sceneKey: string): string {
  return MODE_BY_SCENE[sceneKey] ?? sceneKey;
}
