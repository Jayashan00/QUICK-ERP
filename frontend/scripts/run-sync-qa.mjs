import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = await mkdtemp(join(tmpdir(), "quick-erp-sync-qa-"));
const outfile = join(directory, "sync-qa.mjs");
try {
  await build({
    entryPoints: ["scripts/sync-qa.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    tsconfig: "tsconfig.app.json",
    logLevel: "silent",
  });
  await import(`${new URL(`file:///${outfile.replace(/\\/g, "/")}`).href}?run=${Date.now()}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
