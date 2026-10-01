import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";

const meta = {
  title: "Design System/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: {
    children: "Pendiente",
  },
  argTypes: {
    tone: {
      control: "select",
      options: [
        "neutral",
        "info",
        "success",
        "warning",
        "danger",
      ],
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Paid: Story = {
  args: {
    tone: "success",
    children: "Pagado",
  },
};

export const InProgress: Story = {
  args: {
    tone: "info",
    children: "En preparación",
  },
};

export const Attention: Story = {
  args: {
    tone: "warning",
    children: "Revisar",
  },
};

export const Failed: Story = {
  args: {
    tone: "danger",
    children: "Fallido",
  },
};
