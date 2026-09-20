"use client";

import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api/v1";

type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

type MfaSetup = {
  secret: string;
  otpauthUri: string;
  issuer: string;
  accountName: string;
};

function routeForRole(role: StaffRole) {
  if (role === "KITCHEN") return "/admin/cocina";
  if (role === "DELIVERY") return "/admin/entrega";
  return "/admin/dashboard";
}

export default function AdminLoginPage() {
  const [stage, setStage] = useState<
    "password" | "setup" | "verify" | "recovery"
  >("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] =
    useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] =
    useState<string[]>([]);
  const [authenticatedRole, setAuthenticatedRole] =
    useState<StaffRole>("ADMIN");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            credentials: "include",
          },
        );

        if (response.ok) {
          const data = await response.json();
          window.location.replace(
            routeForRole(data.user.role),
          );
          return;
        }
      } finally {
        setChecking(false);
      }
    }

    void checkSession();
  }, []);

  async function loadMfaSetup() {
    const response = await fetch(
      `${API_URL}/auth/mfa/setup`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(" ")
        : data.message;
      throw new Error(
        message ||
          "No fue posible preparar el segundo factor.",
      );
    }

    setMfaSetup(data as MfaSetup);
    setMfaCode("");
    setStage("setup");
  }

  async function submitPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(
          message ||
            "No fue posible iniciar sesión.",
        );
      }

      if (data.mfaRequired) {
        setPassword("");

        if (data.setupRequired) {
          await loadMfaSetup();
        } else {
          setMfaCode("");
          setStage("verify");
        }

        return;
      }

      window.location.replace(
        routeForRole(data.user.role),
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/mfa/verify`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            code: mfaCode.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(
          message ||
            "No fue posible verificar el código.",
        );
      }

      setAuthenticatedRole(data.user.role);

      if (
        Array.isArray(data.recoveryCodes) &&
        data.recoveryCodes.length > 0
      ) {
        setRecoveryCodes(data.recoveryCodes);
        setStage("recovery");
        return;
      }

      window.location.replace(
        routeForRole(data.user.role),
      );
    } catch (mfaError) {
      setError(
        mfaError instanceof Error
          ? mfaError.message
          : "No fue posible verificar el código.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(
        recoveryCodes.join("\n"),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "No se pudieron copiar. Guárdalos manualmente.",
      );
    }
  }

  if (checking) {
    return (
      <main className="admin-login-shell">
        <div className="admin-login-loading" role="status" aria-live="polite">
          Verificando sesión…
        </div>
      </main>
    );
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-brand">
        <div className="admin-login-brandmark">
          BD
        </div>
        <div className="admin-login-copy">
          <p className="admin-kicker">
            Burger Danlin · Operaciones
          </p>
          <h1>Tu operación, en orden.</h1>
          <p>
            Controla pedidos, cocina y entregas
            desde un solo lugar. El acceso está
            reservado al personal autorizado.
          </p>
        </div>

        <div className="admin-security-note">
          <ShieldCheck
            size={18}
            strokeWidth={1.8}
          />
          <span>
            Sesión protegida · Argon2id · MFA
            obligatorio para administradores
          </span>
        </div>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-card">
          {stage === "password" && (
            <>
              <div className="admin-login-card-head">
                <p className="admin-kicker">
                  Acceso de personal
                </p>
                <h2>Iniciar sesión</h2>
                <p>
                  Usa tu cuenta de personal para
                  continuar.
                </p>
              </div>

              {error && (
                <div className="admin-login-error" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <form
                onSubmit={submitPassword}
                className="admin-login-form"
              >
                <label>
                  <span>Correo</span>
                  <div className="admin-input-wrap">
                    <Mail
                      size={18}
                      strokeWidth={1.8}
                    />
                    <input
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="admin@ejemplo.com"
                    />
                  </div>
                </label>

                <label>
                  <span>Contraseña</span>
                  <div className="admin-input-wrap">
                    <LockKeyhole
                      size={18}
                      strokeWidth={1.8}
                    />
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value,
                        )
                      }
                      placeholder="Tu contraseña"
                    />
                  </div>
                </label>

                <button
                  className="admin-login-button"
                  type="submit"
                  disabled={submitting}
                >
                  <span>
                    {submitting
                      ? "Validando…"
                      : "Entrar al panel"}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}

          {stage === "setup" && mfaSetup && (
            <>
              <div className="admin-login-card-head">
                <p className="admin-kicker">
                  Seguridad obligatoria
                </p>
                <h2>Configura tu MFA</h2>
                <p>
                  Escanea el QR con tu aplicación
                  de autenticación y escribe el
                  código de 6 dígitos.
                </p>
              </div>

              {error && (
                <div className="admin-login-error" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <div className="admin-mfa-qr">
                <QRCodeSVG
                  value={mfaSetup.otpauthUri}
                  size={184}
                  level="M"
                />
              </div>

              <div className="admin-mfa-secret">
                <span>Clave manual</span>
                <code>{mfaSetup.secret}</code>
              </div>

              <form
                className="admin-login-form"
                onSubmit={submitMfa}
              >
                <label>
                  <span>
                    Código del autenticador
                  </span>
                  <div className="admin-input-wrap">
                    <Smartphone
                      size={18}
                      strokeWidth={1.8}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                      maxLength={6}
                      value={mfaCode}
                      onChange={(event) =>
                        setMfaCode(
                          event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        )
                      }
                      placeholder="000000"
                    />
                  </div>
                </label>

                <button
                  className="admin-login-button"
                  type="submit"
                  disabled={submitting}
                >
                  <span>
                    {submitting
                      ? "Verificando…"
                      : "Activar MFA"}
                  </span>
                  <ShieldCheck size={18} />
                </button>
              </form>
            </>
          )}

          {stage === "verify" && (
            <>
              <div className="admin-login-card-head">
                <p className="admin-kicker">
                  Segundo factor
                </p>
                <h2>Verifica tu identidad</h2>
                <p>
                  Escribe el código actual de tu
                  aplicación de autenticación o un
                  código de recuperación.
                </p>
              </div>

              {error && (
                <div className="admin-login-error" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <form
                className="admin-login-form"
                onSubmit={submitMfa}
              >
                <label>
                  <span>
                    Código MFA o recuperación
                  </span>
                  <div className="admin-input-wrap">
                    <KeyRound
                      size={18}
                      strokeWidth={1.8}
                    />
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      required
                      maxLength={11}
                      value={mfaCode}
                      onChange={(event) =>
                        setMfaCode(
                          event.target.value
                            .toUpperCase()
                            .replace(
                              /[^A-F0-9-]/g,
                              "",
                            ),
                        )
                      }
                      placeholder="000000"
                    />
                  </div>
                </label>

                <button
                  className="admin-login-button"
                  type="submit"
                  disabled={submitting}
                >
                  <span>
                    {submitting
                      ? "Verificando…"
                      : "Verificar y entrar"}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}

          {stage === "recovery" && (
            <>
              <div className="admin-login-card-head">
                <p className="admin-kicker">
                  MFA activado
                </p>
                <h2>
                  Guarda tus códigos de recuperación
                </h2>
                <p>
                  Cada código funciona una sola vez.
                  Guárdalos fuera de este equipo en
                  un lugar seguro.
                </p>
              </div>

              {error && (
                <div className="admin-login-error" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <div className="admin-recovery-codes">
                {recoveryCodes.map((code) => (
                  <code key={code}>{code}</code>
                ))}
              </div>

              <button
                className="admin-mfa-copy"
                type="button"
                onClick={copyRecoveryCodes}
              >
                {copied ? (
                  <Check size={17} />
                ) : (
                  <Copy size={17} />
                )}
                {copied
                  ? "Copiados"
                  : "Copiar códigos"}
              </button>

              <button
                className="admin-login-button"
                type="button"
                onClick={() =>
                  window.location.replace(
                    routeForRole(
                      authenticatedRole,
                    ),
                  )
                }
              >
                <span>
                  Ya guardé mis códigos
                </span>
                <ArrowRight size={18} />
              </button>
            </>
          )}

          <p className="admin-login-footnote">
            La sesión se guarda en una cookie
            HttpOnly; el navegador no expone el
            token al JavaScript de la página.
          </p>
        </div>
      </section>
    </main>
  );
}
