import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tempDirectory = await mkdtemp(join(tmpdir(), "quick-erp-sales-qa-"));
const outputFile = join(tempDirectory, "sales-qa.mjs");
try {
  await build({ entryPoints: ["scripts/sales-qa.ts"], outfile: outputFile, bundle: true, platform: "node", format: "esm", target: "node22", tsconfig: "tsconfig.app.json", logLevel: "silent" });
  await import(`${new URL(`file:///${outputFile.replace(/\\/g, "/")}`).href}?run=${Date.now()}`);
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
