// W6.S3: localStorage module with streak state (C64, C65, C66; schema
// 12.6). The module is exercised against an in-memory localStorage stub,
// a throwing stub, and a missing localStorage; every failure mode must
// degrade to the fresh default and never throw.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STORAGE_KEY,
  defaultState,
  getBestStreak,
  getDailyRecord,
  isValidState,
  loadState,
  recordCorrect,
  recordWrong,
  saveDailyRecord,
  saveState,
} from "../docs/js/game/storage.js";

const FRESH = { version: 1, endless: { best: 0 }, daily: {} };

// ---------- localStorage stubs ----------

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function throwingStorage() {
  return {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
}

let stub;

function installStorage(area) {
  Object.defineProperty(globalThis, "localStorage", {
    value: area,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  stub = memoryStorage();
  installStorage(stub);
});

afterEach(() => {
  delete globalThis.localStorage;
});

// ---------- schema round-trip (C65) ----------

describe("state round-trip against schema 12.6", () => {
  it("defaultState() is the fresh default and valid per the schema", () => {
    expect(defaultState()).toEqual(FRESH);
    expect(isValidState(defaultState())).toBe(true);
    // Fresh copies each call: mutating one never leaks into the next.
    const a = defaultState();
    a.endless.best = 5;
    expect(defaultState().endless.best).toBe(0);
  });

  it("saveState/loadState round-trips a full schema-valid state", () => {
    const state = {
      version: 1,
      endless: { best: 7 },
      daily: {
        "2026-07-15": {
          questionIds: ["price_in:gpt-4:o3", "ctx:claude-fable-5:gpt-4"],
          picks: [0, 1],
          correct: [true, false],
          completed: true,
        },
      },
    };
    expect(saveState(state)).toBe(true);
    const loaded = loadState();
    expect(loaded).toEqual(state);
    expect(isValidState(loaded)).toBe(true);
  });

  it("writes exactly the one key `frontier.game.v1` and no other", () => {
    expect(STORAGE_KEY).toBe("frontier.game.v1");
    recordCorrect(0);
    saveDailyRecord("2026-07-15", {
      questionIds: ["a:b:c"],
      picks: [1],
      correct: [true],
      completed: false,
    });
    expect([...stub.map.keys()]).toEqual(["frontier.game.v1"]);
    expect(JSON.parse(stub.map.get("frontier.game.v1")).version).toBe(1);
  });

  it("rejects schema-violating states on save", () => {
    expect(saveState({ version: 1, endless: { best: -1 }, daily: {} })).toBe(
      false
    );
    expect(saveState({ version: 1, endless: { best: 1.5 }, daily: {} })).toBe(
      false
    );
    expect(
      saveState({ version: 1, endless: { best: 0 }, daily: {}, extra: 1 })
    ).toBe(false);
    expect(
      saveState({
        version: 1,
        endless: { best: 0 },
        daily: { "not-a-date": {
          questionIds: [], picks: [], correct: [], completed: false,
        } },
      })
    ).toBe(false);
    expect(stub.map.size).toBe(0);
  });
});

// ---------- corruption and failure degradation (C66) ----------

describe("degradation to the fresh default (C66)", () => {
  it("missing value degrades to the default", () => {
    expect(loadState()).toEqual(FRESH);
  });

  it("corrupt JSON degrades to the default and never throws", () => {
    stub.setItem(STORAGE_KEY, "{not json!!");
    expect(() => loadState()).not.toThrow();
    expect(loadState()).toEqual(FRESH);
  });

  it('wrong version `{"version":99}` degrades to the default', () => {
    stub.setItem(STORAGE_KEY, '{"version":99}');
    expect(loadState()).toEqual(FRESH);
  });

  it("schema-violating JSON (valid parse) degrades to the default", () => {
    stub.setItem(
      STORAGE_KEY,
      '{"version":1,"endless":{"best":"ten"},"daily":{}}'
    );
    expect(loadState()).toEqual(FRESH);
    stub.setItem(STORAGE_KEY, '[1,2,3]');
    expect(loadState()).toEqual(FRESH);
    stub.setItem(STORAGE_KEY, "null");
    expect(loadState()).toEqual(FRESH);
  });

  it("a throwing localStorage stub degrades and never throws anywhere", () => {
    installStorage(throwingStorage());
    expect(() => loadState()).not.toThrow();
    expect(loadState()).toEqual(FRESH);
    expect(saveState(defaultState())).toBe(false);
    expect(getBestStreak()).toBe(0);
    expect(recordCorrect(3)).toBe(4);
    expect(recordWrong()).toBe(0);
    expect(getDailyRecord("2026-07-15")).toBeNull();
    expect(
      saveDailyRecord("2026-07-15", {
        questionIds: [],
        picks: [],
        correct: [],
        completed: false,
      })
    ).toBe(false);
  });

  it("a missing localStorage degrades and never throws", () => {
    delete globalThis.localStorage;
    expect(loadState()).toEqual(FRESH);
    expect(saveState(defaultState())).toBe(false);
    expect(recordCorrect(0)).toBe(1);
    expect(getDailyRecord("2026-07-15")).toBeNull();
  });
});

// ---------- streak helpers (C64) ----------

describe("streak helpers (C64)", () => {
  it("increments the running streak on each correct answer", () => {
    let streak = 0;
    streak = recordCorrect(streak);
    expect(streak).toBe(1);
    streak = recordCorrect(streak);
    streak = recordCorrect(streak);
    expect(streak).toBe(3);
    expect(getBestStreak()).toBe(3);
  });

  it("resets to 0 on a wrong answer while play continues", () => {
    let streak = recordCorrect(recordCorrect(0));
    expect(streak).toBe(2);
    streak = recordWrong();
    expect(streak).toBe(0);
    // Play continues: the next correct answer starts a new run.
    expect(recordCorrect(streak)).toBe(1);
    // Best from before the wrong answer is retained.
    expect(getBestStreak()).toBe(2);
  });

  it("best streak is the maximum ever reached", () => {
    let streak = 0;
    for (let i = 0; i < 5; i += 1) streak = recordCorrect(streak);
    expect(getBestStreak()).toBe(5);
    streak = recordWrong();
    streak = recordCorrect(streak);
    streak = recordCorrect(streak);
    expect(streak).toBe(2);
    expect(getBestStreak()).toBe(5);
  });

  it("best streak persists across sessions via the module", () => {
    let streak = 0;
    for (let i = 0; i < 4; i += 1) streak = recordCorrect(streak);
    // New session: same underlying storage, fresh in-page streak state.
    const persisted = stub.map.get(STORAGE_KEY);
    stub = memoryStorage();
    stub.setItem(STORAGE_KEY, persisted);
    installStorage(stub);
    expect(getBestStreak()).toBe(4);
    expect(recordCorrect(0)).toBe(1);
    expect(getBestStreak()).toBe(4);
  });
});

// ---------- daily records (12.6, C67 groundwork) ----------

describe("daily records keyed by UTC date string", () => {
  const record = {
    questionIds: ["price_in:a:b", "ctx:c:d"],
    picks: [0, 1],
    correct: [false, true],
    completed: true,
  };

  it("round-trips a record for a date and returns null for others", () => {
    expect(getDailyRecord("2026-07-15")).toBeNull();
    expect(saveDailyRecord("2026-07-15", record)).toBe(true);
    expect(getDailyRecord("2026-07-15")).toEqual(record);
    expect(getDailyRecord("2026-07-16")).toBeNull();
  });

  it("overwrites a record in place (answers recorded as play progresses)", () => {
    const partial = {
      questionIds: ["price_in:a:b", "ctx:c:d"],
      picks: [0],
      correct: [false],
      completed: false,
    };
    expect(saveDailyRecord("2026-07-15", partial)).toBe(true);
    expect(getDailyRecord("2026-07-15")).toEqual(partial);
    expect(saveDailyRecord("2026-07-15", record)).toBe(true);
    expect(getDailyRecord("2026-07-15")).toEqual(record);
  });

  it("keeps records for distinct dates and streak state independent", () => {
    expect(saveDailyRecord("2026-07-15", record)).toBe(true);
    const other = { questionIds: [], picks: [], correct: [], completed: false };
    expect(saveDailyRecord("2026-07-16", other)).toBe(true);
    recordCorrect(0);
    const state = loadState();
    expect(state.daily["2026-07-15"]).toEqual(record);
    expect(state.daily["2026-07-16"]).toEqual(other);
    expect(state.endless.best).toBe(1);
  });

  it("rejects invalid date keys and invalid record shapes", () => {
    expect(saveDailyRecord("today", record)).toBe(false);
    expect(saveDailyRecord("2026-7-15", record)).toBe(false);
    expect(getDailyRecord("today")).toBeNull();
    expect(getDailyRecord(42)).toBeNull();
    expect(
      saveDailyRecord("2026-07-15", { ...record, picks: [0, 2] })
    ).toBe(false);
    expect(
      saveDailyRecord("2026-07-15", { ...record, extra: true })
    ).toBe(false);
    expect(saveDailyRecord("2026-07-15", null)).toBe(false);
    expect(stub.map.size).toBe(0);
  });
});

// ---------- single access point (C65) ----------

describe("storage.js is the only localStorage access point in docs/js", () => {
  it("no other docs/js file mentions localStorage", () => {
    const root = new URL("../docs/js", import.meta.url).pathname;
    const offenders = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          name.endsWith(".js") &&
          readFileSync(path, "utf8").includes("localStorage") &&
          path !== join(root, "game", "storage.js")
        ) {
          offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it("storage.js touches no key other than frontier.game.v1", () => {
    const source = readFileSync(
      new URL("../docs/js/game/storage.js", import.meta.url),
      "utf8"
    );
    // Every getItem/setItem call site passes the single STORAGE_KEY.
    const calls = source.match(/\.(getItem|setItem|removeItem)\(([^)]*)\)/g);
    expect(calls).not.toBeNull();
    for (const call of calls) {
      expect(call).toMatch(/\(STORAGE_KEY[,)]/);
    }
    expect(source).toContain('export const STORAGE_KEY = "frontier.game.v1"');
    // No fetch, no Math.random, no DOM beyond localStorage.
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("document.");
  });
});
