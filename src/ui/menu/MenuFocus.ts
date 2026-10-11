/**
 * MenuFocus — keyboard and gamepad navigation with a visible focus ring for
 * a list of menu controls (HoloButton / HoloPressButton or anything with the
 * same `setFocused` + `activate` shape).
 *
 * The ring appears on the first arrow / Tab / D-pad press (focus-visible
 * semantics), so pointer users never see a stray highlight. ENTER or
 * gamepad A activates the focused control. Listeners are scoped to the
 * scene's input plugins and removed by `destroy()` (or automatically when
 * the scene shuts down).
 */

import type Phaser from "phaser";
import { playUiHover } from "./menuTransitions";

/** A control the focus ring can land on. */
export interface FocusTarget {
  setFocused(focused: boolean): unknown;
  activate(): void;
  /** Disabled controls are skipped. Default: enabled. */
  readonly enabled?: boolean;
  /** Hidden / destroyed controls are skipped. */
  readonly visible?: boolean;
}

/** Navigation options. */
export interface MenuFocusOptions {
  /** Items per row for LEFT/RIGHT vs UP/DOWN movement. Default 1 (vertical). */
  readonly columns?: number;
  /** Only navigate while this returns true (e.g. overlay visible). */
  readonly isActive?: () => boolean;
}

/** Keys handled by the focus controller. */
const NAV_EVENTS = [
  "keydown-UP",
  "keydown-DOWN",
  "keydown-LEFT",
  "keydown-RIGHT",
  "keydown-TAB",
  "keydown-ENTER",
] as const;
type NavEvent = (typeof NAV_EVENTS)[number];

/**
 * Standard-layout gamepad buttons that mirror the navigation keys:
 * A = ENTER, D-pad = arrows (B = back lives in bindMenuBack).
 */
const GAMEPAD_NAV: Readonly<Record<number, NavEvent>> = {
  0: "keydown-ENTER",
  12: "keydown-UP",
  13: "keydown-DOWN",
  14: "keydown-LEFT",
  15: "keydown-RIGHT",
};

/** Keyboard + gamepad focus controller for a fixed set of controls. */
export class MenuFocus {
  private index = -1;
  private lastEvent: KeyboardEvent | null = null;
  private lastSignature = "";
  private lastTimeStamp = -Infinity;
  private readonly handlers: Array<[string, (e?: KeyboardEvent) => void]> = [];
  private gamepadHandler:
    ((pad: unknown, button: { readonly index: number }) => void) | null = null;

  /**
   * @param scene - Scene whose keyboard drives navigation.
   * @param targets - Controls in reading order.
   * @param options - Grid columns and activity predicate.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly targets: ReadonlyArray<FocusTarget>,
    private readonly options: MenuFocusOptions = {},
  ) {
    const columns = Math.max(1, options.columns ?? 1);
    const steps: Record<NavEvent, () => void> = {
      "keydown-UP": () => this.move(-columns),
      "keydown-DOWN": () => this.move(columns),
      "keydown-LEFT": () => this.move(columns > 1 ? -1 : 0),
      "keydown-RIGHT": () => this.move(columns > 1 ? 1 : 0),
      "keydown-TAB": () => this.move(1),
      "keydown-ENTER": () => this.activateFocused(),
    };
    this.bindGamepad(steps);
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;
    for (const event of NAV_EVENTS) {
      const handler = (keyEvent?: KeyboardEvent): void => {
        if (this.options.isActive && !this.options.isActive()) return;
        if (this.isRepeatDelivery(keyEvent)) return;
        steps[event]();
      };
      keyboard.on(event, handler);
      this.handlers.push([event, handler]);
    }
  }

  /**
   * Gamepad A / D-pad drive the same steps as ENTER / arrows (gamepad
   * "down" events fire once per press, so no repeat guard is needed).
   *
   * @param steps - Navigation step per key event.
   */
  private bindGamepad(steps: Readonly<Record<NavEvent, () => void>>): void {
    const gamepad = this.scene.input.gamepad;
    if (!gamepad) return;
    this.gamepadHandler = (_pad, button) => {
      const event = GAMEPAD_NAV[button.index];
      if (!event) return;
      if (this.options.isActive && !this.options.isActive()) return;
      steps[event]();
    };
    gamepad.on("down", this.gamepadHandler);
  }

  /**
   * Phaser can deliver one physical key event more than once — in the same
   * frame, or re-emit an older queued event a frame later; only the first
   * delivery of the newest event moves focus.
   *
   * @param keyEvent - The DOM keyboard event, when provided.
   * @returns True when this event (or a newer one) was already handled.
   */
  private isRepeatDelivery(keyEvent: KeyboardEvent | undefined): boolean {
    if (!keyEvent) return false;
    const signature = `${keyEvent.keyCode}@${keyEvent.timeStamp}`;
    if (
      keyEvent === this.lastEvent ||
      signature === this.lastSignature ||
      keyEvent.timeStamp < this.lastTimeStamp
    ) {
      return true;
    }
    this.lastEvent = keyEvent;
    this.lastSignature = signature;
    this.lastTimeStamp = keyEvent.timeStamp;
    return false;
  }

  /** Index of the focused control, or -1 before keyboard use. */
  get focusedIndex(): number {
    return this.index;
  }

  /**
   * Focus a control programmatically (shows the ring).
   *
   * @param index - Control index.
   */
  focus(index: number): void {
    if (index < 0 || index >= this.targets.length) return;
    this.targets[this.index]?.setFocused(false);
    this.index = index;
    this.targets[index]?.setFocused(true);
  }

  /** Hide the ring (e.g. when the overlay closes). */
  clear(): void {
    this.targets[this.index]?.setFocused(false);
    this.index = -1;
  }

  /** Remove keyboard and gamepad listeners. */
  destroy(): void {
    const keyboard = this.scene.input?.keyboard;
    for (const [event, handler] of this.handlers) keyboard?.off(event, handler);
    this.handlers.length = 0;
    if (this.gamepadHandler)
      this.scene.input?.gamepad?.off("down", this.gamepadHandler);
    this.gamepadHandler = null;
  }

  private usable(target: FocusTarget | undefined): boolean {
    return (
      target !== undefined &&
      target.enabled !== false &&
      target.visible !== false
    );
  }

  private move(step: number): void {
    const count = this.targets.length;
    if (count === 0 || step === 0) return;
    let next = this.index < 0 ? (step > 0 ? -1 : 0) : this.index;
    for (let tries = 0; tries < count; tries++) {
      next = (next + step + count * Math.abs(step)) % count;
      if (this.usable(this.targets[next])) {
        this.focus(next);
        playUiHover();
        return;
      }
    }
  }

  private activateFocused(): void {
    const target = this.targets[this.index];
    if (this.usable(target)) target?.activate();
  }
}
