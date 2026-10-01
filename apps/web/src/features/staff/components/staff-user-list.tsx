import {
  KeyRound,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type {
  SessionUser,
  StaffRole,
  StaffUser,
} from "../personal/types";

type Props = {
  users: StaffUser[];
  sessionUser: SessionUser | null;
  busyId: string | null;
  onUpdate: (
    staff: StaffUser,
    patch: {
      role?: StaffRole;
      active?: boolean;
    },
  ) => void;
  onResetMfa: (staff: StaffUser) => void;
  onPassword: (staff: StaffUser) => void;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((part) =>
        part[0]?.toUpperCase(),
      )
      .join("") || "BD"
  );
}

export function StaffUserList({
  users,
  sessionUser,
  busyId,
  onUpdate,
  onResetMfa,
  onPassword,
}: Props) {
  return (
    <section className="staff-list">
      {users.length === 0 ? (
        <div className="admin-empty">
          No hay cuentas que coincidan
          con la búsqueda.
        </div>
      ) : (
        users.map((staff) => {
          const isSelf =
            staff.id === sessionUser?.sub;

          return (
            <article
              className={
                "staff-card " +
                (!staff.active
                  ? "inactive"
                  : "")
              }
              key={staff.id}
            >
              <div className="staff-avatar">
                {initials(staff.name)}
              </div>

              <div className="staff-identity">
                <div>
                  <strong>
                    {staff.name}
                    {isSelf && <em>Tú</em>}
                  </strong>
                  <span>{staff.email}</span>

                  {staff.role ===
                    "ADMIN" && (
                    <span
                      className={
                        "staff-mfa-state " +
                        (staff.mfaEnabled
                          ? "enabled"
                          : "pending")
                      }
                    >
                      <ShieldCheck
                        size={12}
                      />
                      {staff.mfaEnabled
                        ? "MFA activo"
                        : "MFA pendiente"}
                    </span>
                  )}
                </div>

                <span
                  className={
                    "staff-active-badge " +
                    (staff.active
                      ? "active"
                      : "inactive")
                  }
                >
                  {staff.active
                    ? "Activo"
                    : "Desactivado"}
                </span>
              </div>

              <div className="staff-role-control">
                <span>Rol</span>
                <select
                  aria-label={`Rol de ${staff.name}`}
                  value={staff.role}
                  disabled={
                    isSelf ||
                    busyId === staff.id
                  }
                  onChange={(event) =>
                    onUpdate(staff, {
                      role: event.target
                        .value as StaffRole,
                    })
                  }
                >
                  <option value="ADMIN">
                    Administrador
                  </option>
                  <option value="KITCHEN">
                    Cocina
                  </option>
                  <option value="DELIVERY">
                    Entrega
                  </option>
                </select>
              </div>

              <div className="staff-card-actions">
                <button
                  type="button"
                  className="staff-password-button"
                  onClick={() =>
                    onPassword(staff)
                  }
                >
                  <KeyRound size={16} />
                  Contraseña
                </button>

                {staff.role === "ADMIN" &&
                  staff.mfaEnabled &&
                  !isSelf && (
                    <button
                      type="button"
                      className="staff-password-button"
                      onClick={() =>
                        onResetMfa(staff)
                      }
                      disabled={
                        busyId === staff.id
                      }
                    >
                      <ShieldCheck
                        size={16}
                      />
                      Restablecer MFA
                    </button>
                  )}

                <button
                  type="button"
                  className={
                    "staff-toggle-button " +
                    (staff.active
                      ? "deactivate"
                      : "activate")
                  }
                  disabled={
                    isSelf ||
                    busyId === staff.id
                  }
                  onClick={() =>
                    onUpdate(staff, {
                      active:
                        !staff.active,
                    })
                  }
                >
                  {staff.active ? (
                    <ToggleLeft
                      size={17}
                    />
                  ) : (
                    <ToggleRight
                      size={17}
                    />
                  )}
                  {busyId === staff.id
                    ? "Actualizando…"
                    : staff.active
                      ? "Desactivar"
                      : "Activar"}
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
