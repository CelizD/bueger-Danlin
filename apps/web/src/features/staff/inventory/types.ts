export type { StaffSessionUser as StaffUser } from "../types";

export type InventoryItem = {
  id: string;
  key: string;
  name: string;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
  lowStock: boolean;
  outOfStock: boolean;
  linkedToSales: boolean;
  hasHistory: boolean;
  deletable: boolean;
};

export type InventoryDraft = {
  name: string;
  unit: string;
  stock: string;
  threshold: string;
};

export type CreateInventoryForm = {
  name: string;
  unit: string;
  stock: string;
  threshold: string;
};
