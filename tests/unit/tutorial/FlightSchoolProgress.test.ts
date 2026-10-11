/**
 * Spec: Flight School progress persistence and the first-launch offer.
 */

import { describe, it, expect } from "vitest";
import {
  dismissFlightSchoolOffer,
  loadFlightSchoolProgress,
  markFlightSchoolComplete,
  recordFlightSchoolStep,
  shouldOfferFlightSchool,
  FLIGHT_SCHOOL_PROGRESS_KEY,
} from "../../../src/tutorial/FlightSchoolProgress";
import { createMemoryStore } from "../../../src/systems/keyValueStore";

describe("FlightSchoolProgress", () => {
  it("a fresh install has not completed the course and is offered it", () => {
    const progress = loadFlightSchoolProgress(createMemoryStore());
    expect(progress.completed).toBe(false);
    expect(shouldOfferFlightSchool(progress)).toBe(true);
  });

  it("records completion with a timestamp and stops offering it", () => {
    const store = createMemoryStore();
    markFlightSchoolComplete(store, 1234);
    const progress = loadFlightSchoolProgress(store);
    expect(progress.completed).toBe(true);
    expect(progress.completedAt).toBe(1234);
    expect(shouldOfferFlightSchool(progress)).toBe(false);
  });

  it("skipping the offer stops offering it without completing", () => {
    const store = createMemoryStore();
    dismissFlightSchoolOffer(store);
    const progress = loadFlightSchoolProgress(store);
    expect(progress.completed).toBe(false);
    expect(shouldOfferFlightSchool(progress)).toBe(false);
  });

  it("remembers the furthest lesson reached", () => {
    const store = createMemoryStore();
    recordFlightSchoolStep(store, 4);
    recordFlightSchoolStep(store, 2);
    expect(loadFlightSchoolProgress(store).furthestStep).toBe(4);
  });

  it("survives corrupt storage", () => {
    const store = createMemoryStore();
    store.setItem(FLIGHT_SCHOOL_PROGRESS_KEY, "nope{");
    expect(loadFlightSchoolProgress(store).completed).toBe(false);
  });
});
