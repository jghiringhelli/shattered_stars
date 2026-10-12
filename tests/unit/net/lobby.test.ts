import { describe, expect, it } from "vitest";
import { NetClient } from "../../../src/net/client/NetClient";
import {
  connectionStatus,
  initialLobbyState,
  lobbyScreen,
  readyBlocker,
  reduceLobby,
  roomCountdowns,
  type LobbyState,
} from "../../../src/net/lobby/LobbyModel";
import {
  cycleFaction,
  cycleShip,
  defaultLoadout,
  describeLoadout,
  onlineShipChoices,
} from "../../../src/net/lobby/loadoutChoices";
import {
  buildOnlineBattleConfig,
  buildOnlineDogfightInit,
  localSeatOf,
} from "../../../src/net/lobby/matchSetup";
import { OnlineSession } from "../../../src/net/lobby/OnlineSession";
import type { MatchStart, RoomView } from "../../../src/net/protocol";
import { getShipDefinition } from "../../../src/data/ShipDefinitions";
import { createRelayLink, memoryTokenStore } from "./netFixtures";

const SERVER = { url: "ws://relay/ws", source: "build" as const };

function room(overrides: Partial<RoomView> = {}): RoomView {
  return {
    code: "ABCDE",
    mode: "dogfight",
    options: {},
    hostId: "me",
    phase: "lobby",
    maxPlayers: 2,
    readyDeadline: null,
    startsAt: null,
    quickMatch: false,
    players: [
      {
        id: "me",
        name: "Me",
        seat: 0,
        team: 0,
        loadout: { faction: "void_corsairs", ships: ["corsair_raider"] },
        ready: false,
        pingMs: 30,
        connected: true,
        isHost: true,
      },
      {
        id: "you",
        name: "You",
        seat: 1,
        team: 1,
        loadout: null,
        ready: false,
        pingMs: 60,
        connected: true,
        isHost: false,
      },
    ],
    ...overrides,
  };
}

function online(): LobbyState {
  let state = initialLobbyState(SERVER);
  state = reduceLobby(state, {
    kind: "connection",
    state: "online",
    refusal: null,
  });
  return reduceLobby(state, {
    kind: "server",
    message: {
      t: "welcome",
      playerId: "me",
      token: "t",
      protocol: 1,
      resumed: false,
      reconnectWindowMs: 1,
      heartbeatMs: 1,
      serverTime: 0,
    },
  });
}

describe("LobbyModel", () => {
  it("moves from offline to menu to queue to room", () => {
    expect(lobbyScreen(initialLobbyState(SERVER))).toBe("offline");
    let state = online();
    expect(lobbyScreen(state)).toBe("menu");
    state = reduceLobby(state, {
      kind: "server",
      message: { t: "queue", mode: "dogfight", queued: true, since: 5 },
    });
    expect(lobbyScreen(state)).toBe("queue");
    state = reduceLobby(state, {
      kind: "server",
      message: { t: "room", room: room() },
    });
    expect(lobbyScreen(state)).toBe("room");
    expect(state.queue).toBeNull();
  });

  it("keeps the room view during a reconnect", () => {
    let state = reduceLobby(online(), {
      kind: "server",
      message: { t: "room", room: room() },
    });
    state = reduceLobby(state, {
      kind: "connection",
      state: "reconnecting",
      refusal: null,
    });
    expect(lobbyScreen(state)).toBe("room");
    expect(connectionStatus(state, 0).text).toMatch(/reconnecting/i);
  });

  it("explains a missed quick-match ready check", () => {
    const state = reduceLobby(online(), {
      kind: "server",
      message: { t: "room_left", reason: "ready_timeout" },
    });
    expect(state.notice?.text).toMatch(/ready check/i);
  });

  it("caps the chat history", () => {
    let state = online();
    for (let i = 0; i < 20; i++)
      state = reduceLobby(state, {
        kind: "server",
        message: { t: "chat", from: "x", name: "X", text: `${i}` },
      });
    expect(state.chat).toHaveLength(8);
    expect(state.chat.at(-1)?.text).toBe("19");
  });

  it("shows the ping when online and tells an outdated client to reload", () => {
    expect(connectionStatus(online(), 42.4).text).toBe("Online · 42 ms");
    const refused = reduceLobby(online(), {
      kind: "connection",
      state: "refused",
      refusal: "version_mismatch",
    });
    expect(connectionStatus(refused, 0)).toEqual({
      text: "Game version out of date — reload the page",
      tone: "danger",
    });
    expect(
      connectionStatus(initialLobbyState({ url: null, source: "none" }), 0)
        .text,
    ).toMatch(/no online server/i);
  });

  it("blocks ready without a ship and on a shared faction in reinforcements", () => {
    const noShip = reduceLobby(online(), {
      kind: "server",
      message: {
        t: "room",
        room: room({ players: [{ ...room().players[0]!, loadout: null }] }),
      },
    });
    expect(readyBlocker(noShip)).toMatch(/pick your ship/i);
    const shared = room({ mode: "reinforcements" });
    const clash = {
      ...shared,
      players: [
        shared.players[0]!,
        {
          ...shared.players[1]!,
          loadout: { faction: "void_corsairs", ships: ["corsair_raider"] },
        },
      ],
    };
    expect(
      readyBlocker(
        reduceLobby(online(), {
          kind: "server",
          message: { t: "room", room: clash },
        }),
      ),
    ).toMatch(/different faction/i);
    expect(
      readyBlocker(
        reduceLobby(online(), {
          kind: "server",
          message: { t: "room", room: room() },
        }),
      ),
    ).toBeNull();
  });

  it("counts down the start and the ready check in whole seconds", () => {
    const state = reduceLobby(online(), {
      kind: "server",
      message: {
        t: "room",
        room: room({ startsAt: 3_000, readyDeadline: 20_000 }),
      },
    });
    expect(roomCountdowns(state, 1_100)).toEqual({ start: 2, ready: 19 });
  });
});

describe("loadoutChoices", () => {
  it("offers no capital ships online", () => {
    for (const id of onlineShipChoices("ascendant_empire"))
      expect(getShipDefinition(id)?.role).not.toBe("capital");
  });

  it("gives dogfight one ship and team modes a squad", () => {
    expect(defaultLoadout("dogfight", "free_confederation").ships).toHaveLength(
      1,
    );
    expect(
      defaultLoadout("skirmish", "free_confederation").ships.length,
    ).toBeGreaterThan(1);
  });

  it("uses the Squad Builder's squad when its faction matches", () => {
    const saved = { faction: "void_corsairs", ships: ["corsair_cutlass"] };
    expect(defaultLoadout("skirmish", "void_corsairs", saved).ships).toEqual([
      "corsair_cutlass",
    ]);
    expect(
      defaultLoadout("skirmish", "terran_hegemony", saved).ships,
    ).not.toEqual(["corsair_cutlass"]);
  });

  it("cycles factions and ships in both directions", () => {
    const first = cycleFaction("dogfight", null, 1);
    expect(
      cycleFaction("dogfight", cycleFaction("dogfight", first, 1), -1),
    ).toEqual(first);
    const next = cycleShip(first, 1);
    expect(cycleShip(next, -1)).toEqual(first);
    expect(describeLoadout(first)).toContain(" · ");
  });
});

const MATCH: MatchStart = {
  matchId: "ABCDE-1",
  seed: 99,
  mode: "reinforcements",
  options: {},
  inputDelay: 4,
  authoritySeat: 0,
  seats: [
    {
      seat: 0,
      playerId: "a",
      name: "A",
      team: 0,
      loadout: {
        faction: "void_corsairs",
        ships: ["corsair_raider", "corsair_cutlass"],
      },
    },
    {
      seat: 1,
      playerId: "b",
      name: "B",
      team: 1,
      loadout: { faction: "terran_hegemony", ships: ["terran_viper"] },
    },
  ],
};

describe("matchSetup", () => {
  it("builds the same battle on both clients except for the local seat", () => {
    const forA = buildOnlineBattleConfig(MATCH, localSeatOf(MATCH, "a"));
    const forB = buildOnlineBattleConfig(MATCH, localSeatOf(MATCH, "b"));
    const strip = (config: Record<string, unknown>) =>
      JSON.stringify({
        ...config,
        factions: (config["factions"] as Array<Record<string, unknown>>).map(
          ({ controller: _c, ...rest }) => rest,
        ),
        online: { ...(config["online"] as object), localSeat: 0 },
      });
    expect(strip(forA)).toBe(strip(forB));
    expect(
      (forA["factions"] as Array<{ controller: string }>).map(
        (f) => f.controller,
      ),
    ).toEqual(["player", "remote"]);
    expect(
      (forB["factions"] as Array<{ controller: string }>).map(
        (f) => f.controller,
      ),
    ).toEqual(["remote", "player"]);
  });

  it("states the reinforcement rules explicitly with one pool per faction", () => {
    const config = buildOnlineBattleConfig(MATCH, 0);
    expect(config["battle"]).toBe("reinforcements");
    expect(
      Object.keys((config["reinforcements"] as { sides: object }).sides),
    ).toEqual(["void_corsairs", "terran_hegemony"]);
  });

  it("defaults a scenario room to the first scenario and never inherits local prefs", () => {
    const config = buildOnlineBattleConfig({ ...MATCH, mode: "scenario" }, 0);
    expect(config["scenario"]).toBe("satellite_array");
    expect(config["battle"]).toBe("classic");
  });

  it("lists dogfight seats canonically", () => {
    const init = buildOnlineDogfightInit({ ...MATCH, mode: "dogfight" }, 1);
    expect(init.seats.map((s) => s.shipId)).toEqual([
      "corsair_raider",
      "terran_viper",
    ]);
    expect(init.online.localSeat).toBe(1);
  });
});

describe("OnlineSession", () => {
  function session(link: ReturnType<typeof createRelayLink>, name: string) {
    const client = new NetClient({
      url: "ws://relay/ws",
      build: "b",
      name,
      transport: link.factory,
      scheduler: link.clock,
      tokenStore: memoryTokenStore(),
    });
    return new OnlineSession(client, SERVER, link.clock);
  }

  it("takes two players from quick match through ready to a running lockstep match", () => {
    const link = createRelayLink();
    const a = session(link, "A");
    const b = session(link, "B");
    a.connect();
    b.connect();
    link.clock.advance(100);
    a.quickMatch();
    b.quickMatch();
    link.clock.advance(100);
    expect(a.state.room?.quickMatch).toBe(true);
    for (const s of [a, b]) {
      s.setLoadout({ faction: "void_corsairs", ships: ["corsair_raider"] });
      s.setReady(true);
    }
    link.clock.advance(1_000);
    expect(a.state.match?.seed).toBe(b.state.match?.seed);
    const boundA = a.startLockstep({ edgeMask: 0 })!;
    const boundB = b.startLockstep({ edgeMask: 0 })!;
    expect([boundA.localSeat, boundB.localSeat].sort()).toEqual([0, 1]);
    boundA.session.markLoaded();
    boundB.session.markLoaded();
    link.clock.advance(100);
    expect(boundA.session.status).toBe("running");
    expect(boundB.session.status).toBe("running");
  });

  it("joins a friend's room by code typed in lower case", () => {
    const link = createRelayLink();
    const host = session(link, "Host");
    const guest = session(link, "Guest");
    host.connect();
    guest.connect();
    link.clock.advance(100);
    host.selectMode("skirmish");
    host.createRoom();
    link.clock.advance(100);
    guest.joinRoom(host.state.room!.code.toLowerCase());
    link.clock.advance(100);
    expect(guest.state.room?.mode).toBe("skirmish");
    expect(host.state.room?.players).toHaveLength(2);
  });
});
