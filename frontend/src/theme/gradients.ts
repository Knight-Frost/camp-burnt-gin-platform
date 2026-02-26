/**
 * Gradient Color Engine — dark mode only
 *
 * ColorSet defines RGB triplet pairs for interpolation across two axes:
 *   - scroll progress (0→1): deepens/shifts as user scrolls down
 *   - gradient phase  (0→1): slow 40-second time cycle
 *
 * Naming: c{1|2|3}{a|b|c|d}
 *   c1 = first gradient stop, c2 = second, c3 = third
 *   a/b = time-phase-0 scroll start / scroll end
 *   c/d = time-phase-1 scroll start / scroll end
 */

interface ColorSet {
  c1a: number[]; c1b: number[];
  c1c: number[]; c1d: number[];
  c2a: number[]; c2b: number[];
  c2c: number[]; c2d: number[];
  c3a: number[]; c3b: number[];
  c3c: number[]; c3d: number[];
  vignette: string;
}

// Dark — jet black with warm ember undertones (campfire glow)
const DARK: ColorSet = {
  c1a: [0, 0, 0],     c1b: [8, 5, 3],
  c1c: [8, 5, 5],     c1d: [12, 8, 6],
  c2a: [0, 0, 0],     c2b: [10, 8, 5],
  c2c: [10, 8, 8],    c2d: [15, 12, 10],
  c3a: [5, 5, 5],     c3b: [14, 12, 8],
  c3c: [10, 10, 10],  c3d: [18, 20, 14],
  vignette: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
};

function lerpChannel(c1: number[], c2: number[], t: number): number[] {
  return c1.map((v, i) => Math.round(v + ((c2[i] ?? 0) - v) * t));
}

export interface DynamicColors {
  color1: string;
  color2: string;
  color3: string;
  vignette: string;
}

/**
 * Pure function — returns gradient colors for the current state.
 * Called inside RAF loop; no allocations beyond small number[] intermediaries.
 */
export function getDynamicColors(
  _resolvedTheme: 'dark' | 'light',
  scrollProgress: number,
  gradientPhase: number,
): DynamicColors {
  const set = DARK;

  const c1 = lerpChannel(
    lerpChannel(set.c1a, set.c1b, scrollProgress),
    lerpChannel(set.c1c, set.c1d, scrollProgress),
    gradientPhase,
  );
  const c2 = lerpChannel(
    lerpChannel(set.c2a, set.c2b, scrollProgress),
    lerpChannel(set.c2c, set.c2d, scrollProgress),
    gradientPhase,
  );
  const c3 = lerpChannel(
    lerpChannel(set.c3a, set.c3b, scrollProgress),
    lerpChannel(set.c3c, set.c3d, scrollProgress),
    (gradientPhase + 0.5) % 1,
  );

  return {
    color1: `rgb(${c1.join(',')})`,
    color2: `rgb(${c2.join(',')})`,
    color3: `rgb(${c3.join(',')})`,
    vignette: set.vignette,
  };
}
