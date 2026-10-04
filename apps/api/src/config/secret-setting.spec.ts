import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  readSetting,
  requireSetting,
} from "./secret-setting.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});

function secretFile(value: string) {
  const dir = mkdtempSync(
    join(tmpdir(), "burger-secret-"),
  );
  tempDirs.push(dir);

  const file = join(dir, "value");
  writeFileSync(file, value, {
    encoding: "utf8",
    mode: 0o600,
  });

  return file;
}

describe("secret settings", () => {
  it("prefiere el valor directo en desarrollo", () => {
    vi.stubEnv("TEST_SECRET", "direct");
    vi.stubEnv(
      "TEST_SECRET_FILE",
      secretFile("file"),
    );

    expect(readSetting("TEST_SECRET")).toBe(
      "direct",
    );
  });

  it("lee un secreto desde *_FILE cuando no hay valor directo", () => {
    vi.stubEnv("TEST_SECRET", "");
    vi.stubEnv(
      "TEST_SECRET_FILE",
      secretFile("from-file\n"),
    );

    expect(readSetting("TEST_SECRET")).toBe(
      "from-file",
    );
  });

  it("falla si se configura un archivo inexistente", () => {
    vi.stubEnv(
      "TEST_SECRET_FILE",
      "/tmp/does-not-exist-burger-secret",
    );

    expect(() =>
      readSetting("TEST_SECRET"),
    ).toThrow(
      "TEST_SECRET_FILE could not be read",
    );
  });

  it("requireSetting exige valor directo o archivo", () => {
    expect(() =>
      requireSetting("TEST_SECRET"),
    ).toThrow(
      "TEST_SECRET or TEST_SECRET_FILE is required",
    );
  });
});
