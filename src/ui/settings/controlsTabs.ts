/**
 * Settings › Controls: keyboard rebinding with profiles, conflict swap and
 * reset. Also the shared profile header and row grid the Gamepad tab
 * (gamepadTab.ts) reuses.
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
import {
  REBINDABLE_INTENTS,
  type RebindableIntent,
} from "../../input/RebindableIntents";
import {
  CONTROL_PROFILE_COUNT,
  activeKeyOverrides,
  profileName,
  withActiveKeyOverrides,
  type GameSettings,
} from "../../systems/SettingsStorage";
import { createHoverButton } from "../ButtonFactory";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { SettingsChoiceRow, SettingsKeyRow } from "./settingsChoiceRows";
import type { SettingsRowConfig } from "./settingsRows";
import {
  gridRow,
  type RowGrid,
  type SettingsTabContext,
} from "./settingsTabContext";

const HEADER_GRID: RowGrid = { columns: 2, rowHeight: 44, gap: 0 };
const KEY_GRID: RowGrid = { columns: 2, rowHeight: 30, gap: 4, top: 56 };
const RESET_BUTTON = { width: 220, height: 36, font: "600 13px" } as const;

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
  addProfileHeader(ctx, refresh, {
    label: "Keyboard Profile",
    reset: (s) => withActiveKeyOverrides(s, {}),
    resetNotice: "Profile reset to the default keys.",
  });
  const bindings = effective();
  addRebindRows(ctx, REBINDABLE_INTENTS, (entry, config) => {
    const row = new SettingsKeyRow(
      ctx.scene,
      config,
      chipLabel(entry.intent, bindings),
      (r) => startRebind(ctx, entry.intent, r, refresh),
    );
    rows.set(entry.intent, row);
    return row;
  });
}

/**
 * Lay rebinding rows out in two columns under the header (flight, then
 * combat, then system) and register them for focus in reading order.
 *
 * @param ctx - Tab context.
 * @param entries - Rebindable intents, in display order.
 * @param createRow - Builds one row at its grid placement.
 */
export function addRebindRows(
  ctx: SettingsTabContext,
  entries: readonly RebindableIntent[],
  createRow: (
    entry: RebindableIntent,
    config: SettingsRowConfig,
  ) => SettingsKeyRow,
): void {
  const perColumn = Math.ceil(entries.length / KEY_GRID.columns);
  const rows = entries.map((entry, i) =>
    createRow(
      entry,
      gridRow(ctx.area, KEY_GRID, {
        column: Math.floor(i / perColumn),
        row: i % perColumn,
        label: entry.label,
      }),
    ),
  );
  for (let r = 0; r < perColumn; r++)
    for (let c = 0; c < KEY_GRID.columns; c++) {
      const row = rows[c * perColumn + r];
      if (row) ctx.addFocus(row);
    }
}

/** What a profile header's reset button clears. */
export interface ProfileHeaderOptions {
  readonly label: string;
  /** Settings with the active profile's bindings for this device cleared. */
  readonly reset: (settings: GameSettings) => GameSettings;
  readonly resetNotice: string;
}

/**
 * Header row of a rebinding tab: the active profile chooser and a reset
 * button (profiles hold keyboard and gamepad bindings together).
 *
 * @param ctx - Tab context.
 * @param refresh - Re-reads the rows' labels.
 * @param options - Row label and what reset clears.
 */
export function addProfileHeader(
  ctx: SettingsTabContext,
  refresh: () => void,
  options: ProfileHeaderOptions,
): void {
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
        label: options.label,
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
        ctx.update(options.reset(ctx.settings()));
        refresh();
        ctx.notify(options.resetNotice);
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
