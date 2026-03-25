import Phaser from 'phaser';

/**
 * Load all pilot portrait PNG images.
 * Missing files fail silently — Phaser skips 404s without error.
 * Extracted from BootScene to keep preload() within the 50-line function limit.
 *
 * @param loader - The Phaser loader plugin from the calling scene (this.load).
 */
export function loadPortraitImages(loader: Phaser.Loader.LoaderPlugin): void {
  // COMMAND speaker portrait — real PNG preferred, programmatic fallback generated on load complete
  loader.image('portrait_command', 'assets/portraits/portrait_command.png');

  // Terran Hegemony — base + talking variants
  loader.image('portrait_admiral_chen',      'assets/portraits/terran_hegemony/admiral_chen.png');
  loader.image('portrait_admiral_chen_talk', 'assets/portraits/terran_hegemony/admiral_chen_talk.png');
  loader.image('portrait_striker',           'assets/portraits/terran_hegemony/striker.png');
  loader.image('portrait_striker_talk',      'assets/portraits/terran_hegemony/striker_talk.png');
  loader.image('portrait_whisper',           'assets/portraits/terran_hegemony/whisper.png');
  loader.image('portrait_whisper_talk',      'assets/portraits/terran_hegemony/whisper_talk.png');

  // Free Confederation — base + talking variants
  loader.image('portrait_commander_santos',      'assets/portraits/free_confederation/commander_santos.png');
  loader.image('portrait_commander_santos_talk', 'assets/portraits/free_confederation/commander_santos_talk.png');
  loader.image('portrait_phoenix_one',           'assets/portraits/free_confederation/phoenix_one.png');
  loader.image('portrait_phoenix_one_talk',      'assets/portraits/free_confederation/phoenix_one_talk.png');
  loader.image('portrait_doc_vasquez',           'assets/portraits/free_confederation/doc_vasquez.png');
  loader.image('portrait_doc_vasquez_talk',      'assets/portraits/free_confederation/doc_vasquez_talk.png');

  // Synthetic Collective — base + talking variants
  loader.image('portrait_omega_7',                'assets/portraits/synthetic_collective/omega_7.png');
  loader.image('portrait_omega_7_talk',           'assets/portraits/synthetic_collective/omega_7_talk.png');
  loader.image('portrait_prime_collective',       'assets/portraits/synthetic_collective/prime_collective.png');
  loader.image('portrait_prime_collective_talk',  'assets/portraits/synthetic_collective/prime_collective_talk.png');
  loader.image('portrait_unit_zero',              'assets/portraits/synthetic_collective/unit_zero.png');
  loader.image('portrait_unit_zero_talk',         'assets/portraits/synthetic_collective/unit_zero_talk.png');

  // Void Corsairs — base + talking variants
  loader.image('portrait_captain_kira',       'assets/portraits/void_corsairs/captain_kira.png');
  loader.image('portrait_captain_kira_talk',  'assets/portraits/void_corsairs/captain_kira_talk.png');
  loader.image('portrait_the_admiral',        'assets/portraits/void_corsairs/the_admiral.png');
  loader.image('portrait_the_admiral_talk',   'assets/portraits/void_corsairs/the_admiral_talk.png');
  loader.image('portrait_bloodfang',          'assets/portraits/void_corsairs/bloodfang.png');
  loader.image('portrait_bloodfang_talk',     'assets/portraits/void_corsairs/bloodfang_talk.png');

  // Ascendant Empire — base + talking variants
  loader.image('portrait_the_dreamer',             'assets/portraits/ascendant_empire/the_dreamer.png');
  loader.image('portrait_the_dreamer_talk',        'assets/portraits/ascendant_empire/the_dreamer_talk.png');
  loader.image('portrait_archon_zaelthar',         'assets/portraits/ascendant_empire/archon_zaelthar.png');
  loader.image('portrait_archon_zaelthar_talk',    'assets/portraits/ascendant_empire/archon_zaelthar_talk.png');
  loader.image('portrait_herald',                  'assets/portraits/ascendant_empire/herald.png');
  loader.image('portrait_herald_talk',             'assets/portraits/ascendant_empire/herald_talk.png');
}
