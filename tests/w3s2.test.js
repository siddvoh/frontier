import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { MISSING } from "../docs/js/util.js";
import { render } from "../docs/js/views/model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Fixture model with a full record; every stat field non-null so every
// provenance tag is present, including an "epoch"-sourced releaseDate.
const fullModel = {
  id: "alpha-1",
  name: "Alpha 1",
  organization: "Alpha Lab",
  releaseDate: "2024-05-01",
  epochName: "Alpha 1 (May 2024)",
  pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
  contextWindow: 200000,
  benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.25 },
  openWeights: false,
  epoch: {
    parameters: 1.7e12,
    trainingComputeFlop: 2.1e25,
    organization: "Alpha Lab",
  },
  sources: {
    releaseDate: "epoch",
    "pricing.inputPerMTok": "curated",
    "pricing.outputPerMTok": "curated",
    contextWindow: "curated",
    "benchmarks.gpqaDiamond": "curated",
    "benchmarks.swebenchVerified": "curated",
    openWeights: "curated",
    "epoch.parameters": "epoch",
    "epoch.trainingComputeFlop": "epoch",
    "epoch.organization": "epoch",
  },
};

// Fixture model with null fields AND events (C31 check case): sources keys
// exist only for non-null fields.
const sparseModel = {
  id: "beta-2",
  name: "Beta 2",
  organization: "Beta Corp",
  releaseDate: null,
  epochName: null,
  pricing: { inputPerMTok: 2, outputPerMTok: null, currency: "USD" },
  contextWindow: null,
  benchmarks: { gpqaDiamond: null, swebenchVerified: null },
  openWeights: null,
  epoch: { parameters: null, trainingComputeFlop: null, organization: null },
  sources: { "pricing.inputPerMTok": "curated" },
};

const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [fullModel, sparseModel],
  events: [
    {
      id: "beta-suspension",
      date: "2026-02-01",
      title: "Beta 2 export suspension",
      body: "Beta Corp suspends Beta 2 exports pending review.",
      modelIds: ["beta-2"],
    },
    {
      id: "alpha-launch",
      date: "2024-05-01",
      title: "Alpha 1 launches",
      body: "Alpha Lab releases Alpha 1.",
      modelIds: ["alpha-1"],
    },
    {
      id: "beta-relaunch",
      date: "2026-04-01",
      title: "Beta 2 relaunch",
      body: "Beta Corp resumes Beta 2 availability.",
      modelIds: ["beta-2", "alpha-1"],
    },
  ],
};

function renderModel(id) {
  return render({ route: { view: "model", id }, data: fixture });
}

const savedDocument = globalThis.document;
const savedFetch = globalThis.fetch;

beforeAll(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not call fetch");
  };
});

afterAll(() => {
  globalThis.document = savedDocument;
  globalThis.fetch = savedFetch;
});

describe("model overlay renders all record fields (C31)", () => {
  it("returns the #model-overlay element", () => {
    const el = renderModel("alpha-1");
    expect(el.nodeType).toBe(1);
    expect(el.id).toBe("model-overlay");
  });

  it("shows every record field value for a full model", () => {
    const text = renderModel("alpha-1").textContent;
    expect(text).toContain("Alpha 1"); // name
    expect(text).toContain("alpha-1"); // id
    expect(text).toContain("Alpha Lab"); // organization
    expect(text).toContain("2024-05-01"); // release date
    expect(text).toContain("Alpha 1 (May 2024)"); // epochName
    expect(text).toContain("$3.00"); // input price
    expect(text).toContain("$15.00"); // output price
    expect(text).toContain("200,000"); // context window
    expect(text).toContain("60.1"); // GPQA Diamond
    expect(text).toContain("40.3"); // SWE-bench Verified (1 decimal)
    expect(text).toContain("closed"); // openWeights false
  });

  it("shows the Epoch enrichment values (C31)", () => {
    const text = renderModel("alpha-1").textContent;
    expect(text).toContain("Epoch enrichment");
    expect(text).toContain(String(1.7e12)); // parameters
    expect(text).toContain(String(2.1e25)); // training compute
    expect(text).toContain("Training compute (FLOP)");
  });

  it("labels every field so values are identifiable", () => {
    const el = renderModel("alpha-1");
    const labels = [...el.querySelectorAll("dt")].map((n) => n.textContent);
    expect(labels).toEqual([
      "ID",
      "Name",
      "Organization",
      "Release date",
      "Epoch dataset name",
      "Input price / MTok",
      "Output price / MTok",
      "Context window (tokens)",
      "GPQA Diamond",
      "SWE-bench Verified",
      "Weights",
      "Parameters",
      "Training compute (FLOP)",
      "Organization",
    ]);
  });

  it("renders a not-found message without inventing a record", () => {
    const el = renderModel("nope-0");
    expect(el.id).toBe("model-overlay");
    expect(el.textContent).toContain("Model not found");
    expect(el.querySelectorAll("dt")).toHaveLength(0);
  });
});

describe("provenance tags from sources (C31)", () => {
  it("shows a visible tag per enriched field with truthful text", () => {
    const el = renderModel("alpha-1");
    const tags = [...el.querySelectorAll("[data-source]")];
    // One tag per sources key on the fixture.
    expect(tags).toHaveLength(Object.keys(fullModel.sources).length);
    for (const tag of tags) {
      expect(["Epoch", "curated"]).toContain(tag.textContent);
      expect(tag.textContent).toBe(
        tag.dataset.source === "epoch" ? "Epoch" : "curated"
      );
    }
  });

  it("tags the epoch-sourced releaseDate as Epoch and prices as curated", () => {
    const el = renderModel("alpha-1");
    const bySource = (s) => el.querySelectorAll(`[data-source="${s}"]`);
    // releaseDate + the three epoch.* fields
    expect(bySource("epoch")).toHaveLength(4);
    expect(bySource("curated")).toHaveLength(6);
    const epochTag = bySource("epoch")[0];
    expect(epochTag.textContent).toBe("Epoch");
    const curatedTag = bySource("curated")[0];
    expect(curatedTag.textContent).toBe("curated");
  });

  it("renders no tag for null fields (key absent from sources)", () => {
    const el = renderModel("beta-2");
    const tags = [...el.querySelectorAll("[data-source]")];
    expect(tags).toHaveLength(1); // only pricing.inputPerMTok
    expect(tags[0].dataset.source).toBe("curated");
  });
});

describe("null fields render MISSING (C31, C20)", () => {
  it("renders every null field as the MISSING constant", () => {
    const el = renderModel("beta-2");
    const values = [...el.querySelectorAll("dd")].map((n) =>
      n.textContent.trim()
    );
    // Nulls: releaseDate, epochName, output price, contextWindow, both
    // benchmarks, openWeights, and all three epoch fields = 10 rows.
    expect(values.filter((v) => v === MISSING)).toHaveLength(10);
    // Non-null values still render, never substituted.
    expect(el.textContent).toContain("$2.00");
    expect(el.textContent).toContain("Beta 2");
  });

  it("keeps a null-field model fully in the overlay (no dropped rows)", () => {
    const el = renderModel("beta-2");
    expect(el.querySelectorAll("dt")).toHaveLength(14);
  });

  it("never writes a literal dash in the renderer source (C20)", () => {
    const source = readFileSync(
      path.join(root, "docs", "js", "views", "model.js"),
      "utf8"
    );
    expect(source).not.toContain(MISSING);
    expect(source).toContain('from "../util.js"');
  });
});

describe("events for the model (C31)", () => {
  it("renders every event whose modelIds includes the model", () => {
    const el = renderModel("beta-2");
    const articles = [...el.querySelectorAll(".model-events article")];
    expect(articles).toHaveLength(2);
    const texts = articles.map((a) => a.textContent);
    expect(texts[0]).toContain("2026-02-01");
    expect(texts[0]).toContain("Beta 2 export suspension");
    expect(texts[0]).toContain("suspends Beta 2 exports pending review");
    expect(texts[1]).toContain("2026-04-01");
    expect(texts[1]).toContain("Beta 2 relaunch");
    expect(texts[1]).toContain("resumes Beta 2 availability");
  });

  it("excludes events for other models", () => {
    const el = renderModel("beta-2");
    expect(el.textContent).not.toContain("Alpha 1 launches");
  });

  it("renders date, title, and body as distinct elements", () => {
    const el = renderModel("alpha-1");
    const article = el.querySelector(".model-events article");
    expect(article.querySelector("time").dateTime).toBe("2024-05-01");
    expect(article.querySelector("time").textContent).toBe("2024-05-01");
    expect(article.querySelector("h4").textContent).toBe("Alpha 1 launches");
    expect(article.querySelector("p").textContent).toBe(
      "Alpha Lab releases Alpha 1."
    );
  });

  it("shows an explicit empty state when a model has no events", () => {
    const soloFixture = {
      ...fixture,
      models: [fullModel],
      events: [fixture.events[0]], // beta-only event
    };
    const el = render({
      route: { view: "model", id: "alpha-1" },
      data: soloFixture,
    });
    expect(el.querySelectorAll(".model-events article")).toHaveLength(0);
    expect(el.textContent).toContain("No recorded events for this model.");
  });
});
