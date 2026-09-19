"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function routeForRole(role: "ADMIN" | "KITCHEN" | "DELIVERY") {
  if (role === "KITCHEN") return "/admin/cocina";
  if (role === "DELIVERY") return "/admin/entrega";
  return "/admin/pedidos";
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          window.location.replace(routeForRole(data.user.role));
          return;
        }
      } finally {
        setChecking(false);
      }
    }

    void checkSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No fue posible iniciar sesión.");
      }

      window.location.replace(routeForRole(data.user.role));
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

  if (checking) {
    return (
      <main className="admin-login-shell">
        <div className="admin-login-loading">Verificando sesión…</div>
      </main>
    );
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-brand">
        <div className="admin-login-brandmark">BD</div>
        <div className="admin-login-copy">
          <p className="admin-kicker">Burger Danlin · Operaciones</p>
          <h1>Tu operación, en orden.</h1>
          <p>
            Controla pedidos, cocina y entregas desde un solo lugar.
            El acceso está reservado al personal autorizado.
          </p>
        </div>

        <div className="admin-security-note">
          <ShieldCheck size={18} strokeWidth={1.8} />
          <span>Sesión protegida · Contraseñas con Argon2id</span>
        </div>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-card">
          <div className="admin-login-card-head">
            <p className="admin-kicker">Acceso de personal</p>
            <h2>Iniciar sesión</h2>
            <p>Usa tu cuenta administrativa para continuar.</p>
          </div>

          {error && <div className="admin-login-error">{error}</div>}

          <form onSubmit={submit} className="admin-login-form">
            <label>
              <span>Correo</span>
              <div className="admin-input-wrap">
                <Mail size={18} strokeWidth={1.8} />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@ejemplo.com"
                />
              </div>
            </label>

            <label>
              <span>Contraseña</span>
              <div className="admin-input-wrap">
                <LockKeyhole size={18} strokeWidth={1.8} />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                />
              </div>
            </label>

            <button
              className="admin-login-button"
              type="submit"
              disabled={submitting}
            >
              <span>{submitting ? "Validando…" : "Entrar al panel"}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="admin-login-footnote">
            La sesión se guarda en una cookie HttpOnly; el navegador no expone
            el token al JavaScript de la página.
          </p>
        </div>
      </section>
    </main>
  );
}
