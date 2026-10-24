import published from "./published.json" with { type: "json" };
export type ThemeId = "light" | "dark" | "christmas" | "finance";
export type AppConfig = {
  schemaVersion: 2;
  access: {
    mode: "free" | "sequential" | "foundation" | "score";
    minCompletion: number;
    minScore: number;
    courseRules: Record<string, "inherit" | "always" | "locked">;
    order: string[];
  };
  lessons: {
    sequential: boolean;
    allowSkipTheory: boolean;
    maxAttempts: number;
    allowRepeat: boolean;
    showAnswers: boolean;
    explanations: boolean;
    showProgress: boolean;
    disabledExercises: string[];
  };
  scoring: {
    enabled: boolean;
    hintCost: number;
    maxHints: number;
    passScore: number;
    lessonXP: number;
    perfectBonus: number;
    improvementBonus: number;
  };
  game: {
    achievements: boolean;
    certificates: boolean;
    levels: boolean;
    streaks: boolean;
    successThreshold: number;
    streakTarget: number;
    masterThreshold: number;
    courseCelebration: boolean;
    rewardAnimations: boolean;
    ranking: boolean;
  };
  interface: {
    theme: ThemeId;
    animations: boolean;
    density: "compact" | "standard" | "spacious";
    characters: boolean;
    decorations: boolean;
    accent: "default" | "blue" | "violet" | "teal";
  };
  content: {
    sections: Record<
      | "courses"
      | "cases"
      | "cabinet"
      | "lab"
      | "achievements"
      | "ranking"
      | "methodology",
      boolean
    >;
    showWelcome: boolean;
    recommendations: boolean;
    banners: boolean;
    showDemos: boolean;
  };
};
export const defaults = published as AppConfig;
/** Immutable pre-4.2 rules for attempts created before per-attempt snapshots existed. */
export const legacyScoringRules: AppConfig["scoring"] = Object.freeze({
  enabled: true,
  hintCost: 2,
  maxHints: 4,
  passScore: 70,
  lessonXP: 0,
  perfectBonus: 0,
  improvementBonus: 0,
});
export const settingsKey = "product-lab-settings-v2";
export const themeNames: Record<ThemeId, string> = {
  light: "Product Lab Light",
  dark: "Product Lab Dark",
  christmas: "Product Lab Christmas",
  finance: "Product Lab Finance",
};
export const cloneConfig = (c: AppConfig = defaults): AppConfig =>
  JSON.parse(JSON.stringify(c));
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(v) &&
  !["__proto__", "prototype", "constructor"].includes(v);
const enums: Record<string, string[]> = {
  "access.mode": ["free", "sequential", "foundation", "score"],
  "interface.theme": ["light", "dark", "christmas", "finance"],
  "interface.density": ["compact", "standard", "spacious"],
  "interface.accent": ["default", "blue", "violet", "teal"],
};
const ranges: Record<string, [number, number]> = {
  "access.minCompletion": [0, 100],
  "access.minScore": [0, 100],
  "lessons.maxAttempts": [0, 20],
  "scoring.hintCost": [0, 25],
  "scoring.maxHints": [0, 4],
  "scoring.passScore": [0, 100],
  "scoring.lessonXP": [0, 1000],
  "scoring.perfectBonus": [0, 1000],
  "scoring.improvementBonus": [0, 1000],
  "game.successThreshold": [0, 100],
  "game.streakTarget": [1, 13],
  "game.masterThreshold": [0, 100],
};
/** Walk known keys only. Neither import nor local overrides can execute code or set prototypes. */
function merge(base: unknown, input: unknown, path = ""): unknown {
  if (input === undefined) return structuredClone(base);
  if (path === "access.courseRules") {
    if (!record(input) || Object.keys(input).length > 100)
      throw new Error("Некорректные правила курсов.");
    const out: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(input)) {
      if (!id(key) || !["inherit", "always", "locked"].includes(String(value)))
        throw new Error("Недопустимое правило курса.");
      out[key] = String(value);
    }
    return out;
  }
  if (Array.isArray(base)) {
    if (
      !Array.isArray(input) ||
      input.length > 200 ||
      !input.every(id) ||
      new Set(input).size !== input.length
    )
      throw new Error(`Некорректный список: ${path}.`);
    return [...input];
  }
  if (record(base)) {
    if (!record(input)) throw new Error(`Ожидается объект: ${path}.`);
    for (const k of Object.keys(input))
      if (!Object.hasOwn(base, k))
        throw new Error(
          `Неизвестная настройка: ${path ? path + "." : ""}${k}.`,
        );
    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [
        key,
        merge(value, input[key], path ? path + "." + key : key),
      ]),
    );
  }
  if (typeof base === "boolean" && typeof input !== "boolean")
    throw new Error(`Ожидается переключатель: ${path}.`);
  if (typeof base === "number") {
    const range = ranges[path];
    if (
      typeof input !== "number" ||
      !Number.isInteger(input) ||
      !Number.isFinite(input) ||
      (range && (input < range[0] || input > range[1])) ||
      (path === "schemaVersion" && input !== 2)
    )
      throw new Error(`Число вне допустимого диапазона: ${path}.`);
  }
  if (
    typeof base === "string" &&
    (typeof input !== "string" || !enums[path]?.includes(input))
  )
    throw new Error(`Недопустимое значение: ${path}.`);
  return input;
}
export function parseSettings(raw: unknown): AppConfig {
  if (!record(raw))
    throw new Error("Файл настроек должен содержать JSON-объект.");
  if (
    raw.schemaVersion !== undefined &&
    raw.schemaVersion !== 1 &&
    raw.schemaVersion !== 2
  )
    throw new Error("Эта версия схемы настроек не поддерживается.");
  // v1 was a small theme/access preference file. Preserve it as overrides, not progress.
  if (raw.schemaVersion === 1) {
    return parseSettings({
      schemaVersion: 2,
      interface: { theme: raw.theme ?? "light" },
      access: { mode: raw.accessMode ?? "free" },
    });
  }
  if (raw.kind === "product-lab-settings") {
    if (!record(raw.overrides))
      throw new Error("Переопределения должны быть JSON-объектом.");
    if (
      Object.keys(raw).some(
        (k) => !["kind", "schemaVersion", "overrides"].includes(k),
      )
    )
      throw new Error("Неизвестные поля файла настроек.");
    return parseSettings({
      schemaVersion: 2,
      ...(record(raw.overrides) ? raw.overrides : {}),
    });
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2)
    throw new Error("Эта версия схемы настроек не поддерживается.");
  const result = merge(defaults, raw) as AppConfig;
  if (result.access.mode === "score" && !result.scoring.enabled)
    throw new Error("Доступ по баллу требует включённой системы баллов.");
  return result;
}
export function configWarnings(c: AppConfig) {
  return [
    ...(!c.lessons.showAnswers && c.lessons.explanations
      ? [
          "Эталон скрыт: подробные объяснения с готовым ответом также будут скрыты.",
        ]
      : []),
    ...(c.scoring.hintCost * c.scoring.maxHints > 100
      ? [
          "Сумма штрафов может достигнуть 100 баллов. Итог не опустится ниже нуля.",
        ]
      : []),
    ...(!c.scoring.enabled && c.game.certificates
      ? [
          "Без новых баллов сертификат можно получить только по сохранённым результатам. Для новых миссий включите баллы.",
        ]
      : []),
    ...(!c.content.sections.courses && c.access.mode !== "free"
      ? [
          "Раздел курсов скрыт: условия последовательного доступа нельзя выполнить, пока он скрыт.",
        ]
      : []),
    ...(c.lessons.maxAttempts > 0 && c.lessons.allowRepeat
      ? [
          "Лимит проверок хранится для урока целиком и не обнуляется при повторе или обновлении страницы.",
        ]
      : []),
    ...(!c.lessons.allowRepeat && c.scoring.improvementBonus > 0
      ? ["Бонус улучшения недоступен, пока повторные прохождения запрещены."]
      : []),
    ...(Object.values(c.access.courseRules).includes("locked")
      ? [
          "Курсы, закрытые вручную, открываются только изменением локального правила.",
        ]
      : []),
  ];
}
export function overridesOf(
  c: AppConfig | Record<string, unknown>,
  base: unknown = defaults,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(c)) {
    const old = (base as Record<string, unknown>)[key];
    if (JSON.stringify(value) === JSON.stringify(old)) continue;
    out[key] =
      record(value) && record(old) && key !== "courseRules"
        ? overridesOf(value, old)
        : value;
  }
  return out;
}
export function settingsExport(c: AppConfig) {
  return {
    kind: "product-lab-settings",
    schemaVersion: 2,
    overrides: overridesOf(parseSettings(c)),
  };
}
