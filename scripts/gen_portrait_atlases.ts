/**
 * Generate Phaser 3 texture atlas JSON files for all pilot portrait sprite sheets.
 *
 * Each sheet is 1024×768 with two 512×768 frames:
 *   column 0 (x:0)   → 'base' frame  (idle portrait)
 *   column 1 (x:512) → 'talk' frame  (talking portrait)
 *
 * Run: npx tsx scripts/gen_portrait_atlases.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const FRAME_W = 512;
const FRAME_H = 768;
const SHEET_W = FRAME_W * 2;
const SHEET_H = FRAME_H;

const PORTRAITS_ROOT = join(
  import.meta.dirname ?? __dirname,
  '../public/assets/portraits',
);

interface PilotEntry {
  readonly faction: string;
  readonly id: string;
}

const PILOTS: ReadonlyArray<PilotEntry> = [
  { faction: 'terran_hegemony',     id: 'admiral_chen' },
  { faction: 'terran_hegemony',     id: 'striker' },
  { faction: 'terran_hegemony',     id: 'whisper' },
  { faction: 'free_confederation',  id: 'commander_santos' },
  { faction: 'free_confederation',  id: 'phoenix_one' },
  { faction: 'free_confederation',  id: 'doc_vasquez' },
  { faction: 'synthetic_collective', id: 'omega_7' },
  { faction: 'synthetic_collective', id: 'prime_collective' },
  { faction: 'synthetic_collective', id: 'unit_zero' },
  { faction: 'void_corsairs',       id: 'captain_kira' },
  { faction: 'void_corsairs',       id: 'the_admiral' },
  { faction: 'void_corsairs',       id: 'bloodfang' },
  { faction: 'ascendant_empire',    id: 'the_dreamer' },
  { faction: 'ascendant_empire',    id: 'archon_zaelthar' },
  { faction: 'ascendant_empire',    id: 'herald' },
];

/** Build a Phaser 3 / TexturePacker-compatible JSON atlas for a 2-frame portrait sheet. */
function buildAtlasJson(sheetFilename: string): object {
  return {
    frames: {
      base: {
        frame: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        sourceSize: { w: FRAME_W, h: FRAME_H },
      },
      talk: {
        frame: { x: FRAME_W, y: 0, w: FRAME_W, h: FRAME_H },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        sourceSize: { w: FRAME_W, h: FRAME_H },
      },
    },
    meta: {
      app: 'shattered-stars',
      version: '1.0',
      image: sheetFilename,
      format: 'RGBA8888',
      size: { w: SHEET_W, h: SHEET_H },
      scale: '1',
    },
  };
}

for (const { faction, id } of PILOTS) {
  const sheetFilename = `${id}_sheet.png`;
  const jsonPath = join(PORTRAITS_ROOT, faction, `${id}_sheet.json`);
  const atlas = buildAtlasJson(sheetFilename);
  writeFileSync(jsonPath, JSON.stringify(atlas, null, 2) + '\n', 'utf8');
  console.log(`✓ ${faction}/${id}_sheet.json`);
}

console.log(`\nGenerated ${PILOTS.length} atlas JSON files.`);
