import { UnauthorizedException } from "@nestjs/common";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;
const BASE32_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(
  input: Buffer,
) {
  let bits = "";
  let output = "";

  for (const byte of input) {
    bits += byte
      .toString(2)
      .padStart(8, "0");
  }

  for (
    let index = 0;
    index < bits.length;
    index += 5
  ) {
    const chunk = bits
      .slice(index, index + 5)
      .padEnd(5, "0");

    output +=
      BASE32_ALPHABET[
        Number.parseInt(chunk, 2)
      ];
  }

  return output;
}

function decodeBase32(input: string) {
  const normalized = input
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");

  let bits = "";

  for (const character of normalized) {
    const value =
      BASE32_ALPHABET.indexOf(
        character,
      );

    if (value < 0) {
      throw new UnauthorizedException(
        "Secreto MFA inválido.",
      );
    }

    bits += value
      .toString(2)
      .padStart(5, "0");
  }

  const bytes: number[] = [];

  for (
    let index = 0;
    index + 8 <= bits.length;
    index += 8
  ) {
    bytes.push(
      Number.parseInt(
        bits.slice(
          index,
          index + 8,
        ),
        2,
      ),
    );
  }

  return Buffer.from(bytes);
}

function totpAt(
  secret: string,
  step: number,
) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(
    BigInt(step),
  );

  const digest = createHmac(
    "sha1",
    decodeBase32(secret),
  )
    .update(counter)
    .digest();

  const offset =
    digest[digest.length - 1]! &
    0x0f;

  const binary =
    ((digest[offset]! & 0x7f) <<
      24) |
    ((digest[offset + 1]! & 0xff) <<
      16) |
    ((digest[offset + 2]! & 0xff) <<
      8) |
    (digest[offset + 3]! & 0xff);

  return String(
    binary %
      10 ** TOTP_DIGITS,
  ).padStart(TOTP_DIGITS, "0");
}

export function findValidTotpStep(
  code: string,
  secret: string,
  lastUsedStep: number | null,
) {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }

  const currentStep = Math.floor(
    Date.now() /
      1000 /
      TOTP_PERIOD_SECONDS,
  );

  for (const offset of [0, -1, 1]) {
    const step =
      currentStep + offset;

    if (
      lastUsedStep !== null &&
      step <= lastUsedStep
    ) {
      continue;
    }

    if (
      totpAt(secret, step) ===
      code
    ) {
      return step;
    }
  }

  return null;
}

export function normalizeRecoveryCode(
  code: string,
) {
  return code
    .toUpperCase()
    .replace(/[^A-F0-9]/g, "");
}

export function hashRecoveryCode(
  code: string,
) {
  return createHash("sha256")
    .update(
      normalizeRecoveryCode(code),
    )
    .digest("hex");
}

export function safeEqualHex(
  leftHex: string,
  rightHex: string,
) {
  if (
    !/^[a-f0-9]+$/i.test(
      leftHex,
    ) ||
    !/^[a-f0-9]+$/i.test(
      rightHex,
    )
  ) {
    return false;
  }

  const left = Buffer.from(
    leftHex,
    "hex",
  );
  const right = Buffer.from(
    rightHex,
    "hex",
  );

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

export function generateRecoveryCodes() {
  return Array.from(
    {
      length:
        RECOVERY_CODE_COUNT,
    },
    () => {
      const raw = randomBytes(5)
        .toString("hex")
        .toUpperCase();

      return (
        raw.slice(0, 5) +
        "-" +
        raw.slice(5)
      );
    },
  );
}
