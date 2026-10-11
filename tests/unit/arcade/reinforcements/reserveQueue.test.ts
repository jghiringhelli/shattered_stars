import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import {
  createSideLedger,
  deployShip,
} from "../../../../src/arcade/reinforcements/poolLedger";
import {
  createPlayerReserve,
  nextReserveIndex,
  pickerOptions,
  takeReserve,
  type PickerInput,
} from "../../../../src/arcade/reinforcements/reserveQueue";
import type {
  DeployOption,
  QuotaRule,
} from "../../../../src/arcade/reinforcements/reinforcementTypes";

const opt = (definitionId: string, loadoutId: string | null = null) =>
  toDeployOption({ definitionId, loadoutId })!;

const wasp = opt("confed_wasp");
const kestrel = opt("confed_kestrel");
const pelican = opt("confed_pelican");
const thunderbird = opt("confed_thunderbird");
const falcon = opt("confed_falcon");

const QUOTAS: readonly QuotaRule[] = [
  { category: "bomber", maxOnField: 1, maxPerMatch: Infinity },
];
const fresh = () => createSideLedger({ poolPoints: 1000, fieldCapPoints: 250 });

function pickerInput(overrides: Partial<PickerInput> = {}): PickerInput {
  return {
    reserve: createPlayerReserve([kestrel, wasp, pelican]),
    catalog: [wasp, kestrel, falcon, pelican, thunderbird],
    choice: "open",
    ledger: fresh(),
    quotas: QUOTAS,
    maxOptions: 6,
    ...overrides,
  };
}

const keyOf = (o: DeployOption) => `${o.definitionId}/${o.loadoutId}`;

describe("player reserve", () => {
  it("the next reserve ship is the one at the cursor", () => {
    expect(
      nextReserveIndex(createPlayerReserve([kestrel, wasp]), fresh(), QUOTAS),
    ).toBe(0);
  });

  it("skips reserve ships that cannot deploy now", () => {
    const ledger = deployShip(fresh(), "b", pelican);
    const reserve = createPlayerReserve([pelican, wasp]);
    expect(nextReserveIndex(reserve, ledger, QUOTAS)).toBe(1);
  });

  it("returns null when no reserve ship can deploy", () => {
    const ledger = createSideLedger({ poolPoints: 10, fieldCapPoints: 250 });
    expect(
      nextReserveIndex(createPlayerReserve([kestrel]), ledger, QUOTAS),
    ).toBeNull();
    expect(
      nextReserveIndex(createPlayerReserve([]), fresh(), QUOTAS),
    ).toBeNull();
  });

  it("taking the cursor ship advances (and wraps); taking another does not", () => {
    const reserve = createPlayerReserve([kestrel, wasp]);
    expect(takeReserve(reserve, 0).cursor).toBe(1);
    expect(takeReserve(takeReserve(reserve, 0), 1).cursor).toBe(0);
    expect(takeReserve(reserve, 1).cursor).toBe(0);
  });
});

describe("picker options", () => {
  it("lists the next reserve ship first, as the default", () => {
    const options = pickerOptions(pickerInput());
    expect(options[0]?.option).toBe(kestrel);
    expect(options[0]?.isDefault).toBe(true);
    expect(options[0]?.source).toBe("reserve");
    expect(options.filter((o) => o.isDefault)).toHaveLength(1);
  });

  it("offers other reserve ships, then faction ships when the choice is open", () => {
    const options = pickerOptions(pickerInput());
    const sources = options.map((o) => o.source);
    expect(sources.slice(0, 3)).toEqual(["reserve", "reserve", "reserve"]);
    expect(sources).toContain("catalog");
    expect(options.length).toBeLessThanOrEqual(6);
  });

  it("never lists the same ship twice", () => {
    const keys = pickerOptions(pickerInput()).map((o) => keyOf(o.option));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("offers only the reserve when the match is pre-planned", () => {
    const options = pickerOptions(pickerInput({ choice: "planned" }));
    expect(options.every((o) => o.source === "reserve")).toBe(true);
  });

  it("shows quota-violating ships disabled with the reason", () => {
    const ledger = deployShip(fresh(), "b", pelican);
    const options = pickerOptions(pickerInput({ ledger }));
    const bomber = options.find((o) => o.option === pelican);
    expect(bomber?.check.allowed).toBe(false);
    expect(bomber?.check.reason).toMatch(/BOMBERS ON FIELD/);
  });

  it("the default is the cursor ship (disabled) when nothing can deploy", () => {
    const ledger = createSideLedger({ poolPoints: 10, fieldCapPoints: 250 });
    const options = pickerOptions(pickerInput({ ledger }));
    expect(options[0]?.isDefault).toBe(true);
    expect(options[0]?.check.allowed).toBe(false);
  });

  it("caps the list at maxOptions", () => {
    expect(pickerOptions(pickerInput({ maxOptions: 2 }))).toHaveLength(2);
  });
});
