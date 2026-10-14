/**
 * DOM side of the compatibility notices. The markup and styles are static in
 * index.html (so they exist even if the game bundle cannot run); this module
 * only fills the text and toggles `hidden`. All text goes through
 * `textContent`, never innerHTML.
 */

import type { SupportReport } from "./browserSupport";
import { classifyDevice, isPortrait, shouldShowDeviceNotice } from "./deviceProfile";
import {
  bannerTextFor,
  blockedDetailFor,
  DEVICE_NOTICE_TEXT,
  ROTATE_HINT_TEXT,
} from "./noticeText";
import { readDeviceSignals } from "./probeEnvironment";
import { browserStore, type KeyValueStore } from "../systems/keyValueStore";

/** Storage key remembering that the device notice was dismissed. */
export const DEVICE_NOTICE_DISMISSED_KEY = "shattered_stars_device_notice_dismissed";

/**
 * @param doc - Document holding the static notice markup.
 * @param id - Element id.
 * @returns The element, or null when the page lacks it.
 */
function byId(doc: Document, id: string): HTMLElement | null {
  return doc.getElementById(id);
}

/**
 * Show the blocking "cannot run" overlay with the reason.
 *
 * @param doc - The page document.
 * @param report - A blocked support report.
 */
export function showBlockedNotice(doc: Document, report: SupportReport): void {
  const detail = byId(doc, "compat-blocked-detail");
  if (detail) detail.textContent = blockedDetailFor(report);
  const overlay = byId(doc, "compat-blocked");
  if (overlay) overlay.hidden = false;
}

/**
 * Show the small dismissible banner for compatibility mode / outdated browsers.
 *
 * @param doc - The page document.
 * @param report - A non-blocked support report.
 */
export function showSupportBanner(doc: Document, report: SupportReport): void {
  const text = bannerTextFor(report);
  const banner = byId(doc, "compat-banner");
  const label = byId(doc, "compat-banner-text");
  if (!text || !banner || !label) return;
  label.textContent = text;
  banner.hidden = false;
  const dismiss = byId(doc, "compat-banner-dismiss");
  if (dismiss) dismiss.onclick = () => (banner.hidden = true);
}

/**
 * Show the one-time "built for desktop" notice on touch-only / tiny screens
 * and keep a rotate hint up while such a device is in portrait. Never shows
 * on desktop.
 *
 * @param win - The page window.
 * @param store - Where the dismissal is remembered (never throws).
 */
export function installDeviceNotices(
  win: Window,
  store: KeyValueStore = browserStore(),
): void {
  const doc = win.document;
  const refresh = (): void => {
    const signals = readDeviceSignals(win);
    const deviceClass = classifyDevice(signals);
    const hint = byId(doc, "rotate-hint");
    if (!hint) return;
    hint.textContent = ROTATE_HINT_TEXT;
    hint.hidden =
      deviceClass === "desktop" ||
      !isPortrait(signals.viewportWidth, signals.viewportHeight);
  };
  const deviceClass = classifyDevice(readDeviceSignals(win));
  const dismissed = store.getItem(DEVICE_NOTICE_DISMISSED_KEY) === "1";
  const notice = byId(doc, "device-notice");
  const text = byId(doc, "device-notice-text");
  if (notice && text && shouldShowDeviceNotice(deviceClass, dismissed)) {
    text.textContent = DEVICE_NOTICE_TEXT;
    notice.hidden = false;
    const dismiss = byId(doc, "device-notice-dismiss");
    if (dismiss) {
      dismiss.onclick = () => {
        notice.hidden = true;
        store.setItem(DEVICE_NOTICE_DISMISSED_KEY, "1");
      };
    }
  }
  refresh();
  win.addEventListener("resize", refresh);
  win.addEventListener("orientationchange", refresh);
}
