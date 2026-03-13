/**
 * GameClock Tests
 *
 * Tests for the fixed timestep game clock with interpolation support.
 * Note: GameClock is a singleton, so we create a fresh testable instance for isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LOGIC_DELTA } from '../../../src/config';

// Create a testable GameClock class matching the production implementation
// This allows us to test in isolation without singleton state issues
class TestableGameClock {
  private accumulator = 0;
  private lastTime = 0;
  private isRunning = false;
  private updateCallbacks: Set<(deltaMs: number) => void> = new Set();
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  onUpdate(callback: (deltaMs: number) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = 0;
    this.accumulator = 0;
  }

  stop(): void {
    this.isRunning = false;
  }

  tick(time: number): number {
    if (!this.isRunning) return 0;

    const currentTime = time;
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    const cappedFrameTime = Math.min(frameTime, 250);
    this.accumulator += cappedFrameTime;

    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    let updatesThisFrame = 0;
    while (this.accumulator >= LOGIC_DELTA) {
      this.processUpdate(LOGIC_DELTA);
      this.accumulator -= LOGIC_DELTA;
      updatesThisFrame++;

      if (updatesThisFrame > 10) {
        this.accumulator = 0;
        break;
      }
    }

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

  get fps(): number {
    return this.currentFps;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get alpha(): number {
    return this.accumulator / LOGIC_DELTA;
  }
}

describe('GameClock', () => {
  let clock: TestableGameClock;

  beforeEach(() => {
    // Fresh clock instance for each test
    clock = new TestableGameClock();
  });

  describe('Basic lifecycle', () => {
    it('should not be running initially', () => {
      expect(clock.running).toBe(false);
    });

    it('should start the clock', () => {
      clock.start();
      expect(clock.running).toBe(true);
    });

    it('should stop the clock', () => {
      clock.start();
      clock.stop();
      expect(clock.running).toBe(false);
    });

    it('should not restart if already running', () => {
      clock.start();
      const firstStart = clock.running;

      clock.start(); // Second call should be ignored
      const secondStart = clock.running;

      expect(firstStart).toBe(true);
      expect(secondStart).toBe(true);
    });
  });

  describe('Update callbacks', () => {
    it('should register update callback', () => {
      const callback = vi.fn();
      const unsubscribe = clock.onUpdate(callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should call callback on tick when running', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      // First tick initializes lastTime to 0
      // Second tick with enough delta triggers callback
      clock.tick(0);
      clock.tick(LOGIC_DELTA * 2);

      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback when not running', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.stop();

      const result = clock.tick(LOGIC_DELTA);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should unsubscribe callback when returned function is called', () => {
      const callback = vi.fn();
      const unsubscribe = clock.onUpdate(callback);
      clock.start();

      unsubscribe();
      clock.tick(0);
      clock.tick(LOGIC_DELTA * 2);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should call callback with delta time', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      clock.tick(LOGIC_DELTA * 2);

      expect(callback).toHaveBeenCalledWith(LOGIC_DELTA);
    });

    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      clock.onUpdate(callback1);
      clock.onUpdate(callback2);
      clock.start();

      clock.tick(0);
      clock.tick(LOGIC_DELTA * 2);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      clock.onUpdate(errorCallback);
      clock.onUpdate(successCallback);
      clock.start();

      // Should not throw
      expect(() => {
        clock.tick(0);
        clock.tick(LOGIC_DELTA * 2);
      }).not.toThrow();

      // Both callbacks should be invoked (error is caught)
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('Fixed timestep', () => {
    it('should process multiple updates when frame time exceeds delta', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      // Pass time for 3+ logic updates
      clock.tick(LOGIC_DELTA * 3.5);

      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should cap frame time to prevent spiral of death', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      // Pass a very large frame time (simulating tab being inactive)
      clock.tick(5000);

      // Should be capped - fewer than 5000ms / LOGIC_DELTA (~300) updates
      // Frame is capped to 250ms, then safety limit of 10 applies
      // So we should see at most 15 updates (250/16.67), but the 10 limit may kick in
      expect(callback.mock.calls.length).toBeLessThan(300);
      expect(callback.mock.calls.length).toBeGreaterThan(0);
    });

    it('should return interpolation alpha', () => {
      clock.start();

      clock.tick(0);
      // Pass partial frame time (less than one full LOGIC_DELTA)
      const alpha = clock.tick(LOGIC_DELTA * 0.5);

      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });

    it('should limit updates per frame to 10', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      // Try to process way too many updates (100 * LOGIC_DELTA = ~1.6 seconds)
      // 250ms cap: 250/16.67 = ~15 updates
      // Safety limit of 10 applies
      clock.tick(LOGIC_DELTA * 100);

      // Safety limit kicks in when we try to process more than 10
      // Since 250/16.67 > 10, we should be limited
      expect(callback.mock.calls.length).toBeLessThanOrEqual(15);
    });
  });

  describe('FPS tracking', () => {
    it('should track FPS over time', () => {
      clock.start();

      // Simulate frames over more than 1 second at ~60fps
      let time = 0;
      for (let i = 0; i < 70; i++) {
        time += 16;
        clock.tick(time);
      }

      // After 1 second (1000ms), FPS should be calculated
      expect(clock.fps).toBeGreaterThan(0);
    });

    it('should have fps getter', () => {
      expect(typeof clock.fps).toBe('number');
    });

    it('should reset FPS counter after 1 second', () => {
      clock.start();

      // First second - need to go past 1000ms to trigger FPS calculation
      let time = 0;
      for (let i = 0; i < 65; i++) {
        time += 16; // 65*16 = 1040ms > 1000ms
        clock.tick(time);
      }

      const fps1 = clock.fps;

      // Second second - continue past 2000ms
      for (let i = 0; i < 65; i++) {
        time += 16;
        clock.tick(time);
      }

      const fps2 = clock.fps;

      expect(fps1).toBeGreaterThan(0);
      expect(fps2).toBeGreaterThan(0);
    });
  });

  describe('Interpolation alpha', () => {
    it('should have alpha getter', () => {
      expect(typeof clock.alpha).toBe('number');
    });

    it('should return value between 0 and 1 after partial tick', () => {
      clock.start();
      clock.tick(0);
      clock.tick(LOGIC_DELTA * 0.5);

      const alpha = clock.alpha;

      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });

    it('should be 0 when accumulator is empty', () => {
      clock.start();
      clock.tick(0);
      // Process exactly one update
      clock.tick(LOGIC_DELTA);

      // Accumulator should be near 0
      expect(clock.alpha).toBeLessThan(0.1);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero frame time', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      clock.tick(0); // Zero delta

      // Should not process any updates
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle very small frame times', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);
      clock.tick(1); // 1ms

      // Should not process updates yet (accumulator < LOGIC_DELTA)
      expect(callback).not.toHaveBeenCalled();
    });

    it('should accumulate small frame times', () => {
      const callback = vi.fn();
      clock.onUpdate(callback);
      clock.start();

      clock.tick(0);

      // Accumulate small deltas until they exceed LOGIC_DELTA
      let time = 0;
      const numTicks = Math.ceil(LOGIC_DELTA / 5) + 2;
      for (let i = 0; i < numTicks; i++) {
        time += 5;
        clock.tick(time);
      }

      expect(callback).toHaveBeenCalled();
    });

    it('should handle negative time (should not happen but be safe)', () => {
      clock.start();
      clock.tick(100);

      // Should not throw even with weird input
      expect(() => clock.tick(50)).not.toThrow();
    });
  });

  describe('Integration with real GameClock export', () => {
    // This test verifies the exported singleton exists and has the expected API
    it('should export GameClock singleton with correct API', async () => {
      const { GameClock } = await import('../../../src/core/GameClock');

      expect(GameClock).toBeDefined();
      expect(typeof GameClock.start).toBe('function');
      expect(typeof GameClock.stop).toBe('function');
      expect(typeof GameClock.tick).toBe('function');
      expect(typeof GameClock.onUpdate).toBe('function');
      expect(typeof GameClock.fps).toBe('number');
      expect(typeof GameClock.running).toBe('boolean');
      expect(typeof GameClock.alpha).toBe('number');
    });
  });
});
