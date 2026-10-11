/**
 * downloadTextFile — save a text document through the browser's download
 * flow (no network): used to export the local telemetry log.
 */

/** Delay before revoking the object URL so the download can start. */
const REVOKE_DELAY_MS = 1000;

/**
 * @param filename - Suggested file name.
 * @param text - File contents.
 * @param mime - MIME type. Default JSON.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mime = "application/json",
): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
