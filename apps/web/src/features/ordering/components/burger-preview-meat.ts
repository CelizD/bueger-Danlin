export type MeatVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
};

const PROFILES: Record<
  number,
  MeatVisualProfile
> = {
  1: {
    scale: 0.92,
    x: 0,
    yOffset: 0,
  },
  2: {
    scale: 0.91,
    x: 0,
    yOffset: -2,
  },
  3: {
    scale: 0.89,
    x: 0,
    yOffset: -4,
  },
  4: {
    scale: 0.87,
    x: 0,
    yOffset: -6,
  },
  5: {
    scale: 0.85,
    x: 0,
    yOffset: -8,
  },
};

export function meatVisualProfile(
  count: number,
): MeatVisualProfile {
  const normalized = Math.max(
    1,
    Math.min(
      5,
      Number.isFinite(count)
        ? Math.trunc(count)
        : 1,
    ),
  );

  return PROFILES[normalized]!;
}
