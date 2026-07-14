import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import {
  LAUNCH_DATE,
  dayNumber,
  buildShareString,
  copyShareString,
} from "../docs/js/game/share.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shareSource = readFileSync(
  path.join(root, "docs", "js", "game", "share.js"),
  "utf8",
);

const GREEN = "\u{1F7E9}";
const RED = "\u{1F7E5}";

describe("W6.S4 share string (C68)", () => {
  it("exports the single launch date constant", () => {
    expect(LAUNCH_DATE).toBe("2026-07-15");
    const declarations = shareSource.match(/LAUNCH_DATE\s*=/g);
    expect(declarations).toHaveLength(1);
  });

  it("numbers launch day as #1", () => {
    expect(dayNumber("2026-07-15")).toBe(1);
  });

  it("applies the C68 day formula across day, month, and year boundaries", () => {
    expect(dayNumber("2026-07-16")).toBe(2);
    expect(dayNumber("2026-08-01")).toBe(18);
    expect(dayNumber("2027-07-15")).toBe(366);
  });

  it("builds the exact share string for a fixture record and date", () => {
    const record = {
      questionIds: ["a:1:2", "b:1:3", "c:2:3", "d:1:4", "e:2:4"],
      picks: [0, 1, 0, 0, 1],
      correct: [true, false, true, true, false],
      completed: true,
    };
    expect(buildShareString(record, "2026-07-19")).toBe(
      `Frontier #5 3/5\n${GREEN}${RED}${GREEN}${GREEN}${RED}`,
    );
  });

  it("builds the exact string for an all-correct launch-day record", () => {
    const record = { correct: [true, true, true], completed: true };
    expect(buildShareString(record, "2026-07-15")).toBe(
      `Frontier #1 3/3\n${GREEN}${GREEN}${GREEN}`,
    );
  });

  it("keeps squares in question order for an all-wrong record", () => {
    const record = { correct: [false, false], completed: true };
    expect(buildShareString(record, "2026-07-16")).toBe(
      `Frontier #2 0/2\n${RED}${RED}`,
    );
  });
});

describe("W6.S4 copy helper (C69)", () => {
  const text = `Frontier #1 2/3\n${GREEN}${GREEN}${RED}`;

  it("uses navigator.clipboard.writeText when available and reports copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn();
    const dom = new JSDOM("<!doctype html><body></body>");
    dom.window.document.execCommand = execCommand;

    const copied = await copyShareString(text, {
      navigator: { clipboard: { writeText } },
      document: dom.window.document,
    });

    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("reports not-copied when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const copied = await copyShareString(text, {
      navigator: { clipboard: { writeText } },
    });
    expect(copied).toBe(false);
  });

  it("falls back to a readonly textarea and execCommand('copy')", async () => {
    const dom = new JSDOM("<!doctype html><body></body>");
    const doc = dom.window.document;
    const select = vi.spyOn(
      dom.window.HTMLTextAreaElement.prototype,
      "select",
    );
    let stateAtCopy = null;
    doc.execCommand = vi.fn((command) => {
      const textarea = doc.body.querySelector("textarea");
      stateAtCopy = {
        command,
        inBody: textarea !== null,
        value: textarea && textarea.value,
        readOnly: textarea && textarea.readOnly,
        selectCalls: select.mock.calls.length,
      };
      return true;
    });

    const copied = await copyShareString(text, {
      navigator: {},
      document: doc,
    });

    expect(copied).toBe(true);
    expect(doc.execCommand).toHaveBeenCalledTimes(1);
    expect(stateAtCopy).toEqual({
      command: "copy",
      inBody: true,
      value: text,
      readOnly: true,
      selectCalls: 1,
    });
    // The helper cleans up its textarea after copying.
    expect(doc.body.querySelector("textarea")).toBeNull();
    select.mockRestore();
  });

  it("reports not-copied when execCommand returns false", async () => {
    const dom = new JSDOM("<!doctype html><body></body>");
    const doc = dom.window.document;
    doc.execCommand = vi.fn(() => false);

    const copied = await copyShareString(text, {
      navigator: undefined,
      document: doc,
    });

    expect(copied).toBe(false);
    expect(doc.execCommand).toHaveBeenCalledWith("copy");
    expect(doc.body.querySelector("textarea")).toBeNull();
  });

  it("reports not-copied when execCommand throws", async () => {
    const dom = new JSDOM("<!doctype html><body></body>");
    const doc = dom.window.document;
    doc.execCommand = vi.fn(() => {
      throw new Error("not supported");
    });

    const copied = await copyShareString(text, {
      navigator: {},
      document: doc,
    });

    expect(copied).toBe(false);
    expect(doc.body.querySelector("textarea")).toBeNull();
  });

  it("reports not-copied when neither clipboard path exists", async () => {
    const copied = await copyShareString(text, {
      navigator: undefined,
      document: undefined,
    });
    expect(copied).toBe(false);
  });
});

describe("W6.S4 module hygiene", () => {
  it("touches no storage, no network, no randomness, no external imports", () => {
    expect(shareSource).not.toMatch(/localStorage/);
    expect(shareSource).not.toMatch(/sessionStorage/);
    expect(shareSource).not.toMatch(/fetch\s*\(/);
    expect(shareSource).not.toMatch(/Math\.random/);
    // No import statements at all: nothing outside docs/js/ can leak in.
    expect(shareSource).not.toMatch(/^\s*import\b/m);
  });
});
