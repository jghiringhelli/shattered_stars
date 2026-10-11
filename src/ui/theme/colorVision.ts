/**
 * colorVision — colour-vision-deficiency simulation and perceptual distance,
 * used to verify (in tests) that each colourblind palette keeps HUD signals
 * apart for the viewers it targets.
 *
 * Simulation: Machado, Oliveira & Fernandes (2009) full-severity matrices on
 * linear RGB. Distance: CIE76 ΔE in CIELAB (D65). Contrast: WCAG 2 ratio.
 * Pure: no Phaser.
 */

/** Deficiency types the simulator models. */
export type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";

type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/** Machado 2009, severity 1.0, applied to linear RGB. */
const CVD_MATRICES: Readonly<Record<Deficiency, Matrix3>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const CHANNEL_MAX = 255;
const SRGB_KNEE = 0.04045;
const LINEAR_KNEE = 0.0031308;
const SRGB_SLOPE = 12.92;
const SRGB_GAMMA = 2.4;
const SRGB_OFFSET = 0.055;
/** D65 reference white (XYZ, Y = 1). */
const WHITE_XYZ = [0.95047, 1, 1.08883] as const;
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
const WCAG_OFFSET = 0.05;

type Rgb = readonly [number, number, number];

function toLinearChannel(c: number): number {
  const s = c / CHANNEL_MAX;
  return s <= SRGB_KNEE
    ? s / SRGB_SLOPE
    : ((s + SRGB_OFFSET) / (1 + SRGB_OFFSET)) ** SRGB_GAMMA;
}

function toSrgbChannel(linear: number): number {
  const v = Math.min(1, Math.max(0, linear));
  const s =
    v <= LINEAR_KNEE
      ? v * SRGB_SLOPE
      : (1 + SRGB_OFFSET) * v ** (1 / SRGB_GAMMA) - SRGB_OFFSET;
  return Math.round(s * CHANNEL_MAX);
}

function linearRgb(color: number): Rgb {
  return [
    toLinearChannel((color >> 16) & CHANNEL_MAX),
    toLinearChannel((color >> 8) & CHANNEL_MAX),
    toLinearChannel(color & CHANNEL_MAX),
  ];
}

/**
 * How a colour looks to a viewer with the given deficiency.
 *
 * @param color - 0xRRGGBB.
 * @param deficiency - Deficiency to simulate.
 * @returns The simulated 0xRRGGBB colour.
 */
export function simulateColorVision(
  color: number,
  deficiency: Deficiency,
): number {
  const [r, g, b] = linearRgb(color);
  const m = CVD_MATRICES[deficiency];
  const out = m.map((row) => row[0] * r + row[1] * g + row[2] * b);
  return (
    (toSrgbChannel(out[0] ?? 0) << 16) |
    (toSrgbChannel(out[1] ?? 0) << 8) |
    toSrgbChannel(out[2] ?? 0)
  );
}

function labF(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

/**
 * @param color - 0xRRGGBB.
 * @returns CIELAB [L, a, b] under D65.
 */
export function toLab(color: number): Rgb {
  const [r, g, b] = linearRgb(color);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / WHITE_XYZ[0];
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / WHITE_XYZ[1];
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / WHITE_XYZ[2];
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Perceptual distance between two colours (CIE76 ΔE; ~2.3 is a just
 * noticeable difference, 20+ reads as clearly different at a glance).
 *
 * @param a - 0xRRGGBB.
 * @param b - 0xRRGGBB.
 * @returns ΔE.
 */
export function deltaE(a: number, b: number): number {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/**
 * @param color - 0xRRGGBB.
 * @returns WCAG relative luminance in [0, 1].
 */
export function relativeLuminance(color: number): number {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param a - 0xRRGGBB.
 * @param b - 0xRRGGBB.
 * @returns WCAG contrast ratio in [1, 21].
 */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + WCAG_OFFSET) / (Math.min(la, lb) + WCAG_OFFSET);
}
