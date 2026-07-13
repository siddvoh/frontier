// Screenshot harness (C53). Human eyeballing only: outside every test and
// CI gate (C7, C54). Serves docs/ statically, then captures each route at
// two viewports in light and dark color schemes. No assertions, no diffing.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

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

// Ids below exist in the committed docs/data/models.json.
const ROUTES = [
  { slug: "catalog", hash: "#/catalog" },
  { slug: "model-gpt-4", hash: "#/model/gpt-4" },
  { slug: "compare", hash: "#/compare?ids=gpt-4,claude-fable-5" },
  { slug: "scenario", hash: "#/scenario" },
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
  const browser = await chromium.launch();
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport, colorScheme: theme });
        const page = await context.newPage();
        for (const route of ROUTES) {
          await page.goto(base + route.hash, { waitUntil: "networkidle" });
          const name = `${route.slug}-${viewport.width}x${viewport.height}-${theme}.png`;
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
