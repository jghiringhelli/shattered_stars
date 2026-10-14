/**
 * aceDuelAbilityChips — the row of ace ability chips on the Ace Duel BUILDS
 * tab: your ace's abilities then the rival's, each chip tinted by its side
 * and explained on hover.
 */

import type { AceMatchup } from "../../data/AceMatchups";
import type { PilotAbility } from "../../systems/PilotAbilities";
import { addSelectable } from "../../ui/menu/FlatControls";
import { addPickerText } from "../../ui/picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING, SIDE_COLORS } from "../../ui/theme/HoloTheme";
import type { BodyArea } from "./duelSetupChrome";
import { measureText } from "./duelSetupWidgets";

/** Chip height (px). */
const CHIP_H = 32;
/** Horizontal padding inside a chip (px). */
const CHIP_PAD = 16;

/** What to draw. */
export interface AbilityChipsSpec {
  readonly mine: AceMatchup["side1"];
  readonly foe: AceMatchup["side1"];
  /** Top of the heading. */
  readonly y: number;
  readonly lookup: Readonly<Record<string, PilotAbility | undefined>>;
}

/**
 * @param area - Scene, root and x range.
 * @param spec - Both aces and the ability table.
 */
export function drawAbilityChips(area: BodyArea, spec: AbilityChipsSpec): void {
  const { scene, root } = area;
  root.add(
    addPickerText(scene, { x: area.x, y: spec.y - HOLO_SPACING.lg }, "ACE ABILITIES  (YOURS, THEN THE RIVAL)", "caption", HOLO_PALETTE.textSecondary),
  );
  let x = area.x;
  const sides = [
    { ids: spec.mine.abilities, color: SIDE_COLORS.player },
    { ids: spec.foe.abilities, color: SIDE_COLORS.enemy },
  ];
  for (const { ids, color } of sides) {
    for (const id of ids) {
      const ability = spec.lookup[id];
      if (!ability) continue;
      const label = ability.name.toUpperCase();
      const width = measureText(scene, label, "micro") + CHIP_PAD * 2;
      addSelectable(scene, root, {
        x,
        y: spec.y,
        width,
        height: CHIP_H,
        label,
        role: "micro",
        selected: false,
        accent: color,
        tip: { title: ability.name, body: ability.description, example: "Every ace ability is a real-time effect: it works the whole fight, not once per turn." },
        onPress: () => undefined,
      });
      x += width + HOLO_SPACING.sm;
    }
    x += HOLO_SPACING.lg;
  }
}
