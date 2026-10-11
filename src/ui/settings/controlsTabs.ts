/**
 * Settings › Controls (keyboard rebinding with profiles, conflict swap and
 * reset) and Settings › Gamepad (read-only layout).
 */

import { DEFAULT_KEYBOARD_BINDINGS } from "../../input/DefaultBindings";
import { boundKeyLabel } from "../../input/boundKeyLabel";
import type { ActionIntent } from "../../input/InputTypes";
import {
  applyKeyOverrides,
  chordLabel,
  primaryChord,
  rebindIntent,
  type KeyChord,
} from "../../input/KeyBindings";
import { REBINDABLE_INTENTS } from "../../input/RebindableIntents";
import {
  CONTROL_PROFILE_COUNT,
  activeKeyOverrides,
  profileName,
  withActiveKeyOverrides,
} from "../../systems/SettingsStorage";
import { createHoverButton } from "../ButtonFactory";
import { CONTROL_GROUPS, gamepadLabelFor } from "../ControlsReference";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { SettingsChoiceRow, SettingsKeyRow } from "./settingsChoiceRows";
import {
  gridRow,
  type RowGrid,
  type SettingsTabContext,
} from "./settingsTabContext";

const HEADER_GRID: RowGrid = { columns: 2, rowHeight: 44, gap: 0 };
const KEY_GRID: RowGrid = { columns: 2, rowHeight: 30, gap: 4, top: 56 };
const RESET_BUTTON = { width: 220, height: 36, font: "600 13px" } as const;
const GAMEPAD_ROW = { height: 22, labelSize: 13, top: 8, notePad: 20 } as const;

const LABELS: ReadonlyMap<ActionIntent, string> = new Map(
  REBINDABLE_INTENTS.map((r) => [r.intent, r.label]),
);

/**
 * @param intent - A rebindable intent.
 * @param bindings - Effective bindings.
 * @returns The key chip text.
 */
function chipLabel(
  intent: ActionIntent,
  bindings: ReturnType<typeof applyKeyOverrides>,
): string {
  if (intent === "BOOST") return chordLabel(primaryChord(bindings, "BOOST"));
  return boundKeyLabel(intent, bindings);
}

/**
 * Controls tab: profile chooser, reset, and one key row per rebindable
 * intent (two columns, flight then combat then system).
 *
 * @param ctx - Tab context.
 */
export function buildControlsTab(ctx: SettingsTabContext): void {
  const rows = new Map<ActionIntent, SettingsKeyRow>();
  const effective = () =>
    applyKeyOverrides(
      DEFAULT_KEYBOARD_BINDINGS,
      activeKeyOverrides(ctx.settings()),
    );
  const refresh = (): void => {
    const bindings = effective();
    rows.forEach((row, intent) => row.setKeyLabel(chipLabel(intent, bindings)));
  };
  addProfileHeader(ctx, refresh);
  const perColumn = Math.ceil(REBINDABLE_INTENTS.length / KEY_GRID.columns);
  const bindings = effective();
  REBINDABLE_INTENTS.forEach((entry, i) => {
    const config = gridRow(ctx.area, KEY_GRID, {
      column: Math.floor(i / perColumn),
      row: i % perColumn,
      label: entry.label,
    });
    const row = new SettingsKeyRow(
      ctx.scene,
      config,
      chipLabel(entry.intent, bindings),
      (r) => startRebind(ctx, entry.intent, r, refresh),
    );
    rows.set(entry.intent, row);
  });
  // Focus order: reading order across the two columns.
  for (let r = 0; r < perColumn; r++)
    for (let c = 0; c < KEY_GRID.columns; c++) {
      const entry = REBINDABLE_INTENTS[c * perColumn + r];
      const row = entry ? rows.get(entry.intent) : undefined;
      if (row) ctx.addFocus(row);
    }
}

function addProfileHeader(ctx: SettingsTabContext, refresh: () => void): void {
  const profiles = Array.from({ length: CONTROL_PROFILE_COUNT }, (_, i) => ({
    value: i,
    label: profileName(i),
  }));
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      gridRow(ctx.area, HEADER_GRID, {
        column: 0,
        row: 0,
        label: "Keyboard Profile",
      }),
      profiles,
      ctx.settings().controls.activeProfile,
      (activeProfile) => {
        const s = ctx.settings();
        ctx.update({ ...s, controls: { ...s.controls, activeProfile } });
        refresh();
        ctx.notify(`${profileName(activeProfile)} active.`);
      },
    ),
  );
  const right = gridRow(ctx.area, HEADER_GRID, {
    column: 1,
    row: 0,
    label: "",
  });
  ctx.addFocus(
    createHoverButton(
      ctx.scene,
      right.x + right.width / 2,
      right.y + HEADER_GRID.rowHeight / 2,
      {
        ...RESET_BUTTON,
        label: "RESET TO DEFAULTS",
        color: HOLO_PALETTE.panelFill,
        icon: "refresh",
        variant: "secondary",
      },
      () => {
        ctx.update(withActiveKeyOverrides(ctx.settings(), {}));
        refresh();
        ctx.notify("Profile reset to the default keys.");
      },
    ),
  );
}

function startRebind(
  ctx: SettingsTabContext,
  intent: ActionIntent,
  row: SettingsKeyRow,
  refresh: () => void,
): void {
  row.setCapturing(true);
  ctx.notify(`Press a key for ${LABELS.get(intent) ?? intent} — ESC cancels.`);
  ctx.captureKey(
    (chord) => applyRebind(ctx, intent, chord),
    () => {
      row.setCapturing(false);
      refresh();
    },
  );
}

function applyRebind(
  ctx: SettingsTabContext,
  intent: ActionIntent,
  chord: KeyChord,
): void {
  const s = ctx.settings();
  const result = rebindIntent(
    DEFAULT_KEYBOARD_BINDINGS,
    activeKeyOverrides(s),
    intent,
    chord,
  );
  if (result.rejected) {
    ctx.notify(`${chordLabel(chord)} is reserved for Back / Pause.`, "warning");
    return;
  }
  ctx.update(withActiveKeyOverrides(s, result.overrides));
  const name = LABELS.get(intent) ?? intent;
  if (result.displaced.length === 0) {
    ctx.notify(`${name} → ${chordLabel(chord)}.`);
    return;
  }
  const bindings = applyKeyOverrides(
    DEFAULT_KEYBOARD_BINDINGS,
    result.overrides,
  );
  const moved = result.displaced
    .map(
      (d) => `${LABELS.get(d) ?? d} → ${chordLabel(primaryChord(bindings, d))}`,
    )
    .join(", ");
  ctx.notify(
    `Conflict: ${chordLabel(chord)} was in use. Swapped: ${moved}.`,
    "warning",
  );
}

/**
 * Gamepad tab: the standard-layout bindings (read-only).
 *
 * @param ctx - Tab context.
 */
export function buildGamepadTab(ctx: SettingsTabContext): void {
  const { area, scene } = ctx;
  const rows = CONTROL_GROUPS.flatMap((g) => g.rows).filter(
    (row) => gamepadLabelFor(row.intents) !== "—",
  );
  const perColumn = Math.ceil(rows.length / 2);
  const columnWidth = area.width / 2;
  rows.forEach((row, i) => {
    const x = area.x + Math.floor(i / perColumn) * columnWidth;
    const y = area.y + GAMEPAD_ROW.top + (i % perColumn) * GAMEPAD_ROW.height;
    const style = {
      ...holoFont(GAMEPAD_ROW.labelSize, "400"),
      color: toCssColor(HOLO_PALETTE.textSecondary),
    };
    scene.add.text(x, y, row.label, style);
    scene.add
      .text(
        x + columnWidth - GAMEPAD_ROW.notePad,
        y,
        gamepadLabelFor(row.intents),
        {
          ...style,
          color: toCssColor(HOLO_PALETTE.textPrimary),
        },
      )
      .setOrigin(1, 0);
  });
  scene.add
    .text(
      area.x + area.width / 2,
      area.y + area.height - GAMEPAD_ROW.notePad,
      "Standard (Xbox) layout · B = back in every menu · gamepad rebinding is not available yet",
      {
        ...holoFont(GAMEPAD_ROW.labelSize, "400"),
        color: toCssColor(HOLO_PALETTE.textMuted),
      },
    )
    .setOrigin(0.5, 1);
}
