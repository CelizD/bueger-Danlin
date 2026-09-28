import {
  ArrowRight,
  Check,
  Copy,
} from "lucide-react";

type Props = {
  codes: string[];
  copied: boolean;
  error: string;
  onCopy: () => void;
  onFinish: () => void;
};

export function AdminRecoveryCodes({
  codes,
  copied,
  error,
  onCopy,
  onFinish,
}: Props) {
  return (
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
          Guárdalos fuera de este equipo en un
          lugar seguro.
        </p>
      </div>

      {error && (
        <div
          className="admin-login-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      <div className="admin-recovery-codes">
        {codes.map((code) => (
          <code key={code}>{code}</code>
        ))}
      </div>

      <button
        className="admin-mfa-copy"
        type="button"
        onClick={onCopy}
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
        onClick={onFinish}
      >
        <span>
          Ya guardé mis códigos
        </span>
        <ArrowRight size={18} />
      </button>
    </>
  );
}
