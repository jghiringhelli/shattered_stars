/**
 * validateClient — turns an untrusted parsed JSON value into a typed
 * {@link ClientMessage}, or explains why it was rejected. The relay runs
 * every inbound message through it before touching any state. Pure.
 */

import {
  isRecord,
  readArray,
  readBoolean,
  readDisplayText,
  readInt,
  readNumber,
  readString,
  type JsonRecord,
} from "./fields";
import {
  ID_PATTERN,
  isMatchMode,
  isRoomCode,
  NET_LIMITS,
  normalizeRoomCode,
  type TeamId,
} from "./limits";
import type {
  ClientMessage,
  Loadout,
  RoomOptions,
  TickInput,
} from "./messages";

/** Validation outcome. */
export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/** Largest tick a match may reach (2^31-1 ticks ≈ 414 days at 60 Hz). */
export const MAX_TICK = 0x7fffffff;
/** Input words are 32-bit; either signed or unsigned spelling is accepted. */
const MIN_WORD = -0x80000000;
const MAX_WORD = 0xffffffff;
/** Largest ping id / timestamp accepted (ms since epoch fits easily). */
const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER;
/** Largest round-trip time a client may report (ms). */
const MAX_REPORTED_RTT_MS = 60_000;
/** Most seats an ack vector may list. */
const MAX_ACK_SEATS = 8;

type Reader = (raw: JsonRecord) => ClientMessage | undefined;

const fail = (error: string): Validated<never> => ({ ok: false, error });

/**
 * @param raw - A parsed JSON value from the socket.
 * @returns The typed message, or the reason it was rejected.
 */
export function validateClientMessage(raw: unknown): Validated<ClientMessage> {
  if (!isRecord(raw)) return fail("message is not an object");
  const type = raw["t"];
  if (typeof type !== "string") return fail("missing type");
  const reader = READERS[type];
  if (!reader) return fail(`unknown type '${type.slice(0, 24)}'`);
  const message = reader(raw);
  return message ? { ok: true, value: message } : fail(`malformed '${type}'`);
}

/**
 * @param value - Anything.
 * @returns A well-formed tick input, or undefined.
 */
export function readTickInput(value: unknown): TickInput | undefined {
  const single = readInt(value, MIN_WORD, MAX_WORD);
  if (single !== undefined) return single;
  const words = readArray(value, NET_LIMITS.maxWordsPerInput, (w) =>
    readInt(w, MIN_WORD, MAX_WORD),
  );
  return words && words.length > 0 ? words : undefined;
}

/**
 * @param value - Anything.
 * @returns A well-formed loadout (shape only; the relay checks it against the game's squad rules), or undefined.
 */
export function readLoadout(value: unknown): Loadout | undefined {
  if (!isRecord(value)) return undefined;
  const faction = readId(value["faction"]);
  const ships = readArray(
    value["ships"],
    NET_LIMITS.maxShipsPerLoadout,
    readId,
  );
  if (!faction || !ships || ships.length === 0) return undefined;
  return { faction, ships };
}

function readId(value: unknown): string | undefined {
  const id = readString(value, NET_LIMITS.idMaxLength);
  return id !== undefined && ID_PATTERN.test(id) ? id : undefined;
}

function readTeam(value: unknown): TeamId | undefined {
  return value === 0 || value === 1 ? value : undefined;
}

function readOptions(value: unknown): RoomOptions | undefined {
  if (!isRecord(value)) return undefined;
  if (value["scenarioId"] === undefined) return {};
  const scenarioId = readId(value["scenarioId"]);
  return scenarioId ? { scenarioId } : undefined;
}

const readHello: Reader = (raw) => {
  const protocol = readInt(raw["protocol"], 0, 1_000_000);
  const build = readString(raw["build"], NET_LIMITS.buildMaxLength);
  const name =
    readDisplayText(raw["name"], NET_LIMITS.nameMaxLength) ?? "Pilot";
  if (protocol === undefined || build === undefined) return undefined;
  if (raw["token"] === undefined) return { t: "hello", protocol, build, name };
  const token = readString(raw["token"], NET_LIMITS.tokenMaxLength);
  return token ? { t: "hello", protocol, build, name, token } : undefined;
};

const readPing: Reader = (raw) => {
  const id = readInt(raw["id"], 0, MAX_TIMESTAMP);
  const ct = readNumber(raw["ct"], 0, MAX_TIMESTAMP);
  if (id === undefined || ct === undefined) return undefined;
  if (raw["rtt"] === undefined) return { t: "ping", id, ct };
  const rtt = readNumber(raw["rtt"], 0, MAX_REPORTED_RTT_MS);
  return rtt === undefined ? undefined : { t: "ping", id, ct, rtt };
};

const readInputs: Reader = (raw) => {
  const from = readInt(raw["from"], 0, MAX_TICK);
  const at = readInt(raw["at"], -1, MAX_TICK);
  const inputs = readArray(
    raw["inputs"],
    NET_LIMITS.maxInputFramesPerMessage,
    readTickInput,
  );
  const ack = readArray(raw["ack"], MAX_ACK_SEATS, (v) =>
    readInt(v, 0, MAX_TICK),
  );
  if (from === undefined || at === undefined || !inputs || !ack)
    return undefined;
  return { t: "in", from, inputs, at, ack };
};

const readSnapshot: Reader = (raw) => {
  const tick = readInt(raw["tick"], 0, MAX_TICK);
  const data = readString(raw["data"], NET_LIMITS.maxSnapshotChars);
  return tick === undefined || data === undefined
    ? undefined
    : { t: "snapshot", tick, data };
};

const readMatchOver: Reader = (raw) => {
  const tick = readInt(raw["tick"], 0, MAX_TICK);
  const winner =
    raw["winnerTeam"] === null ? null : readTeam(raw["winnerTeam"]);
  if (tick === undefined || winner === undefined) return undefined;
  return { t: "match_over", tick, winnerTeam: winner };
};

const READERS: Readonly<Record<string, Reader>> = {
  hello: readHello,
  ping: readPing,
  create_room: (raw) =>
    isMatchMode(raw["mode"])
      ? { t: "create_room", mode: raw["mode"] }
      : undefined,
  quick_match: (raw) =>
    isMatchMode(raw["mode"])
      ? { t: "quick_match", mode: raw["mode"] }
      : undefined,
  join_room: (raw) => {
    const code = readString(raw["code"], 16);
    const normalized = code === undefined ? "" : normalizeRoomCode(code);
    return isRoomCode(normalized)
      ? { t: "join_room", code: normalized }
      : undefined;
  },
  cancel_queue: () => ({ t: "cancel_queue" }),
  leave_room: () => ({ t: "leave_room" }),
  loaded: () => ({ t: "loaded" }),
  leave_match: () => ({ t: "leave_match" }),
  set_loadout: (raw) => {
    const loadout = readLoadout(raw["loadout"]);
    return loadout ? { t: "set_loadout", loadout } : undefined;
  },
  set_team: (raw) => {
    const team = readTeam(raw["team"]);
    return team === undefined ? undefined : { t: "set_team", team };
  },
  set_options: (raw) => {
    const options = readOptions(raw["options"]);
    return options ? { t: "set_options", options } : undefined;
  },
  set_ready: (raw) => {
    const ready = readBoolean(raw["ready"]);
    return ready === undefined ? undefined : { t: "set_ready", ready };
  },
  rematch: (raw) => {
    const vote = readBoolean(raw["vote"]);
    return vote === undefined ? undefined : { t: "rematch", vote };
  },
  chat: (raw) => {
    const text = readDisplayText(raw["text"], NET_LIMITS.chatMaxLength);
    return text ? { t: "chat", text } : undefined;
  },
  in: readInputs,
  hash: (raw) => {
    const tick = readInt(raw["tick"], 0, MAX_TICK);
    const hash = readInt(raw["hash"], 0, 0xffffffff);
    return tick === undefined || hash === undefined
      ? undefined
      : { t: "hash", tick, hash };
  },
  snapshot: readSnapshot,
  match_over: readMatchOver,
};
