import { describe, expect, it } from "vitest";
import { SCENARIO_IDS } from "../../../src/arcade/scenarios";
import {
  MODE_RULES,
  validateClientMessage,
  type MatchMode,
} from "../../../src/net/protocol";
import { ONLINE_SCENARIO_IDS } from "../../../src/net/rules/scenarioIds";
import { squadPoints, validateLoadout } from "../../../src/net/rules/squadRules";
import { resolveMapRequest } from "../../../src/rendering/spaceMap/mapRequest";
import {
  createCoreHarness,
  DOGFIGHT_LOADOUT,
  type CoreHarness,
} from "./relayFixtures";

const SQUAD = {
  faction: "terran_hegemony",
  ships: ["terran_gladius", "terran_viper", "terran_viper"],
};

function room(h: CoreHarness, mode: MatchMode, players: number) {
  const seats = Array.from({ length: players }, (_, i) =>
    h.connect(i === 0 ? "Host" : `Guest${i}`),
  );
  h.send(seats[0]!.session, { t: "create_room", mode });
  const code = seats[0]!.conn.last("room")!.room.code;
  for (const p of seats.slice(1)) h.send(p.session, { t: "join_room", code });
  return { seats, code };
}

function readyUp(h: CoreHarness, mode: MatchMode, players: number) {
  const r = room(h, mode, players);
  const loadout = MODE_RULES[mode].maxShips === 1 ? DOGFIGHT_LOADOUT : SQUAD;
  r.seats.forEach((p, i) => {
    h.send(p.session, {
      t: "set_loadout",
      loadout: { ...loadout, ships: [...loadout.ships] },
    });
    if (mode === "skirmish")
      h.send(p.session, { t: "set_team", team: i % 2 === 0 ? 0 : 1 });
    h.send(p.session, { t: "set_ready", ready: true });
  });
  return r;
}

describe("relay validates loadouts against the game's squad rules", () => {
  const cases: Array<[string, MatchMode, { faction: string; ships: string[] }]> =
    [
      ["an unknown ship", "reinforcements", { faction: "void_corsairs", ships: ["nope"] }],
      ["an unknown faction", "reinforcements", { faction: "klingons", ships: ["corsair_blade"] }],
      ["another faction's ship", "reinforcements", { faction: "void_corsairs", ships: ["confed_falcon"] }],
      ["a capital ship", "reinforcements", { faction: "terran_hegemony", ships: ["terran_imperator"] }],
      ["a squad over the point limit", "reinforcements", { faction: "terran_hegemony", ships: Array(8).fill("terran_gladius") }],
      ["two ships in a duel", "dogfight", { faction: "void_corsairs", ships: ["corsair_blade", "corsair_blade"] }],
    ];

  it.each(cases)("refuses %s with a reason the lobby can show", (_name, mode, loadout) => {
    const h = createCoreHarness();
    const { seats } = room(h, mode, 1);
    h.send(seats[0]!.session, { t: "set_loadout", loadout });
    const error = seats[0]!.conn.last("error")!;
    expect(error.code).toBe("invalid_loadout");
    expect(error.message.length).toBeGreaterThan(8);
    h.send(seats[0]!.session, { t: "set_ready", ready: true });
    expect(seats[0]!.conn.last("error")!.code).toBe("invalid_loadout");
  });

  it("accepts a legal squad and a legal duel ship", () => {
    expect(validateLoadout("skirmish", SQUAD)).toBeNull();
    expect(validateLoadout("dogfight", DOGFIGHT_LOADOUT)).toBeNull();
    expect(squadPoints(SQUAD.ships)).toBeLessThanOrEqual(
      MODE_RULES.skirmish.pointLimit,
    );
  });
});

describe("relay owns the match definition", () => {
  it("fixes point limit, map theme (derived from the seed) and scenario in match_start", () => {
    const h = createCoreHarness();
    const { seats } = readyUp(h, "scenario", 2);
    h.clock.advance(h.config.startCountdownMs);
    const match = seats[0]!.conn.last("match_start")!.match;
    expect(match.pointLimit).toBe(MODE_RULES.scenario.pointLimit);
    expect(match.options.scenarioId).toBe(ONLINE_SCENARIO_IDS[0]);
    const clientTheme = resolveMapRequest(
      [{ online: {}, seed: match.seed }],
      () => 0,
    ).theme.id;
    expect(match.mapTheme).toBe(clientTheme);
  });

  it("keeps the online scenario list equal to the game's scenarios", () => {
    expect([...ONLINE_SCENARIO_IDS]).toEqual([...SCENARIO_IDS]);
  });

  it("lets only the host change options, and only to a known scenario", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "scenario", 2);
    const [host, guest] = seats;
    h.send(guest!.session, {
      t: "set_options",
      options: { scenarioId: ONLINE_SCENARIO_IDS[1]! },
    });
    expect(guest!.conn.last("error")!.code).toBe("not_host");
    h.send(host!.session, { t: "set_options", options: { scenarioId: "made_up" } });
    expect(host!.conn.last("error")!.code).toBe("invalid_options");
    h.send(host!.session, {
      t: "set_options",
      options: { scenarioId: ONLINE_SCENARIO_IDS[1]! },
    });
    expect(host!.conn.last("room")!.room.options.scenarioId).toBe(
      ONLINE_SCENARIO_IDS[1],
    );
  });

  it("refuses options in a mode that has none", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "dogfight", 1);
    h.send(seats[0]!.session, {
      t: "set_options",
      options: { scenarioId: ONLINE_SCENARIO_IDS[0]! },
    });
    expect(seats[0]!.conn.last("error")!.code).toBe("not_allowed");
  });

  it("drops unknown fields so a client cannot smuggle rules into set_options", () => {
    const parsed = validateClientMessage({
      t: "set_options",
      options: { scenarioId: "salvage_mission", pointLimit: 9999, mode: "x" },
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        t: "set_options",
        options: { scenarioId: "salvage_mission" },
      },
    });
  });

  it("keeps skirmish teams within the mode's team size", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "skirmish", 3);
    for (const p of seats) h.send(p.session, { t: "set_team", team: 0 });
    const teams = seats[0]!.conn.last("room")!.room.players.map((p) => p.team);
    expect(teams.filter((t) => t === 0).length).toBeLessThanOrEqual(
      MODE_RULES.skirmish.maxPerTeam,
    );
    expect(seats.some((p) => p.conn.last("error")?.code === "team_full")).toBe(
      true,
    );
  });

  it("fixes teams by seat in duel modes", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "dogfight", 2);
    h.send(seats[0]!.session, { t: "set_team", team: 1 });
    expect(seats[0]!.conn.last("error")!.code).toBe("not_allowed");
  });
});

describe("relay room handling", () => {
  it("keeps the player in their room when a join elsewhere is refused", () => {
    const h = createCoreHarness();
    const full = room(h, "dogfight", 2);
    const mine = h.connect("Me");
    h.send(mine.session, { t: "create_room", mode: "dogfight" });
    const myCode = mine.conn.last("room")!.room.code;
    h.send(mine.session, { t: "join_room", code: full.code });
    expect(mine.conn.last("error")!.code).toBe("room_full");
    expect(mine.session.roomCode).toBe(myCode);
    expect(mine.conn.last("room_left")).toBeUndefined();
  });

  it("answers a lobby edit from a player who is in no room", () => {
    const h = createCoreHarness();
    const lone = h.connect("Lone");
    h.send(lone.session, { t: "set_ready", ready: true });
    expect(lone.conn.last("error")!.code).toBe("not_in_room");
  });

  it("does not open a quick-match room past the room cap", () => {
    const h = createCoreHarness({ maxRooms: 1 });
    room(h, "dogfight", 1);
    const a = h.connect("A");
    h.send(a.session, { t: "quick_match", mode: "dogfight" });
    expect(a.conn.last("error")!.code).toBe("server_busy");
  });

  it("puts the remaining player of a quick-match room back in the queue when the opponent leaves", () => {
    const h = createCoreHarness();
    const a = h.connect("A");
    const b = h.connect("B");
    h.send(a.session, { t: "quick_match", mode: "dogfight" });
    h.send(b.session, { t: "quick_match", mode: "dogfight" });
    h.send(b.session, { t: "leave_room" });
    expect(a.conn.last("queue")).toMatchObject({ queued: true });
    expect(h.core.stats().rooms).toBe(0);
    const c = h.connect("C");
    h.send(c.session, { t: "quick_match", mode: "dogfight" });
    expect(c.conn.last("room")!.room.players.map((p) => p.name).sort()).toEqual([
      "A",
      "C",
    ]);
  });
});

describe("relay lifecycle", () => {
  const legal = () => ({ ...DOGFIGHT_LOADOUT, ships: [...DOGFIGHT_LOADOUT.ships] });

  it("cancels the countdown when a player leaves, and starts with a replacement", () => {
    const h = createCoreHarness();
    const { seats, code } = readyUp(h, "dogfight", 2);
    h.send(seats[1]!.session, { t: "leave_room" });
    h.clock.advance(h.config.startCountdownMs * 2);
    expect(seats[0]!.conn.last("match_start")).toBeUndefined();
    const newcomer = h.connect("New");
    h.send(newcomer.session, { t: "join_room", code });
    h.send(newcomer.session, { t: "set_loadout", loadout: legal() });
    h.send(newcomer.session, { t: "set_ready", ready: true });
    h.send(seats[0]!.session, { t: "set_ready", ready: true });
    h.clock.advance(h.config.startCountdownMs);
    expect(newcomer.conn.last("match_start")).toBeDefined();
  });

  it("cancels the countdown when a player's socket drops and restarts it after they return and ready up", () => {
    const h = createCoreHarness();
    const { seats } = readyUp(h, "dogfight", 2);
    h.core.disconnected(seats[1]!.session, seats[1]!.conn);
    h.clock.advance(h.config.startCountdownMs * 2);
    expect(seats[0]!.conn.last("match_start")).toBeUndefined();
    const back = h.reconnect(seats[1]!.session);
    expect(back.last("room")!.room.players[1]!.connected).toBe(true);
    h.send(seats[1]!.session, { t: "set_ready", ready: true });
    h.clock.advance(h.config.startCountdownMs);
    expect(back.last("match_start")).toBeDefined();
  });

  it("removes a player whose reconnection window ran out and tells the room", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "dogfight", 2);
    h.core.disconnected(seats[1]!.session, seats[1]!.conn);
    h.clock.advance(h.config.reconnectWindowMs + 1);
    expect(seats[0]!.conn.last("room")!.room.players).toHaveLength(1);
    expect(h.core.stats().sessions).toBe(1);
  });

  it("leaves no room and no timer behind once everyone left or expired", () => {
    const h = createCoreHarness();
    const r = readyUp(h, "dogfight", 2);
    h.clock.advance(h.config.startCountdownMs);
    for (const p of r.seats) h.send(p.session, { t: "loaded" });
    h.send(r.seats[0]!.session, { t: "leave_match" });
    h.core.disconnected(r.seats[1]!.session, r.seats[1]!.conn);
    h.clock.advance(h.config.reconnectWindowMs + 1);
    expect(h.core.stats()).toMatchObject({ rooms: 0, matches: 0, sessions: 1 });
    h.core.disconnected(r.seats[0]!.session, r.seats[0]!.conn);
    h.clock.advance(h.config.reconnectWindowMs + 1);
    expect(h.core.stats().sessions).toBe(0);
    expect(h.clock.pendingCount()).toBe(0);
  });

  it("ends a match for the player who stays when the other quits", () => {
    const h = createCoreHarness();
    const r = readyUp(h, "dogfight", 2);
    h.clock.advance(h.config.startCountdownMs);
    for (const p of r.seats) h.send(p.session, { t: "loaded" });
    h.send(r.seats[1]!.session, { t: "leave_match" });
    expect(r.seats[0]!.conn.last("peer")).toMatchObject({ status: "left" });
    h.send(r.seats[0]!.session, { t: "match_over", tick: 90, winnerTeam: 0 });
    expect(r.seats[0]!.conn.last("match_end")).toMatchObject({
      reason: "finished",
      winnerTeam: 0,
    });
  });

  it("refuses a stale token after the session expired and a token of another build", () => {
    const h = createCoreHarness();
    const { session } = h.connect("A", "build-1");
    const conn = h.reconnect({ ...session, build: "build-2" });
    expect(conn.last("refused")?.reason).toBe("session_expired");
  });
});

describe("rematch vote", () => {
  function finished(h: CoreHarness) {
    const r = readyUp(h, "dogfight", 2);
    h.clock.advance(h.config.startCountdownMs);
    const [a, b] = r.seats;
    for (const p of r.seats) h.send(p.session, { t: "loaded" });
    h.send(a!.session, { t: "match_over", tick: 10, winnerTeam: 0 });
    h.send(b!.session, { t: "match_over", tick: 10, winnerTeam: 0 });
    return r;
  }

  it("opens after a finished match and starts a new match once both vote yes", () => {
    const h = createCoreHarness();
    const { seats } = finished(h);
    const [a, b] = seats;
    const view = a!.conn.last("room")!.room;
    expect(view.phase).toBe("lobby");
    expect(view.rematch).not.toBeNull();
    const first = a!.conn.last("match_start")!.match;
    h.send(a!.session, { t: "rematch", vote: true });
    h.clock.advance(h.config.startCountdownMs * 2);
    expect(a!.conn.all("match_start")).toHaveLength(1);
    h.send(b!.session, { t: "rematch", vote: true });
    expect(b!.conn.last("room")!.room.phase).toBe("starting");
    h.clock.advance(h.config.startCountdownMs);
    const second = a!.conn.last("match_start")!.match;
    expect(second.matchId).not.toBe(first.matchId);
    expect(second.seats.map((s) => s.loadout)).toEqual(
      first.seats.map((s) => s.loadout),
    );
    expect(second.seats.map((s) => s.team)).toEqual(first.seats.map((s) => s.team));
  });

  it("cancels the countdown when a voter withdraws", () => {
    const h = createCoreHarness();
    const { seats } = finished(h);
    for (const p of seats) h.send(p.session, { t: "rematch", vote: true });
    h.send(seats[1]!.session, { t: "rematch", vote: false });
    h.clock.advance(h.config.startCountdownMs * 2);
    expect(seats[0]!.conn.all("match_start")).toHaveLength(1);
  });

  it("refuses a vote when no match just ended", () => {
    const h = createCoreHarness();
    const { seats } = room(h, "dogfight", 2);
    h.send(seats[0]!.session, { t: "rematch", vote: true });
    expect(seats[0]!.conn.last("error")!.code).toBe("no_rematch");
  });

  it("closes the window after the configured time and dissolves a quick-match room", () => {
    const h = createCoreHarness();
    const a = h.connect("A");
    const b = h.connect("B");
    h.send(a.session, { t: "quick_match", mode: "dogfight" });
    h.send(b.session, { t: "quick_match", mode: "dogfight" });
    for (const p of [a, b]) {
      h.send(p.session, { t: "set_loadout", loadout: { ...DOGFIGHT_LOADOUT, ships: [...DOGFIGHT_LOADOUT.ships] } });
      h.send(p.session, { t: "set_ready", ready: true });
    }
    h.clock.advance(h.config.startCountdownMs);
    for (const p of [a, b]) h.send(p.session, { t: "loaded" });
    for (const p of [a, b])
      h.send(p.session, { t: "match_over", tick: 5, winnerTeam: 1 });
    expect(a.conn.last("room")!.room.rematch).not.toBeNull();
    h.clock.advance(h.config.rematchWindowMs);
    expect(a.conn.last("room_left")?.reason).toBe("rematch_expired");
    expect(h.core.stats().rooms).toBe(0);
  });

  it("keeps a private room open after the window closes, without a rematch", () => {
    const h = createCoreHarness();
    const { seats } = finished(h);
    h.clock.advance(h.config.rematchWindowMs);
    expect(seats[0]!.conn.last("room")!.room.rematch).toBeNull();
    expect(h.core.stats().rooms).toBe(1);
  });

  it("gives a player who was offline at match end the result when they return", () => {
    const h = createCoreHarness();
    const r = readyUp(h, "dogfight", 2);
    h.clock.advance(h.config.startCountdownMs);
    const [a, b] = r.seats;
    for (const p of r.seats) h.send(p.session, { t: "loaded" });
    h.core.disconnected(b!.session, b!.conn);
    h.send(a!.session, { t: "match_over", tick: 10, winnerTeam: 0 });
    h.clock.advance(5_000);
    expect(a!.conn.last("match_end")).toBeDefined();
    const back = h.reconnect(b!.session);
    expect(back.last("match_end")).toMatchObject({ reason: "finished", winnerTeam: 0 });
  });
});
