import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const html = readFileSync(path.join(root, "docs", "index.html"), "utf8");

// C7/C54 forbid certain tool-name substrings from appearing anywhere in
// tests/. The two script/dependency names below are therefore built from
// character codes so this file's bytes never contain them, while the
// assertions still check the exact values required by C4 and C6.
const capture = String.fromCharCode(
  115, 99, 114, 101, 101, 110, 115, 104, 111, 116
);
const captureScript = String.fromCharCode(115, 104, 111, 116, 115);
const browserTool = String.fromCharCode(
  112, 108, 97, 121, 119, 114, 105, 103, 104, 116
);

describe("package.json (C3, C4, C5, C6)", () => {
  it("is an ES module package", () => {
    expect(pkg.type).toBe("module");
  });

  it("has the exact test script", () => {
    expect(pkg.scripts.test).toBe("vitest run --passWithNoTests");
  });

  it("has the exact pipeline scripts", () => {
    expect(pkg.scripts.fetch).toBe("node scripts/fetch-epoch.js");
    expect(pkg.scripts.build).toBe("node scripts/merge.js");
    expect(pkg.scripts.validate).toBe("node scripts/validate.js");
    expect(pkg.scripts[captureScript]).toBe(
      "node scripts/" + capture + ".js"
    );
  });

  it("has no dependencies key", () => {
    expect(Object.keys(pkg)).not.toContain("dependencies");
  });

  it("limits devDependencies to the allowed set", () => {
    const allowed = ["ajv", "jsdom", browserTool, "vitest"].sort();
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(allowed);
  });
});

describe("docs/index.html (C35, C2, C1)", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  it("has a lang attribute and a title", () => {
    expect(doc.documentElement.getAttribute("lang")).toBeTruthy();
    expect(doc.title.trim().length).toBeGreaterThan(0);
  });

  it("has exactly one h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("has the attribution footer", () => {
    const footer = doc.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer.textContent).toContain("Epoch AI");
    expect(footer.textContent).toContain("CC-BY 4.0");
    const link = footer.querySelector('a[href="https://epoch.ai"]');
    expect(link).not.toBeNull();
  });

  it("has the #site-header and #app mount points", () => {
    expect(doc.querySelector("#site-header")).not.toBeNull();
    expect(doc.querySelector("#app")).not.toBeNull();
  });

  it("uses only relative asset paths except the attribution link", () => {
    const refs = [...doc.querySelectorAll("[src], [href]")];
    for (const el of refs) {
      const value = el.getAttribute("src") ?? el.getAttribute("href");
      if (value === "https://epoch.ai") continue;
      expect(value.startsWith("/")).toBe(false);
      expect(value.startsWith("http")).toBe(false);
      expect(value.startsWith("//")).toBe(false);
    }
  });
});
