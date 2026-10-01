"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  checkStaffSession,
  fetchMfaSetup,
  submitStaffPassword,
  verifyStaffMfa,
} from "./api";
import { routeForRole } from "./routing";
import type {
  LoginStage,
  MfaSetup,
  StaffRole,
} from "./types";

export function useAdminLogin() {
  const [stage, setStage] =
    useState<LoginStage>("password");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [mfaCode, setMfaCode] =
    useState("");
  const [mfaSetup, setMfaSetup] =
    useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] =
    useState<string[]>([]);
  const [
    authenticatedRole,
    setAuthenticatedRole,
  ] = useState<StaffRole>("ADMIN");
  const [copied, setCopied] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [checking, setChecking] =
    useState(true);
  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const role =
          await checkStaffSession();

        if (!cancelled && role) {
          window.location.replace(
            routeForRole(role),
          );
          return;
        }
      } catch (checkError) {
        if (!cancelled) {
          setError(
            checkError instanceof Error
              ? checkError.message
              : "No se pudo validar la sesión.",
          );
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMfaSetup() {
    const setup = await fetchMfaSetup();
    setMfaSetup(setup);
    setMfaCode("");
    setStage("setup");
  }

  async function submitPassword(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data =
        await submitStaffPassword(
          email,
          password,
        );

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

      if (data.user?.role) {
        window.location.replace(
          routeForRole(
            data.user.role,
          ),
        );
      }
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
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data =
        await verifyStaffMfa(
          mfaCode,
        );

      setAuthenticatedRole(
        data.user.role,
      );

      if (
        Array.isArray(
          data.recoveryCodes,
        ) &&
        data.recoveryCodes.length >
          0
      ) {
        setRecoveryCodes(
          data.recoveryCodes,
        );
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
      window.setTimeout(
        () => setCopied(false),
        1800,
      );
    } catch {
      setError(
        "No se pudieron copiar. Guárdalos manualmente.",
      );
    }
  }

  function finishRecovery() {
    window.location.replace(
      routeForRole(
        authenticatedRole,
      ),
    );
  }

  return {
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
  };
}
