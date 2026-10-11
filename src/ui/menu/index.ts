/**
 * Holographic menu kit — public API for non-battle screens.
 *
 * Scenes build on MenuScaffold (backdrop, header, BACK, footer), draw panels
 * with HoloPanel (../hud) or holoChrome, use ButtonFactory / HoloButton for
 * actions, MenuIcons for glyphs and MenuFocus for keyboard focus.
 */

export {
  MENU_LAYOUT,
  SCREEN_TITLE,
  MENU_CLEAR_COLOR,
  addMenuBackdrop,
  addMenuHeader,
  addBackButton,
  addFooterHint,
  type MenuBackdropOptions,
  type MenuHeader,
  type MenuHeaderOptions,
} from "./MenuScaffold";
export {
  drawHoloFrame,
  drawHoloButtonFace,
  drawHoloGauge,
  drawAccentRule,
  drawCornerTicks,
  FOCUS_RING_OFFSET,
  type HoloRect,
  type HoloFrameOptions,
} from "./holoChrome";
export { HoloPressButton, type PressButtonConfig } from "./HoloPressButton";
export {
  MenuFocus,
  type FocusTarget,
  type MenuFocusOptions,
} from "./MenuFocus";
export { drawMenuIcon, createMenuIcon, type MenuIconName } from "./MenuIcons";
export { holoFont, holoFontFromCss, parseCssFont } from "../theme/holoFont";
