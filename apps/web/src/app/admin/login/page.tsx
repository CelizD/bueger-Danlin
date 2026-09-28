"use client";

import { AdminLoginBrand } from "@/features/staff/components/admin-login-brand";
import { AdminMfaLogin } from "@/features/staff/components/admin-mfa-login";
import { AdminPasswordLogin } from "@/features/staff/components/admin-password-login";
import { AdminRecoveryCodes } from "@/features/staff/components/admin-recovery-codes";
import { useAdminLogin } from "@/features/staff/login/use-admin-login";

export default function AdminLoginPage() {
  const {
    stage,
    email,
    password,
    mfaCode,
    mfaSetup,
    recoveryCodes,
    copied,
    submitting,
    checking,
    error,
    setEmail,
    setPassword,
    setMfaCode,
    submitPassword,
    submitMfa,
    copyRecoveryCodes,
    finishRecovery,
  } = useAdminLogin();

  if (checking) {
    return (
      <main className="admin-login-shell">
        <div
          className="admin-login-loading"
          role="status"
          aria-live="polite"
        >
          Verificando sesión…
        </div>
      </main>
    );
  }

  return (
    <main className="admin-login-shell">
      <AdminLoginBrand />

      <section className="admin-login-panel">
        <div className="admin-login-card">
          {stage === "password" && (
            <AdminPasswordLogin
              email={email}
              password={password}
              submitting={submitting}
              error={error}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={submitPassword}
            />
          )}

          {stage === "setup" && mfaSetup && (
            <AdminMfaLogin
              setup={mfaSetup}
              verifyOnly={false}
              code={mfaCode}
              submitting={submitting}
              error={error}
              onCodeChange={setMfaCode}
              onSubmit={submitMfa}
            />
          )}

          {stage === "verify" && (
            <AdminMfaLogin
              setup={null}
              verifyOnly
              code={mfaCode}
              submitting={submitting}
              error={error}
              onCodeChange={setMfaCode}
              onSubmit={submitMfa}
            />
          )}

          {stage === "recovery" && (
            <AdminRecoveryCodes
              codes={recoveryCodes}
              copied={copied}
              error={error}
              onCopy={() => {
                void copyRecoveryCodes();
              }}
              onFinish={finishRecovery}
            />
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
