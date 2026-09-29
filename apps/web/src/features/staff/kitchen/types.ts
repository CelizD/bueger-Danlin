export type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

export type KitchenModifier = {
  id: string;
  optionName: string;
  removed: boolean;
};

export type KitchenOrder = {
  id: string;
  orderCode: string;
  status: "PAID" | "CONFIRMED" | "PREPARING" | "READY";
  comboQuantity: number;
  totalCents: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    modifiers: KitchenModifier[];
  }>;
};

export type KitchenColumns = {
  NEW: KitchenOrder[];
  PREPARING: KitchenOrder[];
  READY: KitchenOrder[];
};
