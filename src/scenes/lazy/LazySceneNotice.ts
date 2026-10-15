/**
 * Small DOM status line shown while a lazy scene chunk downloads (only when it
 * takes noticeably long) and when it fails. DOM, not canvas: the current scene
 * keeps running and owns the canvas during the download.
 */

/** Delay before "Loading..." appears, so fast loads never flash it. */
export const LOADING_NOTICE_DELAY_MS = 250;
/** How long the failure message stays visible. */
export const ERROR_NOTICE_DURATION_MS = 5000;

const NOTICE_ID = "lazy-scene-notice";
const NOTICE_STYLE =
  "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1600;padding:6px 14px;" +
  "border:1px solid #6688cc;border-radius:6px;background:rgba(10,12,26,0.92);" +
  "font:bold 13px Arial,sans-serif;color:#ccddee;pointer-events:none;";

/** Shows and hides the status line. */
export interface LazySceneNotice {
  /** A download started. */
  readonly begin: () => void;
  /** A download ended. */
  readonly end: () => void;
  /** A download failed. */
  readonly fail: () => void;
}

/**
 * @param doc - The page document.
 * @returns Controller of the status line (concurrent downloads share one line).
 */
export function createLazySceneNotice(doc: Document): LazySceneNotice {
  let active = 0;
  let timer: number | undefined;
  const element = (): HTMLElement => {
    const existing = doc.getElementById(NOTICE_ID);
    if (existing) return existing;
    const created = doc.createElement("div");
    created.id = NOTICE_ID;
    created.setAttribute("role", "status");
    created.setAttribute("style", NOTICE_STYLE);
    doc.body.appendChild(created);
    return created;
  };
  const hide = (): void => {
    window.clearTimeout(timer);
    doc.getElementById(NOTICE_ID)?.remove();
  };
  return {
    begin: () => {
      active++;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        element().textContent = "Loading…";
      }, LOADING_NOTICE_DELAY_MS);
    },
    end: () => {
      active = Math.max(0, active - 1);
      if (active === 0) hide();
    },
    fail: () => {
      window.clearTimeout(timer);
      element().textContent = "Could not load this screen. Check your connection and try again.";
      timer = window.setTimeout(hide, ERROR_NOTICE_DURATION_MS);
    },
  };
}
