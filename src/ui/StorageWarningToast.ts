/**
 * StorageWarningToast — a small DOM banner shown once when browser storage is
 * blocked or full, so players know progress won't survive a reload. DOM (not
 * a Phaser object) so it shows regardless of which scene is active.
 */

import type { SafeKeyValueStore } from "../systems/keyValueStore";

/** Element id of the toast (also used by e2e checks). */
export const STORAGE_TOAST_ID = "storage-warning-toast";
/** Message shown when persistence is lost. */
export const STORAGE_TOAST_TEXT =
  "Browser storage is unavailable — you can play, but progress and settings won't be saved this session.";
/** How long the toast stays on screen. */
const TOAST_VISIBLE_MS = 8000;

const TOAST_STYLE: Readonly<Record<string, string>> = {
  position: "fixed",
  left: "50%",
  bottom: "24px",
  transform: "translateX(-50%)",
  maxWidth: "640px",
  padding: "10px 18px",
  background: "rgba(20, 12, 4, 0.92)",
  border: "1px solid #d9a441",
  borderRadius: "6px",
  color: "#f2e2c0",
  font: "13px/1.4 sans-serif",
  zIndex: "1000",
  pointerEvents: "none",
};

/** Insert (or re-show) the toast and schedule its removal. */
function showToast(): void {
  if (typeof document === "undefined" || !document.body) return;
  document.getElementById(STORAGE_TOAST_ID)?.remove();
  const toast = document.createElement("div");
  toast.id = STORAGE_TOAST_ID;
  toast.setAttribute("role", "status");
  toast.textContent = STORAGE_TOAST_TEXT;
  Object.assign(toast.style, TOAST_STYLE);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), TOAST_VISIBLE_MS);
}

/**
 * Show the warning once, as soon as `store` reports it can't persist.
 *
 * @param store - The shared safe store.
 */
export function installStorageWarning(store: SafeKeyValueStore): void {
  store.onDegraded(showToast);
}
