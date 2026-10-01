import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextField } from "./text-field";

const meta = {
  title: "Design System/TextField",
  component: TextField,
  tags: ["autodocs"],
  args: {
    id: "customer-name-story",
    label: "Nombre",
    placeholder: "Tu nombre",
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    hint: "Usa el nombre con el que recogerás tu pedido.",
  },
};

export const WithError: Story = {
  args: {
    defaultValue: "A",
    error: "Escribe al menos 2 caracteres.",
  },
};
