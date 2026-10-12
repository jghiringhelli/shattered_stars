/**
 * BattleStateSerializer
 *
 * Serializes and restores turn-based battle state for late-join and reconnect
 * support. State is captured at end-of-turn boundaries, so the RNG is never
 * mid-stream when a snapshot is taken.
 *
 * Future turns are re-seeded deterministically via {@link computeRngSeed}, so
 * both original clients and any late joiners produce identical dice outcomes.
 *
 * Pure TypeScript — no Phaser dependency.
 */

// ── Serializable contract ─────────────────────────────────────────────────────

/**
 * Minimal shape accepted by {@link BattleStateSerializer.serialize}.
 *
 * TurnBasedBattleScene's `BattleShip` satisfies this interface at runtime.
 * Defined here to avoid a circular import back into the scene layer.
 */
export interface SerializableShip {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: string;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly isStressed: boolean;
  readonly pilotSkill: number;
  readonly initiative: number;
  readonly charges: number;
  readonly maxCharges: number;
}

// ── Wire-format types ─────────────────────────────────────────────────────────

/** Serialized representation of a single ship at an end-of-turn boundary. */
export interface ShipSnapshot {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: string;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly isStressed: boolean;
  readonly pilotSkill: number;
  readonly initiative: number;
  readonly charges: number;
  readonly maxCharges: number;
}

/**
 * Full serialized battle state captured at an end-of-turn boundary.
 *
 * Per-turn tokens (focus, evade, target lock) are intentionally excluded
 * because they are cleared by the engagement phase before this snapshot is
 * produced.
 */
export interface BattleSnapshot {
  /** Schema version — always `1` for this implementation. */
  readonly version: 1;
  /** The original battle seed distributed by the P2P server on game_start. */
  readonly baseSeed: number;
  /** The turn that just completed (next turn to play is `turnNumber + 1`). */
  readonly turnNumber: number;
  /** All ships, sorted canonically by ID. */
  readonly ships: readonly ShipSnapshot[];
  /** Wall-clock time the snapshot was produced (ms since epoch). */
  readonly capturedAt: number;
}

// ── Serializer class ──────────────────────────────────────────────────────────

/**
 * Converts live `BattleShip` maps to/from JSON-safe {@link BattleSnapshot}
 * objects for late-join and reconnect support.
 *
 * @example
 * ```typescript
 * const serializer = new BattleStateSerializer();
 * // end of turn:
 * const snap = serializer.serialize(this.ships, this.turnState.turnNumber, this.baseSeed);
 * sendToPeers(snap);
 * // late joiner:
 * const shipMap = serializer.deserialize(snap);
 * const nextSeed = serializer.computeRngSeed(snap.baseSeed, snap.turnNumber + 1);
 * ```
 */
export class BattleStateSerializer {
  /**
   * Serialize the current ship map into a JSON-safe snapshot.
   *
   * Ships are sorted by ID so the snapshot is canonical and order-independent.
   * Floating-point coordinates are rounded to the nearest integer to avoid
   * precision drift between clients.
   *
   * @param ships - Current live ship states (only living ships need be included).
   * @param turnNumber - The turn that just completed.
   * @param baseSeed - The original battle seed from `game_start`.
   * @returns A JSON-serializable {@link BattleSnapshot}.
   */
  serialize(
    ships: ReadonlyMap<string, SerializableShip>,
    turnNumber: number,
    baseSeed: number,
  ): BattleSnapshot {
    const sorted = [...ships.values()].sort((a, b) => a.id.localeCompare(b.id));
    return {
      version: 1,
      baseSeed,
      turnNumber,
      capturedAt: Date.now(),
      ships: sorted.map((s) => ({
        id: s.id,
        definitionId: s.definitionId,
        faction: s.faction,
        owner: s.owner,
        x: Math.round(s.x),
        y: Math.round(s.y),
        angle: Math.round(s.angle),
        hull: s.hull,
        maxHull: s.maxHull,
        shields: s.shields,
        maxShields: s.maxShields,
        isStressed: s.isStressed,
        pilotSkill: s.pilotSkill,
        initiative: s.initiative,
        charges: s.charges,
        maxCharges: s.maxCharges,
      })),
    };
  }

  /**
   * Restore a snapshot as a map indexed by ship ID for O(1) lookup.
   *
   * The caller (scene layer) is responsible for reconstructing full
   * `BattleShip` objects by combining the returned data with mode-specific
   * combat stats from `getModeCombatStats`.
   *
   * @param snapshot - A {@link BattleSnapshot} from `serialize` or the server.
   * @returns `ReadonlyMap` of ship ID → {@link ShipSnapshot}.
   */
  deserialize(snapshot: BattleSnapshot): ReadonlyMap<string, ShipSnapshot> {
    const result = new Map<string, ShipSnapshot>();
    for (const ship of snapshot.ships) {
      result.set(ship.id, ship);
    }
    return result;
  }

  /**
   * Derive a deterministic per-turn RNG seed from the base seed and turn.
   *
   * Both original clients and late joiners call this at the start of each
   * turn to obtain the same seed, ensuring identical dice outcomes without
   * requiring RNG state transport.
   *
   * @param baseSeed - The original battle seed from `game_start`.
   * @param turnNumber - The turn about to begin (i.e. `snapshot.turnNumber + 1`).
   * @returns A 32-bit unsigned integer suitable for `seedrandom`.
   */
  computeRngSeed(baseSeed: number, turnNumber: number): number {
    // Knuth multiplicative hash — bijective, fast, well-distributed
    return (baseSeed ^ (turnNumber * 0x9e3779b9)) >>> 0;
  }
}
