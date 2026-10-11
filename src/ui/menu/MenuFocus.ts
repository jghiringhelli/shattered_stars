/**
 * MenuFocus — keyboard navigation with a visible focus ring for a list of
 * menu controls (HoloButton / HoloPressButton or anything with the same
 * `setFocused` + `activate` shape).
 *
 * The ring appears on the first arrow / Tab press (focus-visible semantics),
 * so pointer users never see a stray highlight. ENTER activates the focused
 * control. Listeners are scoped to the scene's keyboard plugin and removed
 * by `destroy()` (or automatically when the scene shuts down).
 */

import type Phaser from "phaser";

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

/** Keyboard focus controller for a fixed set of controls. */
export class MenuFocus {
  private index = -1;
  private lastEvent: KeyboardEvent | null = null;
  private lastSignature = "";
  private readonly handlers: Array<[string, (e?: KeyboardEvent) => void]> = [];

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
    const steps: Record<(typeof NAV_EVENTS)[number], () => void> = {
      "keydown-UP": () => this.move(-columns),
      "keydown-DOWN": () => this.move(columns),
      "keydown-LEFT": () => this.move(columns > 1 ? -1 : 0),
      "keydown-RIGHT": () => this.move(columns > 1 ? 1 : 0),
      "keydown-TAB": () => this.move(1),
      "keydown-ENTER": () => this.activateFocused(),
    };
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
   * Phaser can deliver one physical key event more than once in a frame;
   * only the first delivery moves focus.
   *
   * @param keyEvent - The DOM keyboard event, when provided.
   * @returns True when this exact event was already handled.
   */
  private isRepeatDelivery(keyEvent: KeyboardEvent | undefined): boolean {
    if (!keyEvent) return false;
    const signature = `${keyEvent.keyCode}@${keyEvent.timeStamp}`;
    if (keyEvent === this.lastEvent || signature === this.lastSignature) {
      return true;
    }
    this.lastEvent = keyEvent;
    this.lastSignature = signature;
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

  /** Remove keyboard listeners. */
  destroy(): void {
    const keyboard = this.scene.input?.keyboard;
    for (const [event, handler] of this.handlers) keyboard?.off(event, handler);
    this.handlers.length = 0;
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
        return;
      }
    }
  }

  private activateFocused(): void {
    const target = this.targets[this.index];
    if (this.usable(target)) target?.activate();
  }
}
