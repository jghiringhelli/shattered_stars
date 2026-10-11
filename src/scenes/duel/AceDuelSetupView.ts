/**
 * AceDuelSetupView — the Ace Duel setup screen in the holographic style:
 * the preset matchups (completion ticks, faction dots), the selected
 * matchup's flavour, side choice with each side's ace abilities, AI
 * difficulty and DUEL!. Pure view: reads a state snapshot, reports choices
 * through callbacks; the scene owns the state and re-renders.
 */

import Phaser from "phaser";
import type { AceMatchup } from "../../data/AceMatchups";
import { PILOT_ABILITIES } from "../../systems/PilotAbilities";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  factionAccent,
} from "../../ui/theme/HoloTheme";
import { renderMatchupRow } from "./aceDuelMatchupRow";
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

/** AI difficulty settings. */
export type AceDuelDifficulty = "easy" | "normal" | "hard" | "brutal";

/** What the setup screen shows. */
export interface AceDuelSetupState {
  readonly matchups: readonly AceMatchup[];
  readonly selected: AceMatchup;
  readonly completed: ReadonlySet<string>;
  readonly playerSide: 1 | 2;
  readonly difficulty: AceDuelDifficulty;
}

/** What the player can do on it. */
export interface AceDuelSetupActions {
  readonly selectMatchup: (matchup: AceMatchup) => void;
  readonly selectSide: (side: 1 | 2) => void;
  readonly selectDifficulty: (difficulty: AceDuelDifficulty) => void;
  readonly start: () => void;
  readonly back: () => void;
}

const DIFFICULTIES: readonly AceDuelDifficulty[] = [
  "easy",
  "normal",
  "hard",
  "brutal",
];

/** Screen layout (px). */
const LAYOUT = {
  completion: { right: 32, y: 44 },
  rowFirstY: 124,
  rowPitch: 50,
  details: { y: 470, width: 600, height: 140 },
  flavorY: 414,
  flavorWrap: 560,
  sideY: 486,
  sideOffsetX: 160,
  side: { width: 230, height: 32, fontPx: 12 },
  chipFirstY: 514,
  chipPitch: 18,
  chip: { width: 136, height: 16 },
  chipFillAlpha: 0.18,
  chipBorderAlpha: 0.6,
  difficultyCaptionY: 566,
  difficultyY: 592,
  difficultyPitch: 100,
  difficulty: { width: 88, height: 28, fontPx: 11 },
  start: { y: 646, width: 210, height: 46, fontPx: 24 },
} as const;

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
  addSetupTitle(scene, "Ace Duel", "Legendary matchups", track);
  addBackButton(scene, actions.back, track);
  renderCompletion(scene, state, track);
  const centerX = scene.scale.width / 2;
  state.matchups.forEach((matchup, i) => {
    const row = renderMatchupRow(scene, {
      x: centerX,
      y: LAYOUT.rowFirstY + i * LAYOUT.rowPitch,
      matchup,
      selected: matchup.id === state.selected.id,
      completed: state.completed.has(matchup.id),
      onSelect: () => actions.selectMatchup(matchup),
    });
    track(row);
  });
  renderDetails(scene, state, actions, track);
  renderDifficulty(scene, state, actions, track);
  renderStart(scene, actions, track);
  addControlsFooter(scene, track);
}

function renderCompletion(
  scene: Phaser.Scene,
  state: AceDuelSetupState,
  track: TrackSetupObject,
): void {
  const done = state.completed.size;
  const total = state.matchups.length;
  const color =
    done === total ? HOLO_PALETTE.success : HOLO_PALETTE.textSecondary;
  track(
    createHoloText(
      scene,
      scene.scale.width - LAYOUT.completion.right,
      LAYOUT.completion.y,
      `${done}/${total} COMPLETED`,
      "caption",
      color,
    ).setOrigin(1, 0.5),
  );
}

function renderDetails(
  scene: Phaser.Scene,
  state: AceDuelSetupState,
  actions: AceDuelSetupActions,
  track: TrackSetupObject,
): void {
  const centerX = scene.scale.width / 2;
  const { details } = LAYOUT;
  addSetupPanel(
    scene,
    { x: centerX, ...details },
    { accent: factionAccent(sideOf(state.selected, state.playerSide).faction) },
    track,
  );
  track(
    createHoloText(
      scene,
      centerX,
      LAYOUT.flavorY,
      `\u201c${state.selected.flavorText}\u201d`,
      "body",
      HOLO_PALETTE.textSecondary,
    )
      .setOrigin(0.5, 0)
      .setFontStyle("italic")
      .setWordWrapWidth(LAYOUT.flavorWrap)
      .setAlign("center"),
  );
  track(
    createHoloText(
      scene,
      centerX,
      LAYOUT.sideY,
      "VS",
      "heading",
      HOLO_PALETTE.textMuted,
    ),
  );
  for (const side of [1, 2] as const) {
    const x = centerX + (side === 1 ? -LAYOUT.sideOffsetX : LAYOUT.sideOffsetX);
    addHoloToggle(
      scene,
      { x, y: LAYOUT.sideY },
      {
        ...LAYOUT.side,
        label: sideOf(state.selected, side).name,
        selected: side === state.playerSide,
      },
      () => actions.selectSide(side),
      track,
    );
    renderAbilityChips(scene, x, sideOf(state.selected, side), track);
  }
}

function renderAbilityChips(
  scene: Phaser.Scene,
  x: number,
  side: AceMatchup["side1"],
  track: TrackSetupObject,
): void {
  const color = factionAccent(side.faction);
  const { chip } = LAYOUT;
  side.abilities.forEach((abilityId, i) => {
    const ability = PILOT_ABILITIES[abilityId];
    if (!ability) return;
    const bg = scene.add.graphics();
    bg.fillStyle(color, LAYOUT.chipFillAlpha);
    bg.fillRoundedRect(
      -chip.width / 2,
      -chip.height / 2,
      chip.width,
      chip.height,
      HOLO_RADIUS.sm,
    );
    bg.lineStyle(HOLO_BORDER.hairline, color, LAYOUT.chipBorderAlpha);
    bg.strokeRoundedRect(
      -chip.width / 2,
      -chip.height / 2,
      chip.width,
      chip.height,
      HOLO_RADIUS.sm,
    );
    const label = createHoloText(
      scene,
      0,
      0,
      ability.name.toUpperCase(),
      "caption",
      color,
    );
    track(
      scene.add.container(x, LAYOUT.chipFirstY + i * LAYOUT.chipPitch, [
        bg,
        label,
      ]),
    );
  });
}

function renderDifficulty(
  scene: Phaser.Scene,
  state: AceDuelSetupState,
  actions: AceDuelSetupActions,
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
  actions: AceDuelSetupActions,
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
      label: "DUEL!",
      variant: "primary",
    },
    actions.start,
  );
  track(sizeHoloLabel(button, start.fontPx));
}

/**
 * @param matchup - A matchup.
 * @param side - Which side.
 * @returns That side's definition.
 */
function sideOf(matchup: AceMatchup, side: 1 | 2): AceMatchup["side1"] {
  return side === 1 ? matchup.side1 : matchup.side2;
}
