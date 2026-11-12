/**
 * FactionRow — the five faction toggles above the ship catalog (step 1 of
 * the Skirmish setup). Each has a tooltip and is a keyboard focus target.
 */

import type Phaser from "phaser";
import { FACTION_COLORS, type FactionId } from "../../../config";
import { factionTermId } from "../../../data/tooltips";
import { createToggleButton } from "../../ButtonFactory";
import type { FocusTarget } from "../../menu/MenuFocus";
import { attachToggleTooltip, focusTipTarget } from "../../menu/tooltipTargets";
import { HOLO_RADIUS, factionAccent } from "../../theme/HoloTheme";
import { SQUAD_TYPE } from "../squadBuilderStyle";

/** Factions in the order of the row. */
export const FACTION_ORDER: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const FACTION_NAMES: Record<FactionId, string> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

/** Row geometry (scene coordinates). */
const ROW = { margin: 32, centreY: 120, height: 32, gap: 12, pipRadius: 4, pipInset: 16 } as const;

/** The faction toggles. */
export class FactionRow {
  private buttons: Phaser.GameObjects.Container[] = [];
  /** Keyboard targets of the toggles (replaced on every render). */
  targets: FocusTarget[] = [];

  /**
   * @param scene - Owning scene.
   * @param onPick - Called with the faction pressed.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPick: (faction: FactionId) => void,
  ) {}

  /** @param selected - The faction to show as selected. */
  render(selected: FactionId): void {
    this.destroy();
    const count = FACTION_ORDER.length;
    const rowW = this.scene.scale.width - ROW.margin * 2;
    const width = (rowW - ROW.gap * (count - 1)) / count;
    this.buttons = FACTION_ORDER.map((faction, i) => {
      const button = createToggleButton(
        this.scene,
        ROW.margin + width / 2 + i * (width + ROW.gap),
        ROW.centreY,
        FACTION_NAMES[faction],
        faction === selected,
        {
          width,
          height: ROW.height,
          radius: HOLO_RADIUS.sm,
          selectedColor: FACTION_COLORS[faction],
          normalColor: FACTION_COLORS[faction],
          font: `${SQUAD_TYPE.body}px`,
          selectedFont: `600 ${SQUAD_TYPE.body}px`,
        },
        () => this.onPick(faction),
      );
      const hit = attachToggleTooltip(this.scene, button, factionTermId(faction));
      button.add(this.scene.add.circle(-width / 2 + ROW.pipInset, 0, ROW.pipRadius, factionAccent(faction)));
      this.targets.push(focusTipTarget(hit, () => this.onPick(faction)));
      return button;
    });
  }

  /** Remove the toggles. */
  destroy(): void {
    this.buttons.forEach((button) => button.destroy());
    this.buttons = [];
    this.targets = [];
  }
}
