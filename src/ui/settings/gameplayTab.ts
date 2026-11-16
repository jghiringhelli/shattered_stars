/**
 * Settings › Gameplay: default difficulty, squad mark assist, damage numbers,
 * the ship specials rule and the steering mode (template or analog turn key).
 * Every change goes through `ctx.update` (persist + apply).
 */

import { t, type PlainMessageKey } from "../../i18n";
import {
  DIFFICULTY_LEVELS,
  SHIP_SPECIALS_OPTIONS,
  type GameplayPrefs,
} from "../../systems/SettingsStorage";
import { STEERING_MODES, type SteeringMode } from "../../core/steeringMode";
import { SettingsChoiceRow } from "./settingsChoiceRows";
import { SettingsSwitchRow } from "./settingsRows";
import { gridRow, type SettingsTabContext } from "./settingsTabContext";
import { centeredArea, ONE_COLUMN } from "./settingsTabs";

/** Rows after the difficulty row (0) and the two switches (1, 2). */
const SHIP_SPECIALS_ROW = 3;
const STEERING_MODE_ROW = 4;

/** Option label of each steering mode. */
const STEERING_LABEL_KEYS: Readonly<Record<SteeringMode, PlainMessageKey>> = {
  template: "settings.gameplay.steering.template",
  analog: "settings.gameplay.steering.analog",
};

function patchGameplay(
  ctx: SettingsTabContext,
  patch: Partial<GameplayPrefs>,
): void {
  const s = ctx.settings();
  ctx.update({ ...s, gameplay: { ...s.gameplay, ...patch } });
}

/**
 * Gameplay: default difficulty, squad mark assist, damage numbers, ship
 * specials rule, steering mode.
 *
 * @param ctx - Tab context.
 */
export function buildGameplayTab(ctx: SettingsTabContext): void {
  const area = centeredArea(ctx, ONE_COLUMN.width ?? 0);
  const at = (row: number, label: string) =>
    gridRow(area, ONE_COLUMN, { column: 0, row, label });
  const g = ctx.settings().gameplay;
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(0, "Default Difficulty"),
      DIFFICULTY_LEVELS.map((value) => ({ value, label: value })),
      g.defaultDifficulty,
      (defaultDifficulty) => patchGameplay(ctx, { defaultDifficulty }),
    ),
  );
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(SHIP_SPECIALS_ROW, "Ship Specials"),
      SHIP_SPECIALS_OPTIONS.map(({ value, label }) => ({ value, label })),
      g.shipSpecials,
      (shipSpecials) => patchGameplay(ctx, { shipSpecials }),
    ),
  );
  ctx.addFocus(
    new SettingsChoiceRow(
      ctx.scene,
      at(STEERING_MODE_ROW, t("settings.gameplay.steering.label")),
      STEERING_MODES.map((value) => ({
        value,
        label: t(STEERING_LABEL_KEYS[value]),
      })),
      g.steeringMode,
      (steeringMode) => patchGameplay(ctx, { steeringMode }),
    ),
  );
  const toggles: ReadonlyArray<
    [string, "markAssist" | "showDamageNumbers"]
  > = [
    ["Wingmen Mark Assist", "markAssist"],
    ["Damage Numbers", "showDamageNumbers"],
  ];
  toggles.forEach(([label, key], i) => {
    ctx.addFocus(
      new SettingsSwitchRow(ctx.scene, at(i + 1, label), g[key], (v) =>
        patchGameplay(ctx, { [key]: v }),
      ),
    );
  });
}
