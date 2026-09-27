import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import {
  ARGON2_OPTIONS,
  hashStaffPassword,
  verifyStaffPassword,
} from "../apps/api/src/auth/password-security.js";

function envInteger(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );

  return sorted[index]!;
}

function summary(values: number[]) {
  return {
    minMs: Math.round(Math.min(...values) * 10) / 10,
    p50Ms: Math.round(percentile(values, 50) * 10) / 10,
    p95Ms: Math.round(percentile(values, 95) * 10) / 10,
    maxMs: Math.round(Math.max(...values) * 10) / 10,
    averageMs:
      Math.round(
        (values.reduce((sum, value) => sum + value, 0) /
          values.length) *
          10,
      ) / 10,
  };
}

async function timed<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await operation();

  return {
    result,
    durationMs: performance.now() - startedAt,
  };
}

async function main() {
  const runs = envInteger("ARGON2_BENCHMARK_RUNS", 12);
  const warmups = envInteger("ARGON2_BENCHMARK_WARMUPS", 2);

  const benchmarkPassword = `Benchmark-${randomBytes(24).toString("base64url")}`;

  for (let index = 0; index < warmups; index += 1) {
    await hashStaffPassword(benchmarkPassword);
  }

  const hashTimes: number[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < runs; index += 1) {
    const measurement = await timed(() =>
      hashStaffPassword(benchmarkPassword),
    );

    hashTimes.push(measurement.durationMs);
    hashes.push(measurement.result);
  }

  const verifyTimes: number[] = [];

  for (const hash of hashes) {
    const measurement = await timed(() =>
      verifyStaffPassword(hash, benchmarkPassword),
    );

    if (!measurement.result) {
      throw new Error("Argon2 benchmark verification failed");
    }

    verifyTimes.push(measurement.durationMs);
  }

  const report = {
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus()[0]?.model ?? "unknown",
      logicalCpus: cpus().length,
    },
    parameters: {
      algorithm: "argon2id",
      memoryCostKiB: ARGON2_OPTIONS.memoryCost,
      timeCost: ARGON2_OPTIONS.timeCost,
      parallelism: ARGON2_OPTIONS.parallelism,
    },
    samples: {
      warmups,
      runs,
    },
    hash: summary(hashTimes),
    verify: summary(verifyTimes),
  };

  console.log(JSON.stringify(report, null, 2));
}

void main();
