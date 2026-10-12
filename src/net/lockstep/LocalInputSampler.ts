/**
 * LocalInputSampler — merges the inputs sampled every rendered frame into
 * the one input scheduled per tick. Held bits (steering, throttle) and the
 * turret aim take the latest sample; edge bits (one-shot presses) and a
 * command (words 2–3) wait until a tick takes them, so a tap shorter than a
 * tick is never lost and neither a press nor a command ever fires twice.
 * Pure.
 */

import { NEUTRAL_INPUT, type TickInput } from "../protocol";

/** Words 2–3 of an input: command opcode and argument. */
type CommandWords = readonly [number, number];

export class LocalInputSampler {
  private latest: TickInput = NEUTRAL_INPUT;
  private pendingEdges = 0;
  private pendingCommand: CommandWords | null = null;

  /** @param edgeMask - Bits of the first word that are one-shot presses. */
  constructor(private readonly edgeMask: number) {}

  /** @param input - This frame's input. */
  sample(input: TickInput): void {
    const command = commandOf(input);
    if (command) this.pendingCommand = command;
    this.latest = withoutCommand(input);
    this.pendingEdges |= firstWord(input) & this.edgeMask;
  }

  /** @returns The input for the next tick (latest held state plus every pending press and command); clears them. */
  take(): TickInput {
    const word = (firstWord(this.latest) & ~this.edgeMask) | this.pendingEdges;
    const command = this.pendingCommand;
    this.pendingEdges = 0;
    this.pendingCommand = null;
    const input = withFirstWord(this.latest, word);
    if (!command) return input;
    const words = typeof input === "number" ? [input] : [...input];
    return [words[0] ?? 0, words[1] ?? 0, command[0], command[1]];
  }

  /** @returns The latest held state without presses or command (fills skipped ticks). */
  held(): TickInput {
    return withFirstWord(this.latest, firstWord(this.latest) & ~this.edgeMask);
  }
}

/** @param input - A tick input. @returns Its first (button) word. */
export function firstWord(input: TickInput): number {
  return typeof input === "number" ? input : (input[0] ?? 0);
}

function withFirstWord(input: TickInput, word: number): TickInput {
  if (typeof input === "number") return word;
  return [word, ...input.slice(1)];
}

function commandOf(input: TickInput): CommandWords | null {
  if (typeof input === "number") return null;
  const op = input[2] ?? 0;
  return op === 0 ? null : [op, input[3] ?? 0];
}

function withoutCommand(input: TickInput): TickInput {
  if (typeof input === "number" || input.length <= 2) return input;
  return input.slice(0, 2);
}
