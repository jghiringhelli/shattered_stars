/**
 * Fixed timestep game clock with interpolation support
 * Decouples logic updates from render frame rate
 */

import { LOGIC_DELTA } from '../config';

type UpdateCallback = (deltaMs: number) => void;

class GameClockClass {
  private accumulator = 0;
  private lastTime = 0;
  private isRunning = false;
  private updateCallbacks: Set<UpdateCallback> = new Set();

  // Timing stats
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  /**
   * Register a callback to be called on each fixed update
   */
  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Start the game clock
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  /**
   * Stop the game clock
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Called each frame by Phaser's update loop
   * Processes fixed timestep updates
   */
  tick(time: number): number {
    if (!this.isRunning) return 0;

    const currentTime = time;
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap frame time to prevent spiral of death
    const cappedFrameTime = Math.min(frameTime, 250);
    this.accumulator += cappedFrameTime;

    // Track FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    // Process fixed updates
    let updatesThisFrame = 0;
    while (this.accumulator >= LOGIC_DELTA) {
      this.processUpdate(LOGIC_DELTA);
      this.accumulator -= LOGIC_DELTA;
      updatesThisFrame++;

      // Safety limit
      if (updatesThisFrame > 10) {
        this.accumulator = 0;
        break;
      }
    }

    // Return interpolation alpha for smooth rendering
    return this.accumulator / LOGIC_DELTA;
  }

  private processUpdate(deltaMs: number): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(deltaMs);
      } catch (error) {
        console.error('GameClock: Error in update callback:', error);
      }
    }
  }

  /**
   * Get current FPS
   */
  get fps(): number {
    return this.currentFps;
  }

  /**
   * Check if clock is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get interpolation alpha (0-1) for smooth rendering between logic updates
   */
  get alpha(): number {
    return this.accumulator / LOGIC_DELTA;
  }
}

// Singleton instance
export const GameClock = new GameClockClass();
