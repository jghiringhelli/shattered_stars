/**
 * Room codes: 5 characters from an alphabet without look-alikes, drawn until
 * one is free. Pure (randomness injected).
 */

import { NET_LIMITS, ROOM_CODE_ALPHABET } from "../../src/net/protocol";

/** Draws before giving up (only reachable with millions of open rooms). */
const MAX_ATTEMPTS = 1_000;

/** No free code could be found. */
export class RoomCodeExhaustedError extends Error {
  constructor() {
    super(`No free room code after ${MAX_ATTEMPTS} attempts`);
    this.name = "RoomCodeExhaustedError";
  }
}

/**
 * @param randomInt - Returns an integer in [0, n).
 * @param isTaken - Whether a code is already in use.
 * @returns A free code.
 * @throws RoomCodeExhaustedError when every draw collided.
 */
export function generateRoomCode(
  randomInt: (n: number) => number,
  isTaken: (code: string) => boolean,
): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = "";
    for (let i = 0; i < NET_LIMITS.roomCodeLength; i++) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)] ?? "A";
    }
    if (!isTaken(code)) return code;
  }
  throw new RoomCodeExhaustedError();
}
