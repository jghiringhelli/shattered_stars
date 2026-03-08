/**
 * Typed Error Handling System
 *
 * Provides structured error types for better error handling,
 * debugging, and potential telemetry.
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'GAME_STATE'
  | 'COMBAT'
  | 'MOVEMENT'
  | 'TARGETING'
  | 'SHIP'
  | 'FACTION'
  | 'SAVE_LOAD'
  | 'AUDIO'
  | 'NETWORK'
  | 'UI'
  | 'CONFIG'
  | 'UNKNOWN';

/**
 * Base game error with structured metadata
 */
export class GameError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly timestamp: number;
  readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory = 'UNKNOWN',
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.timestamp = Date.now();
    this.context = context ?? undefined;

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GameError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================
// SPECIFIC ERROR TYPES
// ============================================

/**
 * Ship-related errors
 */
export class ShipError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'SHIP', severity, context);
    this.name = 'ShipError';
  }
}

export const ShipErrors = {
  NOT_FOUND: (shipId: string) =>
    new ShipError(
      `Ship not found: ${shipId}`,
      'SHIP_NOT_FOUND',
      'error',
      { shipId }
    ),

  INVALID_DEFINITION: (definitionId: string) =>
    new ShipError(
      `Invalid ship definition: ${definitionId}`,
      'SHIP_INVALID_DEFINITION',
      'error',
      { definitionId }
    ),

  ALREADY_DESTROYED: (shipId: string) =>
    new ShipError(
      `Ship already destroyed: ${shipId}`,
      'SHIP_ALREADY_DESTROYED',
      'warning',
      { shipId }
    ),

  INVALID_STATS: (shipId: string, stat: string, value: number) =>
    new ShipError(
      `Invalid ship stat ${stat}=${value} for ship ${shipId}`,
      'SHIP_INVALID_STATS',
      'error',
      { shipId, stat, value }
    ),
};

/**
 * Combat-related errors
 */
export class CombatError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'COMBAT', severity, context);
    this.name = 'CombatError';
  }
}

export const CombatErrors = {
  INVALID_TARGET: (attackerId: string, targetId: string, reason: string) =>
    new CombatError(
      `Invalid target: ${reason}`,
      'COMBAT_INVALID_TARGET',
      'warning',
      { attackerId, targetId, reason }
    ),

  OUT_OF_RANGE: (attackerId: string, targetId: string, distance: number, maxRange: number) =>
    new CombatError(
      `Target out of range: ${distance} > ${maxRange}`,
      'COMBAT_OUT_OF_RANGE',
      'info',
      { attackerId, targetId, distance, maxRange }
    ),

  OUT_OF_ARC: (attackerId: string, targetId: string) =>
    new CombatError(
      `Target not in firing arc`,
      'COMBAT_OUT_OF_ARC',
      'info',
      { attackerId, targetId }
    ),

  NEGATIVE_DAMAGE: (damage: number) =>
    new CombatError(
      `Negative damage calculated: ${damage}`,
      'COMBAT_NEGATIVE_DAMAGE',
      'warning',
      { damage }
    ),
};

/**
 * Movement-related errors
 */
export class MovementError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'MOVEMENT', severity, context);
    this.name = 'MovementError';
  }
}

export const MovementErrors = {
  INVALID_MANEUVER: (shipId: string, maneuverType: string) =>
    new MovementError(
      `Invalid maneuver ${maneuverType} for ship ${shipId}`,
      'MOVEMENT_INVALID_MANEUVER',
      'error',
      { shipId, maneuverType }
    ),

  OUT_OF_BOUNDS: (shipId: string, x: number, y: number) =>
    new MovementError(
      `Ship ${shipId} moved out of bounds: (${x}, ${y})`,
      'MOVEMENT_OUT_OF_BOUNDS',
      'warning',
      { shipId, x, y }
    ),

  COLLISION: (shipId: string, collidedWithId: string) =>
    new MovementError(
      `Ship ${shipId} collided with ${collidedWithId}`,
      'MOVEMENT_COLLISION',
      'info',
      { shipId, collidedWithId }
    ),
};

/**
 * Game state errors
 */
export class GameStateError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'GAME_STATE', severity, context);
    this.name = 'GameStateError';
  }
}

export const GameStateErrors = {
  INVALID_PHASE: (currentPhase: string, expectedPhase: string) =>
    new GameStateError(
      `Invalid phase: expected ${expectedPhase}, got ${currentPhase}`,
      'GAME_STATE_INVALID_PHASE',
      'error',
      { currentPhase, expectedPhase }
    ),

  NO_ACTIVE_BATTLE: () =>
    new GameStateError(
      'No active battle',
      'GAME_STATE_NO_BATTLE',
      'error'
    ),

  BATTLE_ALREADY_ENDED: () =>
    new GameStateError(
      'Battle has already ended',
      'GAME_STATE_BATTLE_ENDED',
      'warning'
    ),
};

/**
 * Save/Load errors
 */
export class SaveLoadError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'SAVE_LOAD', severity, context);
    this.name = 'SaveLoadError';
  }
}

export const SaveLoadErrors = {
  SAVE_FAILED: (reason: string) =>
    new SaveLoadError(
      `Failed to save: ${reason}`,
      'SAVE_LOAD_SAVE_FAILED',
      'error',
      { reason }
    ),

  LOAD_FAILED: (reason: string) =>
    new SaveLoadError(
      `Failed to load: ${reason}`,
      'SAVE_LOAD_LOAD_FAILED',
      'error',
      { reason }
    ),

  CORRUPTED_DATA: (factionId: string) =>
    new SaveLoadError(
      `Corrupted save data for faction ${factionId}`,
      'SAVE_LOAD_CORRUPTED',
      'error',
      { factionId }
    ),

  VERSION_MISMATCH: (savedVersion: number, currentVersion: number) =>
    new SaveLoadError(
      `Save version mismatch: ${savedVersion} vs ${currentVersion}`,
      'SAVE_LOAD_VERSION_MISMATCH',
      'warning',
      { savedVersion, currentVersion }
    ),
};

/**
 * Configuration errors
 */
export class ConfigError extends GameError {
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message, code, 'CONFIG', severity, context);
    this.name = 'ConfigError';
  }
}

export const ConfigErrors = {
  MISSING_CONFIG: (configKey: string) =>
    new ConfigError(
      `Missing configuration: ${configKey}`,
      'CONFIG_MISSING',
      'error',
      { configKey }
    ),

  INVALID_VALUE: (configKey: string, value: unknown, expected: string) =>
    new ConfigError(
      `Invalid config value for ${configKey}: expected ${expected}`,
      'CONFIG_INVALID_VALUE',
      'error',
      { configKey, value, expected }
    ),
};

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Error handler callback type
 */
export type ErrorHandler = (error: GameError) => void;

/**
 * Global error handlers
 */
const errorHandlers: ErrorHandler[] = [];

/**
 * Register a global error handler
 */
export function registerErrorHandler(handler: ErrorHandler): () => void {
  errorHandlers.push(handler);
  return () => {
    const index = errorHandlers.indexOf(handler);
    if (index > -1) {
      errorHandlers.splice(index, 1);
    }
  };
}

/**
 * Report an error to all registered handlers
 */
export function reportError(error: GameError): void {
  // Log to console based on severity
  switch (error.severity) {
    case 'debug':
      console.debug(`[${error.code}]`, error.message, error.context);
      break;
    case 'info':
      console.info(`[${error.code}]`, error.message, error.context);
      break;
    case 'warning':
      console.warn(`[${error.code}]`, error.message, error.context);
      break;
    case 'error':
    case 'critical':
      console.error(`[${error.code}]`, error.message, error.context);
      break;
  }

  // Notify all handlers
  for (const handler of errorHandlers) {
    try {
      handler(error);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
    }
  }
}

/**
 * Safely execute a function and report any errors
 */
export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  errorContext?: { operation: string; context?: Record<string, unknown> }
): T {
  try {
    return fn();
  } catch (error) {
    const gameError = error instanceof GameError
      ? error
      : new GameError(
          error instanceof Error ? error.message : String(error),
          'UNKNOWN_ERROR',
          'UNKNOWN',
          'error',
          errorContext?.context
        );

    reportError(gameError);
    return fallback;
  }
}

/**
 * Assert a condition and throw if false
 */
export function assertCondition(
  condition: boolean,
  errorFactory: () => GameError
): asserts condition {
  if (!condition) {
    const error = errorFactory();
    reportError(error);
    throw error;
  }
}

/**
 * Clamp a value to valid bounds with optional warning
 */
export function clampWithWarning(
  value: number,
  min: number,
  max: number,
  context?: { valueName: string; shipId?: string }
): number {
  if (value < min) {
    if (context) {
      reportError(new GameError(
        `${context.valueName} clamped from ${value} to ${min}`,
        'VALUE_CLAMPED_LOW',
        'GAME_STATE',
        'debug',
        { ...context, original: value, clamped: min }
      ));
    }
    return min;
  }
  if (value > max) {
    if (context) {
      reportError(new GameError(
        `${context.valueName} clamped from ${value} to ${max}`,
        'VALUE_CLAMPED_HIGH',
        'GAME_STATE',
        'debug',
        { ...context, original: value, clamped: max }
      ));
    }
    return max;
  }
  return value;
}
