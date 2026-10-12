/**
 * Tests for the typed error handling system.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  GameError,
  ShipError,
  CombatError,
  MovementError,
  GameStateError,
  SaveLoadError,
  ConfigError,
  ShipErrors,
  CombatErrors,
  MovementErrors,
  GameStateErrors,
  SaveLoadErrors,
  ConfigErrors,
  registerErrorHandler,
  reportError,
  safeExecute,
  assertCondition,
  clampWithWarning,
} from "../../../src/core/errors";

// Track cleanup functions for each test
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

describe("GameError", () => {
  it("should set all properties on construction", () => {
    const err = new GameError(
      "test message",
      "TEST_CODE",
      "COMBAT",
      "warning",
      { foo: "bar" },
    );

    expect(err.message).toBe("test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.category).toBe("COMBAT");
    expect(err.severity).toBe("warning");
    expect(err.context).toEqual({ foo: "bar" });
    expect(err.name).toBe("GameError");
    expect(typeof err.timestamp).toBe("number");
  });

  it("should use default category and severity", () => {
    const err = new GameError("msg", "CODE");

    expect(err.category).toBe("UNKNOWN");
    expect(err.severity).toBe("error");
    expect(err.context).toBeUndefined();
  });

  it("should be an instance of Error", () => {
    const err = new GameError("msg", "CODE");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GameError);
  });

  it("toJSON should return all fields", () => {
    const err = new GameError("msg", "CODE", "SHIP", "info", { key: "val" });
    const json = err.toJSON();

    expect(json.name).toBe("GameError");
    expect(json.message).toBe("msg");
    expect(json.code).toBe("CODE");
    expect(json.category).toBe("SHIP");
    expect(json.severity).toBe("info");
    expect(json.context).toEqual({ key: "val" });
    expect(typeof json.timestamp).toBe("number");
  });
});

describe("Error subclasses", () => {
  it("ShipError should have SHIP category", () => {
    const err = new ShipError("msg", "CODE");
    expect(err.category).toBe("SHIP");
    expect(err.name).toBe("ShipError");
    expect(err).toBeInstanceOf(GameError);
  });

  it("CombatError should have COMBAT category", () => {
    const err = new CombatError("msg", "CODE");
    expect(err.category).toBe("COMBAT");
    expect(err.name).toBe("CombatError");
  });

  it("MovementError should have MOVEMENT category", () => {
    const err = new MovementError("msg", "CODE");
    expect(err.category).toBe("MOVEMENT");
    expect(err.name).toBe("MovementError");
  });

  it("GameStateError should have GAME_STATE category", () => {
    const err = new GameStateError("msg", "CODE");
    expect(err.category).toBe("GAME_STATE");
    expect(err.name).toBe("GameStateError");
  });

  it("SaveLoadError should have SAVE_LOAD category", () => {
    const err = new SaveLoadError("msg", "CODE");
    expect(err.category).toBe("SAVE_LOAD");
    expect(err.name).toBe("SaveLoadError");
  });

  it("ConfigError should have CONFIG category", () => {
    const err = new ConfigError("msg", "CODE");
    expect(err.category).toBe("CONFIG");
    expect(err.name).toBe("ConfigError");
  });
});

describe("ShipErrors factories", () => {
  it("NOT_FOUND should create error with shipId in context", () => {
    const err = ShipErrors.NOT_FOUND("ship_123");
    expect(err.code).toBe("SHIP_NOT_FOUND");
    expect(err.context).toEqual({ shipId: "ship_123" });
    expect(err.severity).toBe("error");
  });

  it("INVALID_DEFINITION should include definitionId", () => {
    const err = ShipErrors.INVALID_DEFINITION("undefined_ship");
    expect(err.code).toBe("SHIP_INVALID_DEFINITION");
    expect(err.context?.definitionId).toBe("undefined_ship");
  });

  it("ALREADY_DESTROYED should have warning severity", () => {
    const err = ShipErrors.ALREADY_DESTROYED("ship_99");
    expect(err.severity).toBe("warning");
    expect(err.code).toBe("SHIP_ALREADY_DESTROYED");
  });

  it("INVALID_STATS should include stat and value", () => {
    const err = ShipErrors.INVALID_STATS("ship_1", "hull", -5);
    expect(err.context?.stat).toBe("hull");
    expect(err.context?.value).toBe(-5);
  });
});

describe("CombatErrors factories", () => {
  it("INVALID_TARGET should have warning severity", () => {
    const err = CombatErrors.INVALID_TARGET("a1", "a2", "friendly fire");
    expect(err.severity).toBe("warning");
    expect(err.context?.reason).toBe("friendly fire");
  });

  it("OUT_OF_RANGE should include distance and maxRange", () => {
    const err = CombatErrors.OUT_OF_RANGE("a", "b", 500, 300);
    expect(err.severity).toBe("info");
    expect(err.context?.distance).toBe(500);
    expect(err.context?.maxRange).toBe(300);
  });

  it("OUT_OF_ARC should include both ship IDs", () => {
    const err = CombatErrors.OUT_OF_ARC("attacker", "target");
    expect(err.context?.attackerId).toBe("attacker");
    expect(err.context?.targetId).toBe("target");
  });

  it("NEGATIVE_DAMAGE should include the damage value", () => {
    const err = CombatErrors.NEGATIVE_DAMAGE(-3);
    expect(err.context?.damage).toBe(-3);
  });
});

describe("MovementErrors factories", () => {
  it("INVALID_MANEUVER should include maneuverType", () => {
    const err = MovementErrors.INVALID_MANEUVER("ship1", "hyperspace");
    expect(err.context?.maneuverType).toBe("hyperspace");
  });

  it("OUT_OF_BOUNDS should include coordinates", () => {
    const err = MovementErrors.OUT_OF_BOUNDS("ship1", 1200, -50);
    expect(err.context?.x).toBe(1200);
    expect(err.context?.y).toBe(-50);
    expect(err.severity).toBe("warning");
  });

  it("COLLISION should include both ship IDs", () => {
    const err = MovementErrors.COLLISION("ship1", "ship2");
    expect(err.context?.shipId).toBe("ship1");
    expect(err.context?.collidedWithId).toBe("ship2");
    expect(err.severity).toBe("info");
  });
});

describe("GameStateErrors factories", () => {
  it("INVALID_PHASE should include both phases", () => {
    const err = GameStateErrors.INVALID_PHASE("planning", "combat");
    expect(err.context?.currentPhase).toBe("planning");
    expect(err.context?.expectedPhase).toBe("combat");
  });

  it("NO_ACTIVE_BATTLE should have error severity", () => {
    const err = GameStateErrors.NO_ACTIVE_BATTLE();
    expect(err.severity).toBe("error");
    expect(err.code).toBe("GAME_STATE_NO_BATTLE");
  });

  it("BATTLE_ALREADY_ENDED should have warning severity", () => {
    const err = GameStateErrors.BATTLE_ALREADY_ENDED();
    expect(err.severity).toBe("warning");
  });
});

describe("SaveLoadErrors factories", () => {
  it("SAVE_FAILED should include reason", () => {
    const err = SaveLoadErrors.SAVE_FAILED("disk full");
    expect(err.context?.reason).toBe("disk full");
  });

  it("LOAD_FAILED should include reason", () => {
    const err = SaveLoadErrors.LOAD_FAILED("not found");
    expect(err.context?.reason).toBe("not found");
  });

  it("CORRUPTED_DATA should include factionId", () => {
    const err = SaveLoadErrors.CORRUPTED_DATA("terran_hegemony");
    expect(err.context?.factionId).toBe("terran_hegemony");
  });

  it("VERSION_MISMATCH should include both versions", () => {
    const err = SaveLoadErrors.VERSION_MISMATCH(1, 3);
    expect(err.severity).toBe("warning");
    expect(err.context?.savedVersion).toBe(1);
    expect(err.context?.currentVersion).toBe(3);
  });
});

describe("ConfigErrors factories", () => {
  it("MISSING_CONFIG should include configKey", () => {
    const err = ConfigErrors.MISSING_CONFIG("gameMode");
    expect(err.context?.configKey).toBe("gameMode");
  });

  it("INVALID_VALUE should include key, value, expected", () => {
    const err = ConfigErrors.INVALID_VALUE("maxPlayers", "ten", "number");
    expect(err.context?.configKey).toBe("maxPlayers");
    expect(err.context?.value).toBe("ten");
    expect(err.context?.expected).toBe("number");
  });
});

describe("registerErrorHandler", () => {
  it("should call handler when error is reported", () => {
    const handler = vi.fn();
    const unregister = registerErrorHandler(handler);
    cleanups.push(unregister);

    const err = new GameError("test", "CODE");
    reportError(err);

    expect(handler).toHaveBeenCalledWith(err);
  });

  it("returned function should unregister the handler", () => {
    const handler = vi.fn();
    const unregister = registerErrorHandler(handler);

    unregister();

    const err = new GameError("test", "CODE");
    reportError(err);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should support multiple handlers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    cleanups.push(registerErrorHandler(handler1));
    cleanups.push(registerErrorHandler(handler2));

    const err = new GameError("test", "CODE");
    reportError(err);

    expect(handler1).toHaveBeenCalledWith(err);
    expect(handler2).toHaveBeenCalledWith(err);
  });

  it("should not throw if handler throws", () => {
    const badHandler = vi.fn().mockImplementation(() => {
      throw new Error("handler error");
    });
    cleanups.push(registerErrorHandler(badHandler));

    const err = new GameError("test", "CODE");
    expect(() => reportError(err)).not.toThrow();
    expect(badHandler).toHaveBeenCalled();
  });
});

describe("reportError severity logging", () => {
  it("should call console.debug for debug severity", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const err = new GameError("msg", "CODE", "UNKNOWN", "debug");
    reportError(err);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should call console.info for info severity", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const err = new GameError("msg", "CODE", "UNKNOWN", "info");
    reportError(err);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should call console.warn for warning severity", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new GameError("msg", "CODE", "UNKNOWN", "warning");
    reportError(err);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should call console.error for error severity", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new GameError("msg", "CODE", "UNKNOWN", "error");
    reportError(err);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should call console.error for critical severity", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new GameError("msg", "CODE", "UNKNOWN", "critical");
    reportError(err);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("safeExecute", () => {
  it("should return the function result on success", () => {
    const result = safeExecute(() => 42, 0);
    expect(result).toBe(42);
  });

  it("should return fallback when function throws", () => {
    const result = safeExecute(() => {
      throw new Error("boom");
    }, -1);
    expect(result).toBe(-1);
  });

  it("should return fallback when function throws GameError", () => {
    const result = safeExecute(() => {
      throw new GameError("game error", "CODE");
    }, "fallback");
    expect(result).toBe("fallback");
  });

  it("should work with errorContext parameter", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    safeExecute(
      () => {
        throw new Error("context error");
      },
      null,
      { operation: "test_op", context: { key: "value" } },
    );

    expect(handler).toHaveBeenCalled();
  });

  it("should handle non-Error throws", () => {
    const result = safeExecute(() => {
      throw "string error";
    }, "default");
    expect(result).toBe("default");
  });
});

describe("assertCondition", () => {
  it("should not throw when condition is true", () => {
    expect(() =>
      assertCondition(true, () => new GameError("fail", "CODE")),
    ).not.toThrow();
  });

  it("should throw when condition is false", () => {
    const error = new GameError("fail", "CODE");
    expect(() => assertCondition(false, () => error)).toThrow();
  });

  it("should throw the exact error returned by factory", () => {
    const error = ShipErrors.NOT_FOUND("ship_x");
    expect(() => assertCondition(false, () => error)).toThrow(error);
  });

  it("should call reportError when throwing", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    const error = new GameError("assert fail", "ASSERT_CODE");
    try {
      assertCondition(false, () => error);
    } catch (_) {
      /* expected */
    }

    expect(handler).toHaveBeenCalledWith(error);
  });
});

describe("clampWithWarning", () => {
  it("should return value when within bounds", () => {
    expect(clampWithWarning(5, 0, 10)).toBe(5);
    expect(clampWithWarning(0, 0, 10)).toBe(0);
    expect(clampWithWarning(10, 0, 10)).toBe(10);
  });

  it("should return min when value is below min", () => {
    expect(clampWithWarning(-1, 0, 10)).toBe(0);
    expect(clampWithWarning(-100, 5, 100)).toBe(5);
  });

  it("should return max when value is above max", () => {
    expect(clampWithWarning(15, 0, 10)).toBe(10);
    expect(clampWithWarning(1000, 0, 100)).toBe(100);
  });

  it("should report error when clamped low with context", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    clampWithWarning(-5, 0, 10, { valueName: "hull", shipId: "ship_1" });
    expect(handler).toHaveBeenCalled();
    const reported = handler.mock.calls[0]![0] as GameError;
    expect(reported.code).toBe("VALUE_CLAMPED_LOW");
  });

  it("should report error when clamped high with context", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    clampWithWarning(150, 0, 100, { valueName: "speed" });
    expect(handler).toHaveBeenCalled();
    const reported = handler.mock.calls[0]![0] as GameError;
    expect(reported.code).toBe("VALUE_CLAMPED_HIGH");
  });

  it("should not report error when no context provided", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    clampWithWarning(-5, 0, 10);
    expect(handler).not.toHaveBeenCalled();

    clampWithWarning(15, 0, 10);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should NOT clamp or report error for value exactly equal to min", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    const result = clampWithWarning(0, 0, 10, { valueName: "hull" });
    expect(result).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should NOT clamp or report error for value exactly equal to max", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    const result = clampWithWarning(10, 0, 10, { valueName: "hull" });
    expect(result).toBe(10);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should include original and clamped fields in low-clamp context", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    clampWithWarning(-3, 0, 10, { valueName: "hull", shipId: "ship_x" });
    const reported = handler.mock.calls[0]![0] as GameError;
    expect(reported.context?.original).toBe(-3);
    expect(reported.context?.clamped).toBe(0);
  });

  it("should include original and clamped fields in high-clamp context", () => {
    const handler = vi.fn();
    cleanups.push(registerErrorHandler(handler));

    clampWithWarning(99, 0, 10, { valueName: "speed" });
    const reported = handler.mock.calls[0]![0] as GameError;
    expect(reported.context?.original).toBe(99);
    expect(reported.context?.clamped).toBe(10);
  });
});

describe("error message content", () => {
  it("ShipErrors.NOT_FOUND message contains shipId", () => {
    expect(ShipErrors.NOT_FOUND("ship_123").message).toContain("ship_123");
  });

  it("ShipErrors.INVALID_DEFINITION message contains definitionId", () => {
    expect(ShipErrors.INVALID_DEFINITION("unknown_def").message).toContain(
      "unknown_def",
    );
  });

  it("ShipErrors.ALREADY_DESTROYED message contains shipId", () => {
    expect(ShipErrors.ALREADY_DESTROYED("ship_99").message).toContain(
      "ship_99",
    );
  });

  it("ShipErrors.INVALID_STATS message contains stat and value", () => {
    const msg = ShipErrors.INVALID_STATS("s1", "hull", -5).message;
    expect(msg).toContain("hull");
    expect(msg).toContain("-5");
  });

  it("CombatErrors.INVALID_TARGET message contains reason", () => {
    expect(
      CombatErrors.INVALID_TARGET("a", "b", "friendly fire").message,
    ).toContain("friendly fire");
  });

  it("CombatErrors.OUT_OF_RANGE message contains distance and maxRange", () => {
    const msg = CombatErrors.OUT_OF_RANGE("a", "b", 500, 300).message;
    expect(msg).toContain("500");
    expect(msg).toContain("300");
  });

  it("CombatErrors.NEGATIVE_DAMAGE message contains damage value", () => {
    expect(CombatErrors.NEGATIVE_DAMAGE(-3).message).toContain("-3");
  });

  it("MovementErrors.INVALID_MANEUVER message contains maneuverType", () => {
    expect(
      MovementErrors.INVALID_MANEUVER("s1", "hyperspace").message,
    ).toContain("hyperspace");
  });

  it("MovementErrors.OUT_OF_BOUNDS message contains coordinates", () => {
    const msg = MovementErrors.OUT_OF_BOUNDS("s1", 1200, -50).message;
    expect(msg).toContain("1200");
    expect(msg).toContain("-50");
  });

  it("MovementErrors.COLLISION message contains both ship IDs", () => {
    const msg = MovementErrors.COLLISION("ship1", "ship2").message;
    expect(msg).toContain("ship1");
    expect(msg).toContain("ship2");
  });

  it("GameStateErrors.INVALID_PHASE message contains both phases", () => {
    const msg = GameStateErrors.INVALID_PHASE("planning", "combat").message;
    expect(msg).toContain("planning");
    expect(msg).toContain("combat");
  });

  it("SaveLoadErrors.SAVE_FAILED message contains reason", () => {
    expect(SaveLoadErrors.SAVE_FAILED("disk full").message).toContain(
      "disk full",
    );
  });

  it("SaveLoadErrors.LOAD_FAILED message contains reason", () => {
    expect(SaveLoadErrors.LOAD_FAILED("not found").message).toContain(
      "not found",
    );
  });

  it("SaveLoadErrors.CORRUPTED_DATA message contains factionId", () => {
    expect(SaveLoadErrors.CORRUPTED_DATA("terran_hegemony").message).toContain(
      "terran_hegemony",
    );
  });

  it("SaveLoadErrors.VERSION_MISMATCH message contains both versions", () => {
    const msg = SaveLoadErrors.VERSION_MISMATCH(1, 3).message;
    expect(msg).toContain("1");
    expect(msg).toContain("3");
  });

  it("ConfigErrors.MISSING_CONFIG message contains configKey", () => {
    expect(ConfigErrors.MISSING_CONFIG("gameMode").message).toContain(
      "gameMode",
    );
  });

  it("ConfigErrors.INVALID_VALUE message contains expected type", () => {
    expect(
      ConfigErrors.INVALID_VALUE("maxPlayers", "ten", "number").message,
    ).toContain("number");
  });
});

describe("error factory codes", () => {
  it("CombatErrors.INVALID_TARGET has correct code", () => {
    expect(CombatErrors.INVALID_TARGET("a", "b", "test").code).toBe(
      "COMBAT_INVALID_TARGET",
    );
  });

  it("CombatErrors.OUT_OF_RANGE has correct code", () => {
    expect(CombatErrors.OUT_OF_RANGE("a", "b", 10, 5).code).toBe(
      "COMBAT_OUT_OF_RANGE",
    );
  });

  it("CombatErrors.OUT_OF_ARC has correct code", () => {
    expect(CombatErrors.OUT_OF_ARC("a", "b").code).toBe("COMBAT_OUT_OF_ARC");
  });

  it("CombatErrors.NEGATIVE_DAMAGE has correct code", () => {
    expect(CombatErrors.NEGATIVE_DAMAGE(-1).code).toBe(
      "COMBAT_NEGATIVE_DAMAGE",
    );
  });

  it("MovementErrors.INVALID_MANEUVER has correct code", () => {
    expect(MovementErrors.INVALID_MANEUVER("s", "hyp").code).toBe(
      "MOVEMENT_INVALID_MANEUVER",
    );
  });

  it("MovementErrors.OUT_OF_BOUNDS has correct code", () => {
    expect(MovementErrors.OUT_OF_BOUNDS("s", 0, 0).code).toBe(
      "MOVEMENT_OUT_OF_BOUNDS",
    );
  });

  it("MovementErrors.COLLISION has correct code", () => {
    expect(MovementErrors.COLLISION("a", "b").code).toBe("MOVEMENT_COLLISION");
  });

  it("GameStateErrors.INVALID_PHASE has correct code", () => {
    expect(GameStateErrors.INVALID_PHASE("x", "y").code).toBe(
      "GAME_STATE_INVALID_PHASE",
    );
  });

  it("GameStateErrors.BATTLE_ALREADY_ENDED has correct code", () => {
    expect(GameStateErrors.BATTLE_ALREADY_ENDED().code).toBe(
      "GAME_STATE_BATTLE_ENDED",
    );
  });

  it("SaveLoadErrors.SAVE_FAILED has correct code", () => {
    expect(SaveLoadErrors.SAVE_FAILED("r").code).toBe("SAVE_LOAD_SAVE_FAILED");
  });

  it("SaveLoadErrors.LOAD_FAILED has correct code", () => {
    expect(SaveLoadErrors.LOAD_FAILED("r").code).toBe("SAVE_LOAD_LOAD_FAILED");
  });

  it("SaveLoadErrors.CORRUPTED_DATA has correct code", () => {
    expect(SaveLoadErrors.CORRUPTED_DATA("f").code).toBe("SAVE_LOAD_CORRUPTED");
  });

  it("SaveLoadErrors.VERSION_MISMATCH has correct code", () => {
    expect(SaveLoadErrors.VERSION_MISMATCH(1, 2).code).toBe(
      "SAVE_LOAD_VERSION_MISMATCH",
    );
  });

  it("ConfigErrors.MISSING_CONFIG has correct code", () => {
    expect(ConfigErrors.MISSING_CONFIG("k").code).toBe("CONFIG_MISSING");
  });

  it("ConfigErrors.INVALID_VALUE has correct code", () => {
    expect(ConfigErrors.INVALID_VALUE("k", "v", "e").code).toBe(
      "CONFIG_INVALID_VALUE",
    );
  });
});

describe("registerErrorHandler first-handler unregistration", () => {
  it("should correctly unregister the first-registered handler", () => {
    const handler0 = vi.fn();
    const handler1 = vi.fn();
    const unregister0 = registerErrorHandler(handler0);
    cleanups.push(registerErrorHandler(handler1));

    unregister0();

    const err = new GameError("test", "CODE");
    reportError(err);

    expect(handler0).not.toHaveBeenCalled();
    expect(handler1).toHaveBeenCalledWith(err);
  });
});
