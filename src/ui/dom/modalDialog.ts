/**
 * A small accessible HTML modal (role="dialog") for text-heavy panels the
 * Phaser UI is poor at: real text fields, selectable text, screen readers.
 * Built with DOM calls only (no innerHTML). While it is open it keeps
 * keyboard events away from the game, traps Tab, closes on Esc and gives the
 * focus back to whatever had it.
 */

/** Element id of the shared stylesheet. */
const STYLE_ID = "ss-modal-style";
/** Above the game canvas and the compatibility notices. */
const MODAL_Z_INDEX = 2000;
/** Pointer events that must not reach Phaser's window listeners. */
const POINTER_EVENTS: readonly string[] = [
  "mousedown",
  "mouseup",
  "mousemove",
  "pointerdown",
  "pointerup",
  "pointermove",
  "touchstart",
  "touchend",
  "touchmove",
  "wheel",
];

const MODAL_CSS = `
.ss-modal{position:fixed;inset:0;z-index:${MODAL_Z_INDEX};display:flex;align-items:center;justify-content:center;background:rgba(5,5,16,.86);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.ss-modal__panel{width:min(640px,94vw);max-height:92vh;overflow:auto;border:1px solid #445577;border-radius:10px;background:linear-gradient(180deg,#10142a 0%,#0a0c1a 100%);box-shadow:0 0 40px rgba(80,120,255,.25);padding:22px 28px;color:#ccddee;font-size:14px;line-height:1.45}
.ss-modal__panel h2{margin:0 0 4px;font-size:22px;letter-spacing:1px;color:#fff}
.ss-modal__panel h3{margin:16px 0 4px;font-size:13px;letter-spacing:1.5px;color:#88aacc;text-transform:uppercase}
.ss-modal__panel p{margin:6px 0}
.ss-modal__panel ul,.ss-modal__panel ol{margin:6px 0 6px 20px;padding:0}
.ss-modal__panel a{color:#7fb0ff}
.ss-modal__panel kbd{font-family:ui-monospace,Consolas,monospace;color:#ffcc66}
.ss-modal__panel .ss-muted{color:#8899aa;font-size:12px}
.ss-modal__panel .ss-keys{display:grid;grid-template-columns:1fr auto;gap:2px 18px;margin:6px 0}
.ss-modal__panel .ss-legend{display:grid;grid-template-columns:minmax(170px,1.3fr) minmax(120px,1fr) minmax(120px,1fr);gap:3px 16px;margin:6px 0}
.ss-modal__panel .ss-legend__head{color:#88aacc;font-size:12px;letter-spacing:1px}
.ss-modal__panel .ss-legend span:not(.ss-legend__head):nth-child(3n+2),.ss-modal__panel .ss-legend span:not(.ss-legend__head):nth-child(3n){font-family:ui-monospace,Consolas,monospace;color:#ffcc66}
.ss-modal__panel--wide{width:min(900px,96vw)}
.ss-modal__panel .ss-keys span:nth-child(even){font-family:ui-monospace,Consolas,monospace;color:#ffcc66;text-align:right}
.ss-modal__panel label{display:block;margin:10px 0 4px;color:#88aacc;font-size:12px}
.ss-modal__panel select,.ss-modal__panel textarea{width:100%;box-sizing:border-box;padding:8px;color:#ddeeff;background:#080a16;border:1px solid #445577;border-radius:6px;font:inherit}
.ss-modal__panel textarea{min-height:90px;resize:vertical}
.ss-modal__panel details{margin:8px 0}
.ss-modal__panel summary{cursor:pointer;color:#88aacc}
.ss-modal__status{min-height:1.4em;margin-top:8px;color:#9fe0a8}
.ss-modal__actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}
.ss-modal__btn{padding:9px 20px;font:inherit;font-weight:700;color:#fff;background:#334477;border:1px solid #6688cc;border-radius:6px;cursor:pointer}
.ss-modal__btn:hover,.ss-modal__btn:focus-visible{background:#445599;outline:2px solid #9fc0ff}
.ss-modal__btn--primary{background:#2d6a4f;border-color:#52b788}
.ss-modal__btn--primary:hover,.ss-modal__btn--primary:focus-visible{background:#3a8a68}
`;

/** Options of {@link openModal}. */
export interface ModalOptions {
  /** DOM id; opening a modal whose id is already open returns that one. */
  readonly id: string;
  readonly title: string;
  /** Fill the body. Call `close` from buttons. */
  readonly build: (body: HTMLElement, close: () => void) => void;
  /** Runs once after the modal closed (any reason). */
  readonly onClose?: () => void;
  /** Wider panel for tables. */
  readonly wide?: boolean;
}

/** An open modal. */
export interface ModalHandle {
  readonly element: HTMLElement;
  close(): void;
}

/** Attributes accepted by {@link h}. */
export type ElementProps = Readonly<Record<string, string>>;

/**
 * Create an element (text through textContent only).
 *
 * @param tag - Tag name.
 * @param props - Attributes (`class`, `type`, `data-*`...).
 * @param children - Text or elements.
 * @returns The element.
 */
export function h(
  tag: string,
  props: ElementProps = {},
  ...children: ReadonlyArray<string | Node>
): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

/**
 * @param label - Button text.
 * @param onPress - Click handler.
 * @param primary - Whether it is the main action.
 * @returns A styled button.
 */
export function modalButton(
  label: string,
  onPress: () => void,
  primary = false,
): HTMLButtonElement {
  const button = h("button", {
    type: "button",
    class: `ss-modal__btn${primary ? " ss-modal__btn--primary" : ""}`,
  }) as HTMLButtonElement;
  button.textContent = label;
  button.addEventListener("click", onPress);
  return button;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = h("style", { id: STYLE_ID }, MODAL_CSS);
  document.head.appendChild(style);
}

/** @returns Focusable descendants in tab order. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "button,a[href],select,textarea,input,summary,[tabindex]:not([tabindex='-1'])",
    ),
  ).filter((el) => !el.hasAttribute("disabled"));
}

/** Tab stays inside the dialog. */
function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  const items = focusables(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Open a modal dialog over the page.
 *
 * @param options - Id, title, body builder and close hook.
 * @returns The open modal.
 */
export function openModal(options: ModalOptions): ModalHandle {
  const existing = document.getElementById(options.id);
  if (existing) {
    return {
      element: existing,
      close: () => existing.dispatchEvent(new Event("ss-close")),
    };
  }
  ensureStyle();
  const previousFocus = document.activeElement as HTMLElement | null;
  const titleId = `${options.id}-title`;
  const heading = h("h2", { id: titleId }, options.title);
  const body = h("div");
  const panel = h(
    "div",
    {
      class: `ss-modal__panel${options.wide ? " ss-modal__panel--wide" : ""}`,
      tabindex: "-1",
    },
    heading,
    body,
  );
  const root = h(
    "div",
    {
      id: options.id,
      class: "ss-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    },
    panel,
  );
  const close = (): void => {
    if (!root.isConnected) return;
    root.remove();
    previousFocus?.focus?.();
    options.onClose?.();
  };
  root.addEventListener("ss-close", close);
  // The game listens on window: keep typing, shortcuts and pointer events
  // (a click on a dialog button must not also press the menu row under it)
  // inside the dialog.
  for (const type of POINTER_EVENTS) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }
  for (const type of ["keydown", "keyup", "keypress"]) {
    root.addEventListener(type, (event) => {
      event.stopPropagation();
      const key = event as KeyboardEvent;
      if (type === "keydown" && key.key === "Escape") close();
      if (type === "keydown" && key.key === "Tab") trapTab(key, panel);
    });
  }
  options.build(body, close);
  document.body.appendChild(root);
  // Focus the dialog itself: the first control would scroll a long panel.
  panel.focus({ preventScroll: true });
  return { element: root, close };
}
