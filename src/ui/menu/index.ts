/**
 * Holographic menu kit — public API for non-battle screens.
 *
 * Scenes build on MenuScaffold (backdrop, header, BACK, footer), draw panels
 * with HoloPanel (../hud) or holoChrome, use ButtonFactory / HoloButton for
 * actions, MenuIcons for glyphs, MenuFocus for keyboard / gamepad focus,
 * footerKeys for the footer hint format and HintTooltip for role hints.
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
export { FOOTER_PAIR_GAP, footerKeys } from "./footerKeys";
export {
  attachHintTooltip,
  shownHintText,
  type HintContent,
} from "./HintTooltip";
export {
  tooltipPosition,
  TOOLTIP_MARGIN,
  TOOLTIP_OFFSET,
} from "./hintTooltipLayout";
export { SettingsDefaultPick, raidDifficultyFor } from "./setupDefaults";
