/**
 * DogfightSetupView — the Dogfight setup screen: a flown-points strip for
 * both sides, a tab bar (OVERVIEW ships and factions, STATS side by side,
 * BUILDS your quick build, MATCH rounds and AI difficulty) and FIGHT!. Pure
 * view: it reads a state snapshot and reports choices through callbacks; the
 * scene owns the state and re-renders.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { shipHint } from "../../data/roleHints";
import { getShipDefinition, getShipsByFaction } from "../../data/ShipDefinitions";
import {
  factionTermId,
  roleTermId,
  termEntry,
} from "../../data/tooltips";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { addCycler, addSelectable } from "../../ui/menu/FlatControls";
import { attachTermTooltip } from "../../ui/menu/HintTooltip";
import type { DetailTabId } from "../../ui/menu/detailTabsModel";
import { addPickerText, pickerTextStyle } from "../../ui/picker/pickerStyle";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../../ui/theme/HoloTheme";
import {
  drawBuildsBody,
  drawStatsBody,
  type StatSide,
} from "./duelSetupBodies";
import {
  DUEL_LAYOUT,
  bodyArea,
  drawDuelFrame,
  openDuelTab,
  pinTree,
  type BodyArea,
} from "./duelSetupChrome";
import type { DuelDifficulty, DuelFormat } from "./duelSetupModel";
import { pointsStrip, sidePoints } from "./duelPointsModel";
import { addShipArt, drawMatchBody } from "./duelSetupWidgets";
import { SHIPS_PER_PAGE, shipPage } from "./shipPaging";
import {
  addBackButton,
  addControlsFooter,
  addSetupBackdrop,
  addSetupTitle,
  sizeHoloLabel,
  type TrackSetupObject,
} from "./holoSetupKit";

/** Best-of formats. */
export type DogfightFormat = DuelFormat;
/** AI difficulty settings. */
export type DogfightDifficulty = DuelDifficulty;

/** What the setup screen shows. */
export interface DogfightSetupState {
  readonly matchFormat: DogfightFormat;
  readonly playerFaction: FactionId;
  readonly enemyFaction: FactionId;
  readonly playerShipId: string;
  readonly enemyShipId: string;
  readonly difficulty: DogfightDifficulty;
  /** The quick build the player flies (null = bare hull). */
  readonly playerLoadoutId: string | null;
  /** The default quick build the AI flies (null = bare hull). */
  readonly enemyLoadoutId: string | null;
  /** Ship page each side was paged to (null = the page of the selected ship). */
  readonly shipPages: Readonly<Record<"player" | "enemy", number | null>>;
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
  readonly selectBuild: (loadoutId: string | null) => void;
  readonly pageShips: (owner: "player" | "enemy", page: number) => void;
  readonly selectTab: (tab: DetailTabId) => void;
  readonly start: () => void;
  readonly back: () => void;
}

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Overview geometry (px, 8 px grid). */
const OVERVIEW = {
  gap: 24,
  headingGap: 24,
  cyclerH: 32,
  rowsTop: 88,
  rowH: 40,
  rowPitch: 48,
  rowW: 376,
  artSize: 192,
  hintGap: 16,
} as const;

type Owner = "player" | "enemy";

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
  addSetupBackdrop(scene, track);
  addSetupTitle(scene, "Dogfight", " ", track);
  addBackButton(scene, actions.back, track);
  const tab = openDuelTab();
  const strip = pointsStrip(
    sidePoints([state.playerShipId], [state.playerLoadoutId]),
    sidePoints([state.enemyShipId], [state.enemyLoadoutId]),
  );
  const root = drawDuelFrame(scene, {
    strip,
    tab,
    accent: HOLO_PALETTE.accent,
    onTab: actions.selectTab,
  });
  drawTabBody(bodyArea(scene, root), tab, state, actions);
  pinTree(root);
  track(root);
  renderStart(scene, actions, track);
  addControlsFooter(scene, track);
}

function drawTabBody(
  area: BodyArea,
  tab: DetailTabId,
  state: DogfightSetupState,
  actions: DogfightSetupActions,
): void {
  const accent = HOLO_PALETTE.accent;
  if (tab === "stats") {
    drawStatsBody(area, statSide("YOUR SHIP", state.playerShipId, state.playerLoadoutId), statSide("ENEMY", state.enemyShipId, state.enemyLoadoutId));
  } else if (tab === "builds") {
    drawBuildsBody(area, {
      shipId: state.playerShipId,
      loadoutId: state.playerLoadoutId,
      accent,
      onPick: actions.selectBuild,
      enemy: { shipId: state.enemyShipId, loadoutId: state.enemyLoadoutId },
    });
  } else if (tab === "match") {
    drawMatchBody(area, {
      accent,
      format: { selected: state.matchFormat, onSelect: actions.selectFormat },
      difficulty: { selected: state.difficulty, onSelect: actions.selectDifficulty },
    });
  } else {
    drawOverview(area, state, actions);
  }
}

function statSide(name: string, shipId: string, loadoutId: string | null): StatSide {
  const def = getShipDefinition(shipId)!;
  return { name: `${name}  ${def.name}`, def, loadoutId };
}

function drawOverview(
  area: BodyArea,
  state: DogfightSetupState,
  actions: DogfightSetupActions,
): void {
  const colW = (area.width - OVERVIEW.gap) / 2;
  (["player", "enemy"] as const).forEach((owner, i) => {
    drawSide(area, owner, { x: area.x + i * (colW + OVERVIEW.gap), width: colW }, state, actions);
  });
}

function drawSide(
  area: BodyArea,
  owner: Owner,
  col: { readonly x: number; readonly width: number },
  state: DogfightSetupState,
  actions: DogfightSetupActions,
): void {
  const { scene, root } = area;
  const player = owner === "player";
  const faction = player ? state.playerFaction : state.enemyFaction;
  const shipId = player ? state.playerShipId : state.enemyShipId;
  const color = player ? SIDE_COLORS.player : SIDE_COLORS.enemy;
  root.add(addPickerText(scene, { x: col.x, y: area.y }, player ? "YOUR SHIP" : "ENEMY SHIP", "caption", color));
  const rule = scene.add.graphics();
  rule.lineStyle(1, color, 0.6).lineBetween(col.x, area.y + OVERVIEW.headingGap - 4, col.x + col.width, area.y + OVERVIEW.headingGap - 4);
  root.add(rule);
  const index = FACTIONS.indexOf(faction);
  addCycler(scene, root, {
    x: col.x,
    y: area.y + OVERVIEW.headingGap + HOLO_SPACING.sm,
    width: col.width,
    height: OVERVIEW.cyclerH,
    label: termEntry(factionTermId(faction)).title.toUpperCase(),
    accent: color,
    tip: "duel.faction_pick",
    onStep: (step) => actions.selectFaction(owner, FACTIONS[(index + step + FACTIONS.length) % FACTIONS.length]!),
  });
  const top = area.y + OVERVIEW.rowsTop;
  const listed = shipPage(getShipsByFaction(faction), shipId, state.shipPages[owner]);
  listed.items.forEach((ship, row) => {
    addSelectable(scene, root, {
      x: col.x,
      y: top + row * OVERVIEW.rowPitch,
      width: OVERVIEW.rowW,
      height: OVERVIEW.rowH,
      label: ship.name,
      detail: `${ship.baseStats.pointCost} pt`,
      selected: ship.id === shipId,
      accent: color,
      tip: roleTermId(ship.role),
      onPress: () => actions.selectShip(owner, ship.id),
    });
  });
  const def = getShipDefinition(shipId);
  if (def) {
    addShipArt(area, def, {
      cx: col.x + OVERVIEW.rowW + OVERVIEW.hintGap + (col.width - OVERVIEW.rowW - OVERVIEW.hintGap) / 2,
      cy: top + OVERVIEW.artSize / 2,
      size: Math.min(OVERVIEW.artSize, col.width - OVERVIEW.rowW - OVERVIEW.hintGap),
    });
  }
  const pagerY = top + SHIPS_PER_PAGE * OVERVIEW.rowPitch;
  addCycler(scene, root, {
    x: col.x,
    y: pagerY,
    width: OVERVIEW.rowW,
    height: OVERVIEW.cyclerH,
    label: listed.caption,
    accent: color,
    tip: "duel.ship_row",
    onStep: (step) => actions.pageShips(owner, (listed.page + step + listed.pages) % listed.pages),
  });
  const hint = shipHint(shipId);
  root.add(
    scene.add.text(col.x, pagerY + OVERVIEW.cyclerH + OVERVIEW.hintGap, `${hint.role}\n${hint.bestWith}`, pickerTextStyle("body", HOLO_PALETTE.textSecondary, { wordWrap: { width: col.width } })),
  );
}

function renderStart(
  scene: Phaser.Scene,
  actions: DogfightSetupActions,
  track: TrackSetupObject,
): void {
  const button = createHoloButton(
    scene,
    scene.scale.width / 2,
    scene.scale.height - DUEL_LAYOUT.startCentreFromBottom,
    {
      width: DUEL_LAYOUT.startWidth,
      height: DUEL_LAYOUT.startHeight,
      label: "FIGHT!",
      variant: "primary",
    },
    actions.start,
  );
  attachTermTooltip(scene, button, "duel.fight");
  track(sizeHoloLabel(button, DUEL_LAYOUT.startFontPx));
}
