"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import {
  fetchAdminArco,
  updateAdminArco,
} from "@/features/staff/arco/api";
import type {
  AdminArcoRequest,
  ArcoRequestStatus,
} from "@/features/staff/arco/types";
import type { StaffSessionUser } from "@/features/staff/types";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

const STATUS_LABELS: Record<
  ArcoRequestStatus,
  string
> = {
  IDENTITY_VERIFICATION_REQUIRED:
    "Verificación de identidad pendiente",
  IN_REVIEW:
    "En revisión",
  RESOLVED:
    "Resuelta",
  DENIED:
    "Denegada",
};

const RIGHT_LABELS = {
  ACCESS: "Acceso",
  RECTIFICATION: "Rectificación",
  CANCELLATION: "Cancelación",
  OPPOSITION: "Oposición",
} as const;

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        "America/Tijuana",
    },
  ).format(new Date(value));
}

export default function AdminArcoPage() {
  const [user, setUser] =
    useState<StaffSessionUser | null>(
      null,
    );
  const [requests, setRequests] =
    useState<AdminArcoRequest[]>([]);
  const [notes, setNotes] =
    useState<Record<string, string>>(
      {},
    );
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [updating, setUpdating] =
    useState("");
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await fetchAdminArco();

        if (!result.authorized) {
          window.location.replace(
            "/admin/login",
          );
          return;
        }

        setUser(result.user);
        setRequests(
          result.requests,
        );
        setNotes(
          Object.fromEntries(
            result.requests.map(
              (request) => [
                request.folio,
                request.adminNote ??
                  "",
              ],
            ),
          ),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las solicitudes ARCO.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function update(
    request: AdminArcoRequest,
    input: {
      status?: ArcoRequestStatus;
      identityVerified?: boolean;
      adminNote?: string;
    },
    message: string,
  ) {
    setUpdating(request.folio);
    setError("");
    setSuccess("");

    try {
      const updated =
        await updateAdminArco(
          request.folio,
          input,
        );

      setRequests((current) =>
        current.map((item) =>
          item.folio ===
          updated.folio
            ? updated
            : item,
        ),
      );

      setNotes((current) => ({
        ...current,
        [updated.folio]:
          updated.adminNote ?? "",
      }));

      setSuccess(message);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la solicitud ARCO.",
      );
    } finally {
      setUpdating("");
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">
          Cargando solicitudes ARCO…
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="arco"
        subtitle="Privacidad"
      />

      <section className="admin-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Protección de datos
            </p>
            <h1>
              Solicitudes ARCO
            </h1>
            <p>
              Revisa solicitudes,
              verifica identidad y
              registra su resolución.
            </p>
          </div>

          <button
            className="admin-refresh"
            type="button"
            disabled={refreshing}
            onClick={() =>
              void load(true)
            }
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "admin-spin"
                  : undefined
              }
            />
            Actualizar
          </button>
        </header>

        {error && (
          <div className="admin-error-banner">
            {error}
          </div>
        )}

        {success && (
          <div className="saturday-success">
            {success}
          </div>
        )}

        <section className="arco-admin-summary">
          <div>
            <span>
              Pendientes de identidad
            </span>
            <strong>
              {
                requests.filter(
                  (request) =>
                    request.status ===
                    "IDENTITY_VERIFICATION_REQUIRED",
                ).length
              }
            </strong>
          </div>
          <div>
            <span>
              En revisión
            </span>
            <strong>
              {
                requests.filter(
                  (request) =>
                    request.status ===
                    "IN_REVIEW",
                ).length
              }
            </strong>
          </div>
          <div>
            <span>
              Cerradas
            </span>
            <strong>
              {
                requests.filter(
                  (request) =>
                    request.status ===
                      "RESOLVED" ||
                    request.status ===
                      "DENIED",
                ).length
              }
            </strong>
          </div>
        </section>

        <section className="arco-admin-list">
          {requests.length === 0 ? (
            <div className="admin-empty">
              No hay solicitudes ARCO.
            </div>
          ) : (
            requests.map((request) => {
              const busy =
                updating ===
                request.folio;

              return (
                <article
                  className="arco-admin-card"
                  key={request.id}
                >
                  <header>
                    <div>
                      <p className="eyebrow">
                        {request.folio}
                      </p>
                      <h2>
                        {request.name}
                      </h2>
                      <span>
                        {request.email}
                        {request.phone
                          ? " · " +
                            request.phone
                          : ""}
                      </span>
                    </div>

                    <span
                      className={
                        "arco-status arco-status-" +
                        request.status
                          .toLowerCase()
                          .replaceAll(
                            "_",
                            "-",
                          )
                      }
                    >
                      {
                        STATUS_LABELS[
                          request.status
                        ]
                      }
                    </span>
                  </header>

                  <div className="arco-meta">
                    <span>
                      Recibida:{" "}
                      <strong>
                        {formatDate(
                          request.createdAt,
                        )}
                      </strong>
                    </span>
                    <span>
                      Identidad:{" "}
                      <strong>
                        {request.identityVerifiedAt
                          ? "Verificada"
                          : "Pendiente"}
                      </strong>
                    </span>
                  </div>

                  <div className="arco-right-tags">
                    {request.rights.map(
                      (right) => (
                        <span key={right}>
                          {
                            RIGHT_LABELS[
                              right
                            ]
                          }
                        </span>
                      ),
                    )}
                  </div>

                  <section>
                    <strong>
                      Solicitud
                    </strong>
                    <p>
                      {request.description}
                    </p>
                  </section>

                  {request.locatorInfo && (
                    <section>
                      <strong>
                        Datos para localizar
                      </strong>
                      <p>
                        {
                          request.locatorInfo
                        }
                      </p>
                    </section>
                  )}

                  {request.rectificationDetails && (
                    <section>
                      <strong>
                        Rectificación solicitada
                      </strong>
                      <p>
                        {
                          request.rectificationDetails
                        }
                      </p>
                    </section>
                  )}

                  {request.cancellationReason && (
                    <section>
                      <strong>
                        Motivo de cancelación
                      </strong>
                      <p>
                        {
                          request.cancellationReason
                        }
                      </p>
                    </section>
                  )}

                  {request.oppositionReason && (
                    <section>
                      <strong>
                        Motivo de oposición
                      </strong>
                      <p>
                        {
                          request.oppositionReason
                        }
                      </p>
                    </section>
                  )}

                  <label className="arco-admin-note">
                    <span>
                      Nota interna
                    </span>
                    <textarea
                      maxLength={2000}
                      value={
                        notes[
                          request.folio
                        ] ?? ""
                      }
                      onChange={(event) =>
                        setNotes(
                          (current) => ({
                            ...current,
                            [request.folio]:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <div className="arco-admin-actions">
                    {!request.identityVerifiedAt && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void update(
                            request,
                            {
                              identityVerified:
                                true,
                              status:
                                "IN_REVIEW",
                            },
                            "Identidad marcada como verificada.",
                          )
                        }
                      >
                        <ShieldCheck
                          size={16}
                        />
                        Verificar identidad
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void update(
                          request,
                          {
                            adminNote:
                              notes[
                                request
                                  .folio
                              ] ?? "",
                          },
                          "Nota interna guardada.",
                        )
                      }
                    >
                      <Clock3
                        size={16}
                      />
                      Guardar nota
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void update(
                          request,
                          {
                            status:
                              "RESOLVED",
                            adminNote:
                              notes[
                                request
                                  .folio
                              ] ?? "",
                          },
                          "Solicitud marcada como resuelta.",
                        )
                      }
                    >
                      <CheckCircle2
                        size={16}
                      />
                      Resolver
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void update(
                          request,
                          {
                            status:
                              "DENIED",
                            adminNote:
                              notes[
                                request
                                  .folio
                              ] ?? "",
                          },
                          "Solicitud marcada como denegada.",
                        )
                      }
                    >
                      <XCircle
                        size={16}
                      />
                      Denegar
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>
    </main>
  );
}
