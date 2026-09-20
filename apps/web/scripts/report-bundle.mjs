import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(process.cwd(), ".next", "static", "chunks");

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

console.log("\nLargest JavaScript chunks (gzip):");
console.table(
  chunks.slice(0, 12).map((chunk) => ({
    chunk: chunk.path,
    "raw KB": kb(chunk.rawBytes),
    "gzip KB": kb(chunk.gzipBytes),
  })),
);

console.log(
  `Total static JS: ${kb(totalRaw)} KB raw / ${kb(totalGzip)} KB gzip across ${chunks.length} chunks.`,
);

const maxChunkKb = Number(
  process.env.BUNDLE_MAX_CHUNK_GZIP_KB ?? 0,
);
const maxTotalKb = Number(
  process.env.BUNDLE_MAX_TOTAL_GZIP_KB ?? 0,
);

let failed = false;

if (
  maxChunkKb > 0 &&
  chunks.some((chunk) => kb(chunk.gzipBytes) > maxChunkKb)
) {
  console.error(
    `Bundle budget exceeded: a chunk is above ${maxChunkKb} KB gzip.`,
  );
  failed = true;
}

if (maxTotalKb > 0 && kb(totalGzip) > maxTotalKb) {
  console.error(
    `Bundle budget exceeded: total static JS is above ${maxTotalKb} KB gzip.`,
  );
  failed = true;
}

if (failed) process.exit(1);
