/**
 * AceDuelSetupView — the Ace Duel setup screen: a flown-points strip for both
 * aces, a tab bar (OVERVIEW the preset matchups, STATS side by side, BUILDS
 * your quick build and both aces' abilities, MATCH side and AI difficulty)
 * and DUEL!. Pure view: reads a state snapshot, reports choices through
 * callbacks; the scene owns the state and re-renders.
 */

import Phaser from "phaser";
import type { AceMatchup } from "../../data/AceMatchups";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { PILOT_ABILITIES } from "../../systems/PilotAbilities";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { addSelectable } from "../../ui/menu/FlatControls";
import { attachTermTooltip } from "../../ui/menu/HintTooltip";
import type { DetailTabId } from "../../ui/menu/detailTabsModel";
import { addTipZone } from "../../ui/menu/tooltipTargets";
import { addPickerText, pickerTextStyle } from "../../ui/picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING, SIDE_COLORS, factionAccent } from "../../ui/theme/HoloTheme";
import { drawAbilityChips } from "./aceDuelAbilityChips";
import { pointsStrip, sidePoints } from "./duelPointsModel";
import { drawBuildsBody, drawStatsBody, type StatSide } from "./duelSetupBodies";
import { DUEL_LAYOUT, bodyArea, drawDuelFrame, openDuelTab, pinTree, type BodyArea } from "./duelSetupChrome";
import type { DuelDifficulty } from "./duelSetupModel";
import { addShipArt, drawMatchBody } from "./duelSetupWidgets";
import {
  addBackButton,
  addControlsFooter,
  addSetupBackdrop,
  addSetupTitle,
  sizeHoloLabel,
  type TrackSetupObject,
} from "./holoSetupKit";

/** AI difficulty settings. */
export type AceDuelDifficulty = DuelDifficulty;

/** What the setup screen shows. */
export interface AceDuelSetupState {
  readonly matchups: readonly AceMatchup[];
  readonly selected: AceMatchup;
  readonly completed: ReadonlySet<string>;
  readonly playerSide: 1 | 2;
  readonly difficulty: AceDuelDifficulty;
  /** The quick build the player flies per ship of their side (null = bare hull). */
  readonly playerLoadoutIds: ReadonlyArray<string | null>;
  /** The default quick builds the AI flies. */
  readonly enemyLoadoutIds: ReadonlyArray<string | null>;
  /** Which of the player's ships the BUILDS tab edits. */
  readonly buildShip: number;
}

/** What the player can do on it. */
export interface AceDuelSetupActions {
  readonly selectMatchup: (matchup: AceMatchup) => void;
  readonly selectSide: (side: 1 | 2) => void;
  readonly selectDifficulty: (difficulty: AceDuelDifficulty) => void;
  readonly selectBuild: (shipIndex: number, loadoutId: string | null) => void;
  readonly selectBuildShip: (shipIndex: number) => void;
  readonly selectTab: (tab: DetailTabId) => void;
  readonly start: () => void;
  readonly back: () => void;
}

/** Overview geometry (px, 8 px grid). */
const OVERVIEW = {
  listW: 704,
  gap: 24,
  rowH: 48,
  rowPitch: 56,
  headingGap: 32,
  artSize: 160,
  flavorWrap: 480,
} as const;

type Side = AceMatchup["side1"];

/**
 * @param matchup - A matchup.
 * @param side - Which side.
 * @returns That side's definition.
 */
function sideOf(matchup: AceMatchup, side: 1 | 2): Side {
  return side === 1 ? matchup.side1 : matchup.side2;
}

/**
 * Render the setup screen.
 *
 * @param scene - The Ace Duel scene (camera zoom 1).
 * @param state - Current choices.
 * @param actions - Choice callbacks.
 * @param track - Registers every object for pinning and cleanup.
 */
export function renderAceDuelSetup(
  scene: Phaser.Scene,
  state: AceDuelSetupState,
  actions: AceDuelSetupActions,
  track: TrackSetupObject,
): void {
  addSetupBackdrop(scene, track);
  addSetupTitle(scene, "Ace Duel", " ", track);
  addBackButton(scene, actions.back, track);
  const tab = openDuelTab();
  const mine = sideOf(state.selected, state.playerSide);
  const foe = sideOf(state.selected, state.playerSide === 1 ? 2 : 1);
  const root = drawDuelFrame(scene, {
    strip: pointsStrip(
      sidePoints(mine.ships, state.playerLoadoutIds),
      sidePoints(foe.ships, state.enemyLoadoutIds),
    ),
    tab,
    accent: HOLO_PALETTE.accent,
    onTab: actions.selectTab,
  });
  drawTabBody(bodyArea(scene, root), tab, { state, actions, mine, foe });
  pinTree(root);
  track(root);
  renderStart(scene, actions, track);
  addControlsFooter(scene, track);
}

/** What a tab body needs. */
interface TabContext {
  readonly state: AceDuelSetupState;
  readonly actions: AceDuelSetupActions;
  readonly mine: Side;
  readonly foe: Side;
}

function drawTabBody(area: BodyArea, tab: DetailTabId, ctx: TabContext): void {
  const { state, actions, mine, foe } = ctx;
  if (tab === "stats") {
    drawStatsBody(area, statSide(mine, state.playerLoadoutIds[0] ?? null), statSide(foe, state.enemyLoadoutIds[0] ?? null));
  } else if (tab === "builds") {
    drawBuilds(area, ctx);
  } else if (tab === "match") {
    drawMatchBody(area, {
      accent: HOLO_PALETTE.accent,
      sides: {
        names: [state.selected.side1.name, state.selected.side2.name],
        accents: [factionAccent(state.selected.side1.faction), factionAccent(state.selected.side2.faction)],
        selected: state.playerSide,
        sentence: `You fly ${mine.name}; the AI flies ${foe.name}.`,
        onSelect: actions.selectSide,
      },
      difficulty: { selected: state.difficulty, onSelect: actions.selectDifficulty },
    });
  } else {
    drawOverview(area, ctx);
  }
}

function statSide(side: Side, loadoutId: string | null): StatSide {
  const def = getShipDefinition(side.ships[0]!)!;
  return { name: side.name, def, loadoutId };
}

function drawBuilds(area: BodyArea, ctx: TabContext): void {
  const { state, actions, mine, foe } = ctx;
  const index = Math.min(state.buildShip, mine.ships.length - 1);
  const shipSwitch =
    mine.ships.length > 1
      ? { count: mine.ships.length, index, onSelect: actions.selectBuildShip }
      : undefined;
  const bottom = drawBuildsBody(area, {
    shipId: mine.ships[index]!,
    loadoutId: state.playerLoadoutIds[index] ?? null,
    accent: HOLO_PALETTE.accent,
    onPick: (loadoutId) => actions.selectBuild(index, loadoutId),
    enemy: null,
    ...(shipSwitch ? { shipSwitch } : {}),
  });
  drawAbilityChips(area, {
    mine,
    foe,
    y: bottom + HOLO_SPACING.xxl + HOLO_SPACING.sm,
    lookup: PILOT_ABILITIES,
  });
}

function drawOverview(area: BodyArea, ctx: TabContext): void {
  const { scene, root } = area;
  const { state, actions } = ctx;
  root.add(
    addPickerText(scene, { x: area.x, y: area.y }, `MATCHUPS  \u00b7  ${state.completed.size}/${state.matchups.length} COMPLETED`, "caption", HOLO_PALETTE.textSecondary),
  );
  addTipZone(scene, root, { x: area.x, y: area.y, width: OVERVIEW.listW, height: HOLO_SPACING.lg }, "duel.completed_count");
  state.matchups.forEach((matchup, i) => {
    addSelectable(scene, root, {
      x: area.x,
      y: area.y + OVERVIEW.headingGap + i * OVERVIEW.rowPitch,
      width: OVERVIEW.listW,
      height: OVERVIEW.rowH,
      label: `${state.completed.has(matchup.id) ? "\u2713  " : ""}${matchup.name}`,
      detail: matchup.description,
      detailRole: "small",
      selected: matchup.id === state.selected.id,
      accent: HOLO_PALETTE.accent,
      tip: "duel.matchup",
      onPress: () => actions.selectMatchup(matchup),
    });
  });
  drawMatchupCard(area, ctx, area.x + OVERVIEW.listW + OVERVIEW.gap);
}

function drawMatchupCard(area: BodyArea, ctx: TabContext, left: number): void {
  const { scene, root } = area;
  const width = area.x + area.width - left;
  root.add(
    scene.add.text(left, area.y, `\u201c${ctx.state.selected.flavorText}\u201d`, pickerTextStyle("body", HOLO_PALETTE.textSecondary, { fontStyle: "italic", wordWrap: { width } })),
  );
  const artY = area.y + 160;
  const slot = width / 2;
  [
    { side: ctx.mine, color: SIDE_COLORS.player, cx: left + slot / 2 },
    { side: ctx.foe, color: SIDE_COLORS.enemy, cx: left + slot + slot / 2 },
  ].forEach(({ side, color, cx }) => {
    const def = getShipDefinition(side.ships[0]!);
    if (def) addShipArt(area, def, { cx, cy: artY + OVERVIEW.artSize / 2, size: OVERVIEW.artSize });
    root.add(
      addPickerText(scene, { x: cx, y: artY + OVERVIEW.artSize + HOLO_SPACING.md }, side.name, "name", color).setOrigin(0.5, 0),
    );
  });
}

function renderStart(
  scene: Phaser.Scene,
  actions: AceDuelSetupActions,
  track: TrackSetupObject,
): void {
  const button = createHoloButton(
    scene,
    scene.scale.width / 2,
    scene.scale.height - DUEL_LAYOUT.startCentreFromBottom,
    {
      width: DUEL_LAYOUT.startWidth,
      height: DUEL_LAYOUT.startHeight,
      label: "DUEL!",
      variant: "primary",
    },
    actions.start,
  );
  attachTermTooltip(scene, button, "duel.fight");
  track(sizeHoloLabel(button, DUEL_LAYOUT.startFontPx));
}
