/**
 * ShipTelemetry — opt-in position sampler for battle scenes.
 *
 * Activated when the page URL contains `?debug=1`. Battle scenes construct
 * a ShipTelemetry, call `start()` on scene create, and `sample()` from
 * their per-tick loop. Samples are exposed on `window.__shipTelemetry` for
 * Playwright specs to read via `readShipTelemetry()`.
 *
 * Cost when disabled: one URL check per scene create.
 */

export interface ShipPositionSample {
  readonly t: number;
  readonly shipId: string;
  readonly x: number;
  readonly y: number;
  readonly heading?: number;
}

const MAX_SAMPLES = 5000;

export class ShipTelemetry {
  private samples: ShipPositionSample[] = [];
  private t0 = 0;

  /** True when the debug query flag is present in the current URL. */
  static isEnabled(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.location !== "undefined" &&
      window.location.search.includes("debug=1")
    );
  }

  /** Reset sample buffer and mark the origin time. */
  start(): void {
    this.t0 = performance.now();
    this.samples = [];
  }

  /** Record one position sample. No-op after MAX_SAMPLES to bound memory. */
  sample(shipId: string, x: number, y: number, heading?: number): void {
    if (this.samples.length >= MAX_SAMPLES) return;
    const sample: ShipPositionSample =
      heading === undefined
        ? { t: performance.now() - this.t0, shipId, x, y }
        : { t: performance.now() - this.t0, shipId, x, y, heading };
    this.samples.push(sample);
  }

  /** Read-only view of the collected samples. */
  getSamples(): readonly ShipPositionSample[] {
    return this.samples;
  }
}
