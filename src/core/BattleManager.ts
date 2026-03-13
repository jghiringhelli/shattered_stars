/**
 * Battle Manager
 * Coordinates the full battle loop with player and AI ships
 */

import type { ShipState, ManeuverDefinition, ActionType } from './types';
import type { TurnState } from '../systems/TurnSystem';
import {
  createInitialTurnState,
  advancePhase,
  setPlannedManeuver,
  isPlannningComplete,
  executeActivation,
  applyActivation,
  markShipActivated,
  markShipAttacked,
  getActivationOrder,
  getEngagementOrder,
  getNextShipToActivate,
  getNextShipToEngage,
  processEndPhaseForAll,
  checkVictory,
} from '../systems/TurnSystem';
import { resolveAttack, type AttackContext } from '../systems/CombatSystem';
import { getTargetInfo, getValidTargets } from '../systems/TargetingSystem';
import { planAIManeuvers, planAIAction, planAIAttack } from '../ai/AIBrain';
import { getShipDefinition, getShipDial, SHIP_DEFINITIONS } from '../data/ShipDefinitions';
import { createSeededRng, type RandomGenerator } from '../utils/random';
import type { FactionId } from '../config';

// ============================================
// Battle State
// ============================================

export interface BattleConfig {
  readonly playerFaction: FactionId;
  readonly enemyFaction: FactionId;
  readonly playerShips: string[]; // Ship definition IDs
  readonly enemyShips: string[]; // Ship definition IDs
  readonly seed?: number;
  /** Cumulative stat bonuses from pilot evolution applied to all player ships */
  readonly playerStatBonuses?: {
    hull?: number;
    shields?: number;
  };
}

export interface BattleState {
  readonly ships: Map<string, ShipState>;
  readonly turnState: TurnState;
  readonly playerShipId: string | null; // Currently controlled ship
  readonly selectedManeuver: ManeuverDefinition | null;
  readonly selectedTarget: string | null;
  readonly battleLog: string[];
  readonly isPlayerTurn: boolean;
  readonly waitingForPlayerInput: 'maneuver' | 'action' | 'target' | null;
}

// ============================================
// Battle Manager Class
// ============================================

export class BattleManager {
  private state: BattleState;
  private rng: RandomGenerator;
  private onStateChange: ((state: BattleState) => void) | null = null;
  private onLog: ((message: string) => void) | null = null;

  constructor(config: BattleConfig) {
    this.rng = createSeededRng(config.seed ?? Date.now());
    this.state = this.initializeBattle(config);
  }

  private initializeBattle(config: BattleConfig): BattleState {
    const ships = new Map<string, ShipState>();
    let shipIndex = 0;

    // Spawn player ships (bottom of field, facing up)
    const playerStartY = 800;
    const playerSpacing = 80;
    const playerStartX = 500 - ((config.playerShips.length - 1) * playerSpacing) / 2;

    for (let i = 0; i < config.playerShips.length; i++) {
      const defId = config.playerShips[i]!;
      const def = getShipDefinition(defId);
      if (!def) continue;

      const hullBonus = config.playerStatBonuses?.hull ?? 0;
      const shieldBonus = config.playerStatBonuses?.shields ?? 0;
      const ship: ShipState = {
        id: `player_${shipIndex++}`,
        definitionId: defId,
        faction: config.playerFaction,
        owner: 'player',
        x: playerStartX + i * playerSpacing,
        y: playerStartY,
        angle: 0, // Facing up
        hull: def.baseStats.hull + hullBonus,
        maxHull: def.baseStats.hull + hullBonus,
        shields: def.baseStats.shields + shieldBonus,
        maxShields: def.baseStats.shields + shieldBonus,
        isStressed: false,
        hasFocus: false,
        hasEvade: false,
        hasTargetLock: null,
        isCloaked: false,
        currentManeuver: null,
        maneuverProgress: 0,
        mobileArcDirection: 'front',
        charges: 0,
        maxCharges: 0,
      };
      ships.set(ship.id, ship);
    }

    // Spawn enemy ships (top of field, facing down)
    const enemyStartY = 200;
    const enemySpacing = 80;
    const enemyStartX = 500 - ((config.enemyShips.length - 1) * enemySpacing) / 2;

    for (let i = 0; i < config.enemyShips.length; i++) {
      const defId = config.enemyShips[i]!;
      const def = getShipDefinition(defId);
      if (!def) continue;

      const ship: ShipState = {
        id: `enemy_${shipIndex++}`,
        definitionId: defId,
        faction: config.enemyFaction,
        owner: 'ai',
        x: enemyStartX + i * enemySpacing,
        y: enemyStartY,
        angle: 180, // Facing down
        hull: def.baseStats.hull,
        maxHull: def.baseStats.hull,
        shields: def.baseStats.shields,
        maxShields: def.baseStats.shields,
        isStressed: false,
        hasFocus: false,
        hasEvade: false,
        hasTargetLock: null,
        isCloaked: false,
        currentManeuver: null,
        maneuverProgress: 0,
        mobileArcDirection: 'front',
        charges: 0,
        maxCharges: 0,
      };
      ships.set(ship.id, ship);
    }

    // Find first player ship to control
    const playerShipId = Array.from(ships.values()).find(
      (s) => s.owner === 'player'
    )?.id ?? null;

    return {
      ships,
      turnState: createInitialTurnState(),
      playerShipId,
      selectedManeuver: null,
      selectedTarget: null,
      battleLog: ['Battle started!'],
      isPlayerTurn: true,
      waitingForPlayerInput: 'maneuver',
    };
  }

  // ============================================
  // Public API
  // ============================================

  getState(): BattleState {
    return this.state;
  }

  setOnStateChange(callback: (state: BattleState) => void): void {
    this.onStateChange = callback;
  }

  setOnLog(callback: (message: string) => void): void {
    this.onLog = callback;
  }

  addShip(ship: ShipState): void {
    const ships = new Map(this.state.ships);
    ships.set(ship.id, ship);
    this.updateState({ ships });
  }

  private updateState(updates: Partial<BattleState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  private log(message: string): void {
    this.state = {
      ...this.state,
      battleLog: [...this.state.battleLog, message],
    };
    this.onLog?.(message);
  }

  // ============================================
  // Player Actions
  // ============================================

  /** Select a maneuver for the player's ship */
  selectManeuver(maneuver: ManeuverDefinition): void {
    if (this.state.waitingForPlayerInput !== 'maneuver') return;
    if (!this.state.playerShipId) return;

    this.updateState({ selectedManeuver: maneuver });
  }

  /** Confirm the selected maneuver and proceed */
  confirmManeuver(): void {
    if (!this.state.selectedManeuver || !this.state.playerShipId) return;

    // Set player maneuver
    let turnState = setPlannedManeuver(
      this.state.turnState,
      this.state.playerShipId,
      this.state.selectedManeuver
    );

    // Plan AI maneuvers
    const aiShips = this.getAIShips();
    const allShips = Array.from(this.state.ships.values());
    const aiManeuvers = planAIManeuvers(
      aiShips,
      allShips,
      (ship) => getShipDial(ship.definitionId),
      turnState.turnNumber
    );

    for (const [shipId, maneuver] of aiManeuvers) {
      turnState = setPlannedManeuver(turnState, shipId, maneuver);
    }

    this.log(`Turn ${turnState.turnNumber}: Planning complete`);

    this.updateState({
      turnState,
      selectedManeuver: null,
      waitingForPlayerInput: null,
    });

    // Move to activation phase
    this.advanceToActivation();
  }

  /** Select a target for attacking */
  selectTarget(targetId: string): void {
    if (this.state.waitingForPlayerInput !== 'target') return;
    this.updateState({ selectedTarget: targetId });
  }

  /** Confirm attack on selected target */
  confirmAttack(): void {
    if (!this.state.selectedTarget || !this.state.playerShipId) return;

    const attacker = this.state.ships.get(this.state.playerShipId);
    const target = this.state.ships.get(this.state.selectedTarget);
    if (!attacker || !target) return;

    this.executeAttack(attacker, target);

    this.updateState({
      selectedTarget: null,
      waitingForPlayerInput: null,
    });

    this.continueEngagement();
  }

  /** Skip attack (no valid targets or choose not to attack) */
  skipAttack(): void {
    if (!this.state.playerShipId) return;

    let turnState = markShipAttacked(this.state.turnState, this.state.playerShipId);
    this.updateState({ turnState, waitingForPlayerInput: null });
    this.continueEngagement();
  }

  /** Perform an action (focus, evade, etc) */
  performAction(action: ActionType, targetId?: string): void {
    if (!this.state.playerShipId) return;

    const ship = this.state.ships.get(this.state.playerShipId);
    if (!ship) return;

    const ships = new Map(this.state.ships);
    const updatedShip = this.applyAction(ship, action, targetId);
    ships.set(ship.id, updatedShip);

    this.log(`${ship.id} performed ${action}`);
    this.updateState({ ships, waitingForPlayerInput: null });

    this.continueActivation();
  }

  /** Skip action */
  skipAction(): void {
    if (!this.state.playerShipId) return;

    let turnState = markShipActivated(this.state.turnState, this.state.playerShipId);
    this.updateState({ turnState, waitingForPlayerInput: null });
    this.continueActivation();
  }

  // ============================================
  // Game Loop
  // ============================================

  private advanceToActivation(): void {
    let turnState = advancePhase(this.state.turnState); // planning -> system
    turnState = advancePhase(turnState); // system -> activation

    this.updateState({ turnState });
    this.runActivationPhase();
  }

  private runActivationPhase(): void {
    const allShips = Array.from(this.state.ships.values()).filter((s) => s.hull > 0);
    const activationOrder = getActivationOrder(allShips, (s) => {
      const def = getShipDefinition(s.definitionId);
      return def?.baseStats.agility ?? 2;
    });

    this.processNextActivation(activationOrder);
  }

  private processNextActivation(activationOrder: string[]): void {
    const nextId = getNextShipToActivate(this.state.turnState, activationOrder);

    if (!nextId) {
      // All ships activated, move to engagement
      this.advanceToEngagement();
      return;
    }

    const ship = this.state.ships.get(nextId);
    if (!ship) {
      this.continueActivation();
      return;
    }

    // Execute maneuver
    const maneuver = this.state.turnState.plannedManeuvers.get(nextId);
    if (maneuver) {
      const result = executeActivation(ship, maneuver);
      const updatedShip = applyActivation(ship, result);

      const ships = new Map(this.state.ships);
      ships.set(nextId, updatedShip);

      this.log(`${ship.id} executed ${maneuver.direction} speed ${maneuver.speed}`);
      this.updateState({ ships });
    }

    // If player ship, wait for action input
    if (ship.owner === 'player' && ship.id === this.state.playerShipId) {
      let turnState = markShipActivated(this.state.turnState, nextId);
      this.updateState({
        turnState,
        waitingForPlayerInput: 'action',
        isPlayerTurn: true,
      });
      return;
    }

    // AI action
    const allShips = Array.from(this.state.ships.values());
    const def = getShipDefinition(ship.definitionId);
    const actionBar = def?.baseStats.actions ?? [];
    const actionDecision = planAIAction(ship, actionBar, allShips, this.state.turnState.turnNumber);

    if (actionDecision) {
      const ships = new Map(this.state.ships);
      const updatedShip = this.applyAction(ship, actionDecision.action, actionDecision.targetId);
      ships.set(nextId, updatedShip);
      this.log(`${ship.id} performed ${actionDecision.action}`);
      this.updateState({ ships });
    }

    let turnState = markShipActivated(this.state.turnState, nextId);
    this.updateState({ turnState });

    // Continue to next ship
    setTimeout(() => this.processNextActivation(activationOrder), 300);
  }

  private continueActivation(): void {
    const allShips = Array.from(this.state.ships.values()).filter((s) => s.hull > 0);
    const activationOrder = getActivationOrder(allShips, (s) => {
      const def = getShipDefinition(s.definitionId);
      return def?.baseStats.agility ?? 2;
    });

    setTimeout(() => this.processNextActivation(activationOrder), 300);
  }

  private advanceToEngagement(): void {
    let turnState = advancePhase(this.state.turnState); // activation -> engagement
    this.updateState({ turnState });
    this.runEngagementPhase();
  }

  private runEngagementPhase(): void {
    const allShips = Array.from(this.state.ships.values()).filter((s) => s.hull > 0);
    const engagementOrder = getEngagementOrder(allShips, (s) => {
      const def = getShipDefinition(s.definitionId);
      return def?.baseStats.agility ?? 2;
    });

    this.processNextEngagement(engagementOrder);
  }

  private processNextEngagement(engagementOrder: string[]): void {
    const nextId = getNextShipToEngage(this.state.turnState, engagementOrder);

    if (!nextId) {
      // All ships engaged, move to end phase
      this.advanceToEnd();
      return;
    }

    const ship = this.state.ships.get(nextId);
    if (!ship || ship.hull <= 0) {
      let turnState = markShipAttacked(this.state.turnState, nextId);
      this.updateState({ turnState });
      this.continueEngagement();
      return;
    }

    // If player ship, wait for target input
    if (ship.owner === 'player' && ship.id === this.state.playerShipId) {
      const enemies = Array.from(this.state.ships.values()).filter(
        (s) => s.faction !== ship.faction && s.hull > 0
      );
      const validTargets = getValidTargets(ship, enemies, true);

      if (validTargets.length === 0) {
        this.log(`${ship.id} has no valid targets`);
        let turnState = markShipAttacked(this.state.turnState, nextId);
        this.updateState({ turnState });
        this.continueEngagement();
        return;
      }

      this.updateState({
        waitingForPlayerInput: 'target',
        isPlayerTurn: true,
      });
      return;
    }

    // AI attack
    const allShips = Array.from(this.state.ships.values());
    const targetDecision = planAIAttack(ship, allShips, this.state.turnState.turnNumber);

    if (targetDecision) {
      const target = this.state.ships.get(targetDecision.targetId);
      if (target) {
        this.executeAttack(ship, target);
      }
    }

    let turnState = markShipAttacked(this.state.turnState, nextId);
    this.updateState({ turnState });

    setTimeout(() => this.processNextEngagement(engagementOrder), 500);
  }

  private continueEngagement(): void {
    const allShips = Array.from(this.state.ships.values()).filter((s) => s.hull > 0);
    const engagementOrder = getEngagementOrder(allShips, (s) => {
      const def = getShipDefinition(s.definitionId);
      return def?.baseStats.agility ?? 2;
    });

    setTimeout(() => this.processNextEngagement(engagementOrder), 500);
  }

  private advanceToEnd(): void {
    let turnState = advancePhase(this.state.turnState); // engagement -> end

    // Clear round tokens
    const ships = new Map(this.state.ships);
    const processed = processEndPhaseForAll(Array.from(ships.values()));
    for (const ship of processed) {
      ships.set(ship.id, ship);
    }

    // Check victory
    const victory = checkVictory(Array.from(ships.values()), turnState.turnNumber);

    if (victory.isComplete) {
      this.log(`Battle Over: ${victory.reason}`);
      this.updateState({ ships, turnState, waitingForPlayerInput: null });
      return;
    }

    // Start new turn
    turnState = advancePhase(turnState); // end -> planning
    this.log(`Turn ${turnState.turnNumber} begins`);

    this.updateState({
      ships,
      turnState,
      waitingForPlayerInput: 'maneuver',
      isPlayerTurn: true,
    });
  }

  // ============================================
  // Combat
  // ============================================

  private executeAttack(attacker: ShipState, target: ShipState): void {
    const attackerDef = getShipDefinition(attacker.definitionId);
    const targetDef = getShipDefinition(target.definitionId);
    if (!attackerDef || !targetDef) return;

    const info = getTargetInfo(attacker, target);
    if (!info.canAttackPrimary || info.range === null) return;

    const context: AttackContext = {
      attackDice: attackerDef.baseStats.attack,
      attackerHasFocus: attacker.hasFocus,
      attackerHasTargetLock: attacker.hasTargetLock === target.id,
      defenseDice: targetDef.baseStats.agility,
      defenderHasFocus: target.hasFocus,
      defenderHasEvadeToken: target.hasEvade,
      defenderShields: target.shields,
      defenderHull: target.hull,
      range: info.range,
    };

    const result = resolveAttack(context, this.rng);

    // Apply damage
    const ships = new Map(this.state.ships);
    const updatedTarget: ShipState = {
      ...target,
      shields: Math.max(0, target.shields - result.shieldDamage),
      hull: Math.max(0, target.hull - result.hullDamage),
    };
    ships.set(target.id, updatedTarget);

    // Spend tokens
    let updatedAttacker = attacker;
    if (attacker.hasFocus && result.modifiedAttack.some((f) => f === 'hit')) {
      updatedAttacker = { ...updatedAttacker, hasFocus: false };
    }
    if (attacker.hasTargetLock === target.id) {
      updatedAttacker = { ...updatedAttacker, hasTargetLock: null };
    }
    ships.set(attacker.id, updatedAttacker);

    this.log(
      `${attacker.id} attacks ${target.id}: ${result.totalDamage} damage` +
        (result.shipDestroyed ? ' - DESTROYED!' : '')
    );

    this.updateState({ ships });
  }

  private applyAction(ship: ShipState, action: ActionType, targetId?: string): ShipState {
    switch (action) {
      case 'focus':
        return { ...ship, hasFocus: true };
      case 'evade':
        return { ...ship, hasEvade: true };
      case 'target_lock':
        return { ...ship, hasTargetLock: targetId ?? null };
      default:
        return ship;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private getAIShips(): ShipState[] {
    return Array.from(this.state.ships.values()).filter(
      (s) => s.owner === 'ai' && s.hull > 0
    );
  }

  getPlayerShip(): ShipState | undefined {
    if (!this.state.playerShipId) return undefined;
    return this.state.ships.get(this.state.playerShipId);
  }

  getAvailableManeuvers(): ManeuverDefinition[] {
    const ship = this.getPlayerShip();
    if (!ship) return [];
    return [...getShipDial(ship.definitionId)];
  }

  getValidTargets(): ShipState[] {
    const ship = this.getPlayerShip();
    if (!ship) return [];

    const enemies = Array.from(this.state.ships.values()).filter(
      (s) => s.faction !== ship.faction && s.hull > 0
    );
    const targetInfos = getValidTargets(ship, enemies, true);
    return targetInfos
      .map((info) => this.state.ships.get(info.targetId))
      .filter((s): s is ShipState => s !== undefined);
  }
}
