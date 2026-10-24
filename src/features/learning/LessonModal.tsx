import { useSettings } from "../../config/store";
import type { ProgressState } from "../../domain/progress";
import { Fragment, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Lightbulb,
} from "lucide-react";
import Modal from "../../components/Modal";
import {
  lessons,
  lessonGroups,
  literature,
  type Slide,
} from "../../data/lessons";
import { locateLesson } from "../../data/courses";
import { percent } from "../../lib/statistics";
import { track } from "../../analytics/events";
import Link from "../../components/Link";
import VisualLesson from "./VisualLesson";
const operators = new Set(["×", "+", "−", "÷", "→", "≠", "=", "·", "vs", "⇄"]);
/** Схема урока: строки «узлов» с операторами между ними, сверху вниз. */
function Scheme({ scheme }: { scheme: Slide["scheme"] }) {
  return (
    <div className="lesson-scheme">
      {scheme.rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <ArrowDown size={20} />}
          <div>
            {row.map((t, j) =>
              operators.has(t) ? (
                <b className="scheme-op" key={j}>
                  {t}
                </b>
              ) : (
                <span key={j}>{t}</span>
              ),
            )}
          </div>
        </Fragment>
      ))}
      {scheme.caption && <small>{scheme.caption}</small>}
    </div>
  );
}
export default function LessonModal({
  id,
  onClose,
  onNavigate,
  onComplete,
  state,
  onCheck,
}: {
  id: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onComplete: (id: string) => void;
  state: ProgressState;
  onCheck: (id: string, a: number) => boolean;
}) {
  const config = useSettings();
  const checks = state.lessonAttempts?.filter((a) => a.lessonId === id) || [];
  const last = checks[checks.length - 1];
  const exhausted =
    config.lessons.maxAttempts > 0 &&
    checks.length >= config.lessons.maxAttempts;
  const [theoryRead, setTheoryRead] = useState(false);
  const s = lessons.find((l) => l.id === id);
  const [answer, setAnswer] = useState(last?.answer ?? -1);
  const [checked, setChecked] = useState(!!last);
  const [base, setBase] = useState(5);
  const [after, setAfter] = useState(5.5);
  if (!s)
    return (
      <Modal title="Урок перемещён" onClose={onClose}>
        <p>Откройте обновлённую библиотеку уроков.</p>
      </Modal>
    );
  const group = lessons.filter((l) => l.id[0] === s.id[0]);
  const idx = group.findIndex((l) => l.id === s.id);
  const opts = s.options || [
    "Данные показывают изменение; причину нужно проверять.",
    "Любое изменение метрики доказывает причину.",
  ];
  const correct = s.correct ?? 0;
  return (
    <Modal title={s.title} onClose={onClose} wide>
      <div className="lesson-meta">
        <span className="pill">
          {s.id} · {lessonGroups.find((g) => g.id === s.id[0])?.name}
        </span>
        <span>
          {idx + 1} / {group.length}
        </span>
      </div>
      <div className="lesson-progress">
        {group.map((l) => (
          <button
            key={l.id}
            aria-label={`Слайд ${l.id}`}
            className={l.id === s.id ? "active" : ""}
            onClick={() => onNavigate(l.id)}
          />
        ))}
      </div>
      {s.problem && (
        <div className="notice">
          <Lightbulb size={20} />
          <span>{s.problem}</span>
        </div>
      )}
      {!config.lessons.disabledExercises.includes(s.id) && (
        <VisualLesson key={s.id} lesson={s} />
      )}
      <p className="lesson-body">{s.body}</p>
      <Scheme scheme={s.scheme} />
      {s.table && (
        <div className="table-scroll lesson-table">
          <table>
            <thead>
              <tr>
                <th>{s.table.head[0]}</th>
                <th>{s.table.head[1]}</th>
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map(([a, b]) => (
                <tr key={a}>
                  <td>
                    <strong>{a}</strong>
                  </td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.example && (
        <div className="lesson-example">
          <Lightbulb size={21} />
          <p>{s.example}</p>
        </div>
      )}
      {s.numbers && (
        <details className="interactive-lesson">
          <summary>Потрогать числа: проценты и процентные пункты</summary>
          <div className="two-columns">
            <label>
              Базовая конверсия: {base.toLocaleString("ru-RU")}%
              <input
                type="range"
                min="1"
                max="50"
                step=".5"
                value={base}
                onChange={(e) => setBase(+e.target.value)}
              />
            </label>
            <label>
              Новая конверсия: {after.toLocaleString("ru-RU")}%
              <input
                type="range"
                min="1"
                max="50"
                step=".5"
                value={after}
                onChange={(e) => setAfter(+e.target.value)}
              />
            </label>
          </div>
          <div className="lesson-math">
            <span>
              Абсолютно{" "}
              <strong>
                {(after - base > 0 ? "+" : after - base < 0 ? "−" : "") +
                  Math.abs(after - base).toLocaleString("ru-RU")}{" "}
                п.п.
              </strong>
            </span>
            <ArrowRight />
            <span>
              Относительно <strong>{percent(after / base - 1)}</strong>
            </span>
          </div>
        </details>
      )}
      <section className="lesson-task">
        <h3>Проверь себя</h3>
        <p>
          {s.question || "Какой подход помогает избежать поспешного решения?"}
        </p>
        <div
          className="options"
          role="radiogroup"
          aria-label="Мини-задание урока"
        >
          {opts.map((o, i) => (
            <button
              className={`option ${answer === i ? "selected" : ""}`}
              key={o}
              disabled={exhausted}
              role="radio"
              aria-checked={answer === i}
              onClick={() => {
                setAnswer(i);
                setChecked(false);
              }}
            >
              {o}
            </button>
          ))}
        </div>
        <button
          className="button secondary"
          disabled={answer < 0 || exhausted || checked}
          onClick={() => {
            if (onCheck(s.id, answer)) setChecked(true);
          }}
        >
          Проверить
        </button>
        {checked && (
          <p
            role="status"
            className={answer === correct ? "success" : "warning-text"}
          >
            {answer === correct
              ? "Верно. Примените принцип в миссии."
              : config.lessons.showAnswers && config.lessons.explanations
                ? `Попробуйте ещё раз: ${opts[correct]}`
                : "Ответ сохранён. Эталон скрыт настройкой."}
          </p>
        )}
      </section>
      <div className="lesson-source">
        <BookOpen size={16} />
        <span>
          Источник:{" "}
          {literature[s.source || ""]?.title || "учебная модель Product Lab."}
        </span>
      </div>
      {locateLesson(s.id) && (
        <Link
          className="text-button"
          to={`/courses/${locateLesson(s.id)!.course.id}/${s.id}`}
        >
          Открыть урок полностью: пример, тренажёр и итог
          <ArrowRight size={16} />
        </Link>
      )}
      {!config.lessons.allowSkipTheory && (
        <label className="theory-confirm">
          <input
            type="checkbox"
            checked={theoryRead}
            onChange={(e) => setTheoryRead(e.target.checked)}
          />
          Я изучил теорию и выполнил мини-задание
        </label>
      )}
      <div className="modal-bottom">
        <button
          className="button secondary"
          disabled={idx === 0}
          onClick={() => onNavigate(group[idx - 1].id)}
        >
          Назад
        </button>
        <button
          className="button primary"
          disabled={
            !config.lessons.allowSkipTheory &&
            (!theoryRead || checks.length === 0)
          }
          onClick={() => {
            onComplete(s.id);
            if (idx < group.length - 1) onNavigate(group[idx + 1].id);
            else onClose();
          }}
        >
          {idx === group.length - 1 ? "Завершить главу" : "Изучено · дальше"}
          <Check size={17} />
        </button>
      </div>
    </Modal>
  );
}
