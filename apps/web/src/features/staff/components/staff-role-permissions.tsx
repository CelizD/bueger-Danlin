import {
  ChefHat,
  Shield,
  Truck,
  UserCog,
} from "lucide-react";
import { ROLE_DESCRIPTIONS } from "../personal/config";
import type { StaffRole } from "../personal/types";

export function StaffRolePermissions() {
  return (
    <section className="staff-permissions">
      <div className="staff-section-title">
        <div>
          <p className="admin-kicker">
            Autorización
          </p>
          <h2>Roles y permisos</h2>
        </div>
        <UserCog size={21} />
      </div>

      <div className="staff-permission-grid">
        {(
          Object.keys(
            ROLE_DESCRIPTIONS,
          ) as StaffRole[]
        ).map((role) => {
          const detail =
            ROLE_DESCRIPTIONS[role];

          return (
            <article key={role}>
              <div className="staff-permission-head">
                <span
                  className={
                    "staff-role-icon role-" +
                    role.toLowerCase()
                  }
                >
                  {role === "ADMIN" ? (
                    <Shield size={18} />
                  ) : role ===
                    "KITCHEN" ? (
                    <ChefHat size={18} />
                  ) : (
                    <Truck size={18} />
                  )}
                </span>
                <div>
                  <strong>
                    {detail.title}
                  </strong>
                  <span>
                    {detail.description}
                  </span>
                </div>
              </div>

              <ul>
                {detail.permissions.map(
                  (permission) => (
                    <li key={permission}>
                      {permission}
                    </li>
                  ),
                )}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
