/**
 * InputBuffer — every seat's per-tick inputs as this client knows them.
 * A tick can be simulated once every seat's input for it is present; ticks
 * before the match's input delay need none (everyone is neutral then).
 * Remote inputs never overwrite what is stored — except the relay's version
 * of this client's own seat (AI fill / catch-up after a rejoin), which wins
 * because the relay orders every stream. Pure.
 */

import { NEUTRAL_INPUT, type TickInput } from "../protocol";

export class InputBuffer {
  private readonly seats: Map<number, TickInput>[];
  /** Per seat: first tick not yet present (contiguous frontier). */
  private readonly frontier: number[];
  private floor = 0;

  /**
   * @param seatCount - Seats in the match.
   * @param localSeat - This client's seat.
   * @param inputDelay - Ticks [0, inputDelay) are neutral for every seat.
   */
  constructor(
    seatCount: number,
    private readonly localSeat: number,
    private readonly inputDelay: number,
  ) {
    this.seats = Array.from(
      { length: seatCount },
      () => new Map<number, TickInput>(),
    );
    this.frontier = Array.from({ length: seatCount }, () => inputDelay);
  }

  /** @returns Number of seats. */
  get seatCount(): number {
    return this.seats.length;
  }

  /** @param tick - Tick. @param input - This client's input for it. */
  setLocal(tick: number, input: TickInput): void {
    this.store(this.localSeat, tick, input, false);
  }

  /**
   * @param seat - Seat the inputs belong to.
   * @param from - Tick of the first input.
   * @param inputs - Inputs for from, from+1, ….
   */
  receive(seat: number, from: number, inputs: readonly TickInput[]): void {
    const overwrite = seat === this.localSeat;
    inputs.forEach((input, i) => this.store(seat, from + i, input, overwrite));
  }

  /**
   * @param tick - Tick to simulate.
   * @returns Every seat's input for it, or null while any is missing.
   */
  inputsFor(tick: number): TickInput[] | null {
    if (tick < this.inputDelay) return this.seats.map(() => NEUTRAL_INPUT);
    const inputs: TickInput[] = [];
    for (const seat of this.seats) {
      const input = seat.get(tick);
      if (input === undefined) return null;
      inputs.push(input);
    }
    return inputs;
  }

  /** @param seat - A seat. @returns The first tick of that seat still missing. */
  nextNeeded(seat: number): number {
    return this.frontier[seat] ?? 0;
  }

  /** @returns The first missing tick of every seat (the `ack` vector). */
  ackVector(): number[] {
    return [...this.frontier];
  }

  /** @param seat - A seat. @param tick - A tick. @returns The stored input, if any. */
  get(seat: number, tick: number): TickInput | undefined {
    return this.seats[seat]?.get(tick);
  }

  /**
   * Forget every tick up to and including `tick` (simulated, or skipped by a
   * snapshot) and move frontiers past it.
   *
   * @param tick - Last tick no longer needed.
   */
  discardThrough(tick: number): void {
    for (let t = this.floor; t <= tick; t++)
      for (const seat of this.seats) seat.delete(t);
    this.floor = Math.max(this.floor, tick + 1);
    this.frontier.forEach((_, seat) => this.advanceFrontier(seat));
  }

  private store(
    seat: number,
    tick: number,
    input: TickInput,
    overwrite: boolean,
  ): void {
    const map = this.seats[seat];
    if (!map || tick < this.floor) return;
    if (!overwrite && map.has(tick)) return;
    map.set(tick, input);
    this.advanceFrontier(seat);
  }

  private advanceFrontier(seat: number): void {
    const map = this.seats[seat];
    if (!map) return;
    let next = Math.max(this.frontier[seat] ?? 0, this.floor);
    while (map.has(next)) next++;
    this.frontier[seat] = next;
  }
}
