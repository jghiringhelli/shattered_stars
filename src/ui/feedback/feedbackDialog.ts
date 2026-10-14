/**
 * The "Send feedback" panel (HTML dialog): how to give feedback, a kind
 * selector, an optional note, and the actions. Everything it does happens on
 * a click; the privacy promise is on the panel itself.
 */

import {
  FEEDBACK_MAX_NOTE_CHARS,
  type FeedbackKind,
} from "../../feedback/feedbackBundle";
import type { FeedbackGame } from "../../feedback/feedbackEnvironment";
import {
  FEEDBACK_KINDS,
  FEEDBACK_REPO_URL,
  resolveFeedbackBase,
  DEFAULT_FEEDBACK_URL,
} from "../../feedback/feedbackLink";
import { sendFeedback, pageEffects } from "../../feedback/sendFeedback";
import {
  h,
  modalButton,
  openModal,
  type ModalHandle,
} from "../dom/modalDialog";

/** DOM id of the dialog (e2e and callers use it). */
export const FEEDBACK_DIALOG_ID = "ss-feedback-dialog";
/** Docs the dialog links to (default branch of the public repository). */
const DOCS_URL = `${FEEDBACK_REPO_URL}/blob/master/docs`;

/** Where the dialog was opened from. */
export interface FeedbackDialogOptions {
  readonly game: FeedbackGame | undefined;
  readonly sceneKey: string;
}

/** What the file contains, shown to the player before they send it. */
const BUNDLE_CONTENTS: readonly string[] = [
  "Game version, build id and date",
  "Your settings (volume, difficulty, key bindings, accessibility)",
  "The last 100 local events (mode starts and ends, deaths, errors) and your last 10 match summaries; empty if you turned Local Telemetry off",
  "Browser, screen size, graphics renderer / GPU name and current FPS",
  "The scene and mode you were in, and your note below",
];

function link(label: string, href: string): HTMLElement {
  return h("a", { href, target: "_blank", rel: "noopener noreferrer" }, label);
}

function howItWorks(usesDefaultForm: boolean): HTMLElement {
  const formName = usesDefaultForm
    ? "a prefilled GitHub issue"
    : "the feedback form";
  return h(
    "div",
    {},
    h("h3", {}, "How to give feedback"),
    h(
      "ol",
      {},
      h(
        "li",
        {},
        "Pick what kind of feedback this is and, if you like, write a note.",
      ),
      h(
        "li",
        {},
        `Press SEND: the game saves a small file and opens ${formName} in a new tab.`,
      ),
      h(
        "li",
        {},
        "Drag the saved file into the issue (or the form), describe what happened, and submit.",
      ),
    ),
    h(
      "p",
      { class: "ss-muted" },
      "Most useful: what you were doing, what you expected, and how to repeat it. For balance, say which ship, upgrade or difficulty felt wrong. No GitHub account? Press DOWNLOAD ONLY and send the file to the person who invited you.",
    ),
  );
}

function privacyBlock(): HTMLElement {
  const items = BUNDLE_CONTENTS.map((text) => h("li", {}, text));
  return h(
    "div",
    {},
    h(
      "p",
      { class: "ss-muted", "data-testid": "feedback-privacy" },
      "Privacy: the file is created only when you press a button below. It contains no name, account or e-mail, and anything that looks like a password or token is removed. Nothing is sent automatically; you decide whether to attach it.",
    ),
    h(
      "details",
      {},
      h("summary", {}, "What is in the file?"),
      h("ul", {}, ...items),
    ),
  );
}

function kindSelect(): HTMLSelectElement {
  const select = h("select", { id: "ss-feedback-kind" }) as HTMLSelectElement;
  for (const [value, kind] of Object.entries(FEEDBACK_KINDS)) {
    const option = h(
      "option",
      { value },
      kind.title === "UI/UX" ? "UI / UX" : kind.title,
    );
    select.appendChild(option);
  }
  return select;
}

function noteField(): HTMLTextAreaElement {
  return h("textarea", {
    id: "ss-feedback-note",
    maxlength: String(FEEDBACK_MAX_NOTE_CHARS),
    placeholder:
      "Optional. What happened, what you expected, how to repeat it.",
  }) as HTMLTextAreaElement;
}

/**
 * Open the feedback dialog.
 *
 * @param options - The running game and the scene key it was opened from.
 * @returns The open dialog.
 */
export function openFeedbackDialog(
  options: FeedbackDialogOptions,
): ModalHandle {
  const usesDefaultForm =
    resolveFeedbackBase(pageEffects().configuredUrl) === DEFAULT_FEEDBACK_URL;
  return openModal({
    id: FEEDBACK_DIALOG_ID,
    title: "SEND FEEDBACK",
    build: (body, close) => {
      const status = h("div", {
        class: "ss-modal__status",
        role: "status",
        "aria-live": "polite",
      });
      const kind = kindSelect();
      const note = noteField();
      const run = (openForm: boolean): void => {
        const result = sendFeedback({
          kind: kind.value as FeedbackKind,
          note: note.value,
          sceneKey: options.sceneKey,
          game: options.game,
          openForm,
        });
        const extra = result.truncated ? " (trimmed to a safe size)" : "";
        status.textContent = openForm
          ? `Saved ${result.fileName}${extra}. Attach it to the page that just opened.`
          : `Saved ${result.fileName}${extra}.`;
      };
      body.append(
        h(
          "p",
          {},
          "Thanks for testing Shattered Stars. Tell us what to fix, tune or build next.",
        ),
        howItWorks(usesDefaultForm),
        h("label", { for: "ss-feedback-kind" }, "Kind of feedback"),
        kind,
        h("label", { for: "ss-feedback-note" }, "Your note"),
        note,
        privacyBlock(),
        status,
        h(
          "div",
          { class: "ss-modal__actions" },
          modalButton(
            usesDefaultForm
              ? "SEND (SAVE FILE + OPEN ISSUE)"
              : "SEND (SAVE FILE + OPEN FORM)",
            () => run(true),
            true,
          ),
          modalButton("DOWNLOAD ONLY", () => run(false)),
          modalButton("CLOSE", close),
        ),
        h(
          "p",
          { class: "ss-muted" },
          link("Tester guide", `${DOCS_URL}/TESTER_GUIDE.md`),
          " · ",
          link("Known issues", `${DOCS_URL}/KNOWN_ISSUES.md`),
          " · ",
          link("Privacy", `${DOCS_URL}/PRIVACY.md`),
        ),
      );
    },
  });
}
