import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(process.cwd(), ".next", "static", "chunks");
const budgetPath = join(process.cwd(), "bundle-budget.json");

if (!existsSync(root)) {
  console.error("Bundle report requires a completed Next.js build.");
  console.error("Run: pnpm build");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stats = statSync(path);

    if (stats.isDirectory()) return walk(path);
    if (!name.endsWith(".js")) return [];

    const bytes = readFileSync(path);

    return [{
      path: relative(root, path).replaceAll("\\", "/"),
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
    }];
  });
}

function readBudget() {
  if (!existsSync(budgetPath)) return null;

  try {
    return JSON.parse(readFileSync(budgetPath, "utf8"));
  } catch (error) {
    console.error("Invalid bundle-budget.json:", error);
    process.exit(1);
  }
}

function positiveNumber(value, label) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`Invalid ${label}: expected a non-negative number.`);
    process.exit(1);
  }

  return parsed;
}

const chunks = walk(root).sort(
  (a, b) => b.gzipBytes - a.gzipBytes,
);

const totalRaw = chunks.reduce(
  (sum, chunk) => sum + chunk.rawBytes,
  0,
);
const totalGzip = chunks.reduce(
  (sum, chunk) => sum + chunk.gzipBytes,
  0,
);

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const maxObservedChunkKb = chunks.length > 0 ? kb(chunks[0].gzipBytes) : 0;
const totalObservedGzipKb = kb(totalGzip);

console.log("\nLargest JavaScript chunks (gzip):");
console.table(
  chunks.slice(0, 12).map((chunk) => ({
    chunk: chunk.path,
    "raw KB": kb(chunk.rawBytes),
    "gzip KB": kb(chunk.gzipBytes),
  })),
);

console.log(
  `Total static JS: ${kb(totalRaw)} KB raw / ${totalObservedGzipKb} KB gzip across ${chunks.length} chunks.`,
);

const config = readBudget();
const baseline = config?.baseline;
const configured = config?.budget;

if (baseline) {
  console.log(
    `Recorded baseline: ${baseline.maxChunkGzipKb} KB max chunk / ${baseline.totalStaticJsGzipKb} KB total gzip across ${baseline.chunkCount} chunks.`,
  );
}

const maxChunkKb = positiveNumber(
  process.env.BUNDLE_MAX_CHUNK_GZIP_KB ??
    configured?.maxChunkGzipKb ??
    0,
  "max chunk bundle budget",
);
const maxTotalKb = positiveNumber(
  process.env.BUNDLE_MAX_TOTAL_GZIP_KB ??
    configured?.totalStaticJsGzipKb ??
    0,
  "total bundle budget",
);

if (maxChunkKb > 0 || maxTotalKb > 0) {
  console.log(
    `Bundle budgets: ${maxChunkKb || "disabled"} KB max chunk / ${maxTotalKb || "disabled"} KB total gzip.`,
  );
}

let failed = false;

if (maxChunkKb > 0 && maxObservedChunkKb > maxChunkKb) {
  console.error(
    `Bundle budget exceeded: largest chunk is ${maxObservedChunkKb} KB gzip, limit is ${maxChunkKb} KB.`,
  );
  failed = true;
}

if (maxTotalKb > 0 && totalObservedGzipKb > maxTotalKb) {
  console.error(
    `Bundle budget exceeded: total static JS is ${totalObservedGzipKb} KB gzip, limit is ${maxTotalKb} KB.`,
  );
  failed = true;
}

if (failed) process.exit(1);
