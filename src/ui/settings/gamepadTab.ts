/**
 * Settings › Gamepad — button rebinding per control profile, with the
 * keyboard's conflict rules (swap on a shared button, B / Start reserved,
 * fixed menu/tactical buttons refused) and a reset. Steering and throttle
 * stay on the left stick.
 */

import { DEFAULT_GAMEPAD_BINDINGS } from "../../input/DefaultBindings";
import type { ActionIntent } from "../../input/InputTypes";
import {
  GAMEPAD_REBINDABLE_INTENTS,
  applyGamepadOverrides,
  gamepadButtonLabel,
  primaryButton,
  rebindGamepadIntent,
  type ButtonProblem,
} from "../../input/GamepadBindings";
import {
  activeGamepadOverrides,
  withActiveGamepadOverrides,
} from "../../systems/SettingsStorage";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { addProfileHeader, addRebindRows } from "./controlsTabs";
import { SettingsKeyRow } from "./settingsChoiceRows";
import type { SettingsTabContext } from "./settingsTabContext";

/** Footer note under the rows. */
const NOTE = {
  size: 12,
  bottomPad: 6,
  text: "Left stick steers + throttles · B = back · Start = pause · D-pad + A navigate menus",
} as const;

/** Chip text while waiting for a button. */
const CAPTURE_LABEL = "PRESS A BUTTON";

const LABELS: ReadonlyMap<ActionIntent, string> = new Map(
  GAMEPAD_REBINDABLE_INTENTS.map((r) => [r.intent, r.label]),
);

/** Why a pressed button was refused, as a notice. */
const REFUSALS: Readonly<Record<ButtonProblem, (button: string) => string>> = {
  reserved: (b) => `${b} is reserved (B = back, Start = pause).`,
  unknown_button: (b) => `${b} is not on the standard layout.`,
  fixed: (b) => `${b} is needed by menus / tactical orders there.`,
};

/**
 * Gamepad tab: profile chooser, reset, one button row per rebindable intent.
 *
 * @param ctx - Tab context.
 */
export function buildGamepadTab(ctx: SettingsTabContext): void {
  const rows = new Map<ActionIntent, SettingsKeyRow>();
  const effective = () =>
    applyGamepadOverrides(
      DEFAULT_GAMEPAD_BINDINGS,
      activeGamepadOverrides(ctx.settings()),
    );
  const labelOf = (intent: ActionIntent): string =>
    gamepadButtonLabel(primaryButton(effective(), intent));
  const refresh = (): void =>
    rows.forEach((row, intent) => row.setKeyLabel(labelOf(intent)));
  addProfileHeader(ctx, refresh, {
    label: "Gamepad Profile",
    reset: (s) => withActiveGamepadOverrides(s, {}),
    resetNotice: "Gamepad reset to the standard layout.",
  });
  addRebindRows(ctx, GAMEPAD_REBINDABLE_INTENTS, (entry, config) => {
    const row = new SettingsKeyRow(
      ctx.scene,
      config,
      labelOf(entry.intent),
      (r) => startButtonRebind(ctx, entry.intent, r, refresh),
      CAPTURE_LABEL,
    );
    rows.set(entry.intent, row);
    return row;
  });
  addNote(ctx);
}

function addNote(ctx: SettingsTabContext): void {
  const { area, scene } = ctx;
  scene.add
    .text(
      area.x + area.width / 2,
      area.y + area.height - NOTE.bottomPad,
      NOTE.text,
      {
        ...holoFont(NOTE.size, "400"),
        color: toCssColor(HOLO_PALETTE.textMuted),
      },
    )
    .setOrigin(0.5, 1);
}

function startButtonRebind(
  ctx: SettingsTabContext,
  intent: ActionIntent,
  row: SettingsKeyRow,
  refresh: () => void,
): void {
  row.setCapturing(true);
  ctx.notify(
    `Press a gamepad button for ${LABELS.get(intent) ?? intent} — B or ESC cancels.`,
  );
  ctx.captureButton(
    (button) => applyButtonRebind(ctx, intent, button),
    () => {
      row.setCapturing(false);
      refresh();
    },
  );
}

/**
 * Apply a captured button and explain the outcome (bound, swapped, refused).
 *
 * @param ctx - Tab context.
 * @param intent - Intent being rebound.
 * @param button - Pressed button index.
 */
export function applyButtonRebind(
  ctx: SettingsTabContext,
  intent: ActionIntent,
  button: number,
): void {
  const s = ctx.settings();
  const result = rebindGamepadIntent(
    DEFAULT_GAMEPAD_BINDINGS,
    activeGamepadOverrides(s),
    intent,
    button,
  );
  const label = gamepadButtonLabel(button);
  if (result.rejected) {
    ctx.notify(REFUSALS[result.rejected](label), "warning");
    return;
  }
  ctx.update(withActiveGamepadOverrides(s, result.overrides));
  const name = LABELS.get(intent) ?? intent;
  if (result.displaced.length === 0) {
    ctx.notify(`${name} → ${label}.`);
    return;
  }
  const bindings = applyGamepadOverrides(
    DEFAULT_GAMEPAD_BINDINGS,
    result.overrides,
  );
  const moved = result.displaced
    .map(
      (d) =>
        `${LABELS.get(d) ?? d} → ${gamepadButtonLabel(primaryButton(bindings, d))}`,
    )
    .join(", ");
  ctx.notify(`Conflict: ${label} was in use. Swapped: ${moved}.`, "warning");
}
