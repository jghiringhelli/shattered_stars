/**
 * Boot scene - handles asset loading and initialization
 */

import Phaser from 'phaser';
import { FACTION_COLORS, SHIP_SIZES } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show loading progress
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(440, 320, 400, 50);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Loading...',
      style: {
        font: '24px monospace',
        color: '#ffffff',
      },
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00bfff, 1);
      progressBar.fillRect(450, 330, 380 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder ship textures programmatically
    this.generatePlaceholderTextures();

    // Load pilot portrait images for campaign debrief
    this.loadPortraitImages();

    // Load ship thumbnail images for campaign debrief stats
    this.loadCampaignShipThumbnails();

    // Fallback: if portrait_command.png fails to load, generate programmatic placeholder
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.textures.exists('portrait_command')) {
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0x0a1a3a, 1);
        g.fillRect(0, 0, 128, 128);
        g.fillStyle(0x4488cc, 1);
        const cx = 64, cy = 56, r = 28;
        for (let i = 0; i < 5; i++) {
          const a  = (i * 72 - 90) * (Math.PI / 180);
          const ia = ((i * 72 + 36) - 90) * (Math.PI / 180);
          g.fillTriangle(
            cx + Math.cos(a) * r,           cy + Math.sin(a) * r,
            cx + Math.cos(ia) * (r * 0.4),  cy + Math.sin(ia) * (r * 0.4),
            cx,                              cy + r * 0.15
          );
        }
        g.generateTexture('portrait_command', 128, 128);
        g.destroy();
      }
    });
  }

  create(): void {
    // Transition to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate simple geometric placeholder textures for ships
   * These will be replaced with actual sprites later
   */
  private generatePlaceholderTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Generate a ship texture for each faction and size
    for (const [factionId, color] of Object.entries(FACTION_COLORS)) {
      for (const [sizeName, sizePixels] of Object.entries(SHIP_SIZES)) {
        const key = `ship_${factionId}_${sizeName}`;
        this.generateShipTexture(graphics, key, color, sizePixels);
      }
    }

    // Generate projectile textures
    this.generateProjectileTextures(graphics);

    // Generate UI textures
    this.generateUITextures(graphics);

    graphics.destroy();
  }

  private generateShipTexture(
    graphics: Phaser.GameObjects.Graphics,
    key: string,
    color: number,
    size: number
  ): void {
    graphics.clear();

    // Draw a simple triangle pointing up (ship shape)
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size / 2, 0); // Top point
    graphics.lineTo(size, size); // Bottom right
    graphics.lineTo(size / 2, size * 0.75); // Back indent
    graphics.lineTo(0, size); // Bottom left
    graphics.closePath();
    graphics.fillPath();

    // Add a lighter accent for the cockpit/front
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillTriangle(
      size / 2, 0,
      size / 2 - size / 6, size / 3,
      size / 2 + size / 6, size / 3
    );

    // Add engine glow at back
    graphics.fillStyle(0xffffff, 0.5);
    graphics.fillCircle(size / 2, size * 0.85, size / 8);

    graphics.generateTexture(key, size, size);
  }

  private generateProjectileTextures(graphics: Phaser.GameObjects.Graphics): void {
    // Laser bolt
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 4, 12);
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillRect(1, 1, 2, 10);
    graphics.generateTexture('projectile_laser', 4, 12);

    // Missile
    graphics.clear();
    graphics.fillStyle(0xff6b35, 1);
    graphics.fillTriangle(4, 0, 0, 8, 8, 8);
    graphics.fillRect(2, 8, 4, 8);
    graphics.fillStyle(0xffff00, 0.8);
    graphics.fillCircle(4, 16, 3);
    graphics.generateTexture('projectile_missile', 8, 20);
  }

  private generateUITextures(graphics: Phaser.GameObjects.Graphics): void {
    // Health bar background
    graphics.clear();
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_bg', 40, 6);

    // Health bar fill (hull)
    graphics.clear();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_hull', 40, 6);

    // Health bar fill (shields)
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_shields', 40, 6);

    // Target indicator
    graphics.clear();
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeCircle(16, 16, 14);
    graphics.strokeCircle(16, 16, 8);
    graphics.generateTexture('target_indicator', 32, 32);

    // Selection indicator
    graphics.clear();
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeCircle(20, 20, 18);
    graphics.generateTexture('selection_indicator', 40, 40);
    // portrait_command is handled in loadPortraitImages() — PNG file preferred,
    // programmatic fallback generated in the load.once('complete') handler.
  }

  /**
   * Load pilot portrait PNG images for campaign debrief scenes
   */
  private loadPortraitImages(): void {
    // COMMAND speaker portrait — real PNG preferred, fallback generated after complete
    this.load.image('portrait_command', 'assets/portraits/portrait_command.png');

    // Terran Hegemony — base + talking variants
    this.load.image('portrait_admiral_chen',      'assets/portraits/terran_hegemony/admiral_chen.png');
    this.load.image('portrait_admiral_chen_talk', 'assets/portraits/terran_hegemony/admiral_chen_talk.png');
    this.load.image('portrait_striker',           'assets/portraits/terran_hegemony/striker.png');
    this.load.image('portrait_striker_talk',      'assets/portraits/terran_hegemony/striker_talk.png');
    this.load.image('portrait_whisper',           'assets/portraits/terran_hegemony/whisper.png');
    this.load.image('portrait_whisper_talk',      'assets/portraits/terran_hegemony/whisper_talk.png');

    // Free Confederation — base + talking variants
    this.load.image('portrait_commander_santos',      'assets/portraits/free_confederation/commander_santos.png');
    this.load.image('portrait_commander_santos_talk', 'assets/portraits/free_confederation/commander_santos_talk.png');
    this.load.image('portrait_phoenix_one',           'assets/portraits/free_confederation/phoenix_one.png');
    this.load.image('portrait_phoenix_one_talk',      'assets/portraits/free_confederation/phoenix_one_talk.png');
    this.load.image('portrait_doc_vasquez',           'assets/portraits/free_confederation/doc_vasquez.png');
    this.load.image('portrait_doc_vasquez_talk',      'assets/portraits/free_confederation/doc_vasquez_talk.png');

    // Synthetic Collective — base + talking variants
    this.load.image('portrait_omega_7',                'assets/portraits/synthetic_collective/omega_7.png');
    this.load.image('portrait_omega_7_talk',           'assets/portraits/synthetic_collective/omega_7_talk.png');
    this.load.image('portrait_prime_collective',       'assets/portraits/synthetic_collective/prime_collective.png');
    this.load.image('portrait_prime_collective_talk',  'assets/portraits/synthetic_collective/prime_collective_talk.png');
    this.load.image('portrait_unit_zero',              'assets/portraits/synthetic_collective/unit_zero.png');
    this.load.image('portrait_unit_zero_talk',         'assets/portraits/synthetic_collective/unit_zero_talk.png');

    // Void Corsairs — base + talking variants
    this.load.image('portrait_captain_kira',       'assets/portraits/void_corsairs/captain_kira.png');
    this.load.image('portrait_captain_kira_talk',  'assets/portraits/void_corsairs/captain_kira_talk.png');
    this.load.image('portrait_the_admiral',        'assets/portraits/void_corsairs/the_admiral.png');
    this.load.image('portrait_the_admiral_talk',   'assets/portraits/void_corsairs/the_admiral_talk.png');
    this.load.image('portrait_bloodfang',          'assets/portraits/void_corsairs/bloodfang.png');
    this.load.image('portrait_bloodfang_talk',     'assets/portraits/void_corsairs/bloodfang_talk.png');

    // Ascendant Empire — base + talking variants
    this.load.image('portrait_the_dreamer',             'assets/portraits/ascendant_empire/the_dreamer.png');
    this.load.image('portrait_the_dreamer_talk',        'assets/portraits/ascendant_empire/the_dreamer_talk.png');
    this.load.image('portrait_archon_zaelthar',         'assets/portraits/ascendant_empire/archon_zaelthar.png');
    this.load.image('portrait_archon_zaelthar_talk',    'assets/portraits/ascendant_empire/archon_zaelthar_talk.png');
    this.load.image('portrait_herald',                  'assets/portraits/ascendant_empire/herald.png');
    this.load.image('portrait_herald_talk',             'assets/portraits/ascendant_empire/herald_talk.png');
  }

  /**
   * Load ship sprite images used as thumbnails in campaign debrief and briefing.
   * Texture keys: ship_<shipId>, e.g. ship_terran_raptor
   * Missing files fail silently — Phaser skips them without error.
   */
  private loadCampaignShipThumbnails(): void {
    // Terran Hegemony — pilot ships + evolution ships
    const th = 'assets/ships/terran_hegemony';
    this.load.image('ship_terran_raptor',     `${th}/terran_raptor.png`);
    this.load.image('ship_terran_viper',      `${th}/terran_viper.png`);
    this.load.image('ship_terran_gladius',    `${th}/terran_gladius.png`);
    this.load.image('ship_terran_hawk',       `${th}/terran_hawk.png`);
    this.load.image('ship_terran_sentinel',   `${th}/terran_sentinel.png`);
    this.load.image('ship_terran_aegis',      `${th}/terran_aegis.png`);
    this.load.image('ship_terran_devastator', `${th}/terran_devastator.png`);
    this.load.image('ship_terran_phantom',    `${th}/terran_phantom.png`);
    this.load.image('ship_terran_reaper',     `${th}/terran_reaper.png`);

    // Free Confederation pilot ships
    const confed = 'assets/ships/free_confederation';
    this.load.image('ship_confed_aurora',   `${confed}/confed_aurora.png`);
    this.load.image('ship_confed_nova',     `${confed}/confed_nova.png`);
    this.load.image('ship_confed_meteor',   `${confed}/confed_meteor.png`);
    this.load.image('ship_confed_phoenix',  `${confed}/confed_phoenix.png`);

    // Synthetic Collective pilot ships
    const synth = 'assets/ships/synthetic_collective';
    this.load.image('ship_synth_interceptor', `${synth}/synth_interceptor.png`);
    this.load.image('ship_synth_scout',       `${synth}/synth_scout.png`);
    this.load.image('ship_synth_nexus',       `${synth}/synth_nexus.png`);

    // Void Corsairs pilot ships
    const corsair = 'assets/ships/void_corsairs';
    this.load.image('ship_corsair_dart',     `${corsair}/corsair_dart.png`);
    this.load.image('ship_corsair_razor',    `${corsair}/corsair_razor.png`);
    this.load.image('ship_corsair_phantom',  `${corsair}/corsair_phantom.png`);

    // Ascendant Empire pilot ships
    const ascend = 'assets/ships/ascendant_empire';
    this.load.image('ship_ascendant_virus',    `${ascend}/ascendant_virus.png`);
    this.load.image('ship_ascendant_symbiont', `${ascend}/ascendant_symbiont.png`);
    this.load.image('ship_ascendant_spore',    `${ascend}/ascendant_spore.png`);
  }
}
