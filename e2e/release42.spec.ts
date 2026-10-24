import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { cloneConfig, type AppConfig } from "../src/config/schema";
import { lessons } from "../src/data/lessons";
import { getCase, decisions } from "../src/data/cases";
import { correctReasons, reasonOptions } from "../src/lib/scoring";

async function importConfig(page: Page, config: AppConfig) {
  await page.goto("/settings-lab");
  await page
    .getByLabel("Файл настроек", { exact: true })
    .setInputFiles({
      name: "settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(config)),
    });
  await expect(page.getByRole("status")).toContainText("Файл проверен");
  await page.getByRole("button", { name: "Применить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Настройки применены");
}

test("4.2: четыре темы сохраняются, адаптивны и не меняют содержание", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Без аналитики", exact: true })
    .click();
  for (const theme of ["light", "dark", "christmas", "finance"]) {
    await page
      .getByLabel("Тема оформления", { exact: true })
      .selectOption(theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/",
        "/settings-lab",
        "/my-analytics",
        "/courses/analytics/A2",
        "/mission/market",
        "/admin/login",
      ]) {
        await page.goto(route);
        await expect(page.locator("main h1").first()).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${theme}, ${route}, ${width}`,
        ).toBe(true);
      }
    }
  }
  await page.goto("/courses/analytics/A2");
  await expect(page.locator(".visual-tree-root")).toContainText("20 млн");
  await expect(page.locator(".lab-scene-guide")).toBeVisible();
  expect(errors).toEqual([]);
});

test("4.2: последовательные курсы открываются после прохождения базы", async ({
  page,
}) => {
  test.setTimeout(60000);
  const c = cloneConfig();
  c.access.mode = "sequential";
  await importConfig(page, c);
  await page.goto("/courses/hypotheses/B1");
  await expect(
    page.getByRole("heading", { name: "Урок пока закрыт" }),
  ).toBeVisible();
  await page.goto("/courses/hypotheses");
  await expect(page.locator(".course-lock-note")).toContainText(
    "Курс пока закрыт",
  );
  await page.goto("/courses/analytics/A1");
  for (let i = 0; i < 10; i++) {
    await expect(page.locator(".lesson-header h1")).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 9 ? "Завершить курс" : "Завершить и продолжить",
        exact: true,
      })
      .click();
  }
  await page.goto("/courses/hypotheses/B1");
  await expect(page.locator(".lesson-header h1")).toHaveText(
    lessons.find((l) => l.id === "B1")!.title,
  );
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("product-lab-v2")!),
  );
  expect(stored.completedLessons).toHaveLength(10);
  expect(stored.lessonRewards.A1.xp).toBe(c.scoring.lessonXP);
});

test("4.2: лимит заданий, скрытие эталона, отключение тренажёра и XP действуют после обновления", async ({
  page,
}) => {
  const c = cloneConfig();
  c.lessons.maxAttempts = 1;
  c.lessons.allowSkipTheory = false;
  c.lessons.showAnswers = false;
  c.lessons.explanations = false;
  c.lessons.disabledExercises = ["A1"];
  c.scoring.lessonXP = 50;
  await importConfig(page, c);
  await page.goto("/courses/analytics/A1");
  await expect(page.locator(".visual-lesson")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Завершить и продолжить", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("radiogroup", { name: "Мини-практика урока" })
    .getByRole("radio")
    .nth(0)
    .click();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.locator(".practice-feedback")).toContainText(
    "Ответ сохранён",
  );
  await expect(page.locator(".lesson-task .correct")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Проверить", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".lesson-task")).toContainText("1 из 1");
  await page
    .getByLabel("Я изучил теорию и выполнил мини-задание", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Завершить и продолжить", exact: true })
    .click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("product-lab-v2")!),
  );
  expect(stored.lessonAttempts).toHaveLength(1);
  expect(stored.lessonRewards.A1.xp).toBe(50);
});

test("4.2: стоимость и лимит подсказок реально влияют на оценку миссии", async ({
  page,
}) => {
  const c = cloneConfig();
  c.scoring.hintCost = 5;
  c.scoring.maxHints = 1;
  await importConfig(page, c);
  await page.goto("/mission/market");
  await page.getByRole("button", { name: /Подсказка/ }).click();
  await page.getByRole("button", { name: /Открыть за −5/ }).click();
  await page
    .getByRole("button", { name: "Понятно, продолжаю", exact: true })
    .click();
  const mission = getCase("market");
  await page
    .getByTitle(
      mission.metrics.find((m) => m.id === mission.diagnosis)!.definition,
      { exact: true },
    )
    .click();
  await page
    .getByRole("button", { name: "Подтвердить диагноз", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Перейти к гипотезе", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Подсказка/ })).toBeDisabled();
  for (const [label, value] of [
    ["Выбор гипотезы", mission.hypotheses[1]],
    ["Основная метрика", mission.primary[0]],
    ["Контрольная метрика", mission.guardrails[0]],
  ])
    await page
      .getByRole("radiogroup", { name: label, exact: true })
      .getByRole("radio", { name: value, exact: true })
      .click();
  await page
    .getByRole("button", {
      name: "Зафиксировать и открыть эксперимент",
      exact: true,
    })
    .click();
  await page
    .getByRole("radiogroup", {
      name: "Интерпретация эксперимента",
      exact: true,
    })
    .getByRole("radio", {
      name: mission.interpretations[mission.correctInterpretation],
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Зафиксировать и принять решение",
      exact: true,
    })
    .click();
  await page
    .getByRole("radiogroup", { name: "Финальное решение", exact: true })
    .getByRole("radio", { name: decisions[mission.decision], exact: true })
    .click();
  for (const index of correctReasons(mission))
    await page
      .getByRole("group", { name: "Причины решения", exact: true })
      .getByLabel(reasonOptions[index], { exact: true })
      .check();
  await page
    .getByRole("button", {
      name: "Завершить миссию и увидеть последствия",
      exact: true,
    })
    .click();
  await expect(page.locator(".score-circle strong")).toHaveText("95");
  await page.reload();
  await expect(page.locator(".score-circle strong")).toHaveText("95");
});

test("4.2: настройки экспортируются, неверный импорт не меняет сохранённое", async ({
  page,
}) => {
  const c = cloneConfig();
  c.interface.theme = "finance";
  c.interface.density = "compact";
  await importConfig(page, c);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file!, "utf8"));
  expect(exported.kind).toBe("product-lab-settings");
  expect(exported.overrides.interface.theme).toBe("finance");
  const before = await page.evaluate(() =>
    localStorage.getItem("product-lab-settings-v2"),
  );
  await page
    .getByLabel("Файл настроек", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schemaVersion":2,"admin":true}'),
    });
  await expect(page.getByRole("alert")).toContainText("Неизвестная настройка");
  expect(
    await page.evaluate(() => localStorage.getItem("product-lab-settings-v2")),
  ).toBe(before);
  expect((await page.request.get("/api/admin/analytics")).status()).toBe(401);
});

test("4.2: персональная аналитика, календарь, воронка и очистка используют реальные локальные события", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/events")) requests.push(r.url());
  });
  await page.goto("/my-analytics");
  await expect(
    page.getByRole("heading", { name: "Здесь начнётся твоя история" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Включить локальную аналитику", exact: true })
    .click();
  await page.goto("/courses/analytics");
  await page
    .getByRole("link", { name: "Начать курс", exact: false })
    .first()
    .click();
  await page
    .getByRole("radiogroup", { name: "Мини-практика урока" })
    .getByRole("radio")
    .nth(0)
    .click();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await page
    .getByRole("button", { name: "Завершить и продолжить", exact: true })
    .click();
  await page.goto("/my-analytics");
  await expect(
    page.locator(".personal-stat").filter({ hasText: "Завершено уроков" }),
  ).toContainText("1");
  await expect(
    page.locator(".personal-stat").filter({ hasText: "Ошибки" }),
  ).toContainText("1");
  const activeDay = page.locator(
    '.activity-heatmap button:not([data-level="0"])',
  );
  await expect(activeDay).toHaveCount(1);
  await activeDay.click();
  await expect(page.locator(".day-drilldown")).toContainText("событий");
  await page.getByRole("button", { name: "Воронка", exact: true }).click();
  await page.locator(".funnel-segment").nth(1).click();
  await expect(page.locator(".funnel-detail")).toContainText(
    "Конверсия с предыдущего",
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("product-lab-v2"),
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Экспорт аналитики JSON", exact: true })
    .click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(
    exported.events.some(
      (e: { type: string }) => e.type === "lesson_completed",
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Очистить только аналитику", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Да, удалить аналитику", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("product-lab-v2")),
  ).toBe(before);
  expect(
    await page.evaluate(() => localStorage.getItem("product-lab-events-v1")),
  ).toBeNull();
  expect(requests).toEqual([]);
});

test("4.2: активное время не удваивается после обновления и не растёт у скрытой вкладки", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-24T10:00:00Z") });
  await page.goto("/my-analytics");
  await page
    .getByRole("button", { name: "Включить локальную аналитику", exact: true })
    .click();
  await page.goto("/courses/analytics/A1");
  await expect(page.locator(".lesson-header")).toBeVisible();
  await page.clock.runFor(11000);
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("product-lab-events-v1") || "[]").some(
      (e: { type: string }) => e.type === "active_learning",
    ),
  );
  const duration = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("product-lab-events-v1") || "[]")
        .filter((e: { type: string }) => e.type === "active_learning")
        .reduce(
          (s: number, e: { params: { durationMs: number } }) =>
            s + e.params.durationMs,
          0,
        ),
    );
  const first = await duration();
  expect(first).toBeGreaterThanOrEqual(9000);
  await page.reload();
  await expect(page.locator(".lesson-header")).toBeVisible();
  await page.clock.runFor(11000);
  const second = await duration();
  expect(second).toBeGreaterThan(first);
  expect(second).toBeLessThanOrEqual(25000);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await duration();
  await page.clock.runFor(20000);
  expect(await duration()).toBe(hidden);
});

test("4.2: контраст основного текста и кнопок не ниже 4,5 во всех темах", async ({
  page,
}) => {
  await page.goto("/settings-lab");
  for (const theme of ["light", "dark", "christmas", "finance"]) {
    await page
      .getByLabel("Тема оформления", { exact: true })
      .selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const ratios = await page.evaluate(() => {
      const rgb = (s: string) => {
        const v = s.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
        return [v[0], v[1], v[2], v[3] ?? 1];
      };
      const lum = (c: number[]) =>
        c
          .slice(0, 3)
          .map((v) => {
            const n = v / 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        ".control-note",
        ".setting-toggle strong",
        ".control-save .primary",
        ".local-mode-note p",
      ].map((selector) => {
        const e = document.querySelector(selector)!;
        let node: Element | null = e,
          bg = [255, 255, 255, 1];
        while (node) {
          const c = rgb(getComputedStyle(node).backgroundColor);
          if (c[3] === 1) {
            bg = c;
            break;
          }
          node = node.parentElement;
        }
        const a = lum(rgb(getComputedStyle(e).color)),
          b = lum(bg);
        return {
          selector,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    for (const r of ratios)
      expect(r.ratio, `${theme}: ${r.selector}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("4.2: игровые и визуальные флаги действуют, сброс настроек сохраняет прогресс", async ({
  page,
}) => {
  await page.goto("/courses/analytics/A1");
  await page
    .getByRole("button", { name: "Завершить и продолжить", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("product-lab-v2"),
  );
  const c = cloneConfig();
  c.game.achievements = false;
  c.game.certificates = false;
  c.game.ranking = false;
  c.game.levels = false;
  c.interface.characters = false;
  c.interface.animations = false;
  c.content.showDemos = false;
  await importConfig(page, c);
  await page.goto("/");
  await expect(page.locator(".hero-composition")).toBeHidden();
  await expect(page.locator(".pricing")).toBeHidden();
  await expect(page.locator(".xp-badge")).toBeHidden();
  await page.goto("/achievements");
  await expect(
    page.getByRole("heading", { name: "Раздел скрыт в этом браузере" }),
  ).toBeVisible();
  await page.goto("/cabinet/certificate");
  await expect(
    page.getByRole("heading", { name: "Раздел скрыт в этом браузере" }),
  ).toBeVisible();
  await page.goto("/settings-lab");
  await page
    .getByRole("button", { name: "Восстановить по умолчанию", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подтвердить сброс", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => localStorage.getItem("product-lab-v2")),
  ).toBe(before);
  await page.goto("/achievements");
  await expect(page.locator(".achievement-grid")).toBeVisible();
});
