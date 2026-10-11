/**
 * SettingsInputCapture — waits for the next key chord (Settings › Controls)
 * or gamepad button (Settings › Gamepad) to rebind. ESC cancels either; B
 * cancels a button capture (B is reserved for back). Capture is armed on the
 * next tick so the ENTER / A press that opened it is ignored, and released
 * on the tick after it ends so the same ESC / B does not also leave Settings.
 */

import type Phaser from "phaser";
import { chordFromKeyEvent, type KeyChord } from "../../input/KeyBindings";

/** DOM keyCode of Escape (cancels capture). */
const ESC_KEY_CODE = 27;
/** Standard-layout index of gamepad B (cancels a button capture). */
const GAMEPAD_CANCEL_BUTTON = 1;
/** Notice shown when the player cancels. */
const CANCELLED_NOTICE = "Rebinding cancelled.";

type GamepadDownHandler = (
  pad: unknown,
  button: { readonly index: number },
) => void;

/** One-shot input capture for the Settings rebinding rows. */
export class SettingsInputCapture {
  private active = false;

  /**
   * @param scene - The Settings scene.
   * @param notify - Shows a one-line notice.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly notify: (message: string) => void,
  ) {}

  /** True while waiting for a key or button. */
  get capturing(): boolean {
    return this.active;
  }

  /**
   * Wait for the next real key chord; modifiers alone keep waiting.
   *
   * @param onChord - Receives the chord pressed.
   * @param onDone - Called when capture ends (chord or cancel).
   */
  captureKey(onChord: (chord: KeyChord) => void, onDone: () => void): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard || this.active) return;
    const armedAt = this.begin();
    const listener = (event: KeyboardEvent): void => {
      if (event.timeStamp < armedAt) return;
      event.preventDefault();
      if (event.keyCode === ESC_KEY_CODE) return this.cancel(finish);
      const chord = chordFromKeyEvent(event);
      if (!chord) return;
      onChord(chord);
      finish();
    };
    const finish = (): void => {
      keyboard.off("keydown", listener);
      this.end(onDone);
    };
    this.scene.time.delayedCall(0, () => keyboard.on("keydown", listener));
  }

  /**
   * Wait for the next gamepad button; ESC (keyboard) or B cancels.
   *
   * @param onButton - Receives the standard-layout button index.
   * @param onDone - Called when capture ends (button or cancel).
   */
  captureButton(onButton: (button: number) => void, onDone: () => void): void {
    const gamepad = this.scene.input.gamepad;
    const keyboard = this.scene.input.keyboard;
    if (!gamepad || this.active) return;
    const armedAt = this.begin();
    const onPad: GamepadDownHandler = (_pad, button) => {
      if (button.index === GAMEPAD_CANCEL_BUTTON) return this.cancel(finish);
      onButton(button.index);
      finish();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.timeStamp >= armedAt && event.keyCode === ESC_KEY_CODE)
        this.cancel(finish);
    };
    const finish = (): void => {
      gamepad.off("down", onPad);
      keyboard?.off("keydown", onKey);
      this.end(onDone);
    };
    this.scene.time.delayedCall(0, () => {
      gamepad.on("down", onPad);
      keyboard?.on("keydown", onKey);
    });
  }

  /** @returns The time capture was armed (older key events are ignored). */
  private begin(): number {
    this.active = true;
    return performance.now();
  }

  private cancel(finish: () => void): void {
    this.notify(CANCELLED_NOTICE);
    finish();
  }

  private end(onDone: () => void): void {
    onDone();
    this.scene.time.delayedCall(0, () => (this.active = false));
  }
}
