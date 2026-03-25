/**
 * Squad Builder Scene
 *
 * Allows players to:
 * - Select number of factions (2-6)
 * - Assign player/AI control to each faction
 * - Build squads manually or auto-fill
 * - Choose squad archetypes (swarm, elite, balanced, etc.)
 * - Set point limits
 * - Start the battle
 */

import Phaser from 'phaser';
import { createHoverButton } from '../ui/ButtonFactory';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';
import { SHIP_DEFINITIONS, getShipsByFaction } from '../data/ShipDefinitions';
import {
  type AIDifficultyLevel,
  DIFFICULTY_NAMES,
  DIFFICULTY_DESCRIPTIONS,
} from '../ai/AIDifficulty';
import { getQuickBuild, toSimSpecs } from '../data/SquadronPresets';

interface FactionSlot {
  factionId: FactionId | null;
  controller: 'player' | 'ai';
  squadStyle: SquadStyle;
  ships: string[]; // Ship definition IDs
  pointsUsed: number;
}

type SquadStyle = 'balanced' | 'swarm' | 'elite' | 'bomber' | 'interceptor' | 'custom' | 'quick';

interface SquadTemplate {
  name: string;
  description: string;
  shipRoles: string[];
}

const SQUAD_TEMPLATES: Record<SquadStyle, SquadTemplate> = {
  balanced: {
    name: 'Balanced',
    description: '2 fighters, 1 interceptor, 1 support',
    shipRoles: ['heavy_fighter', 'heavy_fighter', 'interceptor', 'support'],
  },
  swarm: {
    name: 'Swarm',
    description: 'Many cheap light fighters',
    shipRoles: ['light_fighter', 'light_fighter', 'light_fighter', 'light_fighter', 'light_fighter'],
  },
  elite: {
    name: 'Elite',
    description: 'Few expensive heavy hitters',
    shipRoles: ['gunship', 'heavy_fighter', 'interceptor'],
  },
  bomber: {
    name: 'Bomber Wing',
    description: 'Bombers with fighter escort',
    shipRoles: ['bomber', 'bomber', 'heavy_fighter', 'interceptor'],
  },
  interceptor: {
    name: 'Fast Attack',
    description: 'All interceptors and light fighters',
    shipRoles: ['interceptor', 'interceptor', 'interceptor', 'light_fighter'],
  },
  custom: {
    name: 'Custom',
    description: 'Build your own squad',
    shipRoles: [],
  },
  quick: {
    name: 'Quick Build',
    description: 'Curated preset squad for this faction and budget',
    shipRoles: [],
  },
};

const ALL_FACTIONS: FactionId[] = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
];

const FACTION_NAMES: Record<FactionId, string> = {
  terran_hegemony: 'Terran Hegemony',
  free_confederation: 'Free Confederation',
  synthetic_collective: 'Synthetic Collective',
  void_corsairs: 'Void Corsairs',
  ascendant_empire: 'Ascendant Empire',
};

export class SquadBuilderScene extends Phaser.Scene {
  private factionSlots: FactionSlot[] = [];
  private numFactions = 2;
  private pointLimit = 200;
  private gameMode: 'turn_based' | 'continuous' | 'arcade' = 'arcade';
  private aiDifficulty: AIDifficultyLevel = 'normal';

  private slotContainers: Phaser.GameObjects.Container[] = [];
  private selectedSlotIndex = 0;

  // UI elements
  private headerText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'SquadBuilderScene' });
  }

  init(data: Record<string, unknown>): void {
    // Allow caller to preset initial mode (e.g., SKIRMISH → 'arcade')
    if (data?.initialMode === 'arcade' || data?.initialMode === 'turn_based' || data?.initialMode === 'continuous') {
      this.gameMode = data.initialMode as 'arcade' | 'turn_based' | 'continuous';
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    this.initializeFactionSlots();
    this.createHeader();
    this.createFactionSlots();
    this.createControls();
    this.createStartButton();
    this.setupInput();

    this.updateDisplay();

    // Listen for ship selection results from ShipPickerScene
    this.game.events.on('shipsPicked', (data: { slotIndex: number; ships: string[] }) => {
      const slot = this.factionSlots[data.slotIndex];
      if (!slot) return;
      slot.ships = data.ships;
      slot.pointsUsed = data.ships.reduce(
        (sum, id) => sum + (SHIP_DEFINITIONS[id]?.baseStats.pointCost ?? 0), 0,
      );
      this.updateDisplay();
    });
  }

  private initializeFactionSlots(): void {
    // Initialize with 2 factions by default
    this.factionSlots = [
      {
        factionId: 'free_confederation',
        controller: 'player',
        squadStyle: 'balanced',
        ships: [],
        pointsUsed: 0,
      },
      {
        factionId: 'terran_hegemony',
        controller: 'ai',
        squadStyle: 'balanced',
        ships: [],
        pointsUsed: 0,
      },
    ];

    // Auto-fill initial squads
    this.factionSlots.forEach((slot) => this.autoFillSquad(slot));
  }

  private createHeader(): void {
    const centerX = this.scale.width / 2;

    this.add
      .text(centerX, 30, 'SQUAD BUILDER', {
        font: 'bold 36px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Faction count selector
    this.add
      .text(100, 80, 'Factions:', {
        font: '18px Arial',
        color: '#888888',
      })
      .setOrigin(0, 0.5);

    for (let i = 2; i <= 6; i++) {
      const btn = this.createSmallButton(180 + (i - 2) * 50, 80, `${i}`, () => {
        this.setNumFactions(i);
      });
      btn.setData('factionCount', i);
    }

    // Point limit
    this.add
      .text(500, 80, 'Points:', {
        font: '18px Arial',
        color: '#888888',
      })
      .setOrigin(0, 0.5);

    [100, 150, 200, 300].forEach((pts, i) => {
      const btn = this.createSmallButton(580 + i * 60, 80, `${pts}`, () => {
        this.pointLimit = pts;
        this.factionSlots.forEach((slot) => this.autoFillSquad(slot));
        this.updateDisplay();
      });
      btn.setData('pointLimit', pts);
    });

    // Game mode selector
    this.add
      .text(780, 80, 'Mode:', {
        font: '18px Arial',
        color: '#888888',
      })
      .setOrigin(0, 0.5);

    this.createSmallButton(845, 80, 'Arcade', () => {
      this.gameMode = 'arcade';
      this.updateDisplay();
    }).setData('mode', 'arcade');

    this.createSmallButton(955, 80, 'Continuous', () => {
      this.gameMode = 'continuous';
      this.updateDisplay();
    }).setData('mode', 'continuous');

    this.createSmallButton(1085, 80, 'Turn-Based', () => {
      this.gameMode = 'turn_based';
      this.updateDisplay();
    }).setData('mode', 'turn_based');

    // AI Difficulty selector (second row)
    this.add
      .text(100, 115, 'AI Difficulty:', {
        font: '18px Arial',
        color: '#888888',
      })
      .setOrigin(0, 0.5);

    const difficulties: AIDifficultyLevel[] = ['easy', 'normal', 'hard', 'brutal'];
    difficulties.forEach((diff, i) => {
      const btn = this.createSmallButton(220 + i * 80, 115, DIFFICULTY_NAMES[diff], () => {
        this.aiDifficulty = diff;
        this.updateDisplay();
      });
      btn.setData('difficulty', diff);
    });

    // Difficulty description text
    this.add
      .text(560, 115, DIFFICULTY_DESCRIPTIONS[this.aiDifficulty], {
        font: '14px Arial',
        color: '#666666',
      })
      .setOrigin(0, 0.5)
      .setName('difficultyDesc');

    this.instructionText = this.add
      .text(centerX, this.scale.height - 30, 'Click slots to configure | Auto-Fill generates squads automatically', {
        font: '14px Arial',
        color: '#666666',
      })
      .setOrigin(0.5);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    return createHoverButton(this, x, y, {
      width: 50, height: 30, radius: 4,
      color: 0x333344, hoverColor: 0x444466,
      label, font: '14px Arial', textColor: '#aaaaaa',
    }, onClick);
  }

  private createFactionSlots(): void {
    // Will be recreated when faction count changes
    this.redrawFactionSlots();
  }

  private redrawFactionSlots(): void {
    // Clear existing
    this.slotContainers.forEach((c) => c.destroy());
    this.slotContainers = [];

    const startY = 130;
    const slotHeight = 85;
    const maxSlotsPerColumn = 4;
    const columnWidth = 600;

    for (let i = 0; i < this.numFactions; i++) {
      const column = Math.floor(i / maxSlotsPerColumn);
      const row = i % maxSlotsPerColumn;

      const x = 50 + column * columnWidth + columnWidth / 2;
      const y = startY + row * slotHeight;

      const container = this.createFactionSlotUI(x, y, i);
      this.slotContainers.push(container);
    }
  }

  private createFactionSlotUI(x: number, y: number, index: number): Phaser.GameObjects.Container {
    const slot = this.factionSlots[index];
    if (!slot) return this.add.container(x, y);

    const container = this.add.container(x, y);
    const width = 550;
    const height = 75;

    // Background
    const bg = this.add.graphics();
    const factionColor = slot.factionId ? FACTION_COLORS[slot.factionId] : 0x333333;
    bg.fillStyle(0x1a1a2a, 0.9);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    bg.lineStyle(3, factionColor, 0.8);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    container.add(bg);

    // Slot number
    this.add
      .text(-width / 2 + 20, -height / 2 + 10, `#${index + 1}`, {
        font: 'bold 16px Arial',
        color: '#666666',
      })
      .setOrigin(0, 0);
    container.add(container.last as Phaser.GameObjects.Text);

    // Faction name & selector
    const factionName = slot.factionId ? FACTION_NAMES[slot.factionId] : 'Select Faction';
    const factionText = this.add
      .text(-width / 2 + 20, 0, factionName, {
        font: 'bold 20px Arial',
        color: `#${factionColor.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0, 0.5);
    container.add(factionText);

    // Controller (Player/AI)
    const controllerText = this.add
      .text(-width / 2 + 200, -15, slot.controller.toUpperCase(), {
        font: 'bold 14px Arial',
        color: slot.controller === 'player' ? '#44ff44' : '#ff8844',
      })
      .setOrigin(0, 0.5);
    container.add(controllerText);

    // Squad style
    const styleText = this.add
      .text(-width / 2 + 200, 10, SQUAD_TEMPLATES[slot.squadStyle].name, {
        font: '14px Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0, 0.5);
    container.add(styleText);

    // Points used
    const pointsText = this.add
      .text(width / 2 - 20, -15, `${slot.pointsUsed}/${this.pointLimit} pts`, {
        font: 'bold 16px Arial',
        color: slot.pointsUsed <= this.pointLimit ? '#44ff44' : '#ff4444',
      })
      .setOrigin(1, 0.5);
    container.add(pointsText);

    // Ship count — clickable to open ship picker
    const shipCountText = this.add
      .text(width / 2 - 20, 10, `${slot.ships.length} ships ✎`, {
        font: '14px Arial',
        color: '#6688aa',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    shipCountText.on('pointerover', () => shipCountText.setColor('#88bbdd'));
    shipCountText.on('pointerout', () => shipCountText.setColor('#6688aa'));
    shipCountText.on('pointerdown', () => {
      if (slot.factionId) this.openShipPicker(index);
    });
    container.add(shipCountText);

    // Action buttons
    const btnY = 0;

    // Change faction button
    this.createSlotButton(container, -50, btnY, 'Faction', () => {
      this.cycleFaction(index);
    });

    // Toggle controller
    this.createSlotButton(container, 30, btnY, slot.controller === 'player' ? 'AI' : 'Player', () => {
      this.toggleController(index);
    });

    // Cycle squad style
    this.createSlotButton(container, 110, btnY, 'Style', () => {
      this.cycleSquadStyle(index);
    });

    // Auto-fill
    this.createSlotButton(container, 190, btnY, 'Auto', () => {
      this.autoFillSquad(slot);
      this.updateDisplay();
    });

    return container;
  }

  private createSlotButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ): void {
    const btn = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x2a2a3a, 1);
    bg.fillRoundedRect(-30, -12, 60, 24, 4);
    btn.add(bg);

    const text = this.add
      .text(0, 0, label, {
        font: '12px Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
    btn.add(text);

    btn.setInteractive(new Phaser.Geom.Rectangle(-30, -12, 60, 24), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x3a3a5a, 1);
      bg.fillRoundedRect(-30, -12, 60, 24, 4);
      text.setColor('#ffffff');
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2a2a3a, 1);
      bg.fillRoundedRect(-30, -12, 60, 24, 4);
      text.setColor('#aaaaaa');
    });

    btn.on('pointerdown', onClick);

    parent.add(btn);
  }

  private createControls(): void {
    createHoverButton(this, this.scale.width / 2 - 150, this.scale.height - 80, {
      width: 160, height: 40, color: 0x336633, hoverColor: 0x44aa44, label: 'AUTO-FILL ALL',
    }, () => this.autoFillAllSquads());
    createHoverButton(this, this.scale.width / 2, this.scale.height - 80, {
      width: 160, height: 40, color: 0x663366, hoverColor: 0x8844aa, label: 'RANDOMIZE',
    }, () => this.randomizeAll());
  }

  private createStartButton(): void {
    this.startButton = createHoverButton(this, this.scale.width / 2 + 150, this.scale.height - 80, {
      width: 160, height: 40, color: 0x227722, hoverColor: 0x33aa33, label: 'START BATTLE',
    }, () => this.startBattle());
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start('MainMenuScene');
    });
  }

  // ==========================================
  // SQUAD MANAGEMENT
  // ==========================================

  private setNumFactions(count: number): void {
    this.numFactions = count;

    // Ensure we have enough slots
    while (this.factionSlots.length < count) {
      // Find an unused faction
      const usedFactions = this.factionSlots.map((s) => s.factionId);
      const availableFaction = ALL_FACTIONS.find((f) => !usedFactions.includes(f)) ?? ALL_FACTIONS[0];

      const newSlot: FactionSlot = {
        factionId: availableFaction as FactionId,
        controller: 'ai',
        squadStyle: 'balanced',
        ships: [],
        pointsUsed: 0,
      };
      this.autoFillSquad(newSlot);
      this.factionSlots.push(newSlot);
    }

    // Trim excess slots
    this.factionSlots = this.factionSlots.slice(0, count);

    this.updateDisplay();
  }

  private cycleFaction(slotIndex: number): void {
    const slot = this.factionSlots[slotIndex];
    if (!slot) return;

    const currentIndex = slot.factionId ? ALL_FACTIONS.indexOf(slot.factionId) : -1;
    const nextIndex = (currentIndex + 1) % ALL_FACTIONS.length;
    slot.factionId = ALL_FACTIONS[nextIndex] as FactionId;

    this.autoFillSquad(slot);
    this.updateDisplay();
  }

  private toggleController(slotIndex: number): void {
    const slot = this.factionSlots[slotIndex];
    if (!slot) return;

    slot.controller = slot.controller === 'player' ? 'ai' : 'player';
    this.updateDisplay();
  }

  private cycleSquadStyle(slotIndex: number): void {
    const slot = this.factionSlots[slotIndex];
    if (!slot) return;

    const styles: SquadStyle[] = ['balanced', 'swarm', 'elite', 'bomber', 'interceptor', 'quick'];
    const currentIndex = styles.indexOf(slot.squadStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    slot.squadStyle = styles[nextIndex] as SquadStyle;

    this.autoFillSquad(slot);
    this.updateDisplay();
  }

  private autoFillSquad(slot: FactionSlot): void {
    if (!slot.factionId) return;

    slot.ships = [];
    slot.pointsUsed = 0;

    // 'quick' style: use authored preset squad, fall back to balanced
    if (slot.squadStyle === 'quick') {
      const preset = getQuickBuild(slot.factionId, this.pointLimit);
      if (preset) {
        const specs = toSimSpecs(preset);
        for (const spec of specs) slot.ships.push(spec.shipId);
        slot.pointsUsed = preset.totalCost;
        return;
      }
      slot.squadStyle = 'balanced';
    }

    const template = SQUAD_TEMPLATES[slot.squadStyle];
    const factionShips = getShipsByFaction(slot.factionId);

    // Fill based on template roles
    for (const role of template.shipRoles) {
      // Find a ship of this role in the faction
      let ship = factionShips.find((s) => s.role === role);

      // Fallback to any ship if role not found
      if (!ship) {
        ship = factionShips.find((s) => !slot.ships.includes(s.id));
      }

      if (ship && slot.pointsUsed + ship.baseStats.pointCost <= this.pointLimit) {
        slot.ships.push(ship.id);
        slot.pointsUsed += ship.baseStats.pointCost;
      }
    }

    // If we still have points, add more ships
    while (slot.pointsUsed < this.pointLimit) {
      const cheapest = factionShips
        .filter((s) => s.baseStats.pointCost + slot.pointsUsed <= this.pointLimit)
        .sort((a, b) => a.baseStats.pointCost - b.baseStats.pointCost)[0];

      if (!cheapest) break;

      slot.ships.push(cheapest.id);
      slot.pointsUsed += cheapest.baseStats.pointCost;
    }
  }

  private autoFillAllSquads(): void {
    this.factionSlots.forEach((slot) => this.autoFillSquad(slot));
    this.updateDisplay();
  }

  private randomizeAll(): void {
    // Shuffle factions
    const shuffled = [...ALL_FACTIONS].sort(() => Math.random() - 0.5);
    const styles: SquadStyle[] = ['balanced', 'swarm', 'elite', 'bomber', 'interceptor', 'quick'];

    this.factionSlots.forEach((slot, i) => {
      slot.factionId = shuffled[i % shuffled.length] as FactionId;
      slot.squadStyle = styles[Math.floor(Math.random() * styles.length)] as SquadStyle;
      this.autoFillSquad(slot);
    });

    this.updateDisplay();
  }

  private updateDisplay(): void {
    this.redrawFactionSlots();

    // Update difficulty description
    const diffDesc = this.children.getByName('difficultyDesc') as Phaser.GameObjects.Text;
    if (diffDesc) {
      diffDesc.setText(DIFFICULTY_DESCRIPTIONS[this.aiDifficulty]);
    }
  }

  // ==========================================
  // START BATTLE
  // ==========================================

  private startBattle(): void {
    // Validate all slots have factions
    if (this.factionSlots.some((s) => !s.factionId || s.ships.length === 0)) {
      this.instructionText.setText('All factions must have ships!');
      this.instructionText.setColor('#ff4444');
      return;
    }

    // Store battle config in registry for the battle scene to use
    this.registry.set('battleConfig', {
      factions: this.factionSlots.map((slot) => ({
        factionId: slot.factionId,
        controller: slot.controller,
        ships: slot.ships,
      })),
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      aiDifficulty: this.aiDifficulty,
    });

    // Start appropriate battle scene
    if (this.gameMode === 'turn_based') {
      this.scene.start('TurnBasedBattleScene');
    } else if (this.gameMode === 'arcade') {
      this.scene.start('ArcadeBattleScene');
    } else {
      this.scene.start('ContinuousTacticalScene');
    }
  }

  /**
   * Launch ShipPickerScene on top of this scene for the given slot index.
   * @param slotIndex - The faction slot to customize.
   */
  private openShipPicker(slotIndex: number): void {
    const slot = this.factionSlots[slotIndex];
    if (!slot?.factionId) return;
    this.scene.launch('ShipPickerScene', {
      slotIndex,
      factionId: slot.factionId,
      selectedShips: [...slot.ships],
      pointLimit: this.pointLimit,
    });
  }
}
