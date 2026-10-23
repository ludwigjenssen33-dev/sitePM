import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { cases, getCase, caseVariants, type Case } from '../src/data/cases';
import { lessons } from '../src/data/lessons';
import { correctReasons, emptyAnswers, reasonOptions, score } from '../src/lib/scoring';
import { emptyProgress, newAttempt } from '../src/domain/progress';

// Each Playwright test has an isolated browser context; no user's stored progress is touched.
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main h1').first()).toBeVisible();
  // Close an optional first-visit introduction without changing the learning flow.
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
}
async function chooseDiagnosis(page: Page, c: Case) {
  const metric = c.metrics.find(m => m.id === c.diagnosis)!;
  await page.getByTitle(metric.definition, { exact: true }).click();
  await expect(page.locator('.metric-detail')).toContainText(metric.name);
  await page.getByRole('button', { name: 'Подтвердить диагноз', exact: true }).click();
  await page.getByRole('button', { name: 'Перейти к гипотезе', exact: true }).click();
}
async function finishMission(page: Page, c: Case, fromStart = true) {
  if (fromStart) await chooseDiagnosis(page, c);
  await page.getByRole('radiogroup', { name: 'Выбор гипотезы', exact: true }).getByRole('radio').nth(1).click();
  await page.getByRole('radiogroup', { name: 'Основная метрика', exact: true }).getByRole('radio').first().click();
  await page.getByRole('radiogroup', { name: 'Контрольная метрика', exact: true }).getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Зафиксировать и открыть эксперимент', exact: true }).click();
  await expect(page.getByText('Можно ли доверять тесту', { exact: false })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Интерпретация эксперимента', exact: true }).getByRole('radio').nth(c.correctInterpretation).click();
  await page.getByRole('button', { name: 'Зафиксировать и принять решение', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Финальное решение', exact: true }).getByRole('radio').nth(c.decision).click();
  const reasons = page.getByRole('group', { name: 'Причины решения', exact: true });
  for (const index of correctReasons(c)) await reasons.getByLabel(reasonOptions[index], { exact: true }).check();
  await page.getByLabel('Заметка для себя', { exact: false }).fill('Учебная заметка для проверки сохранения.');
  await page.getByRole('button', { name: 'Завершить миссию и увидеть последствия', exact: true }).click();
  await expect(page.locator('.score-circle strong')).toBeVisible();
}
const routes = ['/', '/map', '/cases', '/learn', '/skills', '/ranking', '/certificate', '/lab', '/admin', '/account', '/privacy', '/404'];

test('основные маршруты и прямое открытие неизвестной страницы', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const route of routes) { await open(page, route); await expect(page.locator('main')).not.toBeEmpty(); }
  await open(page, '/unknown-product-lab-page');
  await expect(page.getByText('404', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const base of cases) {
  test(`${base.company}: миссия 100/100, последствия и сохранение`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, `/mission/${base.id}`);
    await expect(page.locator('.review')).toHaveCount(0);
    await finishMission(page, getCase(base.id));
    await expect(page.locator('.score-circle strong')).toHaveText('100');
    await expect(page.locator('.review')).toHaveCount(5);
    await expect(page.locator('.consequence-card')).toContainText('УЧЕБНАЯ МОДЕЛЬ');
    await expect(page.getByRole('columnheader', { name: 'Чего это не доказывает' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.score-circle strong')).toHaveText('100');
    await expect(page.locator('.user-note')).toHaveText('Учебная заметка для проверки сохранения.');
    await page.locator('.review .theory-link').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}

test('подсказка штрафует один раз, не выдаёт готовый диагноз и сохраняется', async ({ page }) => {
  await open(page, '/mission/market');
  await page.getByRole('button', { name: /Подсказка/ }).click();
  await expect(page.getByRole('dialog')).toContainText('2 балла');
  await page.getByRole('button', { name: 'Открыть за −2 балла', exact: true }).click();
  await page.getByRole('button', { name: 'Понятно, продолжаю', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Подсказка · открыта/ })).toBeVisible();
  await page.getByRole('button', { name: /Подсказка · открыта/ }).click();
  await expect(page.getByRole('dialog')).toContainText('повторное открытие бесплатно');
  await page.keyboard.press('Escape');
  await finishMission(page, getCase('market'));
  await expect(page.locator('.score-circle strong')).toHaveText('98');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('product-lab-v2')!));
  expect(state.attempts.find((a: { id: string }) => a.id === state.active.market).answers.hints).toEqual([0]);
});

test('обоснование влияет на балл независимо от свободного текста', async ({ page }) => {
  await open(page, '/mission/market');
  await chooseDiagnosis(page, getCase('market'));
  await page.getByRole('radiogroup', { name: 'Выбор гипотезы', exact: true }).getByRole('radio').nth(1).click();
  for (const name of ['Основная метрика', 'Контрольная метрика']) await page.getByRole('radiogroup', { name, exact: true }).getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Зафиксировать и открыть эксперимент', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Интерпретация эксперимента', exact: true }).getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Зафиксировать и принять решение', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Финальное решение', exact: true }).getByRole('radio').nth(2).click();
  await page.getByRole('group', { name: 'Причины решения', exact: true }).getByLabel(reasonOptions[5], { exact: true }).check();
  await page.getByLabel('Заметка для себя', { exact: false }).fill('p-value, плановая выборка, конверсия — эти слова не должны повышать балл.');
  await page.getByRole('button', { name: 'Завершить миссию и увидеть последствия', exact: true }).click();
  await expect(page.locator('.score-circle strong')).toHaveText('92');
});

test('новый набор данных сохраняет историю и сравнивает попытки без накрутки XP', async ({ page }) => {
  await open(page, '/mission/market');
  await finishMission(page, getCase('market'));
  await page.getByRole('button', { name: 'Попробовать с другими данными', exact: true }).click();
  await page.getByRole('button', { name: 'Начать новую попытку', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить диагноз', exact: true })).toBeDisabled();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('product-lab-v2')!));
  expect(state.attempts).toHaveLength(2);
  expect(state.attempts[0].score).toBe(100);
  expect(state.attempts[1].variant).toBe(1 % caseVariants('market').length);
  await finishMission(page, getCase('market', state.attempts[1].variant));
  await expect(page.locator('.score-circle strong')).toHaveText('100');
  await expect(page.getByRole('heading', { name: 'Твой прогресс между попытками', exact: true })).toBeVisible();
  await page.goto('/skills');
  await expect(page.getByText('1 000', { exact: false }).first()).toBeVisible();
});

test('все 14 уроков открываются по уникальному ID', async ({ page }) => {
  await open(page, '/learn');
  expect(lessons).toHaveLength(14);
  for (const lesson of lessons) {
    await page.locator('.lesson-links button').filter({ has: page.locator('span', { hasText: new RegExp(`^${lesson.id}$`) }) }).click();
    await expect(page.getByRole('dialog')).toContainText(lesson.title);
    await page.keyboard.press('Escape');
  }
});

test('старый прогресс переносится без удаления исходного ключа', async ({ page }) => {
  const legacy = { market: { step: 3, answers: { ...emptyAnswers, node: 'conversion', hypothesis: 1, primary: 0, guardrail: 0, interpretation: 0, decision: 2, note: 'Историческая заметка' }, confirmed: true, finished: true, best: 100, score: 100, updated: '2026-10-20T12:00:00.000Z' } };
  await page.addInitScript(data => { if (!localStorage.getItem('product-lab-v1')) localStorage.setItem('product-lab-v1', JSON.stringify(data)); }, legacy);
  await open(page, '/mission/market');
  await expect(page.locator('.score-circle strong')).toHaveText('100');
  await expect(page.locator('.user-note')).toHaveText('Историческая заметка');
  const stored = await page.evaluate(() => ({ old: JSON.parse(localStorage.getItem('product-lab-v1')!), current: JSON.parse(localStorage.getItem('product-lab-v2')!) }));
  expect(stored.old).toEqual(legacy);
  expect(stored.current.attempts.some((a: { migrated: boolean; score: number }) => a.migrated && a.score === 100)).toBe(true);
});

test('демонстрационная оплата не делает внешних запросов и ведёт на 404', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { const host = new URL(r.url()).hostname; if (!['127.0.0.1', 'localhost'].includes(host)) external.push(host); });
  await open(page, '/');
  await page.getByRole('button', { name: 'Оплатить курс', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('не списываем деньги');
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Подтвердить демо-оплату', exact: true }).click();
  await expect(page).toHaveURL(/\/404$/);
  await expect(page.getByRole('button', { name: 'Вернуться к курсу', exact: true })).toBeVisible();
  expect(external).toEqual([]);
});

test('сертификат недоступен без выполнения условий, образец явно помечен', async ({ page }) => {
  await open(page, '/certificate');
  await expect(page.getByText('ОБРАЗЕЦ · УЧЕБНАЯ ДЕМОНСТРАЦИЯ', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Получить игровой сертификат/ })).toHaveCount(0);
  await expect(page.getByText('Не является документом об образовании.', { exact: false })).toBeVisible();
});

test('сертификат выдаётся по условиям и скачивается как настоящий PDF', async ({ page }) => {
  const state = emptyProgress(); state.profile.alias = 'Тестовый исследователь';
  for (const c of cases) {
    const attempt = newAttempt(c.id);
    attempt.answers = { ...emptyAnswers, node: c.diagnosis, hypothesis: 1, primary: 0, guardrail: 0, interpretation: c.correctInterpretation, decision: c.decision, reasons: correctReasons(c), hints: [] };
    attempt.step = 3; attempt.confirmed = true; attempt.finished = true; attempt.score = 100; attempt.criteria = score(c, attempt.answers).map(r => ({ name: r.name, points: r.points, max: r.max }));
    state.attempts.push(attempt); state.active[c.id] = attempt.id;
  }
  await page.addInitScript(data => { if (!localStorage.getItem('product-lab-v2')) localStorage.setItem('product-lab-v2', JSON.stringify(data)); }, state);
  await open(page, '/certificate');
  await page.getByRole('button', { name: /Получить игровой сертификат/ }).click();
  await expect(page.locator('.certificate-eyebrow')).toHaveText('ИГРОВОЙ СЕРТИФИКАТ');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path(); expect(file).not.toBeNull();
  expect((await readFile(file!)).subarray(0, 4).toString()).toBe('%PDF');
  await page.reload();
  await expect(page.locator('.certificate-name')).toHaveText('Тестовый исследователь');
});

test('демо-админка не предоставляет настоящую роль администратора', async ({ page }) => {
  await open(page, '/admin');
  await expect(page.getByText('Демо-просмотр не предоставляет административных прав.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Сервер · проверка доступа', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Supabase не настроен');
  await expect(page.getByRole('button', { name: 'Сохранить черновик на сервере', exact: true })).toHaveCount(0);
});

test('каждый сегмент воронки кликабелен; фильтры, детализация и CSV работают', async ({ page }) => {
  await open(page, '/admin');
  await page.getByRole('button', { name: 'Воронки', exact: true }).click();
  const segments = page.locator('.funnel-segment');
  expect(await segments.count()).toBeGreaterThan(1);
  for (let i = 0; i < await segments.count(); i++) {
    await segments.nth(i).click();
    await expect(segments.nth(i)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.funnel-detail')).toContainText('Конверсия с предыдущего');
  }
  await page.getByLabel('Тип воронки', { exact: true }).selectOption('cases');
  await page.getByLabel('Период воронки', { exact: true }).selectOption('7');
  await page.getByLabel(/^Устройство/).selectOption('mobile');
  await page.getByRole('button', { name: 'Перейти к событиям этапа', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test('мобильные основные страницы не переполняют экран 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of routes) {
    await open(page, route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Переполнение: ${route}`).toBe(true);
  }
  await open(page, '/mission/market');
  await finishMission(page, getCase('market'));
  await expect(page.locator('.score-circle strong')).toHaveText('100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('аналитика добровольная, не получает заметку и удаляется при отказе', async ({ page }) => {
  await open(page, '/privacy');
  expect(await page.evaluate(() => localStorage.getItem('product-lab-events-v1'))).toBeNull();
  await page.getByRole('button', { name: 'Разрешить локальную аналитику', exact: true }).click();
  await page.goto('/mission/market');
  await finishMission(page, getCase('market'));
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('product-lab-events-v1') || '[]'));
  expect(events.some((e: { type: string }) => e.type === 'case_completed')).toBe(true);
  expect(JSON.stringify(events)).not.toContain('Учебная заметка для проверки сохранения.');
  expect(events.every((e: { params: Record<string, unknown> }) => !('note' in e.params) && !('email' in e.params) && !('password' in e.params))).toBe(true);
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Отключить аналитику', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('product-lab-events-v1'))).toBeNull();
});
