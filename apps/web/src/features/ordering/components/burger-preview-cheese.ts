export type CheeseVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
};

const PROFILES: Record<
  number,
  CheeseVisualProfile
> = {
  1: {
    scale: 0.9,
    x: 0,
    yOffset: 4,
  },
  2: {
    scale: 0.89,
    x: 0,
    yOffset: 3,
  },
  3: {
    scale: 0.87,
    x: 0,
    yOffset: 2,
  },
  4: {
    scale: 0.85,
    x: 0,
    yOffset: 1,
  },
  5: {
    scale: 0.83,
    x: 0,
    yOffset: 0,
  },
};

export function cheeseVisualProfile(
  count: number,
): CheeseVisualProfile {
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
