/**
 * LocalInputSampler — merges the inputs sampled every rendered frame into
 * the one input scheduled per tick. Held bits (steering, throttle) take the
 * latest sample; edge bits (one-shot presses) accumulate until a tick takes
 * them, so a tap shorter than a tick is never lost and never fires twice.
 * Pure.
 */

import { NEUTRAL_INPUT, type TickInput } from "../protocol";

export class LocalInputSampler {
  private latest: TickInput = NEUTRAL_INPUT;
  private pendingEdges = 0;

  /** @param edgeMask - Bits of the first word that are one-shot presses. */
  constructor(private readonly edgeMask: number) {}

  /** @param input - This frame's input. */
  sample(input: TickInput): void {
    this.latest = input;
    this.pendingEdges |= firstWord(input) & this.edgeMask;
  }

  /** @returns The input for the next tick (latest held state plus every pending press); clears the presses. */
  take(): TickInput {
    const word = (firstWord(this.latest) & ~this.edgeMask) | this.pendingEdges;
    this.pendingEdges = 0;
    return withFirstWord(this.latest, word);
  }

  /** @returns The latest held state without presses (fills skipped ticks). */
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
