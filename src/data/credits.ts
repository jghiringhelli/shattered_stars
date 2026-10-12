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
  small("DreamShaper 8 checkpoint + concept-art / stained-glass LoRAs"),
  small("via Forge and ComfyUI, curated by the developer"),
  SPACE,
  role("USER INTERFACE"),
  name("Holographic UI drawn in code"),
  SPACE,
  SPACE,
  section("AUDIO"),
  role("MUSIC"),
  name("Composed by Juan Carlos Ghiringhelli with Suno"),
  small("suno.com"),
  small("Additional Synthetic Collective and Ascendant Empire tracks"),
  small("generated with ACE-Step via Harmonia"),
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
  name("X-Wing Miniatures Game"),
  small("Fantasy Flight Games / Atomic Mass Games"),
  SPACE,
  name("Wing Commander"),
  small("Origin Systems"),
  SPACE,
  SPACE,
  section("LEGAL"),
  small("Shattered Stars is an independent fan game inspired by the"),
  small("X-Wing Miniatures Game. It is not affiliated with, endorsed,"),
  small("sponsored or approved by Lucasfilm Ltd., The Walt Disney Company,"),
  small("Atomic Mass Games or Fantasy Flight Games."),
  SPACE,
  small("Star Wars, X-Wing and related names are trademarks of their"),
  small("respective owners. All other trademarks belong to their owners."),
  small("The factions, ships and characters in this game are original."),
  SPACE,
  small("© 2026 Juan Carlos Ghiringhelli. All rights reserved."),
  small("Free to play; not for redistribution. See LICENSE."),
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
