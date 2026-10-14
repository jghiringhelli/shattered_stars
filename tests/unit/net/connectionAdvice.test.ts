import { describe, expect, it } from "vitest";
import {
  connectionAdvice,
  OFFLINE_HINT,
} from "../../../src/net/lobby/connectionAdvice";
import {
  connectionStatus,
  initialLobbyState,
  reduceLobby,
  type LobbyState,
} from "../../../src/net/lobby/LobbyModel";

const server = { url: "wss://relay.example/ws", source: "build" } as const;

function withConnection(
  state: "unreachable" | "refused" | "expired" | "reconnecting" | "connecting",
  refusal: "version_mismatch" | "server_full" | "bad_hello" | null = null,
): LobbyState {
  return reduceLobby(initialLobbyState(server), {
    kind: "connection",
    state,
    refusal,
  });
}

describe("connectionAdvice", () => {
  it("explains an unreachable server and that it may be waking up", () => {
    const text = connectionAdvice(withConnection("unreachable"));
    expect(text).toMatch(/could not reach/i);
    expect(text).toMatch(/starting up|waking|30 s/i);
    expect(text).toContain(OFFLINE_HINT);
  });

  it("tells a client on another version to reload", () => {
    const text = connectionAdvice(
      withConnection("refused", "version_mismatch"),
    );
    expect(text).toMatch(/reload/i);
    expect(text).toMatch(/older|newer|different version/i);
  });

  it("says when the server is full", () => {
    expect(connectionAdvice(withConnection("refused", "server_full"))).toMatch(
      /full/i,
    );
  });

  it("explains an expired session", () => {
    expect(connectionAdvice(withConnection("expired"))).toMatch(/reconnect/i);
  });

  it("explains a missing server configuration", () => {
    const text = connectionAdvice(
      initialLobbyState({ url: null, source: "none" }),
    );
    expect(text).toMatch(/not set up|no server/i);
    expect(text).toContain(OFFLINE_HINT);
  });

  it("always points to the offline modes", () => {
    expect(OFFLINE_HINT).toMatch(/offline/i);
    expect(OFFLINE_HINT).toMatch(/Skirmish|Survival|Campaign/);
  });
});

describe("connectionStatus refusals", () => {
  it("names a full server", () => {
    expect(
      connectionStatus(withConnection("refused", "server_full"), 0).text,
    ).toMatch(/server is full/i);
  });

  it("keeps the generic text for other refusals", () => {
    expect(
      connectionStatus(withConnection("refused", "bad_hello"), 0).text,
    ).toBe("Connection refused");
  });
});
