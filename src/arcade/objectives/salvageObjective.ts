/**
 * salvageObjective — X-Wing 2.0 "Salvage Mission" in real time: an
 * unstressed player ship not already carrying picks up a crate at range;
 * boosting, barrel-rolling or being destroyed drops it where the carrier is;
 * crates brought into the drop zone are delivered. Completes at `required`
 * deliveries. Pure.
 */

import type { SalvageDefinition } from "./objectiveDefinitions";
import { coreOf, type ObjectiveStateCore } from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import { NO_WORLD_PRESENCE } from "./objectiveModel";
import { clamp01, withinRange } from "./objectiveGeometry";
import type { ObjectiveFrame, ObjectiveMarker } from "./objectiveTypes";

/** One crate. */
export interface SalvageCrate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly carrierId: string | null;
  readonly delivered: boolean;
}

/** Salvage progress. */
export interface SalvageState extends ObjectiveStateCore<SalvageDefinition> {
  readonly crates: readonly SalvageCrate[];
}

/** Crate marker radius (px). */
const CRATE_MARKER_RADIUS = 24;

/**
 * Carried crates follow their carriers (or fall where a vanished carrier was).
 *
 * @param crates - Crates.
 * @param frame - The frame.
 * @returns Crates after following.
 */
function follow(
  crates: readonly SalvageCrate[],
  frame: ObjectiveFrame,
): SalvageCrate[] {
  return crates.map((crate) => {
    if (!crate.carrierId) return crate;
    const carrier = frame.ships.find((s) => s.id === crate.carrierId);
    if (carrier) return { ...crate, x: carrier.x, y: carrier.y };
    const wreck = frame.events.find(
      (e) => e.kind === "destroyed" && e.shipId === crate.carrierId,
    );
    const at = wreck && wreck.kind === "destroyed" ? wreck : crate;
    return { ...crate, x: at.x, y: at.y, carrierId: null };
  });
}

/**
 * Evasive actions (boost / barrel roll) drop the crate in place.
 *
 * @param crates - Crates.
 * @param frame - The frame.
 * @returns Crates after drops.
 */
function dropOnEvasive(
  crates: readonly SalvageCrate[],
  frame: ObjectiveFrame,
): SalvageCrate[] {
  const evading = new Set(
    frame.events.filter((e) => e.kind === "evasive").map((e) => e.shipId),
  );
  return crates.map((crate) =>
    crate.carrierId && evading.has(crate.carrierId)
      ? { ...crate, carrierId: null }
      : crate,
  );
}

/**
 * @param crates - Crates.
 * @param frame - The frame.
 * @param def - Salvage definition.
 * @returns Crates after unstressed, empty-handed player ships pick some up.
 */
function pickUp(
  crates: readonly SalvageCrate[],
  frame: ObjectiveFrame,
  def: SalvageDefinition,
): SalvageCrate[] {
  const carrying = new Set(
    crates.map((c) => c.carrierId).filter((id) => id !== null),
  );
  const evaded = new Set(
    frame.events.filter((e) => e.kind === "evasive").map((e) => e.shipId),
  );
  return crates.map((crate) => {
    if (crate.carrierId || crate.delivered) return crate;
    const picker = frame.ships.find(
      (s) =>
        s.side === "player" &&
        !s.stressed &&
        !carrying.has(s.id) &&
        !evaded.has(s.id) &&
        withinRange(s, crate, def.pickupRadius, frame.worldSize),
    );
    if (!picker) return crate;
    carrying.add(picker.id);
    return { ...crate, carrierId: picker.id, x: picker.x, y: picker.y };
  });
}

export const SALVAGE_MODEL: ObjectiveModel<SalvageDefinition, SalvageState> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({
    ...coreOf(def),
    crates: def.crates.map((p, i) => ({
      id: `${def.id}_crate${i}`,
      x: p.x,
      y: p.y,
      carrierId: null,
      delivered: false,
    })),
  }),
  step(state, frame) {
    const { def } = state;
    let crates = dropOnEvasive(follow(state.crates, frame), frame);
    crates = pickUp(crates, frame, def).map((crate) =>
      crate.carrierId &&
      withinRange(crate, def.dropZone, def.dropRadius, frame.worldSize)
        ? {
            ...crate,
            x: def.dropZone.x,
            y: def.dropZone.y,
            carrierId: null,
            delivered: true,
          }
        : crate,
    );
    const delivered = crates.filter((c) => c.delivered).length;
    return {
      ...state,
      crates,
      status: delivered >= def.required ? "completed" : "active",
    };
  },
  readout(state) {
    const delivered = state.crates.filter((c) => c.delivered).length;
    return {
      progressText: `${delivered}/${state.def.required}`,
      fraction: clamp01(delivered / Math.max(1, state.def.required)),
    };
  },
  markers(state): ObjectiveMarker[] {
    const crates = state.crates
      .filter((c) => !c.delivered)
      .map((c) => ({
        id: c.id,
        kind: "crate" as const,
        x: c.x,
        y: c.y,
        radius: CRATE_MARKER_RADIUS,
        progress: 0,
        controller: c.carrierId ? ("player" as const) : ("none" as const),
      }));
    const zone: ObjectiveMarker = {
      id: `${state.def.id}_drop`,
      kind: "dropzone",
      x: state.def.dropZone.x,
      y: state.def.dropZone.y,
      radius: state.def.dropRadius,
      progress: clamp01(
        state.crates.filter((c) => c.delivered).length /
          Math.max(1, state.def.required),
      ),
      controller: "player",
    };
    return [...crates, zone];
  },
  isConstraint: () => false,
};
