/**
 * OnlineTurnManager
 *
 * Manages the network-gated planning phase for online P2P battles.
 * Sends the local player's planned maneuvers and waits for the opponent's
 * before allowing the activation phase to proceed.
 *
 * Also handles mid-battle opponent disconnects by immediately unblocking
 * any pending submitAndWait promise so the scene can fall back to AI control.
 *
 * Pure TypeScript — no Phaser dependency.
 */

import type { NetworkService, GameAction } from '../services/NetworkService';
import type { ShipState } from '../core/types';

/** Wire format for a single planned maneuver sent over the network. */
export interface ManeuverPacket {
  readonly shipId: string;
  readonly direction: string;
  readonly speed: number;
  readonly difficulty: string;
}

/** Payload shape sent inside a game_action with type 'submit_maneuvers'. */
interface SubmitManeuversPayload {
  maneuvers: ManeuverPacket[];
}

/** Payload shape sent inside a game_action with type 'turn_sync'. */
interface TurnSyncPayload {
  turnNumber: number;
  stateHash: string;
}

/** Payload broadcast by the server when a player disconnects mid-battle. */
interface PlayerDisconnectedPayload {
  playerId: string;
  inBattle: boolean;
}

/**
 * Orchestrates the planning-phase synchronisation between two online players.
 *
 * @example
 * ```typescript
 * const mgr = new OnlineTurnManager(networkService);
 * mgr.onDisconnect((id) => handleOpponentLeft(id));
 * const packets = await mgr.submitAndWait(localManeuvers, () => showOverlay());
 * mgr.destroy(); // call on scene shutdown
 * ```
 */
export class OnlineTurnManager {
  private readonly actionHandler: (action: unknown) => void;
  private readonly disconnectHandler: (data: unknown) => void;
  private pendingResolve: ((packets: ManeuverPacket[]) => void) | null = null;
  private turnSyncHandlers: Array<(turnNumber: number, hash: string) => void> = [];
  private disconnectCallbacks: Array<(playerId: string) => void> = [];

  /**
   * @param networkService - The singleton network service instance.
   */
  constructor(private readonly networkService: NetworkService) {
    this.actionHandler = (action: unknown) => this.handleIncomingAction(action as GameAction);
    this.disconnectHandler = (data: unknown) =>
      this.handleDisconnect(data as PlayerDisconnectedPayload);

    this.networkService.on('game_action', this.actionHandler, this);
    this.networkService.on('player_disconnected', this.disconnectHandler, this);
  }

  /**
   * Submit local maneuvers and wait for opponent's response.
   *
   * Sends a 'submit_maneuvers' game_action then returns a Promise that
   * resolves once the opponent's maneuvers arrive over the network.
   * If the opponent disconnects while waiting, resolves immediately with [].
   *
   * @param maneuvers - The local player's planned maneuvers.
   * @param onWaiting - Called immediately after sending so the caller can show a "waiting" overlay.
   * @returns Promise resolving with the opponent's planned maneuvers.
   */
  submitAndWait(
    maneuvers: ManeuverPacket[],
    onWaiting: () => void,
  ): Promise<ManeuverPacket[]> {
    this.networkService.sendGameAction({
      type: 'submit_maneuvers',
      data: { maneuvers } satisfies SubmitManeuversPayload,
    });

    onWaiting();

    return new Promise<ManeuverPacket[]>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  /**
   * Compute a deterministic state hash from all ships' positions and health.
   * Used to detect out-of-sync clients at end of turn.
   *
   * @param ships - Current battle ship states.
   * @returns A short hex string representing the state snapshot.
   */
  computeStateHash(ships: ReadonlyMap<string, ShipState>): string {
    const ordered = [...ships.values()].sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = ordered
      .map(s => `${s.id}:${Math.round(s.x)},${Math.round(s.y)},${s.hull},${s.shields}`)
      .join('|');

    // djb2 hash — deterministic, no crypto needed
    let hash = 5381;
    for (let i = 0; i < snapshot.length; i++) {
      hash = ((hash << 5) + hash) ^ snapshot.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Broadcast a turn-end sync message so both clients can verify state consistency.
   *
   * @param turnNumber - The turn that just completed.
   * @param stateHash - The local state hash from computeStateHash.
   */
  sendTurnSync(turnNumber: number, stateHash: string): void {
    this.networkService.sendGameAction({
      type: 'turn_sync',
      data: { turnNumber, stateHash } satisfies TurnSyncPayload,
    });
  }

  /**
   * Subscribe to opponent turn_sync messages.
   *
   * @param cb - Callback invoked with the opponent's turn number and state hash.
   */
  onTurnSync(cb: (turnNumber: number, opponentHash: string) => void): void {
    this.turnSyncHandlers.push(cb);
  }

  /**
   * Subscribe to mid-battle opponent disconnect events.
   *
   * Called when the server broadcasts player_disconnected with inBattle: true.
   * Any pending submitAndWait promise is resolved with [] before this fires.
   *
   * @param cb - Callback invoked with the disconnected player's ID.
   */
  onDisconnect(cb: (playerId: string) => void): void {
    this.disconnectCallbacks.push(cb);
  }

  /** Deregister all network listeners. Call this in scene shutdown. */
  destroy(): void {
    this.networkService.off('game_action', this.actionHandler, this);
    this.networkService.off('player_disconnected', this.disconnectHandler, this);
    this.pendingResolve = null;
    this.turnSyncHandlers = [];
    this.disconnectCallbacks = [];
  }

  private handleIncomingAction(action: GameAction): void {
    if (!action?.type || typeof action.data !== 'object' || action.data === null) return;

    if (action.type === 'submit_maneuvers' && this.pendingResolve) {
      const payload = action.data as SubmitManeuversPayload;
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(payload.maneuvers ?? []);
      return;
    }

    if (action.type === 'turn_sync') {
      const payload = action.data as TurnSyncPayload;
      for (const handler of this.turnSyncHandlers) {
        handler(payload.turnNumber, payload.stateHash);
      }
    }
  }

  private handleDisconnect(data: PlayerDisconnectedPayload): void {
    if (data.inBattle && this.pendingResolve) {
      // Unblock the planning phase immediately — caller will see [] and handle gracefully
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve([]);
    }
    for (const cb of this.disconnectCallbacks) {
      cb(data.playerId);
    }
  }
}
