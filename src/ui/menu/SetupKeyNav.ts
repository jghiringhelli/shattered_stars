/**
 * SetupKeyNav — keyboard and gamepad navigation for setup screens built from
 * free-form controls (Dogfight, Ace Duel, Survival): ↑↓←→ / D-pad move the
 * focus ring to the neighbouring control, ENTER / SPACE / A press it.
 *
 * It finds every interactive object in the scene by itself, so the screens'
 * widgets need no changes. Call {@link SetupKeyNav.refresh} after the screen
 * is rebuilt: the ring returns to the control nearest where it was.
 */

import Phaser from "phaser";
import { HOLO_DEPTH, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import {
  boxCentre,
  nearestIndex,
  nextByDirection,
  type FocusBox,
  type FocusDirection,
} from "./focusGeometry";

/** Outset of the ring around a control (px). */
const RING_OUTSET = 3;
/** Ring stroke width (px). */
const RING_WIDTH = 2;

const KEY_DIRECTIONS: Readonly<Record<string, FocusDirection>> = {
  "keydown-UP": "up",
  "keydown-DOWN": "down",
  "keydown-LEFT": "left",
  "keydown-RIGHT": "right",
};

/** Standard-layout D-pad buttons. */
const PAD_DIRECTIONS: Readonly<Record<number, FocusDirection>> = {
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
const PAD_A = 0;

/** Options of {@link SetupKeyNav}. */
export interface SetupKeyNavOptions {
  /** Navigate only while this returns true (setup phase). */
  readonly isActive: () => boolean;
}

/** An interactive game object with its screen box. */
interface NavTarget {
  readonly object: Phaser.GameObjects.GameObject;
  readonly box: FocusBox;
}

type Hittable = Phaser.GameObjects.GameObject & {
  displayOriginX?: number;
  displayOriginY?: number;
};

/** Keyboard + gamepad focus ring over a scene's interactive objects. */
export class SetupKeyNav {
  private targets: NavTarget[] = [];
  private index = -1;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly handlers: Array<[string, (e?: KeyboardEvent) => void]> = [];
  private padHandler: ((pad: unknown, button: { index: number }) => void) | null =
    null;

  /**
   * @param scene - The setup scene.
   * @param options - Activity gate.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: SetupKeyNavOptions,
  ) {
    this.ring = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(HOLO_DEPTH.menuControl + 1)
      .setVisible(false);
    this.bindKeys();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Re-collect the controls after a rebuild, keeping the ring near where it was. */
  refresh(): void {
    const previous = this.targets[this.index];
    this.targets = collectTargets(this.scene);
    if (previous === undefined) {
      this.index = -1;
    } else {
      this.index = nearestIndex(
        this.targets.map((t) => t.box),
        boxCentre(previous.box),
      );
    }
    this.draw();
  }

  /** Per frame: follow rebuilt screens while the ring is showing. */
  private readonly tick = (): void => {
    if (this.index < 0 || !this.ring.scene) return;
    if (!this.options.isActive()) {
      this.ring.setVisible(false);
      return;
    }
    this.refresh();
  };

  /** Remove listeners and the ring. */
  destroy(): void {
    this.scene.events?.off(Phaser.Scenes.Events.UPDATE, this.tick);
    const keyboard = this.scene.input?.keyboard;
    for (const [event, handler] of this.handlers) keyboard?.off(event, handler);
    this.handlers.length = 0;
    if (this.padHandler) this.scene.input?.gamepad?.off("down", this.padHandler);
    this.padHandler = null;
    if (this.ring.scene) this.ring.destroy();
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      for (const [event, direction] of Object.entries(KEY_DIRECTIONS)) {
        this.on(keyboard, event, () => this.move(direction));
      }
      this.on(keyboard, "keydown-TAB", () => this.move("down"));
      this.on(keyboard, "keydown-ENTER", () => this.press());
      this.on(keyboard, "keydown-SPACE", () => this.press());
    }
    const gamepad = this.scene.input.gamepad;
    if (!gamepad) return;
    this.padHandler = (_pad, button) => {
      if (!this.options.isActive()) return;
      if (button.index === PAD_A) return this.press();
      const direction = PAD_DIRECTIONS[button.index];
      if (direction) this.move(direction);
    };
    gamepad.on("down", this.padHandler);
  }

  private on(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    event: string,
    action: () => void,
  ): void {
    const handler = (): void => {
      if (this.options.isActive()) action();
    };
    keyboard.on(event, handler);
    this.handlers.push([event, handler]);
  }

  private move(direction: FocusDirection): void {
    this.refresh();
    const next = nextByDirection(
      this.targets.map((t) => t.box),
      this.index,
      direction,
    );
    if (next < 0) return;
    this.index = next;
    this.draw();
  }

  private press(): void {
    this.refresh();
    const target = this.targets[this.index];
    if (!target?.object.active) return;
    const object = target.object as Phaser.GameObjects.GameObject & {
      activate?: () => void;
    };
    if (object.activate) object.activate();
    else object.emit("pointerdown", this.scene.input.activePointer);
  }

  private draw(): void {
    this.ring.clear();
    const target = this.targets[this.index];
    this.ring.setVisible(target !== undefined);
    if (!target) return;
    const { x, y, width, height } = target.box;
    this.ring
      .lineStyle(RING_WIDTH, HOLO_PALETTE.accent, 1)
      .strokeRoundedRect(
        x - RING_OUTSET,
        y - RING_OUTSET,
        width + RING_OUTSET * 2,
        height + RING_OUTSET * 2,
        HOLO_RADIUS.md,
      );
  }
}

/** @returns Every visible interactive object of the scene with its screen box. */
function collectTargets(scene: Phaser.Scene): NavTarget[] {
  const found: NavTarget[] = [];
  const visit = (objects: readonly Phaser.GameObjects.GameObject[]): void => {
    for (const object of objects) {
      const visible = (object as { visible?: boolean }).visible !== false;
      if (!object.active || !visible) continue;
      const box = hitBox(object as Hittable);
      if (object.input?.enabled && box) found.push({ object, box });
      else if (object instanceof Phaser.GameObjects.Container)
        visit(object.list as Phaser.GameObjects.GameObject[]);
    }
  };
  visit(scene.children.list);
  return found;
}

/**
 * @param object - An interactive object.
 * @returns Its hit rectangle in screen pixels, or null without a rectangle hit area.
 */
function hitBox(object: Hittable): FocusBox | null {
  const area = object.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  if (!area || typeof area.width !== "number") return null;
  const matrix = (
    object as unknown as {
      getWorldTransformMatrix: () => Phaser.GameObjects.Components.TransformMatrix;
    }
  ).getWorldTransformMatrix();
  return {
    x: matrix.tx + area.x - (object.displayOriginX ?? 0),
    y: matrix.ty + area.y - (object.displayOriginY ?? 0),
    width: area.width,
    height: area.height,
  };
}
