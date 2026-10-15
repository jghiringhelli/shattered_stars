/**
 * squadBuilderChrome — scene-level controls of SquadBuilderScene: the
 * SIMPLE/ADVANCED mode toggle (small secondary button, top-right) and the
 * bottom action bar (AUTO-FILL ALL · START BATTLE · RANDOMIZE).
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { attachTermTooltip } from "../menu/HintTooltip";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { SQUAD_TYPE } from "./squadBuilderStyle";

/** Geometry of the scene chrome. */
const CHROME_LAYOUT = {
  toggleW: 128,
  toggleH: 30,
  squadsDrop: 32,
  primaryW: 220,
  secondaryW: 180,
  barH: 40,
  barGap: 20,
  primaryFont: 15,
} as const;

/**
 * Small secondary button switching between the simple flow and the
 * advanced builder, aligned to the header row on the right margin.
 *
 * @param scene - Squad builder scene.
 * @param simpleMode - Current mode (label offers the other one).
 * @param onToggle - Fired on press.
 * @returns The button.
 */
export function createModeToggle(
  scene: Phaser.Scene,
  simpleMode: boolean,
  onToggle: () => void,
): HoloPressButton {
  const { toggleW, toggleH } = CHROME_LAYOUT;
  const button = createHoverButton(
    scene,
    scene.scale.width - MENU_LAYOUT.margin - toggleW / 2,
    MENU_LAYOUT.titleY,
    {
      width: toggleW,
      height: toggleH,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: simpleMode ? "ADVANCED" : "SIMPLE",
      font: `600 ${SQUAD_TYPE.label}px`,
      icon: simpleMode ? "gear" : "back",
    },
    onToggle,
  );
  attachTermTooltip(scene, button, simpleMode ? "mode.advanced" : "mode.simple");
  return button;
}

/**
 * SQUADS button (save / share code / paste code / saved squads), left of the
 * mode toggle on the header row.
 *
 * @param scene - Squad builder scene.
 * @param onOpen - Opens the squads dialog.
 * @returns The button.
 */
export function createSquadsButton(
  scene: Phaser.Scene,
  onOpen: () => void,
): HoloPressButton {
  const { toggleW, toggleH, squadsDrop } = CHROME_LAYOUT;
  return createHoverButton(
    scene,
    scene.scale.width - MENU_LAYOUT.margin - toggleW / 2,
    MENU_LAYOUT.titleY + squadsDrop,
    {
      width: toggleW,
      height: toggleH,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "SQUADS",
      font: `600 ${SQUAD_TYPE.label}px`,
      icon: "fleet",
    },
    onOpen,
  );
}

/** Callbacks for the advanced builder's action bar. */
export interface ActionBarHandlers {
  readonly onAutoFill: () => void;
  readonly onRandomize: () => void;
  readonly onStart: () => void;
}

/**
 * Bottom action bar: START BATTLE (primary) bottom-centre, flanked by
 * AUTO-FILL ALL and RANDOMIZE (secondary).
 *
 * @param scene - Squad builder scene.
 * @param handlers - Button callbacks.
 * @returns Buttons in reading order (left → right).
 */
export function createActionBar(
  scene: Phaser.Scene,
  handlers: ActionBarHandlers,
): HoloPressButton[] {
  const { primaryW, secondaryW, barH, barGap, primaryFont } = CHROME_LAYOUT;
  const cx = scene.scale.width / 2;
  const y = scene.scale.height - MENU_LAYOUT.primaryInset;
  const offset = primaryW / 2 + barGap + secondaryW / 2;
  const secondary = (
    x: number,
    label: string,
    icon: "fleet" | "refresh",
    onClick: () => void,
  ): HoloPressButton =>
    createHoverButton(
      scene,
      x,
      y,
      {
        width: secondaryW,
        height: barH,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label,
        font: `600 ${SQUAD_TYPE.body}px`,
        icon,
      },
      onClick,
    );
  const bar = [
    secondary(cx - offset, "AUTO-FILL ALL", "fleet", handlers.onAutoFill),
    createHoverButton(
      scene,
      cx,
      y,
      {
        width: primaryW,
        height: barH,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label: "START BATTLE",
        font: `600 ${primaryFont}px`,
        icon: "next",
      },
      handlers.onStart,
    ),
    secondary(cx + offset, "RANDOMIZE", "refresh", handlers.onRandomize),
  ];
  const terms = ["ui.auto_fill", "ui.start_battle", "ui.randomize"] as const;
  bar.forEach((button, i) => attachTermTooltip(scene, button, terms[i]!));
  return bar;
}
