import { describe, expect, it } from "vitest";
import {
  ARGON2_OPTIONS,
  hashStaffPassword,
  staffPasswordPolicyIssue,
  verifyStaffPassword,
} from "./password-security.js";

describe("staffPasswordPolicyIssue", () => {
  it("acepta una frase larga y no común", () => {
    expect(
      staffPasswordPolicyIssue(
        "Cactus-Nublado-47-Puente",
      ),
    ).toBeUndefined();
  });

  it.each([
    "password123",
    "PASSWORD123",
    "password-123",
    "burgerdanlin123",
    "aaaaaaaaaaaa",
    "111111111111",
  ])("rechaza contraseña común o trivial: %s", (password) => {
    expect(staffPasswordPolicyIssue(password)).toContain(
      "demasiado común",
    );
  });

  it("mantiene el mínimo de 12 caracteres", () => {
    expect(
      staffPasswordPolicyIssue("Corta-123"),
    ).toContain("al menos 12");
  });

  it("mantiene el máximo de 128 caracteres", () => {
    expect(
      staffPasswordPolicyIssue("x".repeat(129)),
    ).toContain("128");
  });
});

describe("Argon2id staff password hashing", () => {
  it("usa los parámetros esperados y verifica el hash", async () => {
    expect(ARGON2_OPTIONS).toMatchObject({
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const password = "Frase-Unica-Para-Test-2026";
    const hash = await hashStaffPassword(password);

    expect(hash).toContain("$argon2id$");
    await expect(
      verifyStaffPassword(hash, password),
    ).resolves.toBe(true);
    await expect(
      verifyStaffPassword(hash, "otra-contraseña"),
    ).resolves.toBe(false);
  });
});
