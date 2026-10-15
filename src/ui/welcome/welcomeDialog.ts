/**
 * The tester welcome (HTML dialog): what this build is, how to get started,
 * the controls, where the settings are and how to give feedback. Shown once
 * on the first launch and re-openable from the main menu.
 */

import { BUILD_INFO, formatVersionTag } from "../../buildInfo";
import { FEEDBACK_REPO_URL } from "../../feedback/feedbackLink";
import { t } from "../../i18n";
import {
  h,
  modalButton,
  openModal,
  type ModalHandle,
} from "../dom/modalDialog";
import { controlRows } from "./controlsCheatSheet";
import { markWelcomeSeen } from "./welcomeState";

/** DOM id of the dialog (e2e uses it). */
export const WELCOME_DIALOG_ID = "ss-welcome-dialog";
const DOCS_URL = `${FEEDBACK_REPO_URL}/blob/master/docs`;

/** Actions the welcome hands back to the menu. */
export interface WelcomeActions {
  /** Absent where leaving the current scene would be wrong (e.g. Settings over a battle). */
  readonly onFlightSchool?: () => void;
  readonly onFeedback: () => void;
}

function section(title: string, ...content: Array<string | Node>): HTMLElement {
  return h(
    "div",
    {},
    h("h3", {}, title),
    ...content.map((c) => (typeof c === "string" ? h("p", {}, c) : c)),
  );
}

/** @returns The Flight School shortcut, if the caller offers one. */
function flightSchoolButton(
  actions: WelcomeActions,
  close: () => void,
): HTMLElement[] {
  const { onFlightSchool } = actions;
  if (!onFlightSchool) return [];
  return [
    modalButton(
      t("welcome.action.flightSchool"),
      () => {
        close();
        onFlightSchool();
      },
      true,
    ),
  ];
}

function controlsGrid(): HTMLElement {
  const grid = h("div", { class: "ss-keys" });
  for (const row of controlRows()) {
    grid.append(h("span", {}, row.label), h("span", {}, row.keys));
  }
  return grid;
}

/**
 * Open the welcome dialog. Closing it (any way) marks it as seen.
 *
 * @param actions - Menu callbacks for the two shortcut buttons.
 * @returns The open dialog.
 */
export function openWelcomeDialog(actions: WelcomeActions): ModalHandle {
  return openModal({
    id: WELCOME_DIALOG_ID,
    title: t("welcome.title"),
    onClose: () => markWelcomeSeen(),
    build: (body, close) => {
      body.append(
        h("p", { class: "ss-muted" }, formatVersionTag(BUILD_INFO)),
        section(
          t("welcome.about.title"),
          t("welcome.about.body"),
        ),
        section(
          t("welcome.start.title"),
          t("welcome.start.body"),
        ),
        section(t("welcome.controls.title"), controlsGrid()),
        section(
          t("welcome.settings.title"),
          t("welcome.settings.body"),
        ),
        section(
          t("welcome.feedback.title"),
          t("welcome.feedback.body"),
        ),
        h(
          "p",
          { class: "ss-muted" },
          h(
            "a",
            {
              href: `${DOCS_URL}/KNOWN_ISSUES.md`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            t("common.link.knownIssues"),
          ),
          " · ",
          h(
            "a",
            {
              href: `${DOCS_URL}/TESTER_GUIDE.md`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            t("common.link.testerGuide"),
          ),
          " · ",
          h(
            "a",
            {
              href: `${DOCS_URL}/PRIVACY.md`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            t("common.link.privacy"),
          ),
        ),
        h(
          "div",
          { class: "ss-modal__actions" },
          ...flightSchoolButton(actions, close),
          modalButton(t("common.sendFeedback"), () => actions.onFeedback()),
          modalButton(t("welcome.action.play"), close),
        ),
      );
    },
  });
}
