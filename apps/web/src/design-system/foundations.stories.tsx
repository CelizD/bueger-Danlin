import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const COLORS = [
  ["Fondo", "var(--color-bg-default)"],
  ["Superficie", "var(--color-surface)"],
  ["Texto principal", "var(--color-text-primary)"],
  ["Texto secundario", "var(--color-text-secondary)"],
  ["Acción", "var(--color-action-primary)"],
  ["Éxito", "var(--color-success)"],
  ["Peligro", "var(--color-danger)"],
] as const;

const meta = {
  title: "Design System/Foundations",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SemanticColors: Story = {
  render: () => (
    <div
      style={{
        width: 560,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
      }}
    >
      {COLORS.map(([label, color]) => (
        <div
          key={label}
          style={{
            display: "grid",
            gap: 8,
            padding: 16,
            border: "1px solid var(--color-border-muted)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface)",
          }}
        >
          <div
            aria-label={label}
            style={{
              height: 72,
              borderRadius: "var(--radius-sm)",
              background: color,
              border: "1px solid var(--color-border-muted)",
            }}
          />
          <strong>{label}</strong>
          <code>{color}</code>
        </div>
      ))}
    </div>
  ),
};
