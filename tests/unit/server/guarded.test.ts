import { describe, expect, it } from "vitest";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import { guardScheduler, runGuarded } from "../../../server/src/guarded";
import type { Logger } from "../../../server/src/logger";

function recordingLogger() {
  const errors: string[] = [];
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: (message) => {
      errors.push(message);
    },
  };
  return { logger, errors };
}

describe("guarded relay logic", () => {
  it("reports an exception instead of letting it escape", () => {
    const { logger, errors } = recordingLogger();
    expect(
      runGuarded(logger, "frame", () => {
        throw new Error("boom");
      }),
    ).toBe(false);
    expect(errors).toEqual(["relay logic failed"]);
    expect(runGuarded(logger, "frame", () => undefined)).toBe(true);
  });

  it("keeps the other timers running when one timer callback throws", () => {
    const { logger, errors } = recordingLogger();
    const clock = new VirtualScheduler();
    const scheduler = guardScheduler(clock, logger);
    let ran = false;
    scheduler.setTimeout(() => {
      throw new Error("bad timer");
    }, 10);
    scheduler.setTimeout(() => {
      ran = true;
    }, 20);
    expect(() => clock.advance(50)).not.toThrow();
    expect(ran).toBe(true);
    expect(errors).toHaveLength(1);
  });
});
