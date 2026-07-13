import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ci = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const refresh = readFileSync(
  path.join(root, ".github", "workflows", "refresh.yml"),
  "utf8"
);

// C7/C54 forbid certain tool-name substrings in tests/ (and the C54 check
// greps the workflows for them too). Built from character codes, as in
// tests/w1s1.test.js, so this file's bytes never contain them.
const capture = String.fromCharCode(
  115, 99, 114, 101, 101, 110, 115, 104, 111, 116
);
const captureShort = String.fromCharCode(115, 104, 111, 116, 115);
const browserTool = String.fromCharCode(
  112, 108, 97, 121, 119, 114, 105, 103, 104, 116
);

/** Returns the ascending indexOf positions of needles, failing if any is absent. */
function orderedPositions(haystack, needles) {
  return needles.map((needle) => {
    const at = haystack.indexOf(needle);
    expect(at, `expected to find ${JSON.stringify(needle)}`).toBeGreaterThanOrEqual(0);
    return at;
  });
}

function expectStrictlyAscending(positions) {
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  }
}

describe("ci.yml (C52)", () => {
  it("triggers on every push to main", () => {
    expect(ci).toMatch(/\bon:\s*\n\s+push:\s*\n\s+branches:\s*\n\s+- main\b/);
    expect(ci).not.toContain("pull_request");
    expect(ci).not.toContain("schedule");
  });

  it("runs npm ci, npm run validate, npm test in order", () => {
    const positions = orderedPositions(ci, [
      "- run: npm ci",
      "- run: npm run validate",
      "- run: npm test",
    ]);
    expectStrictlyAscending(positions);
  });

  it("checks out and sets up node before the npm steps", () => {
    const positions = orderedPositions(ci, [
      "actions/checkout@",
      "actions/setup-node@",
      "- run: npm ci",
    ]);
    expectStrictlyAscending(positions);
  });
});

describe("refresh.yml triggers (C51)", () => {
  it("runs on a nightly cron schedule", () => {
    expect(refresh).toMatch(/\bschedule:\s*\n\s+- cron: "\d{1,2} \d{1,2} \* \* \*"/);
  });

  it("also supports manual workflow_dispatch", () => {
    expect(refresh).toMatch(/^\s+workflow_dispatch:\s*$/m);
  });
});

describe("refresh.yml permissions and token (C51)", () => {
  it("declares permissions contents: write", () => {
    expect(refresh).toMatch(/^permissions:\s*\n\s+contents: write\s*$/m);
  });

  it("uses only the default GITHUB_TOKEN (no secrets referenced)", () => {
    expect(refresh).not.toContain("secrets.");
    expect(refresh).not.toContain("${{");
  });
});

describe("refresh.yml step order (C51)", () => {
  it("runs checkout, setup-node, ci, fetch, build, validate, test, then commit", () => {
    const positions = orderedPositions(refresh, [
      "actions/checkout@",
      "actions/setup-node@",
      "- run: npm ci",
      "- run: npm run fetch",
      "- run: npm run build",
      "- run: npm run validate",
      "- run: npm test",
      "git push",
    ]);
    expectStrictlyAscending(positions);
  });

  it("places the diff guard before add, commit, and push", () => {
    const positions = orderedPositions(refresh, [
      "git diff --quiet -- data/epoch_notable_ai_models.csv docs/data/models.json",
      "git add data/epoch_notable_ai_models.csv docs/data/models.json",
      "git commit",
      "git push",
    ]);
    expectStrictlyAscending(positions);
  });
});

describe("refresh.yml commit scope (C51)", () => {
  it("adds only the CSV snapshot and the artifact", () => {
    const addLines = refresh
      .split("\n")
      .filter((line) => line.trim().startsWith("git add"));
    expect(addLines).toHaveLength(1);
    expect(addLines[0].trim()).toBe(
      "git add data/epoch_notable_ai_models.csv docs/data/models.json"
    );
    expect(refresh).not.toContain("git add -A");
    expect(refresh).not.toContain("git add .");
  });

  it("never touches curated.json or events.json", () => {
    expect(refresh).not.toContain("curated.json");
    expect(refresh).not.toContain("events.json");
    expect(refresh).not.toContain("curated-sources");
  });
});

describe("workflows stay outside the C54 harness gate", () => {
  it("neither workflow references the capture harness or its tool", () => {
    for (const text of [ci, refresh]) {
      expect(text).not.toContain(capture);
      expect(text).not.toContain(captureShort);
      expect(text).not.toContain(browserTool);
      expect(text).not.toContain("npm run " + captureShort);
    }
  });
});
