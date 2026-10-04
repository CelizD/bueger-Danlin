export type { StaffSessionUser as StaffUser } from "../types";

export type KitchenModifier = {
  id: string;
  optionName: string;
  quantity: number;
  removed: boolean;
};

export type KitchenPreparationSnapshot = {
  included: string[];
  removed: string[];
  extras: string[];
  quantities?: string[];
  sauces?: string[];
  others?: string[];
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
    position: number;
    product: {
      type: "COMBO" | "BEVERAGE" | "ADD_ON";
    };
    preparationSnapshot: KitchenPreparationSnapshot | null;
    modifiers: KitchenModifier[];
  }>;
};

export type KitchenColumns = {
  NEW: KitchenOrder[];
  PREPARING: KitchenOrder[];
  READY: KitchenOrder[];
};
