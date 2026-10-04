export type PicklesVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
  step: number;
};

const PROFILES: Record<
  number,
  PicklesVisualProfile
> = {
  0: {
    scale: 0.74,
    x: 0,
    yOffset: 0,
    step: 4,
  },
  1: {
    scale: 0.74,
    x: 0,
    yOffset: 2,
    step: 4,
  },
  2: {
    scale: 0.73,
    x: 0,
    yOffset: 1,
    step: 4,
  },
  3: {
    scale: 0.72,
    x: 0,
    yOffset: 0,
    step: 4,
  },
  4: {
    scale: 0.70,
    x: 0,
    yOffset: -1,
    step: 4,
  },
  5: {
    scale: 0.68,
    x: 0,
    yOffset: -2,
    step: 4,
  },
};

export function picklesVisualProfile(
  count: number,
): PicklesVisualProfile {
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
