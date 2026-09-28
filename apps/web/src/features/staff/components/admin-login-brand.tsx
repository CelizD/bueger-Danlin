import { ShieldCheck } from "lucide-react";

export function AdminLoginBrand() {
  return (
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
  );
}
