/**
 * SessionLogger — opt-in capture of console errors/warnings, uncaught
 * exceptions, and every dispatched input intent (keyboard/touch/gamepad
 * alike, since they all flow through the same InputManager) into an
 * in-memory buffer for post-session analysis.
 *
 * Activated by the same `?debug=1` URL flag as ShipTelemetry. Installed once
 * at boot in main.ts (DEV builds only) — persists across scene transitions,
 * unlike per-scene telemetry. Exposed on `window.__sessionLogger` for manual
 * inspection or a Playwright read. Press Ctrl+Shift+L to download the
 * captured log as JSON.
 *
 * Cost when disabled: one URL check at boot, no hooks installed.
 */

import { InputManager } from "../input/InputManager";
import type { InputEvent } from "../input/InputTypes";

export type SessionLogLevel = "error" | "warn" | "info" | "input";

export interface SessionLogEntry {
  readonly t: number; // ms since logger start
  readonly level: SessionLogLevel;
  readonly message: string;
  readonly data?: unknown;
}

const MAX_ENTRIES = 5000;
const DOWNLOAD_HOTKEY = "l"; // Ctrl+Shift+L

export class SessionLogger {
  private readonly entries: SessionLogEntry[] = [];
  private readonly t0 = performance.now();

  /** True when the debug query flag is present in the current URL. */
  static isEnabled(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.location !== "undefined" &&
      window.location.search.includes("debug=1")
    );
  }

  /** Installs console/error/input hooks and the download hotkey. */
  start(): void {
    this.hookConsole();
    this.hookErrors();
    this.hookInput();
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === DOWNLOAD_HOTKEY) {
        this.download();
      }
    });
    this.logEvent("SessionLogger started");
  }

  /** Records a custom event; scenes/systems may call this for key moments. */
  logEvent(message: string, data?: unknown): void {
    this.push("info", message, data);
  }

  getEntries(): readonly SessionLogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries.length = 0;
  }

  /** Triggers a browser download of the captured log as JSON. */
  download(filename = `session-log-${Date.now()}.json`): void {
    const blob = new Blob([JSON.stringify(this.entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private push(level: SessionLogLevel, message: string, data?: unknown): void {
    if (this.entries.length >= MAX_ENTRIES) this.entries.shift();
    this.entries.push({ t: performance.now() - this.t0, level, message, data });
  }

  private hookConsole(): void {
    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);
    console.error = (...args: unknown[]) => {
      this.push("error", args.map(String).join(" "));
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      this.push("warn", args.map(String).join(" "));
      originalWarn(...args);
    };
  }

  private hookErrors(): void {
    window.addEventListener("error", (e) => {
      this.push("error", e.message, { stack: e.error?.stack });
    });
    window.addEventListener("unhandledrejection", (e) => {
      this.push("error", `Unhandled rejection: ${String(e.reason)}`);
    });
  }

  private hookInput(): void {
    InputManager.onAny((event: InputEvent) => {
      this.push("input", event.intent, {
        source: event.source,
        value: event.value,
      });
    });
  }
}
