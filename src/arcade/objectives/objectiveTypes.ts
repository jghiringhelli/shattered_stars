/**
 * objectiveTypes — data contracts of the reusable mission-objective models
 * (Campaign today, a tabletop Scenario mode later). Pure data: the
 * models in this folder step these states from a per-frame
 * {@link ObjectiveFrame}; scenes build the frame from their own ships and
 * draw the {@link ObjectiveMarker}s / move the {@link EntityPose}s.
 *
 * Coordinates are world pixels on the toroidal battlefield.
 */

/** Where an objective stands. */
export type ObjectiveStatus = "active" | "completed" | "failed";

/** Which side a ship fights for, from the objective's point of view. */
export type ObjectiveSide = "player" | "enemy";

/** A world point. */
export interface ObjectivePoint {
  readonly x: number;
  readonly y: number;
}

/** A living ship as objectives see it. */
export interface ObjectiveShip {
  readonly id: string;
  readonly side: ObjectiveSide;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
  readonly maxHull: number;
  /** Control weight: 1 small/tiny, 2 medium or bigger (tabletop rule). */
  readonly weight: number;
  readonly tags: readonly string[];
  /** Pilot stressed (cannot pick up salvage). */
  readonly stressed: boolean;
}

/** Something that happened since the previous frame. */
export type ObjectiveEvent =
  | {
      readonly kind: "destroyed";
      readonly shipId: string;
      readonly side: ObjectiveSide;
      readonly tags: readonly string[];
      readonly x: number;
      readonly y: number;
    }
  | {
      /** Boost or barrel roll — drops carried salvage. */
      readonly kind: "evasive";
      readonly shipId: string;
    };

/** One frame of the battle, as objectives read it. */
export interface ObjectiveFrame {
  /** Mission time (ms) — paused time excluded. */
  readonly elapsedMs: number;
  readonly deltaMs: number;
  /** Torus side length. */
  readonly worldSize: number;
  /** Living ships. */
  readonly ships: readonly ObjectiveShip[];
  readonly events: readonly ObjectiveEvent[];
  /** The player's flagship, or null when it is gone. */
  readonly flagshipId: string | null;
}

/** World markers an objective wants drawn (and shown on radar). */
export type ObjectiveMarkerKind =
  "zone" | "waypoint" | "crate" | "dropzone" | "sentry" | "exit";

/** Who holds a marker (capture zones). */
export type MarkerController = "player" | "enemy" | "contested" | "none";

/** One drawable objective marker. */
export interface ObjectiveMarker {
  readonly id: string;
  readonly kind: ObjectiveMarkerKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Fill of its progress ring (0..1). */
  readonly progress: number;
  readonly controller: MarkerController;
}

/** A ship an objective needs in the battle (transport, station, target). */
export interface EntitySpawn {
  readonly id: string;
  readonly shipId: string;
  readonly side: ObjectiveSide;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly tags: readonly string[];
  /** Multiplier on its hull/shields caps. */
  readonly hullScale: number;
  /** True: the objective moves it (no pilot, no flight engine). */
  readonly scripted: boolean;
  readonly isBoss?: boolean | undefined;
}

/** Pose an objective imposes on a scripted entity this frame. */
export interface EntityPose {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise. */
  readonly angle: number;
}

/** Resources a (bonus) objective grants on completion. */
export interface ObjectiveReward {
  readonly xp?: number | undefined;
  readonly credits?: number | undefined;
  readonly research?: number | undefined;
}

/** Live readout of an objective for HUD trackers. */
export interface ObjectiveReadout {
  /** Short progress suffix, e.g. "2/3", "45s", "T1 80% · T2 LOST". */
  readonly progressText: string;
  /** Progress 0..1. */
  readonly fraction: number;
}
