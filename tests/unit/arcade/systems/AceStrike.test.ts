/**
 * AceStrike — specification tests of the strike window: only an enlisted ace
 * opens it, only a dash opens it, it lasts one cycle and one shot, and the
 * book is plain data a snapshot can capture.
 */

import { describe, expect, it } from "vitest";
import {
  createAceStrikeBook,
  enlistAce,
  forgetAce,
  isEvading,
  noteFlightEvents,
  spendStrikeShot,
  strikeReady,
} from "../../../../src/arcade/systems/AceStrike";
import {
  STRIKE_WINDOW_MS,
  STRIKE_WINDOW_SHOTS,
} from "../../../../src/data/aceConfig";

const NOW = 10_000;

describe("AceStrike strike window", () => {
  it("opens when an enlisted ace boosts", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    expect(strikeReady(book, "ace", NOW)).toBe(true);
  });

  it.each(["boost", "barrel_roll", "kturn", "segnor", "tallon"] as const)(
    "opens on the %s dash",
    (event) => {
      const book = createAceStrikeBook();
      enlistAce(book, "ace");
      noteFlightEvents(book, "ace", [event], NOW);
      expect(strikeReady(book, "ace", NOW + 1)).toBe(true);
    },
  );

  it("does not open for a hard turn", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["hard_turn"], NOW);
    expect(strikeReady(book, "ace", NOW)).toBe(false);
  });

  it("never opens for a ship that is not an ace", () => {
    const book = createAceStrikeBook();
    noteFlightEvents(book, "rookie", ["boost"], NOW);
    expect(strikeReady(book, "rookie", NOW)).toBe(false);
    expect(book.size).toBe(0);
  });

  it("closes when the window time is over", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["barrel_roll"], NOW);
    expect(strikeReady(book, "ace", NOW + STRIKE_WINDOW_MS - 1)).toBe(true);
    expect(strikeReady(book, "ace", NOW + STRIKE_WINDOW_MS)).toBe(false);
  });

  it("boosts only as many shots as the window allows", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    for (let shot = 0; shot < STRIKE_WINDOW_SHOTS; shot += 1) {
      expect(strikeReady(book, "ace", NOW)).toBe(true);
      spendStrikeShot(book, "ace", NOW);
    }
    expect(strikeReady(book, "ace", NOW)).toBe(false);
  });

  it("opens again after a new dash", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    spendStrikeShot(book, "ace", NOW);
    noteFlightEvents(book, "ace", ["barrel_roll"], NOW + 4000);
    expect(strikeReady(book, "ace", NOW + 4000)).toBe(true);
  });

  it("does not spend a shot outside an open window", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    spendStrikeShot(book, "ace", NOW);
    expect(book.get("ace")!.strikeShotsLeft).toBe(0);
  });

  it("forgets a ship that left the battle", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    forgetAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    expect(strikeReady(book, "ace", NOW)).toBe(false);
  });

  it("keeps an enlisted ace's window when it is enlisted twice", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    enlistAce(book, "ace");
    expect(strikeReady(book, "ace", NOW)).toBe(true);
  });

  it("is plain data: a JSON round trip keeps the window", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    noteFlightEvents(book, "ace", ["boost"], NOW);
    const copy = new Map(
      JSON.parse(JSON.stringify([...book])) as Array<
        [string, ReturnType<typeof book.get> & object]
      >,
    );
    expect(strikeReady(copy, "ace", NOW)).toBe(true);
  });
});

describe("AceStrike evasion", () => {
  it("is off for an ace that did not disengage and for non-aces", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    expect(isEvading(book, "ace", NOW)).toBe(false);
    expect(isEvading(book, "rookie", NOW)).toBe(false);
  });

  it("is on until its time runs out", () => {
    const book = createAceStrikeBook();
    enlistAce(book, "ace");
    book.get("ace")!.evadeUntilMs = NOW + 500;
    expect(isEvading(book, "ace", NOW + 499)).toBe(true);
    expect(isEvading(book, "ace", NOW + 500)).toBe(false);
  });
});
