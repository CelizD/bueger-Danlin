export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "NO_SHOW",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["MOCK", "STRIPE", "MERCADOPAGO"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];


export const BURGER_MAX_INGREDIENT_QUANTITY = 5;

export type BurgerModifierQuantity = {
  modifierOptionId: string;
  quantity: number;
};
