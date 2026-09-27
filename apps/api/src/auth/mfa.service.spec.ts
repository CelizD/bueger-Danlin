import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { MfaService } from "./mfa.service.js";
import type { StaffSessionService } from "./staff-session.service.js";

const originalEncryptionKey = process.env.MFA_ENCRYPTION_KEY;

afterEach(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.MFA_ENCRYPTION_KEY;
  } else {
    process.env.MFA_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

function createService() {
  process.env.MFA_ENCRYPTION_KEY =
    randomBytes(32).toString("base64url");

  const service = new MfaService(
    {} as PrismaService,
    {} as JwtService,
    {} as StaffSessionService,
  );

  return service as unknown as {
    encryptSecret(secret: string): string;
    decryptSecret(value: string): string;
  };
}

describe("MfaService secret encryption", () => {
  it("cifra y descifra un secreto MFA con AES-256-GCM", () => {
    const service = createService();
    const secret = "JBSWY3DPEHPK3PXP";

    const encrypted = service.encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(encrypted.split(".")).toHaveLength(4);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });

  it("rechaza un authentication tag GCM truncado", () => {
    const service = createService();
    const encrypted = service.encryptSecret(
      "JBSWY3DPEHPK3PXP",
    );
    const [version, iv, tag, ciphertext] =
      encrypted.split(".");

    const decodedTag = Buffer.from(tag!, "base64url");
    const truncatedTag = decodedTag
      .subarray(0, decodedTag.length - 1)
      .toString("base64url");

    const tampered = [
      version,
      iv,
      truncatedTag,
      ciphertext,
    ].join(".");

    expect(() => service.decryptSecret(tampered)).toThrow(
      "No fue posible descifrar el secreto MFA.",
    );
  });
});
