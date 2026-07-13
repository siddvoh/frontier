/**
 * Fetch Epoch AI's "Notable AI Models" dataset (CC-BY 4.0) and overwrite the
 * committed snapshot at data/epoch_notable_ai_models.csv (SPEC C9).
 *
 * Run via `npm run fetch`. Never invoked by tests: `npm test` is offline (C49).
 * No dependencies; uses the Node built-in global fetch.
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_URL = "https://epoch.ai/data/notable_ai_models.csv";
const DEST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "epoch_notable_ai_models.csv"
);

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `fetch-epoch: GET ${SOURCE_URL} failed: ${response.status} ${response.statusText}`
    );
  }
  const body = await response.text();
  if (body.length === 0) {
    throw new Error(`fetch-epoch: ${SOURCE_URL} returned an empty body`);
  }
  await writeFile(DEST, body, "utf8");
  console.log(`fetch-epoch: wrote ${body.length} bytes to ${DEST}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
