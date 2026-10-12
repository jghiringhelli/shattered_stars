/**
 * Immer-based immutable game state store
 */

import { produce, enableMapSet } from "immer";
import type { ShipState } from "./types";
import type { FactionId } from "../config";

// Enable Map/Set support in Immer
enableMapSet();

// ============================================
// State Shape
// ============================================

export interface BattleState {
  phase: "setup" | "planning" | "activation" | "combat" | "end";
  turn: number;
  ships: Map<string, ShipState>;
  activeShipId: string | null;
  selectedManeuver: string | null; // Maneuver key for current ship
}

export interface GameState {
  battle: BattleState | null;
  playerFaction: FactionId;
  isPaused: boolean;
}

// ============================================
// Initial State
// ============================================

const initialState: GameState = {
  battle: null,
  playerFaction: "free_confederation",
  isPaused: false,
};

// ============================================
// Store Class
// ============================================

type StateListener = (state: GameState) => void;

class GameStoreClass {
  private state: GameState = initialState;
  private listeners: Set<StateListener> = new Set();

  /**
   * Get current state (read-only)
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Update state using Immer produce
   */
  update(recipe: (draft: GameState) => void): void {
    this.state = produce(this.state, recipe);
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = initialState;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error("GameStore: Error in listener:", error);
      }
    }
  }

  // ============================================
  // Battle State Helpers
  // ============================================

  /**
   * Start a new battle
   */
  startBattle(): void {
    this.update((draft) => {
      draft.battle = {
        phase: "setup",
        turn: 1,
        ships: new Map(),
        activeShipId: null,
        selectedManeuver: null,
      };
    });
  }

  /**
   * Add a ship to the battle
   */
  addShip(ship: ShipState): void {
    this.update((draft) => {
      if (draft.battle) {
        draft.battle.ships.set(ship.id, ship);
      }
    });
  }

  /**
   * Update a specific ship
   */
  updateShip(shipId: string, recipe: (ship: ShipState) => void): void {
    this.update((draft) => {
      if (draft.battle) {
        const ship = draft.battle.ships.get(shipId);
        if (ship) {
          recipe(ship);
        }
      }
    });
  }

  /**
   * Remove a ship from battle
   */
  removeShip(shipId: string): void {
    this.update((draft) => {
      if (draft.battle) {
        draft.battle.ships.delete(shipId);
      }
    });
  }

  /**
   * Get a ship by ID
   */
  getShip(shipId: string): ShipState | undefined {
    return this.state.battle?.ships.get(shipId);
  }

  /**
   * Get all ships for a faction
   */
  getShipsByFaction(faction: FactionId): ShipState[] {
    if (!this.state.battle) return [];
    return Array.from(this.state.battle.ships.values()).filter(
      (ship) => ship.faction === faction,
    );
  }

  /**
   * Get all ships owned by player or AI
   */
  getShipsByOwner(owner: "player" | "ai"): ShipState[] {
    if (!this.state.battle) return [];
    return Array.from(this.state.battle.ships.values()).filter(
      (ship) => ship.owner === owner,
    );
  }
}

// Singleton instance
export const GameStore = new GameStoreClass();
