import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse, parseRows } from "../scripts/lib/csv.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "epoch_notable_ai_models.csv");
const columnsPath = path.join(root, "data", "epoch-columns.json");

describe("csv parser unit behavior", () => {
  it("parses a simple header plus data rows", () => {
    const { header, rows } = parse("a,b,c\n1,2,3\n4,5,6\n");
    expect(header).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    const { rows } = parse('name,org\n"Doe, Jane",Acme\n');
    expect(rows[0]).toEqual({ name: "Doe, Jane", org: "Acme" });
  });

  it("handles embedded newlines inside quoted fields", () => {
    const { rows } = parse('id,notes\n1,"line one\nline two"\n2,plain\n');
    expect(rows).toHaveLength(2);
    expect(rows[0].notes).toBe("line one\nline two");
    expect(rows[1].notes).toBe("plain");
  });

  it("handles embedded CRLF inside quoted fields and CRLF row endings", () => {
    const { rows } = parse('id,notes\r\n1,"a\r\nb"\r\n2,c\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0].notes).toBe("a\r\nb");
    expect(rows[1].notes).toBe("c");
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const { rows } = parse('q\n"She said ""hi"" twice"\n');
    expect(rows[0].q).toBe('She said "hi" twice');
  });

  it("parses quoted header fields", () => {
    const { header } = parse('"Training compute (FLOP)","Model, name"\nx,y\n');
    expect(header).toEqual(["Training compute (FLOP)", "Model, name"]);
  });

  it("handles empty fields and trailing commas", () => {
    const { rows } = parse("a,b,c\n1,,3\n,,\n");
    expect(rows[0]).toEqual({ a: "1", b: "", c: "3" });
    expect(rows[1]).toEqual({ a: "", b: "", c: "" });
  });

  it("parses a final row with no trailing newline", () => {
    const rows = parseRows("a,b\n1,2");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("does not emit a phantom empty row for a trailing newline", () => {
    const rows = parseRows("a,b\n1,2\n");
    expect(rows).toHaveLength(2);
  });

  it("fills missing trailing fields with empty strings", () => {
    const { rows } = parse("a,b,c\n1,2\n");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("throws on an unterminated quoted field", () => {
    expect(() => parseRows('a\n"unclosed')).toThrow(/unterminated/);
  });

  it("throws on empty input", () => {
    expect(() => parse("")).toThrow(/header/);
  });
});

describe("committed Epoch CSV snapshot (C9)", () => {
  const text = readFileSync(csvPath, "utf8");
  const { header, rows } = parse(text);

  it("has a header row with named columns", () => {
    expect(header.length).toBeGreaterThan(1);
    for (const name of header) {
      expect(typeof name).toBe("string");
    }
    expect(header).toContain("Model");
  });

  it("has at least one data row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("gives every data row a value for every header key", () => {
    for (const key of header) {
      expect(typeof rows[0][key]).toBe("string");
    }
  });
});

describe("epoch-columns.json mapping (C12)", () => {
  const mapping = JSON.parse(readFileSync(columnsPath, "utf8"));
  const { header } = parse(readFileSync(csvPath, "utf8"));

  it("maps all five logical enrichment fields", () => {
    expect(Object.keys(mapping).sort()).toEqual(
      [
        "modelName",
        "organization",
        "parameters",
        "releaseDate",
        "trainingComputeFlop",
      ].sort()
    );
  });

  it("maps every logical field to an exact header present in the CSV", () => {
    for (const [logical, headerName] of Object.entries(mapping)) {
      expect(typeof headerName, `mapping for ${logical}`).toBe("string");
      expect(header, `header for ${logical}: ${headerName}`).toContain(
        headerName
      );
    }
  });
});
