import * as argon2 from "argon2";

export const STAFF_PASSWORD_MIN_LENGTH = 12;
export const STAFF_PASSWORD_MAX_LENGTH = 128;

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "12345678901234",
  "123456789012345",
  "password123",
  "password1234",
  "password12345",
  "password123456",
  "passwordpassword",
  "qwerty123456",
  "qwertyuiop123",
  "abc123456789",
  "letmein123456",
  "welcome12345",
  "welcome123456",
  "admin12345678",
  "administrator1",
  "adminadmin123",
  "changeme12345",
  "defaultpassword",
  "iloveyou12345",
  "monkey123456",
  "dragon123456",
  "football12345",
  "baseball12345",
  "sunshine12345",
  "princess12345",
  "superman12345",
  "master123456",
  "trustno112345",
  "burgerdanlin",
  "burgerdanlin123",
  "burgerdanlin1234",
  "danlin123456",
]);

function normalizedForBlocklist(password: string) {
  return password
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function compactForBlocklist(password: string) {
  return normalizedForBlocklist(password).replace(/[\s._-]+/g, "");
}

export function staffPasswordPolicyIssue(
  password: string,
): string | undefined {
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${STAFF_PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (password.length > STAFF_PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede superar ${STAFF_PASSWORD_MAX_LENGTH} caracteres.`;
  }

  const normalized = normalizedForBlocklist(password);
  const compact = compactForBlocklist(password);

  if (
    COMMON_PASSWORDS.has(normalized) ||
    COMMON_PASSWORDS.has(compact) ||
    /^(.)\1{11,}$/u.test(normalized)
  ) {
    return "La contraseña es demasiado común. Usa una frase larga y única que no reutilices en otros servicios.";
  }

  return undefined;
}

export async function hashStaffPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyStaffPassword(
  passwordHash: string,
  password: string,
) {
  return argon2.verify(passwordHash, password);
}
