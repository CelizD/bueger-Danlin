import type { StaffRole } from "./types";

export type { StaffRole } from "./types";

export type AdminSection =
  | "dashboard"
  | "pedidos"
  | "cocina"
  | "entrega"
  | "sabados"
  | "inventario"
  | "arco"
  | "personal";

const sectionRoles: Record<AdminSection, readonly StaffRole[]> = {
  dashboard: ["ADMIN"],
  pedidos: ["ADMIN"],
  cocina: ["ADMIN", "KITCHEN"],
  entrega: ["ADMIN", "DELIVERY"],
  sabados: ["ADMIN"],
  inventario: ["ADMIN"],
  arco: ["ADMIN"],
  personal: ["ADMIN"],
};

export function canAccessAdminSection(
  role: StaffRole,
  section: AdminSection,
) {
  return sectionRoles[section].includes(role);
}
