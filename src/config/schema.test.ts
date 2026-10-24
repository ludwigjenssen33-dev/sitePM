import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloneConfig, defaults, legacyScoringRules, parseSettings, settingsExport } from "./schema";
import { getSettings, resetSettings, saveSettings } from "./store";
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  });
  resetSettings();
});
afterEach(() => {
  resetSettings();
  vi.unstubAllGlobals();
});
it("опубликованный конфиг соответствует схеме, старые правила неизменны", () => {
  expect(parseSettings(defaults)).toEqual(defaults);
  expect(legacyScoringRules.hintCost).toBe(2);
  expect(legacyScoringRules.perfectBonus).toBe(0);
});
it("экспорт хранит только переопределения и восстанавливает настройки", () => {
  const c = cloneConfig();
  c.interface.theme = "finance";
  const exported = settingsExport(c);
  expect(exported.overrides).toEqual({ interface: { theme: "finance" } });
  expect(parseSettings(JSON.parse(JSON.stringify(exported)))).toEqual(c);
});
it("мигрирует старую тему и режим без удаления данных прогресса", () => {
  memory.set("product-lab-v2", "preserved");
  const c = parseSettings({
    schemaVersion: 1,
    theme: "dark",
    accessMode: "sequential",
  });
  saveSettings(c);
  expect(getSettings().interface.theme).toBe("dark");
  expect(memory.get("product-lab-v2")).toBe("preserved");
  resetSettings();
  expect(getSettings().interface.theme).toBe("light");
  expect(memory.get("product-lab-v2")).toBe("preserved");
});
it("отклоняет неизвестные поля, код, прототипы, будущие версии и неверные диапазоны", () => {
  for (const raw of [
    { schemaVersion: 99 },
    { interface: { theme: "javascript:alert(1)" } },
    { scoring: { hintCost: -1 } },
    { scoring: { maxHints: 5 } },
    { access: { order: ["analytics", "analytics"] } },
    JSON.parse('{"__proto__":{"admin":true}}'),
    { run: "node command" },
    { interface: { characters: "yes" } },
  ])
    expect(() => parseSettings(raw)).toThrow();
  expect(({} as Record<string, unknown>).admin).toBeUndefined();
});
it("не разрешает режим по баллам при отключённой системе баллов", () => {
  const c = cloneConfig();
  c.scoring.enabled = false;
  c.access.mode = "score";
  expect(() => saveSettings(c)).toThrow("требует");
  expect(getSettings()).toEqual(defaults);
});
