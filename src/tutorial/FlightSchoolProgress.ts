/**
 * FlightSchoolProgress — whether the player finished (or declined) Flight
 * School, persisted so the main menu offers the course only to new pilots.
 * Pure: storage is injected.
 */

import { browserStore, type KeyValueStore } from "../systems/keyValueStore";

/** Storage key. */
export const FLIGHT_SCHOOL_PROGRESS_KEY = "ss_flight_school_v1";

/** Persisted progress. */
export interface FlightSchoolProgress {
  readonly completed: boolean;
  /** Epoch ms of the first completion, or null. */
  readonly completedAt: number | null;
  /** The player chose "skip" on the first-launch offer. */
  readonly offerDismissed: boolean;
  /** Furthest lesson index reached. */
  readonly furthestStep: number;
}

const FRESH: FlightSchoolProgress = {
  completed: false,
  completedAt: null,
  offerDismissed: false,
  furthestStep: 0,
};

/**
 * @param store - Persistence (default: localStorage).
 * @returns Stored progress, or a fresh record.
 */
export function loadFlightSchoolProgress(
  store: KeyValueStore = browserStore(),
): FlightSchoolProgress {
  const raw = store.getItem(FLIGHT_SCHOOL_PROGRESS_KEY);
  if (!raw) return FRESH;
  try {
    const parsed = JSON.parse(raw) as Partial<FlightSchoolProgress>;
    return {
      completed: parsed.completed === true,
      completedAt:
        typeof parsed.completedAt === "number" ? parsed.completedAt : null,
      offerDismissed: parsed.offerDismissed === true,
      furthestStep:
        typeof parsed.furthestStep === "number" ? parsed.furthestStep : 0,
    };
  } catch {
    return FRESH;
  }
}

function save(store: KeyValueStore, progress: FlightSchoolProgress): void {
  store.setItem(FLIGHT_SCHOOL_PROGRESS_KEY, JSON.stringify(progress));
}

/**
 * Record a finished course (keeps the first completion time).
 *
 * @param store - Persistence.
 * @param nowMs - Epoch ms.
 */
export function markFlightSchoolComplete(
  store: KeyValueStore = browserStore(),
  nowMs: number = Date.now(),
): void {
  const current = loadFlightSchoolProgress(store);
  save(store, {
    ...current,
    completed: true,
    completedAt: current.completedAt ?? nowMs,
  });
}

/**
 * The player skipped the first-launch offer.
 *
 * @param store - Persistence.
 */
export function dismissFlightSchoolOffer(
  store: KeyValueStore = browserStore(),
): void {
  save(store, { ...loadFlightSchoolProgress(store), offerDismissed: true });
}

/**
 * @param store - Persistence.
 * @param index - Lesson index just reached.
 */
export function recordFlightSchoolStep(
  store: KeyValueStore = browserStore(),
  index: number,
): void {
  const current = loadFlightSchoolProgress(store);
  if (index <= current.furthestStep) return;
  save(store, { ...current, furthestStep: index });
}

/**
 * @param progress - Stored progress.
 * @returns Whether the main menu should recommend the course.
 */
export function shouldOfferFlightSchool(
  progress: FlightSchoolProgress,
): boolean {
  return !progress.completed && !progress.offerDismissed;
}
