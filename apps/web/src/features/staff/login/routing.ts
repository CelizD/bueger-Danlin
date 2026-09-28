import type { StaffRole } from "./types";

export function routeForRole(role: StaffRole) {
  if (role === "KITCHEN") return "/admin/cocina";
  if (role === "DELIVERY") return "/admin/entrega";
  return "/admin/dashboard";
}
