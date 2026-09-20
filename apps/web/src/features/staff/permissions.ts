export type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

export type AdminSection =
  | "dashboard"
  | "pedidos"
  | "cocina"
  | "entrega"
  | "sabados"
  | "inventario"
  | "personal";

const sectionRoles: Record<AdminSection, readonly StaffRole[]> = {
  dashboard: ["ADMIN"],
  pedidos: ["ADMIN"],
  cocina: ["ADMIN", "KITCHEN"],
  entrega: ["ADMIN", "DELIVERY"],
  sabados: ["ADMIN"],
  inventario: ["ADMIN"],
  personal: ["ADMIN"],
};

export function canAccessAdminSection(
  role: StaffRole,
  section: AdminSection,
) {
  return sectionRoles[section].includes(role);
}
