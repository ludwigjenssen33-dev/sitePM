import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { courses, courseLessons } from "../src/data/courses";
import { lessons } from "../src/data/lessons";

test("4.0: главная использует собственные иллюстрации, пример обучает и ведёт в миссию", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".hero-composition .lab-scene")).toBeVisible();
  await expect(page.locator(".hero-photo-wrap")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Без аналитики", exact: true })
    .click();
  await page.locator(".demo-metric-grid button").nth(0).click();
  await expect(page.locator(".demo-window")).toContainText(
    "Этот компонент не изменился",
  );
  await page.locator(".demo-metric-grid button").nth(1).click();
  await expect(page.locator(".demo-window")).toContainText("Верно: конверсия");
  await page
    .getByRole("button", { name: "Проверить гипотезу", exact: true })
    .click();
  await expect(page.locator(".demo-window")).toContainText(
    "Упростим оформление",
  );
  expect(errors).toEqual([]);
});

test("4.0: все 39 уроков открываются с моделью, заданием и тренажёром", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const c of courses)
    for (const id of courseLessons(c)) {
      await page.goto(`/courses/${c.id}/${id}`);
      await expect(page.locator(".lesson-header h1")).toHaveText(
        lessons.find((l) => l.id === id)!.title,
      );
      await expect(page.locator(".visual-lesson")).toBeVisible();
      await expect(page.locator(".lesson-task .option").first()).toBeVisible();
    }
  expect(errors).toEqual([]);
});

test("4.0: модели меняются от действий и переход не переносит ответ прошлого урока", async ({
  page,
}) => {
  await page.goto("/courses/analytics/A2");
  const range = page.getByLabel("Конверсия визуального дерева", {
    exact: true,
  });
  await range.fill("10");
  await expect(page.locator(".visual-tree-root")).toContainText("40 млн");
  await page.locator(".lesson-task").getByRole("radio").nth(1).click();
  await page
    .locator(".lesson-task")
    .getByRole("button", { name: "Проверить", exact: true })
    .click();
  await expect(page.locator(".practice-feedback")).toContainText("Верно");
  await page
    .getByRole("button", { name: "Завершить и продолжить", exact: true })
    .click();
  await expect(page).toHaveURL(/\/A3$/);
  await expect(page.locator(".lesson-task [aria-checked=true]")).toHaveCount(0);
  await page.reload();
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("product-lab-v2") || "{}"),
  );
  expect(progress.completedLessons).toContain("A2");
  await page.goto("/courses/analytics/A6");
  await page.locator(".lesson-funnel button").nth(2).click();
  await expect(page.locator(".visual-explanation")).toContainText(
    "Потеря 2 800",
  );
  await page.goto("/courses/abtest/C2");
  await page
    .getByLabel("Выборка визуального примера", { exact: true })
    .fill("15");
  await expect(page.locator(".visual-interval")).toContainText("п.п.");
});

test("4.0: адаптивные маршруты 320–1440 px без переполнения, фокус и reduced motion", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/courses",
      "/courses/analytics",
      "/courses/analytics/A6",
      "/courses/abtest/C2",
      "/achievements",
      "/admin/login",
      "/admin/dashboard",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} at ${width}`,
      ).toBe(true);
    }
  }
  await page.goto("/admin/login");
  await page.getByLabel("Логин", { exact: true }).focus();
  await expect(page.getByLabel("Логин", { exact: true })).toBeFocused();
});

test("4.0: закрытый API не принимает браузерную роль и отклоняет CSRF", async ({
  page,
}) => {
  await page.goto("/admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "Доступ только администратору" }),
  ).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("role", "admin");
    localStorage.setItem("isAdmin", "true");
  });
  await page.reload();
  await expect(page.locator(".admin-metrics")).toHaveCount(0);
  const response = await page.request.get("/api/admin/analytics");
  expect(response.status()).toBe(401);
  const csrf = await page.request.post("/api/admin/login", {
    headers: { Origin: "https://other.invalid", "X-ProductLab-Request": "1" },
    data: { username: "invalid", password: "invalid" },
  });
  expect(csrf.status()).toBe(403);
});

test("4.0: настоящий локальный вход, drill-down, CSV и выход", async ({
  page,
}) => {
  let credentials: { username: string; password: string };
  try {
    credentials = JSON.parse(
      await readFile(".private/admin-credentials.json", "utf8"),
    );
  } catch {
    test.skip(
      true,
      "Для локальной проверки входа выполните npm run admin:setup",
    );
    return;
  }
  await page.goto("/admin/login");
  await page.getByLabel("Логин", { exact: true }).fill(credentials.username);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page
    .getByRole("button", { name: "Войти в панель", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.locator(".admin-source-banner")).toContainText(
    "Демонстрационный режим",
  );
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "__Host-productlab_admin",
  )!;
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Воронки", exact: true }).click();
  await page.locator(".funnel-segment").nth(1).click();
  await expect(page.locator(".funnel-detail")).toContainText(
    "Конверсия с предыдущего",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Перейти к событиям этапа", exact: true })
    .click();
  await expect(page.locator(".analytics-table")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("funnel.csv");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/api/admin/analytics")).status()).toBe(401);
});
