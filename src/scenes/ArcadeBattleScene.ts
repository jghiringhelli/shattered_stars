/**
 * Arcade Battle Scene
 * Real-time dogfighting with direct ship control
 */

import Phaser from 'phaser';
import { ShipStatCard } from '../ui/ShipStatCard';
import type { ShipState } from '../core/types';
import {
  createControlState,
  updateManeuver,
  updateCooldowns,
  getContinuousMovement,
  processCommand,
  canFire,
  canKTurn,
  type ShipControlState,
  type FlightCommand,
} from '../core/ArcadeControls';
import {
  createProjectile,
  updateProjectile,
  isProjectileAlive,
  checkProjectileHit,
  type Projectile,
} from '../core/Projectile';
import { getShipDefinition } from '../data/ShipDefinitions';
import { distance } from '../systems/MovementSystem';
import {
  BATTLEFIELD_SIZE,
  FACTION_COLORS,
  SHIP_SIZES,
  type FactionId,
} from '../config';
import { HealthBar } from '../ui/HealthBar';
import { Minimap, type MinimapShip } from '../ui/Minimap';
import { renderBattleStarfield } from '../rendering/Starfield';

interface ArcadeShip extends ShipState {
  control: ShipControlState;
  /** ID of the ship this AI has locked as its current target. */
  targetId: string | null;
  /** Milliseconds remaining before the AI re-evaluates its target. */
  aiDecisionTimer: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  hull: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  healthBar?: HealthBar;
}

export class ArcadeBattleScene extends Phaser.Scene {
  private ships: Map<string, ArcadeShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private projectiles: Projectile[] = [];
  private projectileSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private minimap: Minimap | undefined;
  private cameraShakeEnabled = true;
  private damageNumbersEnabled = true;

  private playerShipId: string | null = null;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
    shift: Phaser.Input.Keyboard.Key;
    ctrl: Phaser.Input.Keyboard.Key;
  };

  // HUD
  private speedText!: Phaser.GameObjects.Text;
  private hullText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private cooldownText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  private playerFaction: FactionId = 'free_confederation';
  private score = 0;
  private lastTime = 0;
  private gameEnded = false;
  private isPaused = false;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  // Smooth turning state
  private playerAngularVelocity = 0;
  private framesAlive = 0;

  constructor() {
    super({ key: 'ArcadeBattleScene' });
  }

  preload(): void {
    const battleConfig = this.registry.get('battleConfig') as {
      factions: Array<{ factionId: FactionId; controller: 'player' | 'ai'; ships: string[] }>;
    } | undefined;

    const loadIfMissing = (id: string): void => {
      const key = `ship_${id}`;
      if (this.textures.exists(key)) return;
      const def = getShipDefinition(id);
      if (def) this.load.image(key, `assets/ships/${def.faction}/${id}.png`);
    };

    if (battleConfig?.factions?.length) {
      for (const slot of battleConfig.factions) {
        for (const shipId of slot.ships) loadIfMissing(shipId);
      }
    } else {
      loadIfMissing('confed_sparrow');
      loadIfMissing('confed_wasp');
      loadIfMissing('terran_gladius');
      loadIfMissing('terran_viper');
    }
  }

  create(): void {
    const savedSettings = this.registry.get('settings') as
      | { cameraShake: boolean; showDamageNumbers: boolean; showMinimap: boolean }
      | undefined;
    this.cameraShakeEnabled = savedSettings?.cameraShake ?? true;
    this.damageNumbersEnabled = savedSettings?.showDamageNumbers ?? true;
    const showMinimap = savedSettings?.showMinimap ?? true;

    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    this.createStarfield();
    this.setupInput();
    this.createHUD();
    this.spawnShips();
    this.createHealthBars();
    if (showMinimap) this.createMinimap();

    // Follow player
    const playerSprite = this.shipSprites.get(this.playerShipId!);
    if (playerSprite) {
      this.cameras.main.startFollow(playerSprite, true, 0.1, 0.1);
    }

    this.lastTime = this.time.now;
  }

  private createHealthBars(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = new HealthBar({
        scene: this,
        x: ship.x,
        y: ship.y - 30,
        faction: ship.faction as FactionId,
        maxHull: ship.maxHull,
        maxShields: ship.maxShields,
        currentHull: ship.hull,
        currentShields: ship.shields,
      });
      this.healthBars.set(id, healthBar);
    }
  }

  private createMinimap(): void {
    this.minimap = new Minimap({
      scene: this,
      x: this.scale.width - 160,
      y: this.scale.height - 160,
      width: 150,
      height: 150,
    });
  }

  update(time: number): void {
    const deltaMs = time - this.lastTime;
    this.lastTime = time;

    if (deltaMs <= 0 || deltaMs > 100) return;
    if (this.isPaused || this.gameEnded) return;

    this.framesAlive++;
    this.handleInput(deltaMs);
    this.updateShips(deltaMs);
    this.updateProjectiles(deltaMs);
    this.updateAI(deltaMs);
    this.checkCollisions();
    this.updateSprites();
    this.updateHUD();
    this.checkVictory();
  }

  private createStarfield(): void {
    renderBattleStarfield(this, BATTLEFIELD_SIZE);
  }

  private setupInput(): void {
    this.keys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      z: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      shift: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      ctrl: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL),
    };

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.gameEnded) return;
      if (this.isPaused) {
        this.isPaused = false;
        this.pauseOverlay?.destroy();
        this.pauseOverlay = null;
      } else {
        this.isPaused = true;
        this.showPauseOverlay();
      }
    });
  }

  private showPauseOverlay(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.pauseOverlay = this.add.container(0, 0).setDepth(3000).setScrollFactor(0);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(0, 0, this.scale.width, this.scale.height);
    this.pauseOverlay.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a2e, 0.98);
    panel.lineStyle(2, 0x2244aa, 1);
    panel.fillRoundedRect(cx - 150, cy - 90, 300, 180, 12);
    panel.strokeRoundedRect(cx - 150, cy - 90, 300, 180, 12);
    this.pauseOverlay.add(panel);

    this.pauseOverlay.add(this.add.text(cx, cy - 55, 'PAUSED', {
      font: 'bold 32px Arial', color: '#ffffff',
    }).setOrigin(0.5));

    const resumeBtn = this.add.text(cx, cy + 5, 'RESUME', {
      font: 'bold 22px Arial', color: '#44ff88',
      backgroundColor: '#224422', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => {
      this.isPaused = false;
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
    });
    this.pauseOverlay.add(resumeBtn);

    const quitBtn = this.add.text(cx, cy + 55, 'QUIT TO MENU', {
      font: 'bold 18px Arial', color: '#ff4444',
      backgroundColor: '#331111', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    quitBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));
    this.pauseOverlay.add(quitBtn);
  }

  private handleInput(deltaMs: number): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship || ship.hull <= 0) return;

    // Speed control (discrete steps, X-Wing style)
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      ship.control = processCommand(ship, ship.control, 'thrust_increase');
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      ship.control = processCommand(ship, ship.control, 'thrust_decrease');
    }

    // Smooth turning with angular acceleration/deceleration
    const MAX_ANG_VEL = 160; // degrees per second at full deflection
    const ACCEL      = 480; // degrees per second squared
    const dt = deltaMs / 1000;

    if (this.keys.left.isDown) {
      this.playerAngularVelocity = Math.max(-MAX_ANG_VEL, this.playerAngularVelocity - ACCEL * dt);
    } else if (this.keys.right.isDown) {
      this.playerAngularVelocity = Math.min(MAX_ANG_VEL, this.playerAngularVelocity + ACCEL * dt);
    } else {
      const decel = ACCEL * 2 * dt;
      if (Math.abs(this.playerAngularVelocity) <= decel) {
        this.playerAngularVelocity = 0;
      } else {
        this.playerAngularVelocity -= Math.sign(this.playerAngularVelocity) * decel;
      }
    }

    ship.angle = ((ship.angle + this.playerAngularVelocity * dt) % 360 + 360) % 360;

    // K-turn (180 flip)
    if (Phaser.Input.Keyboard.JustDown(this.keys.z)) {
      ship.control = processCommand(ship, ship.control, 'kturn');
    }

    // Fire — skip first few frames to prevent key-bleed from menu navigation
    if (this.framesAlive > 5 && this.keys.space.isDown && canFire(ship.control)) {
      ship.control = processCommand(ship, ship.control, 'fire');
      this.fireWeapon(ship);
    }
  }

  private updateShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Update cooldowns
      ship.control = updateCooldowns(ship.control, deltaMs);

      // Update maneuver
      const { control, position } = updateManeuver(ship.control, deltaMs);
      ship.control = control;

      if (position) {
        ship.x = position.x;
        ship.y = position.y;
        ship.angle = position.angle;
      } else {
        // Continuous forward movement
        const move = getContinuousMovement(ship, ship.control, deltaMs);
        ship.x = move.x;
        ship.y = move.y;
      }

      // Wrap around battlefield
      ship.x = ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y = ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
    }
  }

  private updateProjectiles(deltaMs: number): void {
    const alive: Projectile[] = [];

    for (const proj of this.projectiles) {
      const updated = updateProjectile(proj, deltaMs);

      if (isProjectileAlive(updated) &&
          updated.x >= 0 && updated.x <= BATTLEFIELD_SIZE &&
          updated.y >= 0 && updated.y <= BATTLEFIELD_SIZE) {
        alive.push(updated);
      } else {
        // Remove sprite
        const sprite = this.projectileSprites.get(proj.id);
        sprite?.destroy();
        this.projectileSprites.delete(proj.id);
      }
    }

    this.projectiles = alive;
  }

  private updateAI(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.owner === 'player' || ship.hull <= 0) continue;

      // Tick the decision timer down
      ship.aiDecisionTimer -= deltaMs;

      // Re-evaluate target only when the timer expires or the current target
      // is dead/missing — each ship commits to its target in between decisions.
      const currentTarget = ship.targetId ? this.ships.get(ship.targetId) : null;
      if (!currentTarget || currentTarget.hull <= 0 || ship.aiDecisionTimer <= 0) {
        let nearestEnemy: ArcadeShip | null = null;
        let nearestDist = Infinity;

        for (const other of this.ships.values()) {
          if (other.faction === ship.faction || other.hull <= 0) continue;
          const dist = distance(ship.x, ship.y, other.x, other.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = other;
          }
        }

        ship.targetId = nearestEnemy?.id ?? null;
        // Stagger next decision: 300–500 ms so ships don't all re-evaluate in sync
        ship.aiDecisionTimer = 300 + Math.random() * 200;
      }

      // Pursue the locked target every frame (smooth turning, no jitter)
      const target = ship.targetId ? this.ships.get(ship.targetId) : null;
      if (!target) continue;

      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      const targetAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;

      let angleDiff = targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const AI_TURN_RATE = 120; // degrees per second
      const maxTurn = AI_TURN_RATE * (deltaMs / 1000);
      const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
      ship.angle = ((ship.angle + turn) % 360 + 360) % 360;

      // Fire when roughly facing the target and in range
      const dist = distance(ship.x, ship.y, target.x, target.y);
      if (Math.abs(angleDiff) < 30 && dist < 400 && canFire(ship.control)) {
        ship.control = processCommand(ship, ship.control, 'fire');
        this.fireWeapon(ship);
      }
      // Movement and cooldowns are already applied each frame by updateShips()
    }
  }

  private fireWeapon(ship: ArcadeShip): void {
    // Spawn projectile from ship nose
    const rad = (ship.angle - 90) * (Math.PI / 180);
    const spawnDist = 20;
    const proj = createProjectile(
      ship.x + Math.cos(rad) * spawnDist,
      ship.y + Math.sin(rad) * spawnDist,
      ship.angle,
      ship.id,
      ship.faction
    );

    this.projectiles.push(proj);

    // Create sprite
    const sprite = this.add.graphics();
    sprite.fillStyle(ship.faction === this.playerFaction ? 0xff8800 : 0x00ff00, 1);
    sprite.fillCircle(0, 0, 3);
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  private checkCollisions(): void {
    const hitProjectiles = new Set<string>();

    for (const proj of this.projectiles) {
      for (const ship of this.ships.values()) {
        if (ship.hull <= 0) continue;
        if (ship.id === proj.ownerId) continue;

        if (checkProjectileHit(proj, ship.x, ship.y, 15, ship.faction)) {
          // Hit!
          hitProjectiles.add(proj.id);

          const wasAlive = ship.hull > 0;

          // Apply damage
          if (ship.shields > 0) {
            ship.shields = Math.max(0, ship.shields - proj.damage);
          } else {
            ship.hull = Math.max(0, ship.hull - proj.damage);
          }

          // Show floating damage number
          if (this.damageNumbersEnabled) {
            this.showFloatingText(ship.x, ship.y - 20, `-${proj.damage}`, '#ff4444');
          }

          // Score and kill notification for player kills
          if (proj.ownerFaction === this.playerFaction && ship.hull <= 0 && wasAlive) {
            this.score += 100;
            this.showFloatingText(ship.x, ship.y - 40, 'KILL!', '#ffff00');
            this.scoreText.setText(`SCORE: ${this.score}`);
          }

          // Visual feedback
          if (this.cameraShakeEnabled) this.cameras.main.shake(50, 0.005);
          break;
        }
      }
    }

    // Remove hit projectiles
    this.projectiles = this.projectiles.filter((p) => !hitProjectiles.has(p.id));
    for (const id of hitProjectiles) {
      const sprite = this.projectileSprites.get(id);
      sprite?.destroy();
      this.projectileSprites.delete(id);
    }
  }

  private spawnShips(): void {
    const battleConfig = this.registry.get('battleConfig') as {
      factions: Array<{ factionId: FactionId; controller: 'player' | 'ai'; ships: string[] }>;
    } | undefined;

    if (battleConfig?.factions?.length) {
      this.spawnFromConfig(battleConfig.factions);
    } else {
      this.spawnDefaultShips();
    }

    for (const ship of this.ships.values()) {
      this.createShipSprite(ship);
    }
  }

  private spawnFromConfig(
    factions: Array<{ factionId: FactionId; controller: 'player' | 'ai'; ships: string[] }>
  ): void {
    const playerSlot = factions.find((f) => f.controller === 'player') ?? factions[0]!;
    const enemySlots = factions.filter((f) => f !== playerSlot);
    this.playerFaction = playerSlot.factionId;

    // Spawn player-controlled ship (first in player slot)
    const playerShipId = playerSlot.ships[0] ?? 'confed_sparrow';
    const playerShip = this.createShip(
      'player_0', playerShipId, playerSlot.factionId, 'player',
      BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2 + 200, 0
    );
    playerShip.hull = playerShip.maxHull = Math.max(6, playerShip.maxHull);
    playerShip.shields = playerShip.maxShields = Math.max(3, playerShip.maxShields);
    this.ships.set(playerShip.id, playerShip);
    this.playerShipId = playerShip.id;

    // Remaining player-slot ships are AI allies in wing formation
    const wingOffsets = [{ x: -150, y: 350 }, { x: 150, y: 350 }, { x: 0, y: 450 }];
    playerSlot.ships.slice(1).forEach((shipId, i) => {
      const offset = wingOffsets[i] ?? { x: (i - 1) * 160, y: 400 };
      const ally = this.createShip(
        `ally_${i}`, shipId, playerSlot.factionId, 'ai',
        BATTLEFIELD_SIZE / 2 + offset.x, BATTLEFIELD_SIZE / 2 + offset.y, 0
      );
      this.ships.set(ally.id, ally);
    });

    // All enemy slots spawn spread around the far side
    const totalEnemies = enemySlots.reduce((sum, s) => sum + s.ships.length, 0);
    let enemyIndex = 0;
    for (const slot of enemySlots) {
      for (const shipId of slot.ships) {
        const angle = (enemyIndex / Math.max(totalEnemies, 1)) * Math.PI * 2;
        const radius = 550;
        const enemy = this.createShip(
          `enemy_${enemyIndex}`, shipId, slot.factionId, 'ai',
          BATTLEFIELD_SIZE / 2 + Math.cos(angle) * radius,
          BATTLEFIELD_SIZE / 2 + Math.sin(angle) * radius - 350, 0
        );
        this.ships.set(enemy.id, enemy);
        enemyIndex++;
      }
    }
  }

  private spawnDefaultShips(): void {
    const playerShip = this.createShip(
      'player_0', 'confed_sparrow', 'free_confederation', 'player',
      BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2 + 200, 0
    );
    playerShip.hull = playerShip.maxHull = 8;
    playerShip.shields = playerShip.maxShields = 4;
    this.ships.set(playerShip.id, playerShip);
    this.playerShipId = playerShip.id;

    const wingOffsets = [{ x: -150, y: 350 }, { x: 150, y: 350 }];
    for (let i = 0; i < wingOffsets.length; i++) {
      const offset = wingOffsets[i]!;
      const ally = this.createShip(
        `ally_${i}`, 'confed_wasp', 'free_confederation', 'ai',
        BATTLEFIELD_SIZE / 2 + offset.x, BATTLEFIELD_SIZE / 2 + offset.y, 0
      );
      ally.hull = ally.maxHull = 5;
      ally.shields = ally.maxShields = 3;
      this.ships.set(ally.id, ally);
    }

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const radius = 550;
      const enemy = this.createShip(
        `enemy_${i}`, i === 0 ? 'terran_gladius' : 'terran_viper', 'terran_hegemony', 'ai',
        BATTLEFIELD_SIZE / 2 + Math.cos(angle) * radius,
        BATTLEFIELD_SIZE / 2 + Math.sin(angle) * radius - 350, 0
      );
      this.ships.set(enemy.id, enemy);
    }
  }

  private createShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: 'player' | 'ai',
    x: number,
    y: number,
    angle: number
  ): ArcadeShip {
    const def = getShipDefinition(defId);
    const baseShip: ShipState = {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      hull: def?.baseStats.hull ?? 4,
      maxHull: def?.baseStats.hull ?? 4,
      shields: def?.baseStats.shields ?? 2,
      maxShields: def?.baseStats.shields ?? 2,
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

    const ship: ArcadeShip = {
      ...baseShip,
      control: createControlState(baseShip),
      targetId: null,
      aiDecisionTimer: 0, // fire immediately on first update
    };

    return ship;
  }

  private createShipSprite(ship: ArcadeShip): void {
    const container = this.add.container(ship.x, ship.y) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
    const shipDef = getShipDefinition(ship.definitionId);
    const baseSize = SHIP_SIZES[shipDef?.baseStats.size ?? 'small'];
    const size = ship.owner === 'player' ? baseSize * 1.2 : baseSize;

    // Thruster glow
    const thruster = this.add.graphics();
    thruster.fillStyle(0xff4400, 0.6);
    thruster.fillTriangle(-6, size / 2, 6, size / 2, 0, size / 2 + 12);
    container.add(thruster);
    container.thruster = thruster;

    // Ship body — use PNG sprite if loaded, else draw faction-colored triangle
    const spriteKey = `ship_${ship.definitionId}`;
    let body: Phaser.GameObjects.Graphics;
    if (this.textures.exists(spriteKey)) {
      const img = this.add.image(0, 0, spriteKey);
      img.setDisplaySize(size * 1.8, size * 1.8);
      // ADD blend mode renders dark backgrounds as transparent
      img.setBlendMode(Phaser.BlendModes.ADD);
      container.add(img);

      // Player indicator ring (drawn on top of the sprite)
      if (ship.owner === 'player') {
        const ring = this.add.graphics();
        ring.lineStyle(2, 0xffff00, 0.9);
        ring.strokeCircle(0, 0, size * 1.02);
        ring.lineStyle(1, 0xffff00, 0.4);
        ring.strokeCircle(0, 0, size * 1.2);
        container.add(ring);
      }

      body = this.add.graphics(); // invisible placeholder for hull ref
    } else {
      body = this.add.graphics();
      body.fillStyle(color, 1);
      body.beginPath();
      body.moveTo(0, -size / 2);
      body.lineTo(-size / 3, size / 2);
      body.lineTo(0, size / 3);
      body.lineTo(size / 3, size / 2);
      body.closePath();
      body.fillPath();

      body.lineStyle(2, 0xffffff, 0.8);
      body.strokePath();

      if (ship.owner === 'player') {
        body.lineStyle(2, 0xffff00, 1);
        body.strokeCircle(0, 0, size * 0.84);
      }
      container.add(body);
    }

    container.hull = body;
    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private updateSprites(): void {
    for (const [id, sprite] of this.shipSprites) {
      const ship = this.ships.get(id);

      if (!ship || ship.hull <= 0) {
        // Simple explosion effect using graphics
        this.createExplosion(sprite.x, sprite.y);

        sprite.destroy();
        this.shipSprites.delete(id);

        // Clean up health bar
        const healthBar = this.healthBars.get(id);
        if (healthBar) {
          healthBar.destroy();
          this.healthBars.delete(id);
        }
        continue;
      }

      // Smooth movement
      sprite.x = ship.x;
      sprite.y = ship.y;
      sprite.angle = ship.angle;

      // Update health bar position and values
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 30);
        healthBar.update(ship.hull, ship.shields);
      }

      // Thruster intensity based on speed
      const intensity = ship.control.speed / 5;
      sprite.thruster.setScale(1, 0.5 + intensity * 0.8);
      sprite.thruster.setAlpha(0.4 + intensity * 0.4);
    }

    // Update projectile positions
    for (const proj of this.projectiles) {
      const sprite = this.projectileSprites.get(proj.id);
      if (sprite) {
        sprite.setPosition(proj.x, proj.y);
      }
    }

    // Update minimap with all ship positions
    this.updateMinimap();
  }

  private updateMinimap(): void {
    const minimapShips: MinimapShip[] = [];

    for (const ship of this.ships.values()) {
      minimapShips.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction as FactionId,
        isPlayer: ship.id === this.playerShipId,
        isAlive: ship.hull > 0,
      });
    }

    this.minimap?.updateShips(minimapShips);
    this.minimap?.updateViewRect();
  }

  private createHUD(): void {
    const style = { font: 'bold 16px monospace', color: '#ffffff' };

    this.speedText = this.add.text(10, 10, 'SPEED: 3', style)
      .setScrollFactor(0).setDepth(1000);

    this.hullText = this.add.text(10, 35, 'HULL: 4/4', style)
      .setScrollFactor(0).setDepth(1000);

    this.shieldText = this.add.text(10, 60, 'SHIELDS: 2/2', { ...style, color: '#00bfff' })
      .setScrollFactor(0).setDepth(1000);

    this.cooldownText = this.add.text(10, 90, '', { font: '14px monospace', color: '#ff8888' })
      .setScrollFactor(0).setDepth(1000);

    this.scoreText = this.add.text(this.scale.width - 10, 10, 'SCORE: 0', style)
      .setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    this.instructionsText = this.add.text(
      this.scale.width / 2,
      this.scale.height - 30,
      '↑↓ Speed | ←→ Turn | SHIFT+←→ Bank | Z K-Turn | SPACE Fire',
      { font: '14px monospace', color: '#888888' }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);
  }

  private updateHUD(): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship) return;

    this.speedText.setText(`SPEED: ${ship.control.speed}`);
    this.hullText.setText(`HULL: ${ship.hull}/${ship.maxHull}`);
    this.shieldText.setText(`SHIELDS: ${ship.shields}/${ship.maxShields}`);
    this.scoreText.setText(`SCORE: ${this.score}`);

    // Cooldowns
    const cooldowns: string[] = [];
    if (!canKTurn(ship.control)) {
      cooldowns.push(`K-TURN: ${Math.ceil(ship.control.kturnCooldown / 1000)}s`);
    }
    this.cooldownText.setText(cooldowns.join(' | '));

    // Hull color
    const hullPct = ship.hull / ship.maxHull;
    this.hullText.setColor(hullPct > 0.5 ? '#44ff44' : hullPct > 0.25 ? '#ffff44' : '#ff4444');
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      font: 'bold 18px Arial',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  private createExplosion(x: number, y: number): void {
    // Create multiple expanding circles for explosion effect
    const colors = [0xff4400, 0xffaa00, 0xffff00];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = Phaser.Math.Between(50, 150);
      const color = Phaser.Math.RND.pick(colors);

      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, Phaser.Math.Between(3, 8));
      particle.setPosition(x, y);
      particle.setDepth(15);

      // Animate outward
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.1,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }

    // Central flash
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(0, 0, 20);
    flash.setPosition(x, y);
    flash.setDepth(16);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: 300,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  private checkVictory(): void {
    if (this.gameEnded) return;

    const enemies = Array.from(this.ships.values()).filter(
      (s) => s.faction !== this.playerFaction && s.hull > 0
    );
    const allies = Array.from(this.ships.values()).filter(
      (s) => s.faction === this.playerFaction && s.hull > 0
    );

    if (enemies.length === 0) {
      this.gameEnded = true;
      this.showEndScreen(true);
    } else if (allies.length === 0) {
      this.gameEnded = true;
      this.showEndScreen(false);
    }
  }

  private showEndScreen(victory: boolean): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0).setDepth(2000);

    const title = victory ? 'VICTORY!' : 'DEFEATED';
    const titleColor = victory ? '#44ff44' : '#ff4444';
    this.add.text(cx, cy - 70, title, {
      font: 'bold 56px Arial',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.add.text(cx, cy - 15, `Score: ${this.score}`, {
      font: '26px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    // RETRY button
    const retryBtn = this.add.text(cx - 100, cy + 50, 'RETRY', {
      font: 'bold 24px Arial',
      color: '#44ff88',
      backgroundColor: '#224422',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerover', () => retryBtn.setStyle({ color: '#ffffff' }));
    retryBtn.on('pointerout', () => retryBtn.setStyle({ color: '#44ff88' }));
    retryBtn.on('pointerdown', () => this.scene.restart());

    // MENU button
    const menuBtn = this.add.text(cx + 100, cy + 50, 'MENU', {
      font: 'bold 24px Arial',
      color: '#aaaaaa',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setStyle({ color: '#ffffff' }));
    menuBtn.on('pointerout', () => menuBtn.setStyle({ color: '#aaaaaa' }));
    menuBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }
}
