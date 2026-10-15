/**
 * FieldOrdnance ids — shot and device ids are per-battle state (reset on
 * clear, captured in snapshots), so two lockstep peers always agree on them
 * no matter what each page played before.
 */

import { describe, it, expect } from "vitest";
import { FieldOrdnance } from "../../../../src/arcade/weapons/FieldOrdnance";
import {
  secondarySpecOf,
  type DeviceSpec,
  type LauncherSpec,
} from "../../../../src/arcade/weapons/weaponSpecs";
import { captureGraph, restoreGraph } from "../../../../src/net/lockstep/StateGraph";
import { addOrdnance } from "../../../../src/scenes/online/battleHash";
import { StateHasher } from "../../../../src/net/lockstep/StateHasher";

const WORLD = 6000;
const TORPEDO = secondarySpecOf("proton_torpedo") as LauncherSpec;
const BOMB = secondarySpecOf("proton_bomb") as DeviceSpec;
const POSE = { id: "a", side: "x", x: 3000, y: 3000, angle: 0 };
const TARGET = { id: "t", x: 3500, y: 3000 };

function idsOf(field: FieldOrdnance): string[] {
  return [...field.shotsInFlight, ...field.devicesOnField].map((o) => o.id);
}

function fireTwoThenDrop(field: FieldOrdnance): void {
  field.launch(POSE, TORPEDO, TARGET);
  field.launch(POSE, TORPEDO, TARGET);
  field.drop(POSE, BOMB);
}

describe("FieldOrdnance ids", () => {
  it("gives two sequential battles identical ids", () => {
    const first = new FieldOrdnance(WORLD);
    fireTwoThenDrop(first);
    const second = new FieldOrdnance(WORLD);
    fireTwoThenDrop(second);
    expect(idsOf(second)).toEqual(idsOf(first));
  });

  it("restarts the ids when the field is cleared for a new battle", () => {
    const field = new FieldOrdnance(WORLD);
    fireTwoThenDrop(field);
    const firstRun = idsOf(field);
    field.clear();
    fireTwoThenDrop(field);
    expect(idsOf(field)).toEqual(firstRun);
  });

  it("keeps every id in a battle unique", () => {
    const field = new FieldOrdnance(WORLD);
    fireTwoThenDrop(field);
    expect(new Set(idsOf(field)).size).toBe(3);
  });

  it("preserves the counters through snapshot and restore", () => {
    const authority = new FieldOrdnance(WORLD);
    fireTwoThenDrop(authority);
    const data = captureGraph({ weapons: authority });

    const lagging = new FieldOrdnance(WORLD);
    lagging.launch(POSE, TORPEDO, TARGET);
    restoreGraph({ weapons: lagging }, data);

    authority.launch(POSE, TORPEDO, TARGET);
    lagging.launch(POSE, TORPEDO, TARGET);
    expect(idsOf(lagging)).toEqual(idsOf(authority));
  });

  it("keeps ids aligned after a mid-match resync of a peer that played before", () => {
    const veteran = new FieldOrdnance(WORLD);
    for (let i = 0; i < 5; i++) veteran.launch(POSE, TORPEDO, TARGET);
    const authority = new FieldOrdnance(WORLD);
    fireTwoThenDrop(authority);
    restoreGraph({ weapons: veteran }, captureGraph({ weapons: authority }));
    authority.drop(POSE, BOMB);
    veteran.drop(POSE, BOMB);
    expect(idsOf(veteran)).toEqual(idsOf(authority));
  });

  it("feeds the counters into the state hash", () => {
    const quiet = new FieldOrdnance(WORLD);
    const busy = new FieldOrdnance(WORLD);
    fireTwoThenDrop(busy);
    busy.clear();
    busy.launch(POSE, TORPEDO, TARGET);
    quiet.launch(POSE, TORPEDO, TARGET);
    const hashOf = (f: FieldOrdnance, counters: readonly number[]): number =>
      addOrdnance(
        new StateHasher(),
        f.shotsInFlight,
        f.devicesOnField,
        counters,
      ).digest();
    expect(hashOf(quiet, quiet.idCounters)).toBe(hashOf(busy, busy.idCounters));
    expect(hashOf(quiet, [9, 9])).not.toBe(hashOf(quiet, quiet.idCounters));
  });
});
