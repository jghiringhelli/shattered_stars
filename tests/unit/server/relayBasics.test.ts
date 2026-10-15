import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_CONFIG,
  isOriginAllowed,
  loadConfig,
} from "../../../server/src/config";
import {
  ConnectionRateLimiter,
  MAX_VIOLATIONS_PER_WINDOW,
  TokenBucket,
} from "../../../server/src/RateLimiter";
import {
  generateRoomCode,
  RoomCodeExhaustedError,
} from "../../../server/src/roomCodes";
import { Matchmaker } from "../../../server/src/Matchmaker";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import { isRoomCode } from "../../../src/net/protocol";

describe("loadConfig", () => {
  it("uses the defaults for an empty environment", () => {
    expect(loadConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("reads the port Fly and Render inject", () => {
    expect(loadConfig({ PORT: "10000" }).port).toBe(10000);
  });

  it("fails fast on a malformed number", () => {
    expect(() => loadConfig({ MAX_ROOMS: "lots" })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
  });

  it("parses an origin allowlist and rejects malformed origins", () => {
    const config = loadConfig({
      ALLOWED_ORIGINS:
        "https://jghiringhelli.github.io/, http://localhost:3003",
    });
    expect(config.allowedOrigins).toEqual([
      "https://jghiringhelli.github.io",
      "http://localhost:3003",
    ]);
    expect(() => loadConfig({ ALLOWED_ORIGINS: "github.io" })).toThrow(
      ConfigError,
    );
  });

  it("rejects unknown log levels and booleans", () => {
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(ConfigError);
    expect(() => loadConfig({ TRUST_PROXY: "maybe" })).toThrow(ConfigError);
    expect(loadConfig({ TRUST_PROXY: "0" }).trustProxy).toBe(false);
  });

  it("does_not_trust_x_forwarded_for_unless_asked", () => {
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "true" }).trustProxy).toBe(true);
  });

  it("requires_an_explicit_origin_list_in_production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/ALLOWED_ORIGINS/);
    expect(() =>
      loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "*" }),
    ).toThrow(ConfigError);
  });

  it("accepts_an_explicit_origin_list_in_production", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://jghiringhelli.github.io",
    });
    expect(config.allowedOrigins).toEqual(["https://jghiringhelli.github.io"]);
  });

  it("allows_any_origin_in_production_only_when_opted_in", () => {
    const config = loadConfig({ NODE_ENV: "production", ALLOW_ANY_ORIGIN: "true" });
    expect(config.allowedOrigins).toBe("*");
  });
});

describe("isOriginAllowed", () => {
  const config = {
    allowedOrigins: ["https://jghiringhelli.github.io"],
  } as const;

  it("admits listed browser origins only", () => {
    expect(isOriginAllowed(config, "https://jghiringhelli.github.io")).toBe(
      true,
    );
    expect(isOriginAllowed(config, "https://evil.example")).toBe(false);
  });

  it("admits non-browser clients without an Origin header", () => {
    expect(isOriginAllowed(config, undefined)).toBe(true);
  });

  it("admits everything with the wildcard", () => {
    expect(
      isOriginAllowed({ allowedOrigins: "*" }, "https://anything.example"),
    ).toBe(true);
  });
});

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then refills over time", () => {
    const bucket = new TokenBucket({ capacity: 2, perSecond: 1 }, 0);
    expect([bucket.take(0), bucket.take(0), bucket.take(0)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(bucket.take(999)).toBe(false);
    expect(bucket.take(1000)).toBe(true);
  });
});

describe("ConnectionRateLimiter", () => {
  it("limits chat independently of inputs", () => {
    const clock = new VirtualScheduler();
    const limiter = new ConnectionRateLimiter(clock);
    const chats = Array.from({ length: 10 }, () => limiter.allow("chat"));
    expect(chats.filter(Boolean)).toHaveLength(5);
    expect(limiter.allow("in")).toBe(true);
  });

  it("flags a connection that keeps violating", () => {
    const limiter = new ConnectionRateLimiter(new VirtualScheduler());
    for (let i = 0; i < MAX_VIOLATIONS_PER_WINDOW; i++)
      limiter.recordViolation();
    expect(limiter.isAbusive()).toBe(true);
  });

  it("forgets violations after the window", () => {
    const clock = new VirtualScheduler();
    const limiter = new ConnectionRateLimiter(clock);
    for (let i = 0; i < MAX_VIOLATIONS_PER_WINDOW - 1; i++)
      limiter.recordViolation();
    clock.advance(11_000);
    limiter.recordViolation();
    expect(limiter.isAbusive()).toBe(false);
  });
});

describe("generateRoomCode", () => {
  it("draws valid codes and skips taken ones", () => {
    const draws = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    const code = generateRoomCode(
      () => draws.shift() ?? 2,
      (c) => c === "AAAAA",
    );
    expect(code).toBe("BBBBB");
    expect(isRoomCode(code)).toBe(true);
  });

  it("gives up when every code is taken", () => {
    expect(() =>
      generateRoomCode(
        () => 0,
        () => true,
      ),
    ).toThrow(RoomCodeExhaustedError);
  });
});

describe("Matchmaker", () => {
  const dogfight = { mode: "dogfight", build: "b1" } as const;

  it("pairs the first two players waiting on the same mode and build", () => {
    const mm = new Matchmaker();
    expect(mm.enqueue("a", dogfight, 0)).toBeNull();
    expect(mm.enqueue("b", dogfight, 1)).toEqual(["a", "b"]);
    expect(mm.size()).toBe(0);
  });

  it("never pairs different builds or modes", () => {
    const mm = new Matchmaker();
    mm.enqueue("a", dogfight, 0);
    expect(mm.enqueue("b", { mode: "dogfight", build: "b2" }, 0)).toBeNull();
    expect(mm.enqueue("c", { mode: "skirmish", build: "b1" }, 0)).toBeNull();
    expect(mm.size()).toBe(3);
  });

  it("removes a player and reports the mode they left", () => {
    const mm = new Matchmaker();
    mm.enqueue("a", dogfight, 0);
    expect(mm.remove("a")).toBe("dogfight");
    expect(mm.remove("a")).toBeNull();
    expect(mm.enqueue("b", dogfight, 0)).toBeNull();
  });
});
