/**
 * AutoPause — a battle pauses by itself when the player leaves the page
 * (tab switch, minimised window, focus lost). Offline battles only: a shared
 * online battle cannot pause and keeps running. Resuming stays manual, from
 * the pause menu. One helper for every battle scene's pause path.
 */

/** Minimal event source (Phaser's EventEmitter and Node's both fit). */
export interface AutoPauseEvents {
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

/** The scene parts {@link bindAutoPause} needs. */
export interface AutoPauseScene {
  readonly game: { readonly events: AutoPauseEvents };
  readonly events: AutoPauseEvents;
}

/** What decides whether leaving the page pauses the battle. */
export interface AutoPauseGate {
  /** The battle is already paused (pause menu open). */
  readonly paused: boolean;
  /** An online (shared, lockstep) battle: never paused. */
  readonly online: boolean;
}

/** Phaser.Core.Events.BLUR / HIDDEN: the window lost focus / the page was hidden. */
export const LEAVE_PAGE_EVENTS = ["blur", "hidden"] as const;
/** Phaser.Scenes.Events.SHUTDOWN / DESTROY: the scene's listeners must go. */
const SCENE_END_EVENTS = ["shutdown", "destroy"] as const;

/**
 * Pause a running offline battle through the scene's own pause path.
 *
 * @param gate - Whether the battle is paused already, and whether it is online.
 * @param pause - The scene's pause action (opens the pause menu).
 * @returns True when the battle was paused by this call.
 */
export function pauseBattleIfRunning(
  gate: AutoPauseGate,
  pause: () => void,
): boolean {
  if (gate.online || gate.paused) return false;
  pause();
  return true;
}

/**
 * Call `onLeave` whenever the page is hidden or loses focus, until the scene
 * shuts down (listeners are removed then, so restarts never stack them).
 *
 * @param scene - The battle scene.
 * @param onLeave - The scene's pauseIfRunning().
 */
export function bindAutoPause(scene: AutoPauseScene, onLeave: () => void): void {
  const gameEvents = scene.game.events;
  for (const event of LEAVE_PAGE_EVENTS) gameEvents.on(event, onLeave);
  const unbind = (): void => {
    for (const event of LEAVE_PAGE_EVENTS) gameEvents.off(event, onLeave);
    for (const event of SCENE_END_EVENTS) scene.events.off(event, unbind);
  };
  for (const event of SCENE_END_EVENTS) scene.events.on(event, unbind);
}
