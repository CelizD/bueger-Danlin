export type BurgerStackCounts = {
  hasSauce: boolean;
  meat: number;
  cheese: number;
  bacon: number;
  caramelizedOnion: number;
  whiteOnion: number;
  pickles: number;
  tomato: number;
  lettuce: number;
};

export type BurgerStackLayout = {
  sauceY: number;
  meatY: number;
  cheeseY: number;
  baconY: number;
  caramelizedOnionY: number;
  whiteOnionY: number;
  picklesY: number;
  tomatoY: number;
  lettuceY: number;
  topBunY: number;
  stackHeight: number;
};

type HeightProfile = {
  base: number;
  extra: number;
};

const HEIGHTS = {
  meat: { base: 34, extra: 11 },
  cheese: { base: 19, extra: 6 },
  bacon: { base: 17, extra: 7 },
  caramelizedOnion: {
    base: 11,
    extra: 0,
  },
  whiteOnion: {
    base: 12,
    extra: 6,
  },
  pickles: { base: 9, extra: 4 },
  tomato: { base: 16, extra: 7 },
  lettuce: { base: 19, extra: 6 },
} satisfies Record<string, HeightProfile>;

const SAUCE_Y = 116;
const MEAT_Y_WITH_SAUCE = 82;
const MEAT_Y_WITHOUT_SAUCE = 92;
const TOP_BUN_GAP = 25;

function normalizedCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(5, Math.trunc(value)),
  );
}

function occupiedHeight(
  count: number,
  profile: HeightProfile,
) {
  const normalized =
    normalizedCount(count);

  if (normalized === 0) {
    return 0;
  }

  return (
    profile.base +
    Math.max(0, normalized - 1) *
      profile.extra
  );
}

export function calculateBurgerStackLayout(
  counts: BurgerStackCounts,
): BurgerStackLayout {
  const meatCount = Math.max(
    1,
    normalizedCount(counts.meat),
  );
  const cheeseCount =
    normalizedCount(counts.cheese);
  const baconCount =
    normalizedCount(counts.bacon);
  const caramelizedOnionCount =
    normalizedCount(
      counts.caramelizedOnion,
    );
  const whiteOnionCount =
    normalizedCount(
      counts.whiteOnion,
    );
  const picklesCount =
    normalizedCount(counts.pickles);
  const tomatoCount =
    normalizedCount(counts.tomato);
  const lettuceCount =
    normalizedCount(counts.lettuce);

  const meatY = counts.hasSauce
    ? MEAT_Y_WITH_SAUCE
    : MEAT_Y_WITHOUT_SAUCE;

  let cursor =
    meatY -
    occupiedHeight(
      meatCount,
      HEIGHTS.meat,
    );

  const cheeseY = cursor;
  cursor -= occupiedHeight(
    cheeseCount,
    HEIGHTS.cheese,
  );

  const baconY = cursor;
  cursor -= occupiedHeight(
    baconCount,
    HEIGHTS.bacon,
  );

  const caramelizedOnionY = cursor;
  cursor -= occupiedHeight(
    caramelizedOnionCount,
    HEIGHTS.caramelizedOnion,
  );

  const whiteOnionY = cursor;
  cursor -= occupiedHeight(
    whiteOnionCount,
    HEIGHTS.whiteOnion,
  );

  const picklesY = cursor;
  cursor -= occupiedHeight(
    picklesCount,
    HEIGHTS.pickles,
  );

  const tomatoY = cursor;
  cursor -= occupiedHeight(
    tomatoCount,
    HEIGHTS.tomato,
  );

  const lettuceY = cursor;
  cursor -= occupiedHeight(
    lettuceCount,
    HEIGHTS.lettuce,
  );

  const topBunY =
    cursor - TOP_BUN_GAP;

  return {
    sauceY: SAUCE_Y,
    meatY,
    cheeseY,
    baconY,
    caramelizedOnionY,
    whiteOnionY,
    picklesY,
    tomatoY,
    lettuceY,
    topBunY,
    stackHeight: meatY - topBunY,
  };
}
