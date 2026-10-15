/**
 * English message catalog: the SOURCE of every translatable player-facing string migrated so far.
 *
 * Rules (docs/I18N.md): keys are `area.screen.purpose` in lower case; text may contain `{name}`
 * placeholders (typed: `t("key", { name })` must provide exactly those); never build a sentence by
 * concatenating translated pieces; keep ids and lore data outside this file (they are keyed by id).
 */
export const EN_MESSAGES = {
  "common.close": "CLOSE",
  "common.sendFeedback": "SEND FEEDBACK",
  "common.link.knownIssues": "Known issues",
  "common.link.testerGuide": "Tester guide",
  "common.link.privacy": "Privacy",

  "welcome.title": "WELCOME, TESTER",
  "welcome.about.title": "What this is",
  "welcome.about.body":
    "Shattered Stars is a free, real-time tactical space-combat game that runs in your browser. This is a public BETA: expect bugs, rough edges and unbalanced content. Your progress is saved in this browser only.",
  "welcome.start.title": "Start here",
  "welcome.start.body":
    "Flight School (about 5 minutes) teaches the controls with live checks. Press F on the main menu any time. Then try a Skirmish, Survival or the Campaign.",
  "welcome.controls.title": "Controls (keyboard)",
  "welcome.settings.title": "Accessibility and settings",
  "welcome.settings.body":
    "Main Menu > Settings: colour-blind palettes, key and gamepad rebinding, camera comfort, difficulty and volume. A gamepad works in every mode.",
  "welcome.feedback.title": "Feedback",
  "welcome.feedback.body":
    "Found a bug or something feels off? Use SEND FEEDBACK here, in the pause menu or in Settings > Advanced. Nothing is sent automatically.",
  "welcome.action.flightSchool": "FLIGHT SCHOOL",
  "welcome.action.play": "LET ME PLAY",

  "feedback.title": "SEND FEEDBACK",
  "feedback.intro": "Thanks for testing Shattered Stars. Tell us what to fix, tune or build next.",
  "feedback.how.title": "How to give feedback",
  "feedback.how.step1": "Pick what kind of feedback this is and, if you like, write a note.",
  "feedback.how.step2": "Press SEND: the game saves a small file and opens {formName} in a new tab.",
  "feedback.how.step3":
    "Drag the saved file into the issue (or the form), describe what happened, and submit.",
  "feedback.how.tip":
    "Most useful: what you were doing, what you expected, and how to repeat it. For balance, say which ship, upgrade or difficulty felt wrong. No GitHub account? Press DOWNLOAD ONLY and send the file to the person who invited you.",
  "feedback.form.githubIssue": "a prefilled GitHub issue",
  "feedback.form.customForm": "the feedback form",
  "feedback.kind.label": "Kind of feedback",
  "feedback.kind.uiux": "UI / UX",
  "feedback.note.label": "Your note",
  "feedback.note.placeholder": "Optional. What happened, what you expected, how to repeat it.",
  "feedback.privacy.promise":
    "Privacy: the file is created only when you press a button below. It contains no name, account or e-mail, and anything that looks like a password or token is removed. Nothing is sent automatically; you decide whether to attach it.",
  "feedback.privacy.summary": "What is in the file?",
  "feedback.privacy.item.build": "Game version, build id and date",
  "feedback.privacy.item.settings": "Your settings (volume, difficulty, key bindings, accessibility)",
  "feedback.privacy.item.events":
    "The last 100 local events (mode starts and ends, deaths, errors) and your last 10 match summaries; empty if you turned Local Telemetry off",
  "feedback.privacy.item.environment": "Browser, screen size, graphics renderer / GPU name and current FPS",
  "feedback.privacy.item.context": "The scene and mode you were in, and your note below",
  "feedback.action.sendIssue": "SEND (SAVE FILE + OPEN ISSUE)",
  "feedback.action.sendForm": "SEND (SAVE FILE + OPEN FORM)",
  "feedback.action.downloadOnly": "DOWNLOAD ONLY",
  "feedback.status.saved": "Saved {fileName}{trimmed}.",
  "feedback.status.savedOpened": "Saved {fileName}{trimmed}. Attach it to the page that just opened.",
  "feedback.status.trimmed": " (trimmed to a safe size)",
} as const;

/** Every translatable key. */
export type MessageKey = keyof typeof EN_MESSAGES;

/** A complete translation of {@link EN_MESSAGES}. */
export type MessageCatalog = Readonly<Record<MessageKey, string>>;
