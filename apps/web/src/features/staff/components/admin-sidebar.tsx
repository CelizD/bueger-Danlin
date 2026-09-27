"use client";

import {
  canAccessAdminSection,
  type AdminSection,
  type StaffRole,
} from "@/features/staff/permissions";
import { API_URL, apiFetch } from "@/lib/api/browser";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ChefHat,
  LogOut,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";

export type StaffSessionUser = {
  name: string;
  email: string;
  role: StaffRole;
};

type AdminSidebarProps = {
  user: StaffSessionUser | null;
  active: AdminSection;
  subtitle?: string;
};

const navItems = [
  {
    id: "dashboard",
    href: "/admin/dashboard",
    label: "Panel del día",
    icon: BarChart3,
  },
  {
    id: "pedidos",
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: ShoppingBag,
  },
  {
    id: "cocina",
    href: "/admin/cocina",
    label: "Cocina",
    icon: ChefHat,
  },
  {
    id: "entrega",
    href: "/admin/entrega",
    label: "Entrega",
    icon: Truck,
  },
  {
    id: "sabados",
    href: "/admin/sabados",
    label: "Sábados",
    icon: CalendarDays,
  },
  {
    id: "inventario",
    href: "/admin/inventario",
    label: "Inventario",
    icon: Boxes,
  },
  {
    id: "personal",
    href: "/admin/personal",
    label: "Personal",
    icon: Users,
  },
] as const;

export function AdminSidebar({
  user,
  active,
  subtitle = "Operaciones",
}: AdminSidebarProps) {
  async function logout() {
    await apiFetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    window.location.replace("/admin/login");
  }

  return (
    <aside className="admin-sidebar">
      <div>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-mark">BD</div>
          <div>
            <strong>Burger Danlin</strong>
            <span>{subtitle}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Navegación de operaciones">
          {navItems.map((item) => {
            if (
              !user ||
              !canAccessAdminSection(
                user.role,
                item.id as AdminSection,
              )
            ) {
              return null;
            }

            const Icon = item.icon;
            const isActive = item.id === active;

            return (
              <a
                key={item.id}
                className={isActive ? "active" : undefined}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="admin-sidebar-user">
        <div>
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
        </div>
        <button type="button" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
