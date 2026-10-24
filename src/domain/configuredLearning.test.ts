import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloneConfig, legacyScoringRules } from "../config/schema";
import { resetSettings, saveSettings } from "../config/store";
import {
  emptyProgress,
  completeLearningLesson,
  submitLesson,
  xp,
  startAttempt,
  newAttempt,
  certificateEligibility,
} from "./progress";
import {
  parseProgress,
  saveProgress,
  loadProgress,
  clearLearningProgress,
} from "../services/progressStore";
import { correctReasons, emptyAnswers, totalScore } from "../lib/scoring";
import { getCase, cases } from "../data/cases";
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
const check = (correct: boolean, id = "check-a") => ({
  id,
  lessonId: "A1",
  courseId: "analytics",
  answer: correct ? 1 : 0,
  correct,
  updated: new Date().toISOString(),
});
it("сохраняет E/P-уроки, ответы и награды без удаления v1", () => {
  memory.set("product-lab-v1", "{}");
  let s = emptyProgress();
  s.completedLessons = ["A1", "E1", "P1"];
  s = submitLesson(s, check(true));
  s = completeLearningLesson(s, "A1");
  expect(saveProgress(s)).toBe(true);
  const loaded = loadProgress();
  expect(loaded.completedLessons).toEqual(["A1", "E1", "P1"]);
  expect(loaded.lessonAttempts).toHaveLength(1);
  expect(memory.get("product-lab-v1")).toBe("{}");
});
it("лимит попыток хранится в прогрессе и не обходится повторной записью", () => {
  const c = cloneConfig();
  c.lessons.maxAttempts = 1;
  saveSettings(c);
  let s = submitLesson(emptyProgress(), check(false));
  s = submitLesson(s, check(true, "check-b"));
  expect(s.lessonAttempts).toHaveLength(1);
  const loaded = parseProgress(s)!;
  expect(
    submitLesson(loaded, check(true, "check-c")).lessonAttempts,
  ).toHaveLength(1);
});
it("XP урока и бонус нельзя накручивать одинаковым повтором", () => {
  const c = cloneConfig();
  c.scoring.lessonXP = 25;
  c.scoring.perfectBonus = 50;
  c.scoring.improvementBonus = 30;
  saveSettings(c);
  let s = completeLearningLesson(
    submitLesson(emptyProgress(), check(true)),
    "A1",
  );
  expect(xp(s)).toBe(75);
  for (let i = 0; i < 5; i++) s = completeLearningLesson(s, "A1");
  expect(xp(s)).toBe(75);
});
it("бонус улучшения начисляется максимум один раз на уникальный урок", () => {
  const c = cloneConfig();
  c.scoring.lessonXP = 0;
  c.scoring.improvementBonus = 40;
  saveSettings(c);
  let s = completeLearningLesson(
    submitLesson(emptyProgress(), check(false)),
    "A1",
  );
  s = completeLearningLesson(submitLesson(s, check(true, "check-b")), "A1");
  expect(xp(s)).toBe(40);
  s = completeLearningLesson(submitLesson(s, check(true, "check-c")), "A1");
  expect(xp(s)).toBe(40);
});
it("новая стоимость подсказки фиксируется в попытке, старый результат не переоценивается", () => {
  const c = cloneConfig();
  c.scoring.hintCost = 7;
  saveSettings(c);
  const s = startAttempt(emptyProgress(), "market");
  const a = s.attempts[0],
    scenario = getCase("market");
  const answers = {
    ...emptyAnswers,
    node: scenario.diagnosis,
    hypothesis: 1,
    primary: 0,
    guardrail: 0,
    interpretation: scenario.correctInterpretation,
    decision: scenario.decision,
    reasons: correctReasons(scenario),
    hints: [0],
  };
  expect(totalScore(scenario, answers, a.rules)).toBe(93);
  c.scoring.hintCost = 20;
  saveSettings(c);
  expect(totalScore(scenario, answers, a.rules)).toBe(93);
  expect(parseProgress(s)?.attempts[0].rules?.hintCost).toBe(7);
  // An old in-progress attempt with no snapshot keeps its original two-point hint.
  expect(totalScore(scenario, answers, legacyScoringRules)).toBe(98);
});
it("отключение баллов действительно прекращает начисление, а не только прячет число", () => {
  const c = cloneConfig();
  c.scoring.enabled = false;
  c.scoring.lessonXP = 100;
  c.scoring.perfectBonus = 100;
  saveSettings(c);
  const scenario = getCase("market");
  expect(totalScore(scenario, { ...emptyAnswers })).toBe(0);
  expect(
    xp(
      completeLearningLesson(submitLesson(emptyProgress(), check(true)), "A1"),
    ),
  ).toBe(0);
});
it("порог сертификата и отключение сертификатов влияют на выдачу", () => {
  const s = emptyProgress();
  for (const c of cases) {
    const a = newAttempt(c.id);
    a.finished = true;
    a.score = 80;
    s.attempts.push(a);
  }
  const ids = cases.map((c) => c.id);
  const settings = cloneConfig();
  settings.scoring.passScore = 85;
  saveSettings(settings);
  expect(certificateEligibility(s, ids, ids.at(-1)!).eligible).toBe(false);
  settings.scoring.passScore = 70;
  settings.game.certificates = false;
  saveSettings(settings);
  expect(certificateEligibility(s, ids, ids.at(-1)!).eligible).toBe(false);
});
it("явный сброс прогресса не стирает аналитику и настройки", () => {
  memory.set("product-lab-v2", "progress");
  memory.set("product-lab-v1", "legacy");
  memory.set("product-lab-events-v1", "events");
  saveSettings({
    ...cloneConfig(),
    interface: { ...cloneConfig().interface, theme: "dark" },
  });
  clearLearningProgress();
  expect(memory.has("product-lab-v1")).toBe(false);
  expect(memory.has("product-lab-v2")).toBe(false);
  expect(memory.get("product-lab-events-v1")).toBe("events");
  expect(memory.has("product-lab-settings-v2")).toBe(true);
});
it("ошибка после уже правильного ответа не создаёт бонус улучшения", () => {
  const c = cloneConfig();
  c.scoring.perfectBonus = 10;
  c.scoring.improvementBonus = 100;
  saveSettings(c);
  let s = completeLearningLesson(
    submitLesson(emptyProgress(), check(true)),
    "A1",
  );
  s = submitLesson(s, check(false, "check-b"));
  s = completeLearningLesson(submitLesson(s, check(true, "check-c")), "A1");
  expect(s.lessonRewards?.A1.bonus).toBe(10);
});
