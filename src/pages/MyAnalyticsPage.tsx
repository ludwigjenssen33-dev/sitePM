import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  analyticsConsent,
  clearAnalytics,
  EVENT_LIMIT,
  eventLabels,
  getEvents,
  setAnalyticsConsent,
} from "../analytics/events";
import {
  heatmapDates,
  learningMinutes,
  personalReport,
} from "../analytics/personal";
import { courses, locateLesson } from "../data/courses";
import { cases } from "../data/cases";
import { skills, type ProgressState } from "../domain/progress";
import { downloadJson } from "../services/exportJson";
import FunnelChart from "../components/FunnelChart";
import Modal from "../components/Modal";
import Link from "../components/Link";
export default function MyAnalyticsPage({ state }: { state: ProgressState }) {
  const [events, setEvents] = useState(getEvents);
  const [consent, setConsent] = useState(analyticsConsent);
  const [days, setDays] = useState(30);
  const [courseId, setCourse] = useState("all");
  const [caseId, setCase] = useState("all");
  const [date, setDate] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => {
      setEvents(getEvents());
      setConsent(analyticsConsent());
    };
    window.addEventListener("product-lab:analytics", refresh);
    window.addEventListener("product-lab:consent", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("product-lab:analytics", refresh);
      window.removeEventListener("product-lab:consent", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const r = useMemo(
    () => personalReport(events, { days, courseId, caseId }),
    [events, days, courseId, caseId],
  );
  const heat = heatmapDates(r.daily);
  const sk = skills(state);
  const selected = r.events.filter(
    (e) => !date || e.timestamp.startsWith(date),
  );
  const fmt = (v: number | null, suffix = "") =>
    v === null
      ? "Недостаточно данных"
      : v.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + suffix;
  const times = r.times.map((t) => ({
    ...t,
    title: courses.find((c) => c.id === t.id)?.title || "Практические кейсы",
  }));
  return (
    <div className="personal-analytics">
      <header className="control-title">
        <div>
          <span className="eyebrow">MY ANALYTICS · ДАННЫЕ О ТВОЁМ ПУТИ</span>
          <h1>
            Увидеть прогресс.
            <br />
            <em>Найти следующий шаг.</em>
          </h1>
          <p>
            Настоящие события этого браузера. Без регистрации, серверного
            хранения и статистики других людей.
          </p>
        </div>
        <Activity size={45} />
      </header>
      <div className="local-mode-note">
        <Clock3 size={23} />
        <div>
          <strong>Персональная аналитика хранится только здесь</strong>
          <p>
            Время считается при активной вкладке на учебной странице. После 30
            минут бездействия или 8 часов сессия заканчивается. В историю
            попадают только события после согласия; прошлые действия не
            восстанавливаются из предположений.
          </p>
        </div>
        <Link className="text-button" to="/settings-lab">
          Настроить обучение →
        </Link>
      </div>
      {consent !== true && (
        <div className="notice">
          <div>
            <strong>
              Сбор локальных событий{" "}
              {consent === false ? "отключён" : "ещё не включён"}
            </strong>
            <p>
              Можно разрешить только локальную запись уроков, ответов, подсказок
              и активного времени. Ни один из этих событий не отправляется на
              сервер.
            </p>
            <button
              className="button primary"
              onClick={() => {
                setAnalyticsConsent(true);
                setConsent(true);
              }}
            >
              Включить локальную аналитику
            </button>
          </div>
        </div>
      )}
      <div className="personal-toolbar">
        <Filter size={18} />
        <label>
          Период
          <select
            aria-label="Период персональной аналитики"
            value={days}
            onChange={(e) => {
              setDays(+e.target.value);
              setDate(null);
            }}
          >
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
            <option value={0}>Вся история</option>
          </select>
        </label>
        <label>
          Курс
          <select
            aria-label="Курс персональной аналитики"
            value={courseId}
            onChange={(e) => {
              setCourse(e.target.value);
              setDate(null);
            }}
          >
            <option value="all">Все курсы</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Кейс
          <select
            aria-label="Кейс персональной аналитики"
            value={caseId}
            onChange={(e) => {
              setCase(e.target.value);
              setDate(null);
            }}
          >
            <option value="all">Все кейсы</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary compact"
          onClick={() => setEvents(getEvents())}
        >
          <RefreshCw size={15} />
          Обновить
        </button>
      </div>
      <div className="tabs personal-tabs">
        {[
          ["overview", "Обзор"],
          ["tasks", "Задания и ошибки"],
          ["funnel", "Воронка"],
          ["history", "События"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {!r.events.length && (
        <section className="panel personal-empty">
          <Activity size={32} />
          <h2>Здесь начнётся твоя история</h2>
          <p>
            {consent === true
              ? "Для выбранных условий пока нет событий. Пройди урок или измени фильтры."
              : "Разреши локальную запись, чтобы увидеть свои реальные действия. Обучение доступно и без аналитики."}
          </p>
          <Link className="button primary" to="/courses">
            Открыть курсы
            <ArrowRight size={17} />
          </Link>
        </section>
      )}
      {tab === "overview" ? (
        <>
          <div className="personal-stats">
            {[
              ["Сессии", r.sessions],
              ["Активное обучение", learningMinutes(r.activeMs)],
              ["Завершено уроков", r.lessons],
              ["Завершено кейсов", r.cases],
              ["Средний балл кейсов", fmt(r.mean, " / 100")],
              ["Ошибки", r.errors],
              ["Подсказки", r.hints],
              ["Повторные попытки", r.retries],
              ["Проверки с результатом", r.answers],
              [
                "Доля ошибок",
                r.answers
                  ? fmt((r.errors / r.answers) * 100, "%")
                  : "Недостаточно данных",
              ],
              ["Сертификаты", r.certificates],
              ["Переходы между курсами", r.transitions],
            ].map(([name, value]) => (
              <section className="panel personal-stat" key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
              </section>
            ))}
          </div>
          <div className="personal-chart-grid">
            <section className="panel">
              <h2>Активность по дням</h2>
              <p className="control-note">
                UTC · нажми на точку или день календаря для детализации
              </p>
              {r.daily.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={r.daily}
                    onClick={(v) => {
                      if (typeof v.activeLabel === "string")
                        setDate(v.activeLabel);
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => v.slice(5)}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="events"
                      name="События"
                      fill="var(--chart-muted)"
                    />
                    <Bar
                      dataKey="lessons"
                      name="Уроки завершены"
                      fill="var(--chart-1)"
                    />
                    <Bar
                      dataKey="cases"
                      name="Кейсы завершены"
                      fill="var(--chart-2)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </section>
            <section className="panel">
              <h2>Динамика результатов</h2>
              <p className="control-note">
                Каждая точка — завершённая попытка с записанным баллом
              </p>
              {r.scores.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={r.scores}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="attempt" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip labelFormatter={(v) => `Попытка ${v}`} />
                    <Line
                      dataKey="score"
                      name="Балл / 100"
                      stroke="var(--chart-1)"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </section>
          </div>
          <section className="panel activity-calendar">
            <div className="section-heading">
              <div>
                <h2>Ритм твоего обучения</h2>
                <p className="control-note">
                  26 недель · UTC · показаны только события выбранного периода и
                  фильтров
                </p>
              </div>
              <span className="heatmap-legend">
                Меньше <i />
                <i />
                <i />
                <i /> Больше
              </span>
            </div>
            <div className="heatmap-scroll">
              <div className="activity-heatmap">
                {heat.map((d) => (
                  <button
                    key={d.date}
                    data-level={
                      d.events === 0
                        ? 0
                        : d.events < 5
                          ? 1
                          : d.events < 15
                            ? 2
                            : d.events < 40
                              ? 3
                              : 4
                    }
                    aria-pressed={date === d.date}
                    title={`${d.date}: ${d.events} событий, ${learningMinutes(d.activeMs)}`}
                    aria-label={`${d.date}: ${d.events} событий, ${learningMinutes(d.activeMs)}`}
                    onClick={() => setDate(date === d.date ? null : d.date)}
                  />
                ))}
              </div>
            </div>
            {date && (
              <div className="day-drilldown">
                <strong>
                  {date}: {selected.length} событий
                </strong>
                <p>
                  {learningMinutes(
                    r.daily.find((d) => d.date === date)?.activeMs || 0,
                  )}{" "}
                  активного обучения.
                </p>
                <button
                  className="text-button"
                  onClick={() => setTab("history")}
                >
                  Посмотреть события дня →
                </button>
                <button className="text-button" onClick={() => setDate(null)}>
                  Снять выбор
                </button>
              </div>
            )}
          </section>
          <div className="personal-chart-grid">
            <section className="panel">
              <h2>Куда ушло учебное время</h2>
              {times.length ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={times}
                      layout="vertical"
                      margin={{ left: 15, right: 25 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" unit=" мин" />
                      <YAxis
                        type="category"
                        dataKey="title"
                        width={120}
                        tickFormatter={(v) =>
                          v.length > 19 ? v.slice(0, 18) + "…" : v
                        }
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="minutes"
                        name="Активные минуты"
                        fill="var(--chart-2)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="control-note">
                    Кейсы показаны отдельно и не дублируются в нескольких
                    курсах. Скрытая вкладка не учитывается.
                  </p>
                </>
              ) : (
                <Empty />
              )}
            </section>
            <section className="panel">
              <h2>Личный профиль навыков</h2>
              <p className="control-note">
                Источник: сохранённые лучшие результаты кейсов. Этот профиль
                независим от фильтров событий.
              </p>
              {sk.some((s) => s.cases > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={sk}>
                    <PolarGrid />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "var(--muted)" }}
                    />
                    <Radar
                      name="Освоение, %"
                      dataKey="percent"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.25}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </section>
          </div>
        </>
      ) : tab === "tasks" ? (
        <section className="panel">
          <h2>На каких заданиях остановиться</h2>
          <p className="control-note">
            Доля ошибок — неверные проверки / проверки с известным результатом.
            Повторные проверки включены. Для старых событий без результата ответ
            не выдумывается.
          </p>
          {r.tasks.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Задание</th>
                    <th>Проверки</th>
                    <th>Ошибки</th>
                    <th>Доля ошибок</th>
                    <th>Повторить</th>
                  </tr>
                </thead>
                <tbody>
                  {r.tasks.map((t) => {
                    const l = locateLesson(t.id);
                    return (
                      <tr key={t.id}>
                        <td>{l ? `${t.id} · ${l.course.title}` : t.id}</td>
                        <td>{t.count}</td>
                        <td>{t.wrong}</td>
                        <td>{fmt((t.wrong / t.count) * 100, "%")}</td>
                        <td>
                          <Link
                            className="text-button"
                            to={
                              l ? `/courses/${l.course.id}/${t.id}` : "/cases"
                            }
                          >
                            К заданию →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </section>
      ) : tab === "funnel" ? (
        <FunnelChart events={r.events} sourceMode="local" admin />
      ) : (
        <section className="panel">
          <div className="section-heading">
            <h2>{date ? "События за " + date : "Личная история событий"}</h2>
            {date && (
              <button className="text-button" onClick={() => setDate(null)}>
                Все даты
              </button>
            )}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Время UTC</th>
                  <th>Событие</th>
                  <th>Контекст</th>
                  <th>Результат</th>
                </tr>
              </thead>
              <tbody>
                {selected
                  .slice(-200)
                  .reverse()
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.timestamp).toLocaleString("ru-RU", {
                          timeZone: "UTC",
                        })}
                      </td>
                      <td>{eventLabels[e.type]}</td>
                      <td>
                        {e.params.lessonId ||
                          e.params.caseId ||
                          e.params.courseId ||
                          e.params.route ||
                          "—"}
                      </td>
                      <td>
                        {e.params.score !== undefined
                          ? `${e.params.score}/100`
                          : e.params.correct !== undefined
                            ? e.params.correct
                              ? "Верно"
                              : "Ошибка"
                            : e.params.durationMs !== undefined
                              ? learningMinutes(e.params.durationMs)
                              : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="control-note">
            Последние 200 событий выбранного набора. Полная локальная история
            доступна в экспорте.
          </p>
        </section>
      )}
      <section className="panel analytics-data-actions">
        <h2>Твои данные — у тебя</h2>
        <p className="control-note">
          Хранятся последние {EVENT_LIMIT.toLocaleString("ru-RU")} событий (при
          ограничении места — меньше). Экспорт содержит всю доступную историю,
          независимо от фильтров. Настройки, прогресс и аналитика хранятся
          отдельно.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() =>
              downloadJson(
                {
                  kind: "product-lab-personal-analytics",
                  schemaVersion: 1,
                  exportedAt: new Date().toISOString(),
                  events: getEvents(),
                },
                "product-lab-personal-analytics.json",
              )
            }
          >
            <Download size={17} />
            Экспорт аналитики JSON
          </button>
          <button className="button secondary" onClick={() => setConfirm(true)}>
            <Trash2 size={17} />
            Очистить только аналитику
          </button>
          <Link className="text-button" to="/settings-lab">
            Управление прогрессом →
          </Link>
          {consent === true && (
            <button
              className="text-button"
              onClick={() => {
                setAnalyticsConsent(false);
                setConsent(false);
              }}
            >
              Отключить запись и удалить события
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
      </section>
      {confirm && (
        <Modal
          title="Удалить персональную аналитику?"
          onClose={() => setConfirm(false)}
        >
          <p>
            Будут удалены события, история сессий и активного времени в этом
            браузере. Учебные результаты, сертификаты и настройки останутся.
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                try {
                  clearAnalytics();
                  setEvents([]);
                  setConfirm(false);
                  setMessage(
                    "Локальная аналитика удалена. Учебный прогресс сохранён.",
                  );
                } catch {
                  setMessage(
                    "Не удалось очистить хранилище. Проверь настройки браузера.",
                  );
                }
              }}
            >
              Да, удалить аналитику
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Empty() {
  return (
    <div className="personal-chart-empty">
      Недостаточно данных для этого графика.
    </div>
  );
}
