/**
 * setupMemory — what the game remembers between sessions so setup screens
 * open the way the player left them: per-mode setup (the builder's squads,
 * difficulty, point limit, map and mode settings), saved squads with share
 * codes, and the last launch behind the main menu's CONTINUE LAST. One
 * versioned document per concern through the safe key-value store; anything
 * corrupt or unknown reads as "nothing remembered".
 */

import { browserStore, type KeyValueStore } from "../keyValueStore";

/** Storage keys (the version is part of the key). */
export const SETUP_MEMORY_KEY = "ss_setup_memory_v1";
export const LAST_LAUNCH_KEY = "ss_last_launch_v1";
/** Schema version of both documents. */
export const SETUP_MEMORY_VERSION = 1;

/** A plain value a mode setting may hold. */
export type SettingValue = string | number | boolean;
/** Flat per-mode settings (difficulty, format, boss, faction...). */
export type ModeSettings = Readonly<Record<string, SettingValue>>;

/** One squad of the builder. */
export interface SquadMemory {
  readonly factionId: string;
  readonly controller: string;
  readonly teamId: number;
  readonly ships: readonly string[];
  readonly loadoutChoices: Readonly<Record<string, string>>;
}

/** The builder's remembered state for one game mode. */
export interface BuilderMemory {
  readonly pointLimit: number;
  readonly aiDifficulty: string;
  /** Simple (single ship) flow vs the advanced builder. */
  readonly simpleMode: boolean;
  readonly mapTheme?: string;
  readonly squads: readonly SquadMemory[];
}

/** What CONTINUE LAST starts. */
export interface LastLaunch {
  readonly version: number;
  readonly savedAt: number;
  /** Shown on the card, e.g. "SKIRMISH". */
  readonly label: string;
  readonly scene: string;
  readonly data?: ModeSettings;
  /** A builder battle: relaunch straight into the battle with this config. */
  readonly battleConfig?: unknown;
}

/** Scenes CONTINUE LAST may open (a stored name outside this list is ignored). */
export const LAUNCHABLE_SCENES: readonly string[] = [
  "SquadBuilderScene",
  "SurvivalSetupScene",
  "EpicBattleScene",
  "DogfightScene",
  "AceDuelScene",
  "CampaignScene",
  "ArcadeBattleScene",
  "ContinuousTacticalScene",
];

interface MemoryDocument {
  readonly version: number;
  readonly builders: Readonly<Record<string, BuilderMemory>>;
  readonly modes: Readonly<Record<string, ModeSettings>>;
}

const EMPTY: MemoryDocument = { version: SETUP_MEMORY_VERSION, builders: {}, modes: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSetting(value: unknown): value is SettingValue {
  return ["string", "number", "boolean"].includes(typeof value);
}

function parseSettings(value: unknown): ModeSettings {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => isSetting(v))) as ModeSettings;
}

function parseSquad(value: unknown): SquadMemory | null {
  if (!isRecord(value)) return null;
  const { factionId, controller, teamId, ships, loadoutChoices } = value;
  if (typeof factionId !== "string" || typeof controller !== "string") return null;
  if (typeof teamId !== "number" || !Array.isArray(ships)) return null;
  if (!ships.every((s) => typeof s === "string")) return null;
  const choices = Object.fromEntries(
    Object.entries(isRecord(loadoutChoices) ? loadoutChoices : {}).filter(
      ([, v]) => typeof v === "string",
    ),
  ) as Record<string, string>;
  return { factionId, controller, teamId, ships: ships as string[], loadoutChoices: choices };
}

function parseBuilder(value: unknown): BuilderMemory | null {
  if (!isRecord(value) || !Array.isArray(value.squads)) return null;
  const squads = value.squads.map(parseSquad);
  if (squads.length === 0 || squads.some((s) => s === null)) return null;
  if (typeof value.pointLimit !== "number" || typeof value.aiDifficulty !== "string") return null;
  return {
    pointLimit: value.pointLimit,
    aiDifficulty: value.aiDifficulty,
    simpleMode: value.simpleMode === true,
    ...(typeof value.mapTheme === "string" ? { mapTheme: value.mapTheme } : {}),
    squads: squads as SquadMemory[],
  };
}

function readDocument(store: KeyValueStore): MemoryDocument {
  const raw = store.getItem(SETUP_MEMORY_KEY);
  if (raw === null) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SETUP_MEMORY_VERSION) return EMPTY;
    const builders: Record<string, BuilderMemory> = {};
    for (const [mode, value] of Object.entries(isRecord(parsed.builders) ? parsed.builders : {})) {
      const builder = parseBuilder(value);
      if (builder) builders[mode] = builder;
    }
    const modes: Record<string, ModeSettings> = {};
    for (const [mode, value] of Object.entries(isRecord(parsed.modes) ? parsed.modes : {})) {
      modes[mode] = parseSettings(value);
    }
    return { version: SETUP_MEMORY_VERSION, builders, modes };
  } catch {
    return EMPTY;
  }
}

function writeDocument(store: KeyValueStore, doc: MemoryDocument): void {
  store.setItem(SETUP_MEMORY_KEY, JSON.stringify(doc));
}

/**
 * @param mode - Game mode ("arcade", "epic", "continuous"...).
 * @param store - Storage (default: the browser's safe store).
 * @returns The builder state last launched in that mode, or null.
 */
export function loadBuilderMemory(
  mode: string,
  store: KeyValueStore = browserStore(),
): BuilderMemory | null {
  return readDocument(store).builders[mode] ?? null;
}

/**
 * @param mode - Game mode.
 * @param memory - Builder state to remember.
 * @param store - Storage (default: the browser's safe store).
 */
export function saveBuilderMemory(
  mode: string,
  memory: BuilderMemory,
  store: KeyValueStore = browserStore(),
): void {
  const doc = readDocument(store);
  writeDocument(store, { ...doc, builders: { ...doc.builders, [mode]: memory } });
}

/**
 * @param mode - Mode id ("dogfight", "ace_duel", "boss_raid", "survival").
 * @param store - Storage (default: the browser's safe store).
 * @returns The mode's remembered settings (empty when none).
 */
export function loadModeSettings(
  mode: string,
  store: KeyValueStore = browserStore(),
): ModeSettings {
  return readDocument(store).modes[mode] ?? {};
}

/**
 * Merge settings into the mode's remembered ones.
 *
 * @param mode - Mode id.
 * @param patch - Settings to set.
 * @param store - Storage (default: the browser's safe store).
 */
export function saveModeSettings(
  mode: string,
  patch: ModeSettings,
  store: KeyValueStore = browserStore(),
): void {
  const doc = readDocument(store);
  const merged = { ...(doc.modes[mode] ?? {}), ...patch };
  writeDocument(store, { ...doc, modes: { ...doc.modes, [mode]: merged } });
}

/**
 * Remember what CONTINUE LAST should start.
 *
 * @param launch - Label, scene and optional data / battle config.
 * @param store - Storage (default: the browser's safe store).
 * @param now - Clock (ms).
 */
export function saveLastLaunch(
  launch: Omit<LastLaunch, "version" | "savedAt">,
  store: KeyValueStore = browserStore(),
  now: () => number = Date.now,
): void {
  const record: LastLaunch = { ...launch, version: SETUP_MEMORY_VERSION, savedAt: now() };
  store.setItem(LAST_LAUNCH_KEY, JSON.stringify(record));
}

/**
 * @param store - Storage (default: the browser's safe store).
 * @returns The last launch, or null when absent, invalid or for an unknown scene.
 */
export function loadLastLaunch(
  store: KeyValueStore = browserStore(),
): LastLaunch | null {
  const raw = store.getItem(LAST_LAUNCH_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SETUP_MEMORY_VERSION) return null;
    if (typeof parsed.label !== "string" || typeof parsed.scene !== "string") return null;
    if (!LAUNCHABLE_SCENES.includes(parsed.scene)) return null;
    return {
      version: SETUP_MEMORY_VERSION,
      savedAt: Number(parsed.savedAt) || 0,
      label: parsed.label,
      scene: parsed.scene,
      ...(isRecord(parsed.data) ? { data: parseSettings(parsed.data) } : {}),
      ...(parsed.battleConfig !== undefined ? { battleConfig: parsed.battleConfig } : {}),
    };
  } catch {
    return null;
  }
}
