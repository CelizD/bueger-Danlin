import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "./alert";

const meta = {
  title: "Design System/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    children: "Tu pedido se actualizó correctamente.",
  },
  argTypes: {
    tone: {
      control: "select",
      options: [
        "info",
        "success",
        "warning",
        "danger",
      ],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    tone: "success",
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "Quedan pocos artículos disponibles.",
  },
};

export const Danger: Story = {
  args: {
    tone: "danger",
    children: "No se pudo completar la operación.",
  },
};
