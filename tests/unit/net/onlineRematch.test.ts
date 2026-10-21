import { describe, expect, it } from "vitest";
import { NetClient } from "../../../src/net/client/NetClient";
import { OnlineSession } from "../../../src/net/lobby/OnlineSession";
import {
  OnlineRematch,
  rematchStatus,
} from "../../../src/net/battle/OnlineRematch";
import {
  initialLobbyState,
  type LobbyState,
} from "../../../src/net/lobby/LobbyModel";
import type { RoomPlayerView, RoomView } from "../../../src/net/protocol";
import { createRelayLink, memoryTokenStore } from "./netFixtures";

const SERVER = { url: "ws://relay/ws", source: "query" as const };

function seat(id: string, ready: boolean): RoomPlayerView {
  return {
    id,
    name: id,
    seat: id === "me" ? 0 : 1,
    team: id === "me" ? 0 : 1,
    loadout: { faction: "void_corsairs", ships: ["corsair_blade"] },
    ready,
    pingMs: 20,
    connected: true,
    isHost: id === "me",
  };
}

function lobby(
  rematch: boolean,
  players: readonly RoomPlayerView[],
  inMatch = false,
): LobbyState {
  const room = {
    code: "K7Q2X",
    mode: "dogfight",
    options: {},
    hostId: "me",
    phase: "lobby",
    maxPlayers: 2,
    readyDeadline: null,
    startsAt: null,
    quickMatch: false,
    pointLimit: 200,
    rematch: rematch ? { closesAt: 60_000 } : null,
    players,
  } as RoomView;
  return {
    ...initialLobbyState(SERVER),
    localId: "me",
    room,
    match: inMatch ? ({ matchId: "m1" } as LobbyState["match"]) : null,
  };
}

describe("rematchStatus", () => {
  it("offers the vote once the relay opened the rematch window", () => {
    const status = rematchStatus(
      lobby(true, [seat("me", false), seat("you", false)]),
      false,
    );
    expect(status).toMatchObject({ phase: "open", label: "Rematch" });
  });

  it("counts the players still deciding after the local vote", () => {
    const status = rematchStatus(
      lobby(true, [seat("me", true), seat("you", false)]),
      true,
    );
    expect(status).toMatchObject({ phase: "voted", waitingFor: 1 });
    expect(status.label).toBe("Waiting for 1");
  });

  it("counts several players still deciding", () => {
    const players = [seat("me", true), seat("a", false), seat("b", false)];
    expect(rematchStatus(lobby(true, players), true).label).toBe(
      "Waiting for 2",
    );
  });

  it("reads Starting once everybody voted yes", () => {
    const status = rematchStatus(
      lobby(true, [seat("me", true), seat("you", true)]),
      true,
    );
    expect(status).toMatchObject({ phase: "voted", waitingFor: 0 });
    expect(status.label).toBe("Starting…");
  });

  it("waits for the relay's result while the match is still running", () => {
    const players = [seat("me", false), seat("you", false)];
    expect(rematchStatus(lobby(false, players, true), false).phase).toBe(
      "waiting_result",
    );
  });

  it("falls back to the room when no rematch is open and the match is over", () => {
    const players = [seat("me", false), seat("you", false)];
    expect(rematchStatus(lobby(false, players), false)).toMatchObject({
      phase: "unavailable",
      label: "Back to room",
    });
  });

  it("is unavailable once the room is gone", () => {
    expect(rematchStatus(initialLobbyState(SERVER), true).phase).toBe(
      "unavailable",
    );
  });
});

function player(link: ReturnType<typeof createRelayLink>, name: string) {
  const client = new NetClient({
    url: SERVER.url,
    build: "b",
    name,
    transport: link.factory,
    scheduler: link.clock,
    tokenStore: memoryTokenStore(),
  });
  return new OnlineSession(client, SERVER, link.clock);
}

/** Two seated, started and loaded players in a Dogfight. */
function runningMatch() {
  const link = createRelayLink();
  const sessions = [player(link, "A"), player(link, "B")] as const;
  sessions.forEach((s) => s.connect());
  link.clock.advance(100);
  sessions.forEach((s) => s.quickMatch());
  link.clock.advance(100);
  for (const s of sessions) {
    s.setLoadout({ faction: "void_corsairs", ships: ["corsair_blade"] });
    s.setReady(true);
  }
  link.clock.advance(1_000);
  sessions.forEach((s) => s.client.send({ t: "loaded" }));
  link.clock.advance(100);
  const playedMatchId = sessions[0].state.match!.matchId;
  const watchers = sessions.map((session) => {
    const events = { newMatch: 0, fallback: 0 };
    const rematch = new OnlineRematch(session, playedMatchId, {
      onNewMatch: () => events.newMatch++,
      onFallback: () => events.fallback++,
    });
    return { session, rematch, events };
  });
  const finish = (): void => {
    sessions.forEach((s) =>
      s.client.send({ t: "match_over", tick: 10, winnerTeam: 0 }),
    );
    link.clock.advance(100);
  };
  return { link, sessions, watchers, finish, playedMatchId };
}

describe("OnlineRematch over the relay", () => {
  it("casts the server vote from the results screen and shows who is still deciding", () => {
    const { link, watchers, finish } = runningMatch();
    finish();
    const [a, b] = watchers;
    expect(a!.rematch.status.phase).toBe("open");
    a!.rematch.click();
    link.clock.advance(100);
    expect(a!.rematch.status).toMatchObject({ phase: "voted", waitingFor: 1 });
    expect(b!.rematch.status.phase).toBe("open");
    expect(a!.events.newMatch).toBe(0);
  });

  it("starts the new match for everyone once all accepted", () => {
    const { link, watchers, finish, playedMatchId } = runningMatch();
    finish();
    watchers.forEach((w) => w.rematch.click());
    link.clock.advance(1_000);
    for (const w of watchers) {
      expect(w.events.newMatch).toBe(1);
      expect(w.session.state.match?.matchId).not.toBe(playedMatchId);
    }
  });

  it("keeps a click made before the result arrived and votes when the window opens", () => {
    const { link, watchers, finish } = runningMatch();
    const [a, b] = watchers;
    a!.rematch.click();
    expect(a!.rematch.status.phase).toBe("waiting_result");
    b!.rematch.click();
    finish();
    link.clock.advance(1_000);
    expect(a!.events.newMatch).toBe(1);
    expect(b!.events.newMatch).toBe(1);
  });

  it("lets a voter withdraw, which stops the countdown", () => {
    const { link, watchers, finish } = runningMatch();
    const [a, b] = watchers;
    finish();
    a!.rematch.click();
    b!.rematch.click();
    link.clock.advance(50);
    a!.rematch.click();
    link.clock.advance(1_000);
    expect(a!.rematch.status.phase).toBe("open");
    expect(a!.events.newMatch).toBe(0);
    expect(b!.events.newMatch).toBe(0);
  });

  it("returns to the room when the rematch window closed unused", () => {
    const { link, watchers, finish } = runningMatch();
    finish();
    link.clock.advance(120_000);
    const [a] = watchers;
    expect(a!.rematch.status.phase).toBe("unavailable");
    a!.rematch.click();
    expect(a!.events.fallback).toBe(1);
  });

  it("stops reacting after dispose", () => {
    const { link, watchers, finish } = runningMatch();
    const [a, b] = watchers;
    a!.rematch.dispose();
    finish();
    b!.rematch.click();
    a!.rematch.click();
    link.clock.advance(1_000);
    expect(a!.events.newMatch).toBe(0);
  });
});
