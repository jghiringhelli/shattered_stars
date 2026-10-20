/**
 * Credits roll content (CreditsScene draws it). Kept as data so tests can
 * hold it to the release rules: honest AI-content credits, the
 * non-affiliation / trademark disclaimer and the license statement.
 * Mirrors LICENSE, README "Credits" and public/THIRD_PARTY_NOTICES.txt.
 */

/** Line styles of the credit roll. */
export type CreditStyle =
  "title" | "subtitle" | "section" | "role" | "name" | "small" | "spacer";

/** One line of the roll. */
export interface CreditLine {
  readonly text: string;
  readonly style: CreditStyle;
}

/** Longest line the roll shows without clipping (small style, 1280 px). */
export const CREDIT_LINE_MAX_CHARS = 72;

const SPACE: CreditLine = { text: "", style: "spacer" };
const section = (text: string): CreditLine => ({ text, style: "section" });
const role = (text: string): CreditLine => ({ text, style: "role" });
const name = (text: string): CreditLine => ({ text, style: "name" });
const small = (text: string): CreditLine => ({ text, style: "small" });

export const CREDITS: readonly CreditLine[] = [
  { text: "SHATTERED STARS", style: "title" },
  SPACE,
  { text: "A real-time tactical starship combat game", style: "subtitle" },
  small("Free-to-play alpha"),
  SPACE,
  SPACE,
  section("DEVELOPMENT"),
  role("CREATED BY"),
  name("Juan Carlos Ghiringhelli"),
  SPACE,
  role("PROGRAMMING"),
  name("Written with AI coding assistants"),
  small("Anthropic Claude and GitHub Copilot, directed and reviewed"),
  small("by the developer"),
  SPACE,
  SPACE,
  section("ART"),
  role("SHIPS, PORTRAITS, BACKDROPS"),
  name("Generated with Stable Diffusion"),
  small("SDXL 1.0 and DreamShaper 8 checkpoints with community LoRAs"),
  small("(concept art, sci-fi, stained glass) via Forge and ComfyUI,"),
  small("curated by the developer"),
  SPACE,
  role("USER INTERFACE"),
  name("Holographic UI drawn in code"),
  small("System fonts only; no font files are bundled"),
  SPACE,
  SPACE,
  section("AUDIO"),
  role("MUSIC"),
  name("Made by Juan Carlos Ghiringhelli with Suno"),
  small("suno.com"),
  small("Additional Synthetic Collective and Ascendant Empire tracks"),
  small("generated with ACE-Step (Apache-2.0) via Harmonia"),
  SPACE,
  role("SOUND EFFECTS"),
  name("Synthesized in real time (Web Audio)"),
  SPACE,
  SPACE,
  section("AI-GENERATED CONTENT"),
  small("This game's art and music are AI-generated (music made with Suno"),
  small("and ACE-Step), and much of its code was written with AI assistance."),
  small("Every asset was prompted, selected and integrated by the developer."),
  SPACE,
  SPACE,
  section("TECHNOLOGY"),
  role("GAME ENGINE"),
  name("Phaser 3"),
  small("MIT License, Phaser Studio Inc."),
  small("Bundles Matter.js and poly-decomp (MIT) and earcut (ISC)"),
  SPACE,
  role("LIBRARIES"),
  name("seedrandom · immer"),
  small("MIT Licenses, see THIRD_PARTY_NOTICES.txt"),
  SPACE,
  role("LANGUAGE AND TOOLS"),
  name("TypeScript · Vite · Vitest · Playwright"),
  SPACE,
  SPACE,
  section("INSPIRATION"),
  name("Classic dogfighting games"),
  small("Tabletop and arcade starfighter classics"),
  SPACE,
  SPACE,
  section("LEGAL"),
  small("Shattered Stars is an independent original work inspired by"),
  small("classic dogfighting games. It is not affiliated with, endorsed,"),
  small("sponsored or approved by any other game, publisher or franchise."),
  SPACE,
  small("All trademarks belong to their respective owners."),
  small("The factions, ships and characters in this game are original."),
  SPACE,
  small("© 2026 Juan Carlos Ghiringhelli. All rights reserved."),
  small("Not for redistribution. See LICENSE."),
  SPACE,
  SPACE,
  section("SPECIAL THANKS"),
  role("PLAYTESTERS"),
  name("You!"),
  SPACE,
  SPACE,
  SPACE,
  { text: "Thank you for playing!", style: "subtitle" },
  SPACE,
  SPACE,
  SPACE,
];
