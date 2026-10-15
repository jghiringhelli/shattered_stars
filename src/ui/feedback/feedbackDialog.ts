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
import { t, type PlainMessageKey } from "../../i18n";
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
const BUNDLE_CONTENTS: readonly PlainMessageKey[] = [
  "feedback.privacy.item.build",
  "feedback.privacy.item.settings",
  "feedback.privacy.item.events",
  "feedback.privacy.item.environment",
  "feedback.privacy.item.context",
];

function link(label: string, href: string): HTMLElement {
  return h("a", { href, target: "_blank", rel: "noopener noreferrer" }, label);
}

function howItWorks(usesDefaultForm: boolean): HTMLElement {
  const formName = usesDefaultForm
    ? t("feedback.form.githubIssue")
    : t("feedback.form.customForm");
  return h(
    "div",
    {},
    h("h3", {}, t("feedback.how.title")),
    h(
      "ol",
      {},
      h("li", {}, t("feedback.how.step1")),
      h("li", {}, t("feedback.how.step2", { formName })),
      h("li", {}, t("feedback.how.step3")),
    ),
    h(
      "p",
      { class: "ss-muted" },
      t("feedback.how.tip"),
    ),
  );
}

function privacyBlock(): HTMLElement {
  const items = BUNDLE_CONTENTS.map((key) => h("li", {}, t(key)));
  return h(
    "div",
    {},
    h(
      "p",
      { class: "ss-muted", "data-testid": "feedback-privacy" },
      t("feedback.privacy.promise"),
    ),
    h(
      "details",
      {},
      h("summary", {}, t("feedback.privacy.summary")),
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
      kind.title === "UI/UX" ? t("feedback.kind.uiux") : kind.title,
    );
    select.appendChild(option);
  }
  return select;
}

function noteField(): HTMLTextAreaElement {
  return h("textarea", {
    id: "ss-feedback-note",
    maxlength: String(FEEDBACK_MAX_NOTE_CHARS),
    placeholder: t("feedback.note.placeholder"),
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
    title: t("feedback.title"),
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
        const params = {
          fileName: result.fileName,
          trimmed: result.truncated ? t("feedback.status.trimmed") : "",
        };
        status.textContent = openForm
          ? t("feedback.status.savedOpened", params)
          : t("feedback.status.saved", params);
      };
      body.append(
        h("p", {}, t("feedback.intro")),
        howItWorks(usesDefaultForm),
        h("label", { for: "ss-feedback-kind" }, t("feedback.kind.label")),
        kind,
        h("label", { for: "ss-feedback-note" }, t("feedback.note.label")),
        note,
        privacyBlock(),
        status,
        h(
          "div",
          { class: "ss-modal__actions" },
          modalButton(
            usesDefaultForm
              ? t("feedback.action.sendIssue")
              : t("feedback.action.sendForm"),
            () => run(true),
            true,
          ),
          modalButton(t("feedback.action.downloadOnly"), () => run(false)),
          modalButton(t("common.close"), close),
        ),
        h(
          "p",
          { class: "ss-muted" },
          link(t("common.link.testerGuide"), `${DOCS_URL}/TESTER_GUIDE.md`),
          " · ",
          link(t("common.link.knownIssues"), `${DOCS_URL}/KNOWN_ISSUES.md`),
          " · ",
          link(t("common.link.privacy"), `${DOCS_URL}/PRIVACY.md`),
        ),
      );
    },
  });
}
