/**
 * Shared types for the Playthrough Director (scripts/playthrough_director.ts).
 *
 * The Director is a deep, session-length QA harness — distinct from
 * verify_loop.ts, which stays a fast single-snapshot MUST-gate for CI.
 * The Director never blocks CI; it produces a report for human review.
 */

export type ArchetypeRole =
  | "light_fighter"
  | "interceptor"
  | "heavy_fighter"
  | "bomber"
  | "gunship"
  | "support"
  | "capital";

/** One scripted input beat: press `key`, hold for `downMs`, then wait `waitAfterMs`. */
export interface DrillStep {
  readonly key: string;
  readonly shift: boolean;
  readonly downMs: number;
  readonly waitAfterMs: number;
}

/** A standardized maneuver sequence applied identically across ship classes. */
export interface ArchetypeDrill {
  readonly name: string;
  readonly steps: readonly DrillStep[];
}

/** One polled sample of a ship's kinematic + stress state during a drill/session. */
export interface TelemetryFrame {
  readonly tMs: number;
  readonly shipId: string;
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly speed: number;
  readonly stressLevel: number;
  readonly isStressed: boolean;
  readonly maneuver: string | null;
}

/** Verdict on whether a ship's movement behavior matched its declared archetype. */
export type FidelityVerdict =
  "matches_archetype" | "role_bleed" | "inconclusive";

export interface RoleFidelityScore {
  readonly shipId: string;
  readonly role: ArchetypeRole;
  readonly drill: string;
  readonly avgSpeed: number;
  readonly maxStressLevel: number;
  readonly cyclesToFirstStress: number | null;
  readonly stressedFraction: number;
  readonly verdict: FidelityVerdict;
  readonly detail: string;
}

export interface FrictionEvent {
  readonly tMs: number;
  readonly kind: string;
  readonly detail: string;
}

export interface VisionFinding {
  readonly context: string;
  readonly screenshot: string;
  readonly bugs: readonly string[];
  readonly visualIssues: readonly string[];
  readonly usabilityFriction: readonly string[];
  readonly incompleteFeatures: readonly string[];
  readonly funScore: number;
  readonly funReasoning: string;
}

export interface ModeReport {
  readonly mode: string;
  readonly sceneKey: string;
  readonly durationMs: number;
  readonly telemetrySampleCount: number;
  readonly roleFidelity: readonly RoleFidelityScore[];
  readonly frictionEvents: readonly FrictionEvent[];
  readonly consoleErrors: readonly string[];
  readonly visionFindings: readonly VisionFinding[];
  readonly finalVerdict: string | null;
  /** Elapsed ms until matchCompleteAccessor fired, or null if it never did within the session. */
  readonly matchDurationMs: number | null;
}

/** How a scenario boots its scene — mirrors verify_loop.ts's StartSpec. */
export type StartSpec =
  | { readonly via: "registry"; readonly battleConfig: Record<string, unknown> }
  | { readonly via: "init"; readonly data: Record<string, unknown> }
  | { readonly via: "hook"; readonly hook: string; readonly arg: string };

export interface ModeScenario {
  readonly mode: string;
  readonly sceneKey: string;
  readonly start: StartSpec;
  readonly durationMs: number;
  readonly shipsVia?: "ships" | "battleManager";
  readonly playerShipRole?: ArchetypeRole;
  readonly drill?: ArchetypeDrill;
  /** Method to call on the scene right after boot, to bypass a setup screen (e.g. "startMatch"). */
  readonly postStartMethod?: string;
  /** Boolean scene property polled to timestamp match completion (e.g. "matchComplete"). */
  readonly matchCompleteAccessor?: string;
}
