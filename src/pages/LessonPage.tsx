import { useSettings } from "../config/store";
import { orderedCourses } from "../config/access";
import type { ProgressState } from "../domain/progress";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Target,
  Trophy,
} from "lucide-react";
import { Fragment } from "react";
import {
  courses,
  courseProgress,
  getCourse,
  lessonById,
} from "../data/courses";
import { literature, type Slide } from "../data/lessons";
import { cases } from "../data/cases";
import { navigate } from "../domain/router";
import { track } from "../analytics/events";
import Link from "../components/Link";
import LessonWidgetView from "../features/learning/LessonWidgets";
import VisualLesson from "../features/learning/VisualLesson";
const operators = new Set(["×", "+", "−", "÷", "→", "≠", "=", "·", "vs", "⇄"]);
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
/** Полная страница урока по структуре: проблема → инструмент → модель → пример → практика → применение → итог → литература. */
export default function LessonPage({
  courseId,
  lessonId,
  completed,
  onComplete,
  state,
  onCheck,
}: {
  courseId: string;
  lessonId: string;
  completed: string[];
  onComplete: (id: string) => void;
  state: ProgressState;
  onCheck: (id: string, answer: number) => boolean;
}) {
  const config = useSettings();
  const checks =
    state.lessonAttempts?.filter((a) => a.lessonId === lessonId) || [];
  const last = checks[checks.length - 1];
  const exhausted =
    config.lessons.maxAttempts > 0 &&
    checks.length >= config.lessons.maxAttempts;
  const [theoryRead, setTheoryRead] = useState(false);
  const c = getCourse(courseId);
  const l = lessonById(lessonId);
  const [answer, setAnswer] = useState(last?.answer ?? -1);
  const [checked, setChecked] = useState(!!last);
  useEffect(() => {
    if (l) track("lesson_started", { lessonId, courseId });
  }, [lessonId, courseId, l]);
  if (!c || !l || !c.modules.some((m) => m.lessons.includes(lessonId)))
    return (
      <section className="panel locked-mission">
        <h1>Урок не найден</h1>
        <p>Возможно, ссылка устарела. Откройте программу курсов.</p>
        <Link className="button primary" to="/courses">
          К курсам
          <ArrowRight size={18} />
        </Link>
      </section>
    );
  const list = c.modules.flatMap((m) => m.lessons);
  const index = list.indexOf(lessonId);
  const module = c.modules.find((m) => m.lessons.includes(lessonId))!;
  const prev = list[index - 1];
  const next = list[index + 1];
  const done = completed.includes(lessonId);
  const p = courseProgress(c, completed);
  const mission = cases.find((m) => m.id === l.caseId);
  const opts = l.options || [];
  const correct = l.correct ?? 0;
  const sequence = orderedCourses(config);
  const ci = sequence.indexOf(c);
  const nextCourse = sequence[ci + 1];
  const src = literature[l.source || ""];
  function finish() {
    onComplete(lessonId);
    if (next) navigate(`/courses/${c!.id}/${next}`);
    else navigate(`/courses/${c!.id}`);
  }
  return (
    <div className="lesson-page">
      <nav className="breadcrumbs" aria-label="Навигационная цепочка">
        <Link to="/courses">Курсы</Link>
        <ChevronRight size={14} />
        <Link to={`/courses/${c.id}`}>{c.title}</Link>
        <ChevronRight size={14} />
        <span>{module.title}</span>
        <ChevronRight size={14} />
        <span aria-current="page">
          {l.id}. {l.title}
        </span>
      </nav>
      <div className="lesson-layout">
        <aside className="lesson-nav panel" aria-label="Уроки курса">
          <Link to={`/courses/${c.id}`} className="text-button">
            <ArrowLeft size={16} />
            Программа курса
          </Link>
          <div className="lesson-nav-progress">
            <span>
              {p.done} из {p.total} уроков · {p.percent}%
            </span>
            <div className="progress">
              <span style={{ width: `${p.percent}%` }} />
            </div>
          </div>
          {c.modules.map((m, mi) => (
            <div key={m.id} className="lesson-nav-module">
              <strong>
                Модуль {mi + 1}. {m.title}
              </strong>
              <ol>
                {m.lessons.map((id) => {
                  const x = lessonById(id)!;
                  const d = completed.includes(id);
                  return (
                    <li key={id}>
                      <Link
                        to={`/courses/${c.id}/${id}`}
                        className={id === lessonId ? "active" : ""}
                        aria-current={id === lessonId ? "page" : undefined}
                      >
                        {d ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        <span>{x.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </aside>
        <article className="lesson-article">
          <header className="lesson-header">
            <span className="eyebrow">
              {c.title.toUpperCase()} · УРОК {index + 1} ИЗ {list.length}
            </span>
            <h1>{l.title}</h1>
            {config.lessons.allowSkipTheory && (
              <button
                className="text-button lesson-skip"
                onClick={() =>
                  document
                    .querySelector(".lesson-task")
                    ?.scrollIntoView({
                      behavior:
                        config.interface.animations &&
                        !matchMedia("(prefers-reduced-motion: reduce)").matches
                          ? "smooth"
                          : "instant",
                    })
                }
              >
                К мини-практике ↓
              </button>
            )}
            {done && (
              <span className="badge done-badge">
                <Check size={14} />
                Урок пройден
              </span>
            )}
          </header>
          {!config.lessons.disabledExercises.includes(lessonId) && (
            <VisualLesson key={lessonId} lesson={l} />
          )}
          <section className="lesson-block problem">
            <h2>
              <Target size={20} />
              Проблема
            </h2>
            <p>{l.problem}</p>
          </section>
          <section className="lesson-block">
            <h2>
              <BookMarked size={20} />
              Инструмент
            </h2>
            <p className="lesson-body">{l.body}</p>
          </section>
          <section className="lesson-block">
            <h2>
              <ListChecks size={20} />
              Модель
            </h2>
            <Scheme scheme={l.scheme} />
            {l.table && (
              <div className="table-scroll lesson-table">
                <table>
                  <thead>
                    <tr>
                      <th>{l.table.head[0]}</th>
                      <th>{l.table.head[1]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.table.rows.map(([a, b]) => (
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
            {l.example && (
              <div className="lesson-example">
                <Lightbulb size={21} />
                <p>{l.example}</p>
              </div>
            )}
          </section>
          {!config.lessons.disabledExercises.includes(lessonId) && (
            <section className="lesson-block">
              <h2>
                <FlaskConical size={20} />
                Попробуй сам
              </h2>
              <LessonWidgetView kind={l.widget} />
            </section>
          )}
          {opts.length > 0 && (
            <section className="lesson-block lesson-task">
              <h2>
                <Check size={20} />
                Мини-практика
              </h2>
              <p>{l.question}</p>
              <div
                className="options"
                role="radiogroup"
                aria-label="Мини-практика урока"
              >
                {opts.map((o, i) => (
                  <button
                    className={`option ${answer === i ? "selected" : ""} ${checked && config.lessons.showAnswers && i === correct ? "correct" : ""} ${checked && answer === i && i !== correct ? "wrong" : ""}`}
                    key={o}
                    disabled={exhausted}
                    role="radio"
                    aria-checked={answer === i}
                    onClick={() => {
                      setAnswer(i);
                      setChecked(false);
                    }}
                  >
                    <span className="radio">{answer === i && <span />}</span>
                    <span>{o}</span>
                  </button>
                ))}
              </div>
              <button
                className="button secondary"
                disabled={answer < 0 || exhausted || checked}
                onClick={() => {
                  if (onCheck(lessonId, answer)) setChecked(true);
                }}
              >
                Проверить
              </button>
              {checked && (
                <div
                  role="status"
                  className={`practice-feedback ${answer === correct ? "good" : "bad"}`}
                >
                  <strong>
                    {answer === correct ? "Верно." : "Не совсем."}
                  </strong>{" "}
                  {config.lessons.showAnswers && config.lessons.explanations
                    ? l.explain || `Верный ответ: ${opts[correct]}`
                    : "Ответ сохранён."}
                </div>
              )}
              {config.lessons.maxAttempts > 0 && (
                <p className="control-note">
                  Использовано попыток: {checks.length} из{" "}
                  {config.lessons.maxAttempts}.{" "}
                  {exhausted
                    ? "Лимит исчерпан; изучение материала доступно."
                    : ""}
                </p>
              )}
            </section>
          )}
          {mission && (
            <section className="lesson-block apply">
              <h2>
                <FlaskConical size={20} />
                Применение в кейсе
              </h2>
              <p>
                Этот навык понадобится в миссии{" "}
                <strong>«{mission.title}»</strong> ({mission.company}).
              </p>
              <Link className="button secondary" to={`/mission/${mission.id}`}>
                Открыть миссию
                <ArrowRight size={17} />
              </Link>
            </section>
          )}
          <section className="lesson-block summary">
            <h2>
              <Trophy size={20} />
              Итог
            </h2>
            <p>{l.summary}</p>
          </section>
          {src && (
            <section className="lesson-block literature">
              <h2>
                <BookMarked size={20} />
                Литература
              </h2>
              <p>
                {src.url ? (
                  <a href={src.url} target="_blank" rel="noreferrer">
                    {src.title}
                  </a>
                ) : (
                  src.title
                )}
              </p>
            </section>
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
          <footer className="lesson-footer">
            {prev ? (
              <Link
                className="button secondary"
                to={`/courses/${c.id}/${prev}`}
              >
                <ArrowLeft size={17} />
                Назад
              </Link>
            ) : (
              <span />
            )}
            <button
              className="button primary large"
              disabled={
                !config.lessons.allowSkipTheory &&
                (!theoryRead || checks.length === 0)
              }
              onClick={finish}
            >
              {next
                ? done
                  ? "Следующий урок"
                  : "Завершить и продолжить"
                : done
                  ? "К программе курса"
                  : "Завершить курс"}
              <ArrowRight size={18} />
            </button>
          </footer>
          {!next && done && (
            <section className="panel next-step">
              <Trophy size={26} />
              <div>
                <h3>Курс «{c.title}» пройден</h3>
                <p>
                  Закрепите навыки в миссии или переходите к следующему курсу.
                </p>
              </div>
              <div className="button-row">
                {nextCourse && (
                  <Link
                    className="button primary"
                    to={`/courses/${nextCourse.id}`}
                  >
                    Курс «{nextCourse.title}»<ArrowRight size={17} />
                  </Link>
                )}
                <Link className="button secondary" to="/cases">
                  К миссиям
                </Link>
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
