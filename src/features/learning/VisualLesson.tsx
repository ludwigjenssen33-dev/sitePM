import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  MousePointer2,
} from "lucide-react";
import { compareProportions, points } from "../../lib/statistics";
import type { Slide } from "../../data/lessons";
import LabScene from "../../components/illustrations/LabScene";
import ConceptComparison, { conceptScenes } from "./ConceptComparison";

const ru = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
/** A small concept-specific visual investigation before the full theory and numeric trainer. */
export default function VisualLesson({ lesson }: { lesson: Slide }) {
  const [value, setValue] = useState(5);
  const [selected, setSelected] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const concept = conceptScenes[lesson.id];
  const kind = lesson.widget;
  const hypothesis = lesson.id.startsWith("B") || lesson.id.startsWith("P");
  return (
    <section className="visual-lesson" aria-label="Визуальное объяснение">
      <div className="visual-lesson-caption">
        <span className="eyebrow">СНАЧАЛА — ПОСМОТРИ НА МОДЕЛЬ</span>
        <span>
          <MousePointer2 size={15} />
          Можно взаимодействовать
        </span>
      </div>
      <div className="visual-lesson-layout">
        <div className="visual-mentor">
          <LabScene variant="guide" />
          <p>
            {hypothesis
              ? "Давай отделим наблюдение от предположения."
              : kind === "ab" || kind === "sample"
                ? "Один эффект. Разная уверенность."
                : kind === "funnel"
                  ? "На каком переходе мы теряем людей?"
                  : "Подвигай один показатель. Проследи, что изменится."}
          </p>
        </div>
        <div className="visual-canvas">
          {concept ? (
            <ConceptComparison key={lesson.id} scene={concept} />
          ) : hypothesis ? (
            <>
              <div className="cause-chain">
                <span>Данные</span>
                <ArrowRight />
                <span>Предположение</span>
                <ArrowRight />
                <span>Проверка</span>
              </div>
              <h3>Данные: 4 из 10 пользователей бросают форму</h3>
              <p>Как превратить наблюдение в проверяемый следующий шаг?</p>
              <div className="visual-compare">
                {[
                  "Новая форма точно всё исправит",
                  "Уберём лишние поля и проверим конверсию",
                ].map((text, i) => (
                  <button
                    key={text}
                    className={choice === i ? "selected" : ""}
                    onClick={() => setChoice(i)}
                  >
                    <span>
                      {i === 0
                        ? "Уверенность без проверки"
                        : "Изменение + метрика"}
                    </span>
                    <strong>{text}</strong>
                  </button>
                ))}
              </div>
              {choice !== null && (
                <p className="visual-explanation" role="status">
                  {choice === 1
                    ? "Да: есть изменение и измеримый результат. Механизм — меньше усилий при заполнении — ещё предстоит проверить."
                    : "Данные локализуют потери, но не доказывают причину. Добавь измеримый результат и способ проверки."}
                </p>
              )}
            </>
          ) : kind === "funnel" ? (
            <>
              <h3>10 000 визитов. Где застряли пользователи?</h3>
              <div className="lesson-funnel">
                {[10000, 4000, 1200, 600].map((n, i) => (
                  <button
                    key={i}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                    style={{ width: `${100 - i * 16}%` }}
                  >
                    <span>{["Визит", "Карточка", "Корзина", "Оплата"][i]}</span>
                    <strong>{ru(n)}</strong>
                  </button>
                ))}
              </div>
              <div className="visual-explanation" role="status">
                <strong>
                  {
                    [
                      "Вход в воронку",
                      "40% дошли до карточки",
                      "30% добавили товар в корзину",
                      "50% оплатили корзину",
                    ][selected]
                  }
                </strong>
                <p>
                  {
                    [
                      "Это база сравнения: 10 000 уникальных визитов в учебной модели.",
                      "Потеря 6 000 пользователей. Проверь качество трафика и понятность каталога.",
                      "Потеря 2 800 пользователей. Исследуй наличие, цену и условия доставки.",
                      "Потеря 600 пользователей. Проверь форму оплаты и технические ошибки.",
                    ][selected]
                  }{" "}
                  Это направления исследования, а не доказанные причины.
                </p>
              </div>
            </>
          ) : ["ab", "sample", "pp"].includes(kind) ? (
            <>
              <h3>Рост конверсии: 5% → 5,5%</h3>
              <div className="visual-ab-groups">
                <div>
                  A<strong>5%</strong>
                </div>
                <ArrowRight />
                <div>
                  B<strong>5,5%</strong>
                </div>
              </div>
              <label className="visual-range">
                Участников на группу: {ru(value * 2000)}
                <input
                  aria-label="Выборка визуального примера"
                  type="range"
                  min={1}
                  max={15}
                  value={value}
                  onChange={(e) => setValue(+e.target.value)}
                />
              </label>
              <Interval n={value * 2000} />
              <p className="visual-explanation">
                Эффект остаётся +0,5 п.п.; интервал сужается с ростом выборки.
                Это иллюстрация при фиксированных долях, а не прогноз исхода
                реального теста.
              </p>
            </>
          ) : kind === "srm" ? (
            <>
              <h3>Рандомизация по плану 50/50</h3>
              <div className="visual-compare">
                {["50 / 50", "60 / 40"].map((t, i) => (
                  <button
                    key={t}
                    className={selected === i ? "selected" : ""}
                    onClick={() => setSelected(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div
                className="random-dots"
                aria-label={`100 назначений, группа A: ${selected ? 60 : 50}, B: ${selected ? 40 : 50}`}
              >
                {Array.from({ length: 100 }, (_, i) => (
                  <i
                    key={i}
                    className={i < (selected ? 60 : 50) ? "group-a" : "group-b"}
                  />
                ))}
              </div>
              <p className="visual-explanation">
                {selected
                  ? "При большой выборке 60/40 вместо плана 50/50 — повод проверить распределение и измерение. Добирать только малую группу нельзя."
                  : "Баланс размеров выглядит ожидаемо. Он сам по себе не доказывает корректность рандомизации и отсутствие других ошибок."}
              </p>
            </>
          ) : kind === "retention" ? (
            <>
              <h3>Из 100 новичков возвращаются…</h3>
              <div className="retention-steps">
                {[100, 55, 40, 32, 28].map((n, i) => (
                  <button
                    key={i}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    <span style={{ height: `${n + 20}px` }}>
                      <b>{n}</b>
                    </span>
                    <small>{["D0", "D1", "D7", "D14", "D30"][i]}</small>
                  </button>
                ))}
              </div>
              <p className="visual-explanation">
                {
                  [
                    "D0: исходная когорта — 100 новичков.",
                    "D1: 55 из 100 вернулись на следующий день.",
                    "D7: 40 из 100 вернулись на седьмой день.",
                    "D14: 32 из 100 вернулись через две недели.",
                    "D30: 28 из 100 активны на тридцатый день.",
                  ][selected]
                }{" "}
                Удержание считается относительно исходной когорты, а не
                предыдущего столбца. Данные синтетические.
              </p>
            </>
          ) : kind === "ltv" ? (
            <>
              <h3>Маржа важнее красивой выручки</h3>
              <label className="visual-range">
                Переменные затраты: {230 + value * 5} ₽
                <input
                  aria-label="Затраты визуального примера"
                  type="range"
                  min={1}
                  max={15}
                  value={value}
                  onChange={(e) => setValue(+e.target.value)}
                />
              </label>
              <div className="economics-equation">
                <span>
                  Доход<strong>300 ₽</strong>
                </span>
                <b>−</b>
                <span>
                  Затраты<strong>{230 + value * 5} ₽</strong>
                </span>
                <b>=</b>
                <span
                  className={
                    300 - 230 - value * 5 > 0 ? "positive" : "negative"
                  }
                >
                  Маржа<strong>{300 - 230 - value * 5} ₽</strong>
                </span>
              </div>
              <p className="visual-explanation">
                На 1 000 заказов: {ru((300 - 230 - value * 5) * 1000)} ₽
                маржинальной прибыли. Рост заказов не исправляет отрицательную
                маржу на заказ.
              </p>
            </>
          ) : kind === "segment" ? (
            <>
              <h3>Среднее может спрятать проблему</h3>
              <div className="visual-compare">
                {["30% мобильных", "70% мобильных"].map((t, i) => (
                  <button
                    key={t}
                    className={selected === i ? "selected" : ""}
                    onClick={() => setSelected(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="segment-visual">
                <span style={{ width: `${selected ? 70 : 30}%` }}>
                  Мобильные · 2%
                </span>
                <span style={{ width: `${selected ? 30 : 70}%` }}>
                  Десктоп · 6%
                </span>
              </div>
              <div className="visual-big-number">
                {selected ? "3,2%" : "4,8%"}
                <small>общая конверсия</small>
              </div>
              <p className="visual-explanation">
                Конверсии внутри групп не изменились. Общий результат упал
                только из-за изменения долей трафика. Проверяй состав аудитории.
              </p>
            </>
          ) : (
            <>
              <h3>Найди рычаг выручки</h3>
              <div className="visual-tree">
                <div className="visual-tree-root">
                  Выручка
                  <strong>
                    {ru((((200000 * value) / 100) * 2000) / 1e6)} млн ₽
                  </strong>
                </div>
                <ArrowDown />
                <div className="visual-tree-leaves">
                  {[
                    "200 000 посетителей",
                    `${ru(value)}% конверсия`,
                    "2 000 ₽ средний чек",
                  ].map((text, i) => (
                    <button
                      key={i}
                      aria-pressed={selected === i}
                      onClick={() => setSelected(i)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              <label className="visual-range">
                Конверсия в покупку
                <input
                  aria-label="Конверсия визуального дерева"
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={value}
                  onChange={(e) => setValue(+e.target.value)}
                />
              </label>
              <p className="visual-explanation">
                {
                  [
                    "Число посетителей × доля покупок = число заказов.",
                    "Конверсия показывает долю посетителей с покупкой. Изменение на 0,5 п.п. даёт 1 000 заказов при неизменных остальных факторах.",
                    "Средний чек — выручка, делённая на число заказов.",
                  ][selected]
                }{" "}
                Модель: посетители × конверсия × средний чек.
              </p>
            </>
          )}
        </div>
      </div>
      <span className="visual-model-note">
        <CheckCircle2 size={14} />
        Учебная модель · синтетические данные · ниже — подробное объяснение
      </span>
    </section>
  );
}
function Interval({ n }: { n: number }) {
  const s = compareProportions(
    Math.round(n * 0.05),
    n,
    Math.round(n * 0.055),
    n,
  );
  if (!s.ci) return null;
  const min = -0.015,
    max = 0.025;
  const x = (v: number) => 40 + ((v - min) / (max - min)) * 420;
  return (
    <div className="visual-interval">
      <svg
        viewBox="0 0 500 100"
        role="img"
        aria-label={`95% доверительный интервал эффекта: ${points(s.ci[0])} … ${points(s.ci[1])}`}
      >
        <line
          x1="40"
          x2="460"
          y1="50"
          y2="50"
          stroke="var(--chart-grid, #d8d1f5)"
          strokeWidth="2"
        />
        <line
          x1={x(0)}
          x2={x(0)}
          y1="15"
          y2="75"
          stroke="var(--muted, #8a829e)"
          strokeDasharray="4 4"
        />
        <line
          x1={x(s.ci[0])}
          x2={x(s.ci[1])}
          y1="50"
          y2="50"
          stroke="var(--chart-1, #6044ef)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle
          cx={x(s.delta)}
          cy="50"
          r="8"
          fill="#d2f66c"
          stroke="#242433"
          strokeWidth="2"
        />
        <text x={x(0)} y="94" textAnchor="middle" fontSize="12">
          0 п.п.
        </text>
        <text x="40" y="16" fontSize="12">
          95% ДИ эффекта
        </text>
      </svg>
      <strong>
        {points(s.ci[0])} … {points(s.ci[1])}
      </strong>
    </div>
  );
}
