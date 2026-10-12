/**
 * LobbyChatInput — keyboard capture for the room's COMMS box: while focused
 * every printable key goes into the buffer, ENTER sends, BACKSPACE edits.
 * Independent of the game's key bindings so all characters are typable.
 */

import type Phaser from "phaser";
import { NET_LIMITS } from "../../net/protocol";
import type { ChatLine, ChatPanelState } from "./LobbyChatPanel";

/** What the chat box needs from its scene. */
export interface ChatInputHooks {
  /** Whether typing may go to the chat (room shown, no dialog open). */
  readonly isActive: () => boolean;
  readonly send: (text: string) => void;
  /** Buffer or focus changed (re-render). */
  readonly changed: () => void;
}

export class LobbyChatInput {
  focused = false;
  private buffer = "";
  /** Every handled event (Phaser may replay a short queue of native events). */
  private readonly seenEvents = new WeakSet<KeyboardEvent>();

  /** @param scene - Lobby scene. @param hooks - Activity, send and change callbacks. */
  constructor(
    scene: Phaser.Scene,
    private readonly hooks: ChatInputHooks,
  ) {
    scene.input.keyboard?.on("keydown", (event: KeyboardEvent) =>
      this.onKey(event),
    );
  }

  /** @param messages - Recent lines. @returns The panel state to render. */
  state(messages: readonly ChatLine[]): ChatPanelState {
    return {
      messages,
      inputBuffer: this.buffer,
      focused: this.focused,
      caretVisible: true,
    };
  }

  /** Take keyboard focus. */
  focus(): void {
    this.focused = true;
    this.hooks.changed();
  }

  /** Release keyboard focus. */
  blur(): void {
    this.focused = false;
    this.hooks.changed();
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.focused || !this.hooks.isActive() || this.seenEvents.has(event))
      return;
    this.seenEvents.add(event);
    if (event.key === "Enter") {
      const text = this.buffer.trim();
      if (text) this.hooks.send(text);
      this.buffer = "";
    } else if (event.key === "Backspace") {
      this.buffer = this.buffer.slice(0, -1);
    } else if (
      event.key.length === 1 &&
      this.buffer.length < NET_LIMITS.chatMaxLength
    ) {
      this.buffer += event.key;
    } else {
      return;
    }
    this.hooks.changed();
  }
}
