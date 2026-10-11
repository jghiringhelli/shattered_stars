/**
 * briefingStinger — plays a briefing mood's procedural stinger through the
 * audio manager (UI bus, so Settings › UI volume applies). Notes are
 * scheduled on the scene clock and die with the scene.
 */

import type Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";
import { BRIEFING_STINGERS, type BriefingMood } from "./sortieBriefing";

/**
 * @param scene - Scene whose clock schedules the notes.
 * @param mood - Briefing mood.
 */
export function playBriefingStinger(
  scene: Phaser.Scene,
  mood: BriefingMood,
): void {
  for (const note of BRIEFING_STINGERS[mood]) {
    const play = (): void => audioManager.playUiSound(note.sound, note.volume);
    if (note.atMs <= 0) play();
    else scene.time.delayedCall(note.atMs, play);
  }
}
