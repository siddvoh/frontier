// Screenshot harness (C53, amended by STEP 2; game states per C75). Human
// eyeballing only: outside every test and CI gate (C7, C54). Serves docs/
// statically, then captures each of the eight states at two viewports in
// light and dark color schemes: 32 PNGs. No assertions, no diffing.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { STORAGE_KEY } from "../docs/js/game/storage.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS_DIR = join(ROOT, "docs");
const OUT_DIR = join(ROOT, "shots");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// A completed daily record for the current UTC date, per schema 12.6, so
// `#/game/daily` renders the results screen (C75). Before LAUNCH_DATE the
// view legitimately shows the C76 pre-launch notice instead; the record is
// seeded regardless.
function seededGameState() {
  const date = new Date().toISOString().slice(0, 10);
  const questionIds = Array.from(
    { length: 10 },
    (_, i) => `seeded-question-${i + 1}`,
  );
  const picks = questionIds.map((_, i) => i % 2);
  const correct = questionIds.map((_, i) => i % 3 !== 0);
  return {
    version: 1,
    endless: { best: 0 },
    daily: { [date]: { questionIds, picks, correct, completed: true } },
  };
}

// Model ids below exist in the committed docs/data/models.json. The four
// game states are the C75 set; "reveal" is the endless question after
// clicking option A (the first #game-cards button).
const STATES = [
  { slug: "catalog", hash: "#/catalog" },
  { slug: "model-gpt-4", hash: "#/model/gpt-4" },
  { slug: "compare", hash: "#/compare?ids=gpt-4,claude-fable-5" },
  { slug: "scenario", hash: "#/scenario" },
  { slug: "game-picker", hash: "#/game" },
  { slug: "game-endless-question", hash: "#/game/endless?seed=1" },
  { slug: "game-endless-reveal", hash: "#/game/endless?seed=1", clickOptionA: true },
  { slug: "game-daily-results", hash: "#/game/daily" },
];

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
];

const THEMES = ["light", "dark"];

function serveDocs() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = normalize(join(DOCS_DIR, relative));
    if (!filePath.startsWith(DOCS_DIR)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const body = await readFile(filePath);
      const type = CONTENT_TYPES[extname(filePath)];
      res.writeHead(200, type ? { "Content-Type": type } : {});
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await serveDocs();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const storageValue = JSON.stringify(seededGameState());
  const browser = await chromium.launch();
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport, colorScheme: theme });
        // Seed the completed daily record before any page script runs; only
        // the daily view reads it, so the other states are unaffected.
        await context.addInitScript(
          ([key, value]) => {
            window.localStorage.setItem(key, value);
          },
          [STORAGE_KEY, storageValue],
        );
        const page = await context.newPage();
        for (const state of STATES) {
          await page.goto(base + state.hash, { waitUntil: "networkidle" });
          if (state.clickOptionA) {
            await page.locator("#game-cards button").first().click();
          }
          const name = `${state.slug}-${viewport.width}x${viewport.height}-${theme}.png`;
          await page.screenshot({ path: join(OUT_DIR, name), fullPage: true });
          console.log(`wrote ${name}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
