export type WhiteOnionVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
  step: number;
};

const PROFILES: Record<
  number,
  WhiteOnionVisualProfile
> = {
  0: {
    scale: 0.82,
    x: 0,
    yOffset: 0,
    step: 6,
  },
  1: {
    scale: 0.82,
    x: 0,
    yOffset: 2,
    step: 6,
  },
  2: {
    scale: 0.81,
    x: 0,
    yOffset: 1,
    step: 6,
  },
  3: {
    scale: 0.8,
    x: 0,
    yOffset: 0,
    step: 6,
  },
  4: {
    scale: 0.78,
    x: 0,
    yOffset: -1,
    step: 6,
  },
  5: {
    scale: 0.76,
    x: 0,
    yOffset: -2,
    step: 6,
  },
};

export function whiteOnionVisualProfile(
  count: number,
): WhiteOnionVisualProfile {
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
