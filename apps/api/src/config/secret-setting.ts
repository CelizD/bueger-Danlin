import { readFileSync } from "node:fs";

export function readSetting(name: string) {
  const direct = process.env[name]?.trim();

  if (direct) {
    return direct;
  }

  const file = process.env[`${name}_FILE`]?.trim();

  if (!file) {
    return undefined;
  }

  try {
    const value = readFileSync(file, "utf8").trim();
    return value || undefined;
  } catch {
    throw new Error(`${name}_FILE could not be read`);
  }
}

export function requireSetting(name: string) {
  const value = readSetting(name);

  if (!value) {
    throw new Error(
      `${name} or ${name}_FILE is required`,
    );
  }

  return value;
}
