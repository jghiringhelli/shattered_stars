/**
 * HoloTextPrompt — in-game replacement for `window.prompt`: a holo dialog
 * with a message, a single-line input field (typing, Backspace, Ctrl+V /
 * paste, Enter to confirm, ESC to cancel) and CANCEL / CONFIRM buttons.
 *
 * Keyboard input is read from the scene keyboard's catch-all `keydown`
 * event, which Phaser emits after key-specific events — scene handlers such
 * as `keydown-ESC` should check {@link HoloTextPrompt.isOpen} first.
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { drawHoloFrame } from "../menu/holoChrome";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { addLobbyText } from "./lobbyLayout";
import { createModalFrame, type ModalFrame } from "./lobbyModal";

/** Dialog content. */
export interface TextPromptOptions {
  readonly title: string;
  readonly message: string;
  readonly initialValue?: string;
  readonly confirmLabel?: string;
}

/** Dialog geometry and behaviour. */
const PROMPT = {
  width: 560,
  height: 184,
  inputHeight: 40,
  buttonWidth: 140,
  buttonHeight: 36,
  messageSize: 14,
  inputSize: 15,
  maxLength: 512,
  caretBlinkMs: 500,
  ellipsis: "…",
} as const;

/** Single-line text input dialog. */
export class HoloTextPrompt {
  private frame: ModalFrame | null = null;
  private inputText: Phaser.GameObjects.Text | null = null;
  private caretTimer: Phaser.Time.TimerEvent | null = null;
  private buffer = "";
  private caretVisible = true;
  /** Key events queued before the dialog opened are ignored. */
  private openedAt = 0;
  /**
   * Last handled event: Phaser can re-emit one queued native event when it
   * runs several scene steps before clearing its key queue.
   */
  private lastEvent: KeyboardEvent | null = null;
  private onDone: ((value: string | null) => void) | null = null;
  private readonly keyHandler = (event: KeyboardEvent): void =>
    this.onKey(event);
  private readonly pasteHandler = (event: ClipboardEvent): void => {
    this.append(event.clipboardData?.getData("text") ?? "");
  };

  /**
   * @param scene - Owning scene.
   */
  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once("shutdown", () => this.teardown());
  }

  /** True while the dialog is shown. */
  get isOpen(): boolean {
    return this.frame !== null;
  }

  /**
   * Whether a key event was already consumed by the dialog (e.g. the ESC
   * that closed it), so scene key handlers can ignore re-emissions.
   *
   * @param event - Native key event.
   * @returns True when the dialog handled this event.
   */
  handled(event: KeyboardEvent): boolean {
    return event === this.lastEvent;
  }

  /**
   * Show the dialog.
   *
   * @param options - Title, message, initial value, confirm label.
   * @param onDone - Receives the entered text, or null when cancelled.
   */
  open(
    options: TextPromptOptions,
    onDone: (value: string | null) => void,
  ): void {
    this.teardown();
    this.openedAt = performance.now();
    this.buffer = options.initialValue ?? "";
    this.onDone = onDone;
    this.frame = createModalFrame(this.scene, {
      width: PROMPT.width,
      height: PROMPT.height,
      title: options.title,
      accent: HOLO_PALETTE.accent,
    });
    this.buildContent(this.frame, options);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    document.addEventListener("paste", this.pasteHandler);
    this.caretTimer = this.scene.time.addEvent({
      delay: PROMPT.caretBlinkMs,
      loop: true,
      callback: () => {
        this.caretVisible = !this.caretVisible;
        this.refreshInput();
      },
    });
    this.refreshInput();
  }

  private buildContent(frame: ModalFrame, options: TextPromptOptions): void {
    const pad = HOLO_SPACING.xl;
    const x = frame.left + pad;
    const innerWidth = frame.width - pad * 2;
    const message = addLobbyText(
      this.scene,
      { x, y: frame.contentTop },
      options.message,
      {
        size: PROMPT.messageSize,
        color: HOLO_PALETTE.textSecondary,
        originY: 0,
      },
    );
    const inputTop = frame.contentTop + HOLO_SPACING.xl + HOLO_SPACING.xs;
    const field = this.scene.add.graphics();
    drawHoloFrame(
      field,
      { x, y: inputTop, width: innerWidth, height: PROMPT.inputHeight },
      {
        radius: HOLO_RADIUS.sm,
        accent: HOLO_PALETTE.accent,
        borderWidth: HOLO_BORDER.regular,
        fill: HOLO_PALETTE.panelFillRaised,
      },
    );
    this.inputText = addLobbyText(
      this.scene,
      { x: x + HOLO_SPACING.md, y: inputTop + PROMPT.inputHeight / 2 },
      "",
      { size: PROMPT.inputSize },
    );
    const buttonY =
      frame.top + frame.height - HOLO_SPACING.lg - PROMPT.buttonHeight / 2;
    frame.container.add([
      message,
      field,
      this.inputText,
      ...this.createButtons(frame, buttonY, options),
    ]);
  }

  private createButtons(
    frame: ModalFrame,
    y: number,
    options: TextPromptOptions,
  ): Phaser.GameObjects.GameObject[] {
    const right = frame.left + frame.width - HOLO_SPACING.xl;
    const confirmX = right - PROMPT.buttonWidth / 2;
    const cancelX = confirmX - PROMPT.buttonWidth - HOLO_SPACING.md;
    const size = { width: PROMPT.buttonWidth, height: PROMPT.buttonHeight };
    return [
      createHoverButton(
        this.scene,
        cancelX,
        y,
        {
          ...size,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          label: "CANCEL",
          font: "600 14px",
          icon: "close",
        },
        () => this.finish(null),
      ),
      createHoverButton(
        this.scene,
        confirmX,
        y,
        {
          ...size,
          color: HOLO_PALETTE.panelFill,
          variant: "primary",
          label: options.confirmLabel ?? "CONFIRM",
          font: "600 14px",
          icon: "next",
        },
        () => this.finish(this.buffer),
      ),
    ];
  }

  private onKey(event: KeyboardEvent): void {
    if (event.timeStamp < this.openedAt || event === this.lastEvent) return;
    this.lastEvent = event;
    if (event.key === "Enter") return this.finish(this.buffer);
    if (event.key === "Escape") return this.finish(null);
    if (event.key === "Backspace") {
      const clearAll = event.ctrlKey || event.metaKey;
      this.buffer = clearAll ? "" : this.buffer.slice(0, -1);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.append(event.key);
      return;
    }
    this.refreshInput();
  }

  private append(text: string): void {
    const clean = text.replace(/[\r\n\t]/g, "");
    this.buffer = (this.buffer + clean).slice(0, PROMPT.maxLength);
    this.caretVisible = true;
    this.refreshInput();
  }

  private refreshInput(): void {
    const input = this.inputText;
    const frame = this.frame;
    if (!input || !frame) return;
    const maxWidth = frame.width - HOLO_SPACING.xl * 2 - HOLO_SPACING.md * 2;
    const caret = this.caretVisible ? "|" : " ";
    let start = 0;
    input.setText(this.buffer + caret);
    while (input.width > maxWidth && start < this.buffer.length) {
      start += 1;
      input.setText(PROMPT.ellipsis + this.buffer.slice(start) + caret);
    }
  }

  private finish(value: string | null): void {
    const done = this.onDone;
    this.teardown();
    done?.(value);
  }

  private teardown(): void {
    this.scene.input?.keyboard?.off("keydown", this.keyHandler);
    document.removeEventListener("paste", this.pasteHandler);
    this.caretTimer?.remove();
    this.caretTimer = null;
    this.frame?.container.destroy();
    this.frame = null;
    this.inputText = null;
    this.onDone = null;
  }
}
