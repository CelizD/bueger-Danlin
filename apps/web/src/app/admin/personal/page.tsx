"use client";

import {
  Boxes,
  BarChart3,
  CalendarDays,
  ChefHat,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Truck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

type SessionUser = {
  sub: string;
  name: string;
  email: string;
  role: StaffRole;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  KITCHEN: "Cocina",
  DELIVERY: "Entrega",
};

const ROLE_DESCRIPTIONS: Record<
  StaffRole,
  { title: string; description: string; permissions: string[] }
> = {
  ADMIN: {
    title: "Administrador",
    description: "Control completo de la operación.",
    permissions: [
      "Ver Dashboard de ventas",
      "Ver todos los pedidos",
      "Operar Cocina y Entrega",
      "Administrar sábados",
      "Crear y administrar personal",
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

export default function StaffPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | StaffRole>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<StaffRole>("KITCHEN");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    try {
      const me = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (me.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      const meData = await me.json();

      if (!me.ok || meData.user.role !== "ADMIN") {
        window.location.replace("/admin/login");
        return;
      }

      setSessionUser(meData.user);

      const response = await fetch(`${API_URL}/admin/staff`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las cuentas del personal.");
      }

      setUsers(await response.json());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el personal.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((staff) => {
      const matchesRole =
        roleFilter === "ALL" || staff.role === roleFilter;
      const matchesQuery =
        !normalized ||
        staff.name.toLowerCase().includes(normalized) ||
        staff.email.toLowerCase().includes(normalized);

      return matchesRole && matchesQuery;
    });
  }, [users, query, roleFilter]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((staff) => staff.active).length,
      admins: users.filter((staff) => staff.role === "ADMIN" && staff.active)
        .length,
    }),
    [users],
  );

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/staff`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim(),
          role: createRole,
          password: createPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo crear la cuenta.");
      }

      setCreateName("");
      setCreateEmail("");
      setCreateRole("KITCHEN");
      setCreatePassword("");
      setCreateOpen(false);
      setSuccess(`Cuenta creada para ${data.name}.`);
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(
    staff: StaffUser,
    patch: Partial<Pick<StaffUser, "role" | "active">>,
  ) {
    setBusyId(staff.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/admin/staff/${encodeURIComponent(staff.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo actualizar la cuenta.");
      }

      setSuccess(
        patch.active !== undefined
          ? patch.active
            ? `${data.name} fue activado.`
            : `${data.name} fue desactivado.`
          : `Rol de ${data.name} actualizado.`,
      );
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la cuenta.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetUser) return;

    if (resetPassword !== resetPasswordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setResetting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/admin/staff/${encodeURIComponent(resetUser.id)}/password`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: resetPassword }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo cambiar la contraseña.");
      }

      const changedSelf = resetUser.id === sessionUser?.sub;
      const changedName = resetUser.name;

      setResetUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");

      if (changedSelf) {
        window.location.replace("/admin/login");
        return;
      }

      setSuccess(
        `Contraseña de ${changedName} actualizada. Sus sesiones anteriores quedaron invalidadas.`,
      );
      await load();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setResetting(false);
    }
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/admin/login");
  }

  if (loading) {
    return <main className="admin-loading">Cargando personal…</main>;
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">BD</div>
            <div>
              <strong>Burger Danlin</strong>
              <span>Operaciones</span>
            </div>
          </div>

          <nav className="admin-nav">
            <a href="/admin/dashboard">
              <BarChart3 size={18} strokeWidth={1.8} />
              Dashboard
            </a>
            <a href="/admin/pedidos">
              <ShoppingBag size={18} strokeWidth={1.8} />
              Pedidos
            </a>
            <a href="/admin/cocina">
              <ChefHat size={18} strokeWidth={1.8} />
              Cocina
            </a>
            <a href="/admin/entrega">
              <Truck size={18} strokeWidth={1.8} />
              Entrega
            </a>
            <a href="/admin/sabados">
              <CalendarDays size={18} strokeWidth={1.8} />
              Sábados
            </a>
            <a href="/admin/inventario">
              <Boxes size={18} strokeWidth={1.8} />
              Inventario
            </a>
            <a className="active" href="/admin/personal">
              <Users size={18} strokeWidth={1.8} />
              Personal
            </a>
          </nav>
        </div>

        <div className="admin-sidebar-user">
          <div>
            <strong>{sessionUser?.name}</strong>
            <span>{sessionUser?.email}</span>
          </div>
          <button type="button" onClick={logout} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="admin-content staff-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Accesos y permisos</p>
            <h1>Personal</h1>
            <p>
              Crea cuentas individuales y controla qué parte de la operación
              puede usar cada persona.
            </p>
          </div>

          <div className="staff-header-actions">
            <button
              className="admin-refresh"
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "admin-spin" : undefined}
              />
              Actualizar
            </button>
            <button
              className="staff-create-button"
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setCreateOpen(true);
              }}
            >
              <UserPlus size={17} />
              Nueva cuenta
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner">{error}</div>}
        {success && <div className="saturday-success">{success}</div>}

        <section className="staff-metrics">
          <article>
            <Users size={19} />
            <span>Cuentas</span>
            <strong>{counts.total}</strong>
          </article>
          <article>
            <ToggleRight size={19} />
            <span>Activas</span>
            <strong>{counts.active}</strong>
          </article>
          <article>
            <Shield size={19} />
            <span>Administradores activos</span>
            <strong>{counts.admins}</strong>
          </article>
        </section>

        {createOpen && (
          <section className="staff-form-card">
            <div className="staff-form-head">
              <div>
                <p className="admin-kicker">Nuevo acceso</p>
                <h2>Crear cuenta</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Cerrar formulario"
              >
                <X size={19} />
              </button>
            </div>

            <form className="staff-create-form" onSubmit={createUser}>
              <label>
                <span>Nombre</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Nombre del empleado"
                />
              </label>

              <label>
                <span>Correo</span>
                <div className="staff-input-icon">
                  <Mail size={16} />
                  <input
                    required
                    type="email"
                    maxLength={160}
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    placeholder="cocina@ejemplo.com"
                  />
                </div>
              </label>

              <label>
                <span>Rol</span>
                <select
                  value={createRole}
                  onChange={(event) =>
                    setCreateRole(event.target.value as StaffRole)
                  }
                >
                  <option value="KITCHEN">Cocina</option>
                  <option value="DELIVERY">Entrega</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>

              <label>
                <span>Contraseña temporal</span>
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  placeholder="Mínimo 12 caracteres"
                  autoComplete="new-password"
                />
              </label>

              <div className="staff-form-note">
                La contraseña se guarda con <strong>Argon2id</strong>. Cada
                persona debe tener su propia cuenta; no compartas un acceso
                entre Cocina y Entrega.
              </div>

              <div className="staff-form-actions">
                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="staff-primary-button"
                  disabled={creating}
                >
                  <Plus size={16} />
                  {creating ? "Creando…" : "Crear cuenta"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="staff-toolbar">
          <div className="admin-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre o correo"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "ALL" | StaffRole)
            }
          >
            <option value="ALL">Todos los roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="KITCHEN">Cocina</option>
            <option value="DELIVERY">Entrega</option>
          </select>
        </section>

        <section className="staff-list">
          {filteredUsers.length === 0 ? (
            <div className="admin-empty">
              No hay cuentas que coincidan con la búsqueda.
            </div>
          ) : (
            filteredUsers.map((staff) => {
              const isSelf = staff.id === sessionUser?.sub;

              return (
                <article
                  className={
                    "staff-card " + (!staff.active ? "inactive" : "")
                  }
                  key={staff.id}
                >
                  <div className="staff-avatar">
                    {staff.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "BD"}
                  </div>

                  <div className="staff-identity">
                    <div>
                      <strong>
                        {staff.name}
                        {isSelf && <em>Tú</em>}
                      </strong>
                      <span>{staff.email}</span>
                    </div>
                    <span
                      className={
                        "staff-active-badge " +
                        (staff.active ? "active" : "inactive")
                      }
                    >
                      {staff.active ? "Activo" : "Desactivado"}
                    </span>
                  </div>

                  <div className="staff-role-control">
                    <span>Rol</span>
                    <select
                      value={staff.role}
                      disabled={isSelf || busyId === staff.id}
                      onChange={(event) =>
                        void updateUser(staff, {
                          role: event.target.value as StaffRole,
                        })
                      }
                    >
                      <option value="ADMIN">Administrador</option>
                      <option value="KITCHEN">Cocina</option>
                      <option value="DELIVERY">Entrega</option>
                    </select>
                  </div>

                  <div className="staff-card-actions">
                    <button
                      type="button"
                      className="staff-password-button"
                      onClick={() => {
                        setResetPassword("");
                        setResetPasswordConfirm("");
                        setError("");
                        setSuccess("");
                        setResetUser(staff);
                      }}
                    >
                      <KeyRound size={16} />
                      Contraseña
                    </button>

                    <button
                      type="button"
                      className={
                        "staff-toggle-button " +
                        (staff.active ? "deactivate" : "activate")
                      }
                      disabled={isSelf || busyId === staff.id}
                      onClick={() =>
                        void updateUser(staff, { active: !staff.active })
                      }
                    >
                      {staff.active ? (
                        <ToggleLeft size={17} />
                      ) : (
                        <ToggleRight size={17} />
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

        <section className="staff-permissions">
          <div className="staff-section-title">
            <div>
              <p className="admin-kicker">Autorización</p>
              <h2>Roles y permisos</h2>
            </div>
            <UserCog size={21} />
          </div>

          <div className="staff-permission-grid">
            {(Object.keys(ROLE_DESCRIPTIONS) as StaffRole[]).map((role) => {
              const detail = ROLE_DESCRIPTIONS[role];

              return (
                <article key={role}>
                  <div className="staff-permission-head">
                    <span className={"staff-role-icon role-" + role.toLowerCase()}>
                      {role === "ADMIN" ? (
                        <Shield size={18} />
                      ) : role === "KITCHEN" ? (
                        <ChefHat size={18} />
                      ) : (
                        <Truck size={18} />
                      )}
                    </span>
                    <div>
                      <strong>{detail.title}</strong>
                      <span>{detail.description}</span>
                    </div>
                  </div>

                  <ul>
                    {detail.permissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {resetUser && (
        <div className="staff-modal-overlay" role="dialog" aria-modal="true">
          <div className="staff-password-modal">
            <div className="staff-form-head">
              <div>
                <p className="admin-kicker">Seguridad de cuenta</p>
                <h2>Cambiar contraseña</h2>
                <p>
                  {resetUser.name} · {ROLE_LABELS[resetUser.role]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetUser(null)}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submitPasswordReset}>
              <label>
                <span>Nueva contraseña</span>
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 12 caracteres"
                />
              </label>

              <label>
                <span>Confirmar contraseña</span>
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  value={resetPasswordConfirm}
                  onChange={(event) =>
                    setResetPasswordConfirm(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                />
              </label>

              <p className="staff-password-warning">
                Al guardar, las sesiones anteriores de esta cuenta dejarán de
                ser válidas.
              </p>

              <button
                className="staff-primary-button"
                type="submit"
                disabled={resetting}
              >
                <KeyRound size={16} />
                {resetting ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
