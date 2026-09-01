/**
 * CapitalSystemsIndicator — compact HUD readout of a capital ship's three
 * subsystems (engines/turrets/bridge): green chip while online, dark red
 * once disabled. Shown above the health bar only for capital-class ships.
 */

import Phaser from "phaser";
import type {
  CapitalSystemId,
  CapitalSystemsState,
} from "../systems/CapitalSystems";

const CHIP_WIDTH = 26;
const CHIP_HEIGHT = 10;
const CHIP_GAP = 3;
const ONLINE_COLOR = 0x33cc55;
const OFFLINE_COLOR = 0x662222;

const ORDER: readonly CapitalSystemId[] = ["engines", "turrets", "bridge"];
const LABELS: Readonly<Record<CapitalSystemId, string>> = {
  engines: "ENG",
  turrets: "TUR",
  bridge: "BRG",
};

export class CapitalSystemsIndicator extends Phaser.GameObjects.Container {
  private readonly chips: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const totalWidth = ORDER.length * (CHIP_WIDTH + CHIP_GAP) - CHIP_GAP;

    ORDER.forEach((id, i) => {
      const chipX = -totalWidth / 2 + i * (CHIP_WIDTH + CHIP_GAP);
      const chip = scene.add.graphics();
      this.add(chip);
      this.chips.push(chip);

      const label = scene.add
        .text(chipX + CHIP_WIDTH / 2, 0, LABELS[id], {
          font: "7px monospace",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.add(label);
    });

    scene.add.existing(this);
  }

  /** Redraws each chip's fill color from the current system states. */
  update(systems: CapitalSystemsState): void {
    const totalWidth = ORDER.length * (CHIP_WIDTH + CHIP_GAP) - CHIP_GAP;
    ORDER.forEach((id, i) => {
      const chipX = -totalWidth / 2 + i * (CHIP_WIDTH + CHIP_GAP);
      const chip = this.chips[i]!;
      const online = !systems[id].disabled;
      chip.clear();
      chip.fillStyle(online ? ONLINE_COLOR : OFFLINE_COLOR, 0.9);
      chip.fillRoundedRect(chipX, -CHIP_HEIGHT / 2, CHIP_WIDTH, CHIP_HEIGHT, 2);
    });
  }
}
