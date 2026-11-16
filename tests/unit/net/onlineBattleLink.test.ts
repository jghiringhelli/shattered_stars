import { describe, expect, it } from "vitest";
import { NetClient } from "../../../src/net/client/NetClient";
import { OnlineSession } from "../../../src/net/lobby/OnlineSession";
import {
  startOnlineBattle,
  type OnlineBattleLink,
  type OnlineNotice,
} from "../../../src/net/battle/OnlineBattleLink";
import {
  decodePilotInput,
  type DecodedPilotInput,
} from "../../../src/net/input/PilotInputCodec";
import { StateHasher } from "../../../src/net/lockstep/StateHasher";
import type { LockstepSimulation } from "../../../src/net/lockstep/types";
import type { TickInput } from "../../../src/net/protocol";
import type { InputEvent } from "../../../src/input/InputTypes";
import { createRelayLink, memoryTokenStore } from "./netFixtures";
import { activeTrickRule } from "../../../src/arcade/systems/FlightCapabilities";
import { activeSteeringMode } from "../../../src/arcade/systems/SteeringMode";
import { resetBrowserStore } from "../../../src/systems/keyValueStore";
import {
  DEFAULT_SETTINGS,
  saveSettings,
} from "../../../src/systems/SettingsStorage";

const SERVER = { url: "ws://relay/ws", source: "query" as const };
const FRAME_MS = 16;

/** A tiny deterministic battle: each seat's position moves with its steering. */
class CounterSim implements LockstepSimulation {
  positions = [0, 0];
  lastInputs: DecodedPilotInput[] = [];
  step(_tick: number, inputs: readonly TickInput[]): void {
    this.lastInputs = inputs.map(decodePilotInput);
    this.lastInputs.forEach((input, seat) => {
      const dir = input.held.has("STEER_LEFT") ? -1 : 1;
      this.positions[seat] = (this.positions[seat] ?? 0) + dir;
    });
  }
  hash(tick: number): number {
    const h = new StateHasher().addInt(tick);
    this.positions.forEach((p) => h.addInt(p));
    return h.digest();
  }
  snapshot(): string {
    return JSON.stringify(this.positions);
  }
  restore(_tick: number, data: string): void {
    this.positions = JSON.parse(data) as number[];
  }
}

class Keys {
  held = new Set<string>();
  isHeld = (intent: string): boolean => this.held.has(intent);
  onAny = (_cb: (e: InputEvent) => void): number => 1;
  off = (): boolean => true;
}

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

function startMatch() {
  const link = createRelayLink();
  const sessions = [player(link, "A"), player(link, "B")];
  sessions.forEach((s) => s.connect());
  link.clock.advance(100);
  sessions.forEach((s) => s.quickMatch());
  link.clock.advance(100);
  for (const s of sessions) {
    s.setLoadout({ faction: "void_corsairs", ships: ["corsair_blade"] });
    s.setReady(true);
  }
  link.clock.advance(1_000);
  return { link, sessions };
}

function run(
  link: ReturnType<typeof createRelayLink>,
  battles: readonly { link: OnlineBattleLink; sim: CounterSim }[],
  frames: number,
): void {
  for (let i = 0; i < frames; i++) {
    for (const b of battles) b.link.frame(FRAME_MS, b.sim);
    link.clock.advance(FRAME_MS);
  }
}

describe("OnlineBattleLink ship-identity rule", () => {
  it("ignores the offline Full card setting while a lockstep battle runs and restores it after", () => {
    resetBrowserStore();
    saveSettings({
      ...DEFAULT_SETTINGS,
      gameplay: { ...DEFAULT_SETTINGS.gameplay, shipSpecials: "full" },
    });
    expect(activeTrickRule()).toBe("full");
    const { sessions } = startMatch();
    const battle = startOnlineBattle(sessions[0]!, { intents: new Keys() })!;
    expect(activeTrickRule()).toBe("identity");
    battle.dispose();
    expect(activeTrickRule()).toBe("full");
    resetBrowserStore();
  });

  it("flies the template steering engine online whatever the offline Settings say, then restores it", () => {
    resetBrowserStore();
    saveSettings({
      ...DEFAULT_SETTINGS,
      gameplay: { ...DEFAULT_SETTINGS.gameplay, steeringMode: "analog" },
    });
    expect(activeSteeringMode()).toBe("analog");
    const { sessions } = startMatch();
    const battle = startOnlineBattle(sessions[0]!, { intents: new Keys() })!;
    expect(activeSteeringMode()).toBe("template");
    battle.dispose();
    expect(activeSteeringMode()).toBe("analog");
    resetBrowserStore();
  });

  it("does not leave the lock on when no match is running", () => {
    resetBrowserStore();
    const link = createRelayLink();
    const lone = player(link, "Lone");
    expect(startOnlineBattle(lone, { intents: new Keys() })).toBeNull();
    saveSettings({
      ...DEFAULT_SETTINGS,
      gameplay: { ...DEFAULT_SETTINGS.gameplay, shipSpecials: "full" },
    });
    expect(activeTrickRule()).toBe("full");
    resetBrowserStore();
  });
});

describe("OnlineBattleLink", () => {
  it("runs both clients through identical ticks and traces a hash per tick", () => {
    const { link, sessions } = startMatch();
    const keys = [new Keys(), new Keys()];
    const battles = sessions.map((session, i) => ({
      sim: new CounterSim(),
      link: startOnlineBattle(session, { intents: keys[i]! })!,
    }));
    battles.forEach((b) => b.link.markLoaded());
    link.clock.advance(100);
    const leftSeat = battles[0]!.link.localSeat;
    keys[0]!.held.add("STEER_LEFT");
    run(link, battles, 240);
    const [a, b] = battles.map((x) => x.link.debug.hashes);
    const common = a!.filter(([tick]) => b!.some(([t]) => t === tick));
    expect(common.length).toBeGreaterThan(150);
    for (const [tick, hash] of common)
      expect(b!.find(([t]) => t === tick)?.[1]).toBe(hash);
    const sim = battles[1]!.sim;
    expect(sim.positions[leftSeat]).toBeLessThan(0);
    expect(sim.positions[1 - leftSeat]).toBeGreaterThan(0);
  });

  it("reports the match result once and hears the relay end it", () => {
    const { link, sessions } = startMatch();
    const ended: (number | null)[] = [];
    const battles = sessions.map((session) => ({
      sim: new CounterSim(),
      link: startOnlineBattle(session, {
        intents: new Keys(),
        onMatchEnd: (_reason, winner) => ended.push(winner),
      })!,
    }));
    battles.forEach((b) => b.link.markLoaded());
    run(link, battles, 30);
    battles.forEach((b) => {
      b.link.reportMatchOver(1);
      b.link.reportMatchOver(0);
    });
    run(link, battles, 10);
    expect(ended).toEqual([1, 1]);
  });

  it("tells the HUD when the opponent drops and the AI takes their ship", () => {
    const { link, sessions } = startMatch();
    const notices: OnlineNotice[] = [];
    const battles = sessions.map((session, i) => ({
      sim: new CounterSim(),
      link: startOnlineBattle(session, {
        intents: new Keys(),
        ...(i === 0 ? { onNotice: (n: OnlineNotice) => notices.push(n) } : {}),
      })!,
    }));
    battles.forEach((b) => b.link.markLoaded());
    run(link, battles, 30);
    sessions[1]!.client.close();
    run(link, battles.slice(0, 1), 60);
    expect(notices.map((n) => n.tone)).toContain("warning");
    expect(notices[0]!.text).toMatch(/B .*AI/);
    const opponent = 1 - battles[0]!.link.localSeat;
    expect(battles[0]!.sim.lastInputs[opponent]?.aiControl).toBe(true);
  });
});
