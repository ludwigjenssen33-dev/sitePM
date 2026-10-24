import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Download,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../auth/useAuth";
import { adminRequest } from "../auth/admin";
import type { AnalyticsEvent } from "../analytics/events";
import { demoEvents } from "../analytics/demo";
import { learningReport } from "../analytics/learningReport";
import { courses, locateLesson } from "../data/courses";
import { cases } from "../data/cases";
import FunnelChart, { downloadCsv } from "../components/FunnelChart";
import Link from "../components/Link";
import { navigate } from "../domain/router";
type ReportResponse = {
  mode: "server" | "demo";
  events: AnalyticsEvent[];
  truncated: boolean;
};
export default function AdminDashboardPage() {
  const auth = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await adminRequest<ReportResponse>("analytics?days=" + days));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Нет соединения.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (auth.admin) void load();
  }, [auth.admin, days]);
  const events = useMemo(
    () =>
      data?.mode === "server"
        ? data.events
        : data?.mode === "demo"
          ? demoEvents().filter(
              (e) => Date.parse(e.timestamp) >= Date.now() - days * 86400000,
            )
          : [],
    [data, days],
  );
  const r = useMemo(() => learningReport(events), [events]);
  if (auth.loading)
    return (
      <div className="panel" role="status">
        Проверяем закрытую сессию…
      </div>
    );
  if (!auth.admin)
    return (
      <section className="admin-denied panel">
        <ShieldCheck size={40} />
        <h1>Доступ только администратору</h1>
        <p>
          Статистика доступна после серверной проверки сессии. Локальный профиль
          не даёт административных прав.
        </p>
        <Link className="button primary" to="/admin/login">
          Перейти ко входу
          <ArrowRight size={18} />
        </Link>
      </section>
    );
  const demo = data?.mode === "demo";
  const n = (v: number | null, suffix = "") =>
    v === null
      ? "Недостаточно данных"
      : v.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + suffix;
  const metrics = [
    [
      "Уникальные посетители",
      r.visitors,
      "Число разных анонимных ID с событиями за период. Это браузеры, не подтверждённые люди.",
    ],
    [
      "Сессии",
      r.sessions,
      "Разные sessionId. Новая сессия после 30 минут бездействия.",
    ],
    [
      "Просмотры курсов",
      r.courseViews,
      "Число событий course_viewed; повторные просмотры включены.",
    ],
    ["Уроки начаты", r.lessonStarts, "Уникальные пары анонимный ID + урок."],
    ["Уроки завершены", r.lessonEnds, "Уникальные пары анонимный ID + урок."],
    [
      "Конверсия уроков",
      r.completion === null ? null : r.completion * 100,
      "Доля начатых пар посетитель + урок с завершением в том же периоде.",
    ],
    [
      "Средний балл",
      r.mean,
      "Среднее по завершённым попыткам; attemptId учитывается один раз. Оценки присланы клиентом и не подтверждены серверной рубрикой.",
    ],
    [
      "Ошибки в заданиях",
      r.errors,
      "Число зафиксированных неверных проверок. Повторные ошибки включены.",
    ],
    [
      "Использовано подсказок",
      r.hints,
      "Число событий hint_used; повторное открытие той же подсказки не начисляется.",
    ],
    [
      "Получили сертификат",
      r.certificates,
      "Разные анонимные ID с certificate_issued. Сертификаты локальные, игровые.",
    ],
  ] as const;
  return (
    <div className="admin-dashboard">
      <div className="page-title admin-title">
        <div>
          <span className="eyebrow">PRODUCT LAB ANALYTICS</span>
          <h1>За цифрами — обучение</h1>
          <p>Наблюдай, где люди находят свой ритм, а где им нужна помощь.</p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await adminRequest("logout", {});
              window.dispatchEvent(new Event("product-lab:admin-session"));
              navigate("/admin/login");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось выйти.");
            }
          }}
        >
          <LogOut size={17} />
          Выйти
        </button>
      </div>
      <div className={`admin-source-banner ${demo ? "demo" : "real"}`}>
        <ShieldCheck size={22} />
        <div>
          <strong>
            {demo
              ? "Демонстрационный режим · БД не подключена"
              : data
                ? "Серверные события · PostgreSQL"
                : "Подключаем источник"}
          </strong>
          <p>
            {demo
              ? "Все числа ниже синтетические и показывают возможности отчёта. Локальный прогресс посетителей не выдаётся за общую статистику."
              : "События только посетителей, разрешивших аналитику. Блокировки, очистка браузера и разные устройства ограничивают точность."}
          </p>
        </div>
      </div>
      <div className="button-row"><Link className="button secondary compact" to="/settings-lab">Локальные настройки</Link><Link className="button secondary compact" to="/my-analytics">Моя аналитика без сервера</Link></div><div className="admin-toolbar">
        <div className="tabs">
          {[
            ["overview", "Обзор"],
            ["funnels", "Воронки"],
            ["learning", "Уроки и задания"],
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
        <label>
          Период
          <select
            aria-label="Период аналитики"
            value={days}
            onChange={(e) => setDays(+e.target.value)}
          >
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
        </label>
        <button
          className="button secondary compact"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={16} />
          Обновить
        </button>
      </div>
      {busy ? (
        <div role="status" className="page-skeleton">
          <div />
          <div />
          Загружаем статистику…
        </div>
      ) : error ? (
        <div className="notice warning" role="alert">
          {error}
        </div>
      ) : (
        data && (
          <>
            {data.truncated && (
              <div className="notice warning">
                Показаны последние 20 000 событий. Метрики рассчитаны по этой
                выборке; сократите период.
              </div>
            )}
            {tab === "overview" ? (
              <>
                <div className="admin-metrics">
                  {metrics.map(([label, value, formula], i) => (
                    <section className="panel admin-metric" key={label}>
                      <span>{label}</span>
                      <strong>{n(value, i === 5 ? "%" : "")}</strong>
                      <details>
                        <summary>Как считаем</summary>
                        <p>
                          {formula} Период: {days} дней. Источник:{" "}
                          {demo
                            ? "синтетический набор"
                            : "PostgreSQL, принятые события"}
                          .
                        </p>
                      </details>
                    </section>
                  ))}
                </div>
                <div className="admin-chart-grid">
                  <section className="panel">
                    <h2>Ритм обучения по дням</h2>
                    <p className="muted tiny">
                      UTC · посетители и уникальные завершения
                    </p>
                    {r.daily.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={r.daily}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(v) => v.slice(5)}
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Area
                            dataKey="visitors"
                            name="Посетители"
                            stroke="var(--chart-1, #4736ed)"
                            fill="var(--chart-muted, #e1ddff)"
                          />
                          <Area
                            dataKey="lessons"
                            name="Уроки завершены"
                            stroke="var(--chart-2, #187a41)"
                            fill="var(--chart-1, #d5f5ab)"
                          />
                          <Area
                            dataKey="cases"
                            name="Миссии завершены"
                            stroke="var(--chart-3, #d64c30)"
                            fill="var(--chart-1, #ffe0d7)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <Empty />
                    )}
                  </section>
                  <section className="panel">
                    <h2>Распределение результатов</h2>
                    <p className="muted tiny">Попытки · баллы из 100</p>
                    {r.caseEnds ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={r.distribution}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="band" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            name="Попытки"
                            fill="var(--chart-1, #7561f4)"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Empty />
                    )}
                  </section>
                </div>
                <section className="panel">
                  <h2>Средние результаты миссий</h2>
                  {r.caseResults.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Миссия</th>
                            <th>Попытки</th>
                            <th>Средний балл</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.caseResults.map((row) => (
                            <tr key={row.id}>
                              <td>
                                {cases.find((c) => c.id === row.id)?.title ||
                                  row.id}
                              </td>
                              <td>{row.count}</td>
                              <td>{n(row.average)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty />
                  )}
                </section>
              </>
            ) : tab === "funnels" ? (
              <FunnelChart
                events={events}
                demo={demo}
                admin
                sourceMode="server"
              />
            ) : (
              <div className="admin-learning">
                <section className="panel">
                  <h2>Популярность курсов</h2>
                  {r.courses.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Курс</th>
                            <th>Уникальные посетители</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.courses.map((row) => (
                            <tr key={row.id}>
                              <td>
                                {courses.find((c) => c.id === row.id)?.title ||
                                  "Программа Product Lab"}
                              </td>
                              <td>{row.visitors}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty />
                  )}
                </section>
                <section className="panel">
                  <h2>Где возникают затруднения</h2>
                  <p className="muted tiny">
                    Ошибки / проверки — доля неверных отправок, а не доля людей.
                    Повторные отправки включены.
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
                            <th>Подсказки</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.tasks.map((row) => (
                            <tr key={row.id}>
                              <td>
                                {locateLesson(row.id)
                                  ? `${row.id} · ${locateLesson(row.id)?.course.title}`
                                  : row.id}
                              </td>
                              <td>{row.answers}</td>
                              <td>{row.errors}</td>
                              <td>
                                {row.answers
                                  ? n((row.errors / row.answers) * 100, "%")
                                  : "Недостаточно данных"}
                              </td>
                              <td>{row.hints}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty />
                  )}
                </section>
              </div>
            )}
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() =>
                  downloadCsv(
                    "\uFEFFМетрика;Значение\n" +
                      metrics
                        .map(([label, value]) => `${label};${value ?? ""}`)
                        .join("\n"),
                    "product-lab-summary.csv",
                  )
                }
              >
                <Download size={17} />
                Скачать сводку CSV
              </button>
              <Link className="text-button" to="/privacy">
                Что собирает аналитика →
              </Link>
            </div>
          </>
        )
      )}
    </div>
  );
}
function Empty() {
  return (
    <div className="analytics-empty">
      <BarChart3 size={28} />
      <strong>Недостаточно данных</strong>
      <p>
        Новые события появятся после действий посетителей с согласием на
        аналитику.
      </p>
    </div>
  );
}
