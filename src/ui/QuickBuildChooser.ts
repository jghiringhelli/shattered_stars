/**
 * QuickBuildChooser — a compact "cycle this ship's quick builds" card for
 * setup screens (Dogfight, Ace Duel, Survival): ◀ build name · price ▶,
 * then the pilot (★ unique, initiative), the pilot ability's real-time
 * summary and the upgrades it carries.
 *
 * Every object is created as a direct scene child and returned to the
 * caller, which tracks/destroys them like its other setup objects (the
 * setup screens must not reparent interactive containers into another
 * container, and keep camera zoom at 1.0 — see DogfightScene.track()).
 */

import Phaser from "phaser";
import type { CycleStep } from "../arcade/systems/QuickBuildChoice";
import { quickBuildOptions } from "../arcade/systems/QuickBuildChoice";
import {
  describeQuickBuild,
  type QuickBuildDetails,
} from "../data/quickBuildDetails";
import { getLoadoutById } from "../data/ShipLoadouts";
import { createHoverButton } from "./ButtonFactory";

/** What to show and where. */
export interface QuickBuildChooserOptions {
  /** Left edge. */
  readonly x: number;
  /** Top edge. */
  readonly y: number;
  readonly width: number;
  /** Card title, e.g. "YOUR QUICK BUILD". */
  readonly heading: string;
  readonly shipId: string;
  /** The current pick (null = bare hull). */
  readonly loadoutId: string | null;
  /** Prefix for the arrow buttons' names (`${name}:prev` / `${name}:next`). */
  readonly name: string;
  /** Border colour. */
  readonly accentColor?: number;
  readonly onCycle: (step: CycleStep) => void;
}

/** The card's objects (for the caller to track) and its height. */
export interface RenderedQuickBuildChooser {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly height: number;
}

const PADDING = 10;
const ARROW_SIZE = 28;
const ROW_GAP = 4;
const DEFAULT_ACCENT = 0x446688;
const ARROW_COLOR = 0x223344;
const ARROW_HOVER_COLOR = 0x335577;
const UNIQUE_COLOR = "#ffd76a";

/**
 * Renders the chooser card.
 *
 * @param scene - Owning scene.
 * @param options - Ship, current pick, box and cycle callback.
 * @returns The created objects and the card's height.
 */
export function renderQuickBuildChooser(
  scene: Phaser.Scene,
  options: QuickBuildChooserOptions,
): RenderedQuickBuildChooser {
  const { x, y, width } = options;
  const bg = scene.add.graphics();
  const objects: Phaser.GameObjects.GameObject[] = [bg];
  const choices = quickBuildOptions(options.shipId);
  const loadout = options.loadoutId ? getLoadoutById(options.loadoutId) : null;
  const details = loadout ? describeQuickBuild(loadout) : null;

  const heading = scene.add.text(x + PADDING, y + PADDING, options.heading, {
    font: "bold 12px Arial",
    color: "#aaccee",
  });
  const position = choices.indexOf(options.loadoutId ?? "") + 1;
  const counter = scene.add
    .text(x + width - PADDING, y + PADDING, counterLabel(position, choices), {
      font: "11px Arial",
      color: "#6688aa",
    })
    .setOrigin(1, 0);
  objects.push(heading, counter);

  const rowY = heading.y + heading.height + ROW_GAP;
  objects.push(...renderBuildRow(scene, options, details, rowY, choices));
  let cy = rowY + ARROW_SIZE + ROW_GAP;
  for (const line of detailLines(details, choices.length > 0)) {
    const text = scene.add.text(x + PADDING, cy, line.text, {
      font: line.font,
      color: line.color,
      wordWrap: { width: width - PADDING * 2 },
    });
    objects.push(text);
    cy += text.height + 2;
  }

  const height = cy - y + PADDING - 2;
  bg.fillStyle(0x0d1525, 0.92);
  bg.fillRoundedRect(x, y, width, height, 8);
  bg.lineStyle(2, options.accentColor ?? DEFAULT_ACCENT, 0.8);
  bg.strokeRoundedRect(x, y, width, height, 8);
  return { objects, height };
}

/**
 * "2/3" when there is a choice, "" otherwise.
 * @param position - 1-based position of the current pick (0 = not offered).
 * @param choices - The ship's quick builds.
 * @returns The counter text.
 */
function counterLabel(position: number, choices: readonly string[]): string {
  return choices.length > 1 && position > 0
    ? `${position}/${choices.length}`
    : "";
}

/**
 * ◀ name · price ▶ — arrows only when there is something to cycle to.
 * @param scene - Owning scene.
 * @param options - Chooser options.
 * @param details - The current pick's details (null = bare hull).
 * @param rowY - Top of the row.
 * @param choices - The ship's quick builds.
 * @returns The row's objects.
 */
function renderBuildRow(
  scene: Phaser.Scene,
  options: QuickBuildChooserOptions,
  details: QuickBuildDetails | null,
  rowY: number,
  choices: readonly string[],
): Phaser.GameObjects.GameObject[] {
  const { x, width } = options;
  const midY = rowY + ARROW_SIZE / 2;
  const label = details
    ? `${details.name.toUpperCase()}  \u00b7  ${details.pointCost}pt`
    : "BARE HULL";
  const title = scene.add
    .text(x + width / 2, midY, label, {
      font: "bold 14px Arial",
      color: details ? "#44ffaa" : "#888888",
    })
    .setOrigin(0.5);
  const maxTitleW = width - 2 * (PADDING + ARROW_SIZE + ROW_GAP);
  if (title.width > maxTitleW) title.setScale(maxTitleW / title.width);
  if (choices.length <= 1) return [title];
  const arrow = (dx: number, glyph: string, step: CycleStep) =>
    createHoverButton(
      scene,
      dx,
      midY,
      {
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        radius: 6,
        color: ARROW_COLOR,
        hoverColor: ARROW_HOVER_COLOR,
        label: glyph,
        font: "bold 14px Arial",
        textColor: "#88ccff",
      },
      () => options.onCycle(step),
    ).setName(`${options.name}:${step > 0 ? "next" : "prev"}`);
  const half = PADDING + ARROW_SIZE / 2;
  return [
    title,
    arrow(x + half, "\u25c0", -1),
    arrow(x + width - half, "\u25b6", 1),
  ];
}

/** One line of the card's detail text. */
interface DetailLine {
  readonly text: string;
  readonly font: string;
  readonly color: string;
}

/**
 * Pilot, ability summary and upgrades of the current pick.
 * @param details - The current pick (null = bare hull).
 * @param hasChoices - Whether the ship offers any quick build.
 * @returns The lines to draw, top to bottom.
 */
function detailLines(
  details: QuickBuildDetails | null,
  hasChoices: boolean,
): DetailLine[] {
  if (!details) {
    const text = hasChoices
      ? "No quick build selected \u2014 rookie pilot, no upgrades"
      : "No quick builds for this ship \u2014 flies the bare hull";
    return [{ text, font: "italic 11px Arial", color: "#6a7a8a" }];
  }
  const pilot = details.pilot;
  const lines: DetailLine[] = [];
  if (pilot) {
    lines.push({
      text: `${pilot.isUnique ? "\u2605 " : ""}${pilot.name}  \u00b7  Initiative ${pilot.initiative}`,
      font: "bold 12px Arial",
      color: pilot.isUnique ? UNIQUE_COLOR : "#eef6ff",
    });
  }
  const ability = details.ability;
  lines.push(
    ability
      ? {
          text: `${ability.name}: ${ability.summary || "no real-time effect"}`,
          font: "11px Arial",
          color: "#88ffcc",
        }
      : {
          text: "No pilot ability",
          font: "italic 11px Arial",
          color: "#6a7a8a",
        },
  );
  if (details.upgrades.length > 0) {
    lines.push({
      text: `Upgrades: ${details.upgrades.map((u) => u.name).join(", ")}`,
      font: "11px Arial",
      color: "#8ab0cc",
    });
  }
  return lines;
}
