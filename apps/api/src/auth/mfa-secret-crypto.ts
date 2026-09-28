import { InternalServerErrorException } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function mfaEncryptionKey() {
  const encoded =
    process.env.MFA_ENCRYPTION_KEY?.trim() ??
    "";

  try {
    const key = Buffer.from(
      encoded,
      "base64url",
    );

    if (key.length !== 32) {
      throw new Error();
    }

    return key;
  } catch {
    throw new InternalServerErrorException(
      "MFA_ENCRYPTION_KEY debe ser una clave base64url de 32 bytes.",
    );
  }
}

export function encryptMfaSecret(
  secret: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    mfaEncryptionKey(),
    iv,
  );

  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString(
      "base64url",
    ),
  ].join(".");
}

export function decryptMfaSecret(
  value: string,
) {
  const [
    version,
    ivValue,
    tagValue,
    ciphertextValue,
  ] = value.split(".");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue
  ) {
    throw new InternalServerErrorException(
      "El secreto MFA almacenado es inválido.",
    );
  }

  try {
    const decipher =
      createDecipheriv(
        "aes-256-gcm",
        mfaEncryptionKey(),
        Buffer.from(
          ivValue,
          "base64url",
        ),
        {
          authTagLength: 16,
        },
      );

    decipher.setAuthTag(
      Buffer.from(
        tagValue,
        "base64url",
      ),
    );

    return Buffer.concat([
      decipher.update(
        Buffer.from(
          ciphertextValue,
          "base64url",
        ),
      ),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new InternalServerErrorException(
      "No fue posible descifrar el secreto MFA.",
    );
  }
}
