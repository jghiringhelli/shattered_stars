import { describe, it, expect } from "vitest";
import {
  createMatchTimer,
  tickMatchTimer,
  formatMatchClock,
} from "../../../../src/systems/arena/MatchTimer";

describe("createMatchTimer", () => {
  it("starts with the full duration and not expired", () => {
    const timer = createMatchTimer(180_000);
    expect(timer.remainingMs).toBe(180_000);
    expect(timer.expired).toBe(false);
  });

  it("is immediately expired for a zero duration", () => {
    const timer = createMatchTimer(0);
    expect(timer.remainingMs).toBe(0);
    expect(timer.expired).toBe(true);
  });

  it("clamps a negative duration to an expired timer", () => {
    const timer = createMatchTimer(-500);
    expect(timer.remainingMs).toBe(0);
    expect(timer.expired).toBe(true);
  });
});

describe("tickMatchTimer", () => {
  it("subtracts the delta from the remaining time", () => {
    const next = tickMatchTimer(createMatchTimer(10_000), 250);
    expect(next.remainingMs).toBe(9_750);
    expect(next.expired).toBe(false);
  });

  it("expires exactly when the remaining time reaches zero", () => {
    const next = tickMatchTimer(createMatchTimer(1_000), 1_000);
    expect(next.remainingMs).toBe(0);
    expect(next.expired).toBe(true);
  });

  it("clamps at zero when the delta overshoots", () => {
    const next = tickMatchTimer(createMatchTimer(300), 5_000);
    expect(next.remainingMs).toBe(0);
    expect(next.expired).toBe(true);
  });

  it("returns the same state once expired", () => {
    const expired = createMatchTimer(0);
    expect(tickMatchTimer(expired, 1_000)).toBe(expired);
  });

  it("treats a negative delta as no elapsed time", () => {
    const next = tickMatchTimer(createMatchTimer(10_000), -1_000);
    expect(next.remainingMs).toBe(10_000);
    expect(next.expired).toBe(false);
  });
});

describe("formatMatchClock", () => {
  it("formats whole minutes", () => {
    expect(formatMatchClock(180_000)).toBe("3:00");
  });

  it("zero-pads the seconds", () => {
    expect(formatMatchClock(65_000)).toBe("1:05");
  });

  it("rounds partial seconds up", () => {
    expect(formatMatchClock(6_400)).toBe("0:07");
  });

  it("renders zero at the end of the match", () => {
    expect(formatMatchClock(0)).toBe("0:00");
  });

  it("renders negative values as zero", () => {
    expect(formatMatchClock(-1_000)).toBe("0:00");
  });
});
