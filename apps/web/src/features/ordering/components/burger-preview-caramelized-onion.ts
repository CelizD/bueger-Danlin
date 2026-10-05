export type CaramelizedOnionVisualProfile = {
  scale: number;
  x: number;
  yOffset: number;
};

const OFF = {
  scale: 0.8,
  x: 0,
  yOffset: 0,
} satisfies CaramelizedOnionVisualProfile;

const ON = {
  scale: 0.8,
  x: 0,
  yOffset: 2,
} satisfies CaramelizedOnionVisualProfile;

export function caramelizedOnionVisualProfile(
  count: number,
): CaramelizedOnionVisualProfile {
  return count > 0 ? ON : OFF;
}
