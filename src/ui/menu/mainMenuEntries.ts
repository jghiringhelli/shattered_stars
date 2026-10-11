/**
 * Main-menu entries: label, glyph, one-line briefing and destination scene.
 * Order is load-bearing — e2e helpers click items by index
 * (tests/e2e/helpers/game.ts MENU_POSITIONS).
 */

import type { MenuIconName } from "./MenuIcons";

/** Section a main-menu entry belongs to (drives captions and dividers). */
export type MainMenuGroup = "play" | "network" | "system";

/** One main-menu entry. */
export interface MainMenuEntry {
  readonly label: string;
  readonly icon: MenuIconName;
  /** Friendly one-line description shown in the briefing panel. */
  readonly description: string;
  /** Scene started when the entry is chosen. */
  readonly target: string;
  /** Optional data passed to the target scene. */
  readonly data?: Readonly<Record<string, unknown>>;
  readonly group: MainMenuGroup;
}

/** Caption shown beside the first entry of each group. */
export const MAIN_MENU_GROUP_CAPTIONS: Readonly<Record<MainMenuGroup, string>> =
  {
    play: "PLAY",
    network: "MULTIPLAYER",
    system: "SYSTEM",
  };

/** All main-menu entries in display order. */
export const MAIN_MENU_ENTRIES: ReadonlyArray<MainMenuEntry> = [
  {
    label: "SKIRMISH",
    icon: "crosshair",
    description:
      "Pick a faction and a ship, then jump straight into a real-time battle.",
    target: "SquadBuilderScene",
    data: { initialMode: "arcade" },
    group: "play",
  },
  {
    label: "SURVIVAL",
    icon: "shield",
    description:
      "Hold out against endless waves. Powers, evolutions and wingmen are earned as you survive.",
    target: "SurvivalSetupScene",
    group: "play",
  },
  {
    label: "EPIC FORMAT",
    icon: "fleet",
    description:
      "Build large multi-team fleets — capital ships included — for a full-scale engagement.",
    target: "SquadBuilderScene",
    data: { initialMode: "epic" },
    group: "play",
  },
  {
    label: "BOSS RAID",
    icon: "crown",
    description:
      "Lead a strike wing against a heavily armed capital ship and break its systems.",
    target: "EpicBattleScene",
    group: "play",
  },
  {
    label: "DOGFIGHT",
    icon: "dogfight",
    description:
      "A fast arcade furball. Choose a ship and a quick build, then fly.",
    target: "DogfightScene",
    group: "play",
  },
  {
    label: "ACE DUEL",
    icon: "duel",
    description:
      "Face a named ace one-on-one. Out-fly them before they out-fly you.",
    target: "AceDuelScene",
    group: "play",
  },
  {
    label: "CAMPAIGN",
    icon: "flag",
    description:
      "Follow a faction's story mission by mission. Your pilots level up and evolve.",
    target: "CampaignScene",
    group: "play",
  },
  {
    label: "ONLINE",
    icon: "network",
    description: "Build a squad and battle other pilots over the network.",
    target: "SquadBuilderScene",
    data: { initialMode: "online" },
    group: "network",
  },
  {
    label: "SETTINGS",
    icon: "gear",
    description:
      "Audio, key rebinding, accessibility, gameplay and privacy options.",
    target: "SettingsScene",
    group: "system",
  },
  {
    label: "CONTROLS",
    icon: "gamepad",
    description: "Keyboard, gamepad and touch bindings for every action.",
    target: "ControlsScene",
    group: "system",
  },
  {
    label: "ENCYCLOPEDIA",
    icon: "book",
    description: "Browse every ship: stats, roles and lore.",
    target: "EncyclopediaScene",
    group: "system",
  },
  {
    label: "CREDITS",
    icon: "star",
    description: "The people and tools behind Shattered Stars.",
    target: "CreditsScene",
    group: "system",
  },
];
