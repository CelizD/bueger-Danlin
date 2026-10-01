import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";

const meta = {
  title: "Design System/States",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <EmptyState
      title="Todavía no hay pedidos"
      description="Cuando llegue el primer pedido aparecerá aquí."
      action={<Button variant="secondary">Actualizar</Button>}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <LoadingState label="Cargando pedidos…" />
  ),
};
