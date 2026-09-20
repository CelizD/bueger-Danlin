import { createHash } from "node:crypto";

export function credentialVersion(passwordHash: string) {
  return createHash("sha256")
    .update(passwordHash)
    .digest("base64url")
    .slice(0, 24);
}
