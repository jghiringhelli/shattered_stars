/**
 * DogfightSetupView — the Dogfight setup screen in the holographic style:
 * match format, both ships (four per faction) with their factions, AI
 * difficulty and FIGHT!. Pure view: it reads a state snapshot and reports
 * choices through callbacks; the scene owns the state and re-renders.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { getShipsByFaction } from "../../data/ShipDefinitions";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { SIDE_COLORS } from "../../ui/theme/HoloTheme";
import {
  addBackButton,
  addControlsFooter,
  addHoloToggle,
  addSectionCaption,
  addSetupBackdrop,
  addSetupPanel,
  addSetupTitle,
  sizeHoloLabel,
  type TrackSetupObject,
} from "./holoSetupKit";

/** Best-of formats. */
export type DogfightFormat = "best_of_3" | "best_of_5";
/** AI difficulty settings. */
export type DogfightDifficulty = "easy" | "normal" | "hard" | "brutal";

/** What the setup screen shows. */
export interface DogfightSetupState {
  readonly matchFormat: DogfightFormat;
  readonly playerFaction: FactionId;
  readonly enemyFaction: FactionId;
  readonly playerShipId: string;
  readonly enemyShipId: string;
  readonly difficulty: DogfightDifficulty;
}

/** What the player can do on it. */
export interface DogfightSetupActions {
  readonly selectFormat: (format: DogfightFormat) => void;
  readonly selectShip: (owner: "player" | "enemy", shipId: string) => void;
  readonly selectFaction: (
    owner: "player" | "enemy",
    faction: FactionId,
  ) => void;
  readonly selectDifficulty: (difficulty: DogfightDifficulty) => void;
  readonly start: () => void;
  readonly back: () => void;
}

const FORMATS: ReadonlyArray<{ id: DogfightFormat; name: string }> = [
  { id: "best_of_3", name: "Best of 3" },
  { id: "best_of_5", name: "Best of 5" },
];
const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];
const FACTION_SHORT: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "Heg",
  free_confederation: "Con",
  synthetic_collective: "Col",
  void_corsairs: "Cor",
  ascendant_empire: "Emp",
};
const DIFFICULTIES: readonly DogfightDifficulty[] = [
  "easy",
  "normal",
  "hard",
  "brutal",
];
/** Ships listed per faction. */
const SHIPS_LISTED = 4;

/** Screen layout (px). */
const LAYOUT = {
  formatCaptionY: 118,
  formatY: 146,
  formatPitch: 160,
  format: { width: 144, height: 32 },
  panelOffsetX: 170,
  panel: { top: 184, width: 290, height: 312 },
  shipFirstY: 236,
  shipPitch: 40,
  ship: { width: 250, height: 32 },
  factionCaptionY: 412,
  factionY: 444,
  factionPitch: 52,
  faction: { width: 46, height: 28, fontPx: 11 },
  difficultyCaptionY: 524,
  difficultyY: 554,
  difficultyPitch: 100,
  difficulty: { width: 88, height: 28, fontPx: 11 },
  start: { y: 626, width: 210, height: 50, fontPx: 24 },
} as const;

/**
 * Render the setup screen.
 *
 * @param scene - The Dogfight scene (camera zoom 1).
 * @param state - Current choices.
 * @param actions - Choice callbacks.
 * @param track - Registers every object for pinning and cleanup.
 */
export function renderDogfightSetup(
  scene: Phaser.Scene,
  state: DogfightSetupState,
  actions: DogfightSetupActions,
  track: TrackSetupObject,
): void {
  const centerX = scene.scale.width / 2;
  addSetupBackdrop(scene, track);
  addSetupTitle(scene, "Dogfight", "1v1 quick duels", track);
  addBackButton(scene, actions.back, track);
  renderFormats(scene, state, actions, track);
  renderSide(scene, "player", centerX - LAYOUT.panelOffsetX, {
    state,
    actions,
    track,
  });
  renderSide(scene, "enemy", centerX + LAYOUT.panelOffsetX, {
    state,
    actions,
    track,
  });
  renderDifficulty(scene, state, actions, track);
  renderStart(scene, actions, track);
  addControlsFooter(scene, track);
}

function renderFormats(
  scene: Phaser.Scene,
  state: DogfightSetupState,
  actions: DogfightSetupActions,
  track: TrackSetupObject,
): void {
  const centerX = scene.scale.width / 2;
  addSectionCaption(
    scene,
    centerX,
    LAYOUT.formatCaptionY,
    "Match format",
    track,
  );
  FORMATS.forEach((format, i) => {
    const x = centerX + (i - (FORMATS.length - 1) / 2) * LAYOUT.formatPitch;
    addHoloToggle(
      scene,
      { x, y: LAYOUT.formatY },
      {
        ...LAYOUT.format,
        label: format.name,
        selected: format.id === state.matchFormat,
      },
      () => actions.selectFormat(format.id),
      track,
    );
  });
}

interface SideContext {
  readonly state: DogfightSetupState;
  readonly actions: DogfightSetupActions;
  readonly track: TrackSetupObject;
}

function renderSide(
  scene: Phaser.Scene,
  owner: "player" | "enemy",
  x: number,
  { state, actions, track }: SideContext,
): void {
  const faction = owner === "player" ? state.playerFaction : state.enemyFaction;
  const shipId = owner === "player" ? state.playerShipId : state.enemyShipId;
  const { panel } = LAYOUT;
  addSetupPanel(
    scene,
    {
      x,
      y: panel.top + panel.height / 2,
      width: panel.width,
      height: panel.height,
    },
    {
      title: owner === "player" ? "Your ship" : "Enemy ship",
      accent: owner === "player" ? SIDE_COLORS.player : SIDE_COLORS.enemy,
    },
    track,
  );
  getShipsByFaction(faction)
    .slice(0, SHIPS_LISTED)
    .forEach((ship, i) => {
      addHoloToggle(
        scene,
        { x, y: LAYOUT.shipFirstY + i * LAYOUT.shipPitch },
        { ...LAYOUT.ship, label: ship.name, selected: ship.id === shipId },
        () => actions.selectShip(owner, ship.id),
        track,
      );
    });
  renderFactions(scene, owner, x, { state, actions, track });
}

function renderFactions(
  scene: Phaser.Scene,
  owner: "player" | "enemy",
  x: number,
  { state, actions, track }: SideContext,
): void {
  const selected =
    owner === "player" ? state.playerFaction : state.enemyFaction;
  addSectionCaption(scene, x, LAYOUT.factionCaptionY, "Faction", track);
  FACTIONS.forEach((faction, i) => {
    const fx = x + (i - (FACTIONS.length - 1) / 2) * LAYOUT.factionPitch;
    addHoloToggle(
      scene,
      { x: fx, y: LAYOUT.factionY },
      {
        ...LAYOUT.faction,
        label: FACTION_SHORT[faction],
        selected: faction === selected,
      },
      () => actions.selectFaction(owner, faction),
      track,
    );
  });
}

function renderDifficulty(
  scene: Phaser.Scene,
  state: DogfightSetupState,
  actions: DogfightSetupActions,
  track: TrackSetupObject,
): void {
  const centerX = scene.scale.width / 2;
  addSectionCaption(
    scene,
    centerX,
    LAYOUT.difficultyCaptionY,
    "AI difficulty",
    track,
  );
  DIFFICULTIES.forEach((difficulty, i) => {
    const x =
      centerX + (i - (DIFFICULTIES.length - 1) / 2) * LAYOUT.difficultyPitch;
    addHoloToggle(
      scene,
      { x, y: LAYOUT.difficultyY },
      {
        ...LAYOUT.difficulty,
        label: difficulty,
        selected: difficulty === state.difficulty,
      },
      () => actions.selectDifficulty(difficulty),
      track,
    );
  });
}

function renderStart(
  scene: Phaser.Scene,
  actions: DogfightSetupActions,
  track: TrackSetupObject,
): void {
  const { start } = LAYOUT;
  const button = createHoloButton(
    scene,
    scene.scale.width / 2,
    start.y,
    {
      width: start.width,
      height: start.height,
      label: "FIGHT!",
      variant: "primary",
    },
    actions.start,
  );
  track(sizeHoloLabel(button, start.fontPx));
}
