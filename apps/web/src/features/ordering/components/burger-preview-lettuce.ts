export type LettuceVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
};

const PROFILES: Record<
  number,
  LettuceVisualProfile
> = {
  0: {
    scale: 0.96,
    x: 0,
    yOffset: 0,
  },
  1: {
    scale: 0.96,
    x: 0,
    yOffset: 3,
  },
  2: {
    scale: 0.94,
    x: 0,
    yOffset: 1,
  },
  3: {
    scale: 0.92,
    x: 0,
    yOffset: -1,
  },
  4: {
    scale: 0.9,
    x: 0,
    yOffset: -3,
  },
  5: {
    scale: 0.88,
    x: 0,
    yOffset: -5,
  },
};

export function lettuceVisualProfile(
  count: number,
): LettuceVisualProfile {
  const normalized = Math.max(
    0,
    Math.min(
      5,
      Number.isFinite(count)
        ? Math.trunc(count)
        : 0,
    ),
  );

  return PROFILES[normalized]!;
}
