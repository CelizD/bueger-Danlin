export type BaconVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
  step: number;
  exactSpriteId?: "bacon-1" | "bacon-2" | "bacon-4";
  repeatSingleCount: number;
};

const PROFILES: Record<
  number,
  BaconVisualProfile
> = {
  0: {
    scale: 0.9,
    x: 0,
    yOffset: 0,
    step: 7,
    repeatSingleCount: 0,
  },
  1: {
    scale: 0.9,
    x: 0,
    yOffset: 2,
    step: 7,
    exactSpriteId: "bacon-1",
    repeatSingleCount: 0,
  },
  2: {
    scale: 0.88,
    x: 0,
    yOffset: 1,
    step: 7,
    exactSpriteId: "bacon-2",
    repeatSingleCount: 0,
  },
  3: {
    scale: 0.85,
    x: 0,
    yOffset: -1,
    step: 7,
    repeatSingleCount: 3,
  },
  4: {
    scale: 0.84,
    x: 0,
    yOffset: -3,
    step: 7,
    exactSpriteId: "bacon-4",
    repeatSingleCount: 0,
  },
  5: {
    scale: 0.82,
    x: 0,
    yOffset: -5,
    step: 7,
    repeatSingleCount: 5,
  },
};

export function baconVisualProfile(
  count: number,
): BaconVisualProfile {
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
