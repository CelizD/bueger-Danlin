export type TomatoVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
  step: number;
};

const PROFILES: Record<
  number,
  TomatoVisualProfile
> = {
  0: {
    scale: 0.88,
    x: 0,
    yOffset: 0,
    step: 7,
  },
  1: {
    scale: 0.88,
    x: 0,
    yOffset: 2,
    step: 7,
  },
  2: {
    scale: 0.87,
    x: 0,
    yOffset: 1,
    step: 7,
  },
  3: {
    scale: 0.86,
    x: 0,
    yOffset: 0,
    step: 7,
  },
  4: {
    scale: 0.84,
    x: 0,
    yOffset: -1,
    step: 7,
  },
  5: {
    scale: 0.82,
    x: 0,
    yOffset: -2,
    step: 7,
  },
};

export function tomatoVisualProfile(
  count: number,
): TomatoVisualProfile {
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
