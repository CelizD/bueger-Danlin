import type { StaffRole } from "./types";

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  KITCHEN: "Cocina",
  DELIVERY: "Entrega",
};

export const ROLE_DESCRIPTIONS: Record<
  StaffRole,
  {
    title: string;
    description: string;
    permissions: string[];
  }
> = {
  ADMIN: {
    title: "Administrador",
    description: "Control completo de la operación.",
    permissions: [
      "Ver Dashboard de ventas",
      "Ver todos los pedidos",
      "Operar Cocina y Entrega",
      "Administrar agenda",
      "Administrar inventario",
      "Crear y administrar personal",
      "MFA obligatorio para administradores",
    ],
  },
  KITCHEN: {
    title: "Cocina",
    description: "Solo producción de pedidos pagados.",
    permissions: [
      "Ver pedidos de cocina",
      "Marcar como preparando",
      "Marcar como listo",
    ],
  },
  DELIVERY: {
    title: "Entrega",
    description: "Solo validación y entrega al cliente.",
    permissions: [
      "Ver pedidos listos",
      "Escanear QR",
      "Marcar como entregado",
    ],
  },
};
