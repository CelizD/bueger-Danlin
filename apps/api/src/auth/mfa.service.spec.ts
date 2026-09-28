import { randomBytes } from "node:crypto";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
} from "./mfa-secret-crypto.js";

const originalEncryptionKey =
  process.env.MFA_ENCRYPTION_KEY;

afterEach(() => {
  if (
    originalEncryptionKey ===
    undefined
  ) {
    delete process.env
      .MFA_ENCRYPTION_KEY;
  } else {
    process.env.MFA_ENCRYPTION_KEY =
      originalEncryptionKey;
  }
});

function configureEncryptionKey() {
  process.env.MFA_ENCRYPTION_KEY =
    randomBytes(32).toString(
      "base64url",
    );
}

describe("MFA secret encryption", () => {
  it("cifra y descifra un secreto MFA con AES-256-GCM", () => {
    configureEncryptionKey();
    const secret =
      "JBSWY3DPEHPK3PXP";

    const encrypted =
      encryptMfaSecret(secret);

    expect(encrypted).not.toContain(
      secret,
    );
    expect(
      encrypted.split("."),
    ).toHaveLength(4);
    expect(
      decryptMfaSecret(encrypted),
    ).toBe(secret);
  });

  it("rechaza un authentication tag GCM truncado", () => {
    configureEncryptionKey();

    const encrypted =
      encryptMfaSecret(
        "JBSWY3DPEHPK3PXP",
      );

    const [
      version,
      iv,
      tag,
      ciphertext,
    ] = encrypted.split(".");

    const decodedTag = Buffer.from(
      tag!,
      "base64url",
    );

    const truncatedTag =
      decodedTag
        .subarray(
          0,
          decodedTag.length - 1,
        )
        .toString("base64url");

    const tampered = [
      version,
      iv,
      truncatedTag,
      ciphertext,
    ].join(".");

    expect(() =>
      decryptMfaSecret(tampered),
    ).toThrow(
      "No fue posible descifrar el secreto MFA.",
    );
  });
});
