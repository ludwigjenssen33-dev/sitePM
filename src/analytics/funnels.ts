import type { AnalyticsEvent, EventName } from "./events";
export type FunnelStep = {
  event: EventName;
  label: string;
  explanation: string;
  research: string;
};
export const funnelPresets: Record<
  string,
  { name: string; steps: FunnelStep[] }
> = {
  marketing: {
    name: "Маркетинговая",
    steps: [
      {
        event: "page_view",
        label: "Визит",
        explanation: "Пользователи открыли платформу.",
        research: "Проверьте соответствие сообщения ожиданиям аудитории.",
      },
      {
        event: "course_viewed",
        label: "Просмотр курса",
        explanation: "Пользователи изучили предложение курса.",
        research: "Сравните ясность программы и ценностного предложения.",
      },
      {
        event: "case_started",
        label: "Старт обучения",
        explanation: "Пользователи начали учебную миссию.",
        research: "Изучите понятность первого действия и входной барьер.",
      },
    ],
  },
  signup: {
    name: "Регистрационная",
    steps: [
      {
        event: "page_view",
        label: "Визит",
        explanation: "Вход на платформу.",
        research: "Изучите источники и устройства посетителей.",
      },
      {
        event: "signup_started",
        label: "Начало регистрации",
        explanation: "Открыта форма регистрации.",
        research: "Выясните, нужна ли регистрация пользователю на этом этапе.",
      },
      {
        event: "signup_completed",
        label: "Регистрация завершена",
        explanation: "Только подтверждённый успешный ответ сервера.",
        research: "Проверьте доставку подтверждений и ошибки формы.",
      },
    ],
  },
  learning: {
    name: "Учебная",
    steps: [
      {
        event: "course_viewed",
        label: "Просмотр курса",
        explanation: "Пользователь ознакомился с программой.",
        research: "Проверьте релевантность программы.",
      },
      {
        event: "lesson_started",
        label: "Урок начат",
        explanation: "Открыт учебный материал.",
        research: "Выясните, понятен ли порядок изучения.",
      },
      {
        event: "lesson_completed",
        label: "Урок завершён",
        explanation: "Зафиксировано завершение материала.",
        research: "Проверьте объём материала и сложность мини-задания.",
      },
    ],
  },
  cases: {
    name: "Завершение кейсов",
    steps: [
      {
        event: "case_started",
        label: "Миссия начата",
        explanation: "Пользователь принял задачу.",
        research: "Проверьте ожидания и стартовую сложность.",
      },
      {
        event: "answer_submitted",
        label: "Ответ отправлен",
        explanation: "Пользователь зафиксировал ответ этапа.",
        research: "Наблюдайте, в каком месте возникают затруднения.",
      },
      {
        event: "experiment_viewed",
        label: "Эксперимент изучен",
        explanation: "Открыт экран A/B-теста.",
        research: "Проверьте читаемость статистики и графиков.",
      },
      {
        event: "case_completed",
        label: "Миссия завершена",
        explanation: "Пользователь получил итоговый разбор.",
        research: "Проверьте нагрузку последнего этапа и понятность решения.",
      },
    ],
  },
  payment: {
    name: "Демонстрационная оплата",
    steps: [
      {
        event: "course_viewed",
        label: "Просмотр курса",
        explanation: "Пользователь увидел учебный тариф.",
        research: "Проверьте понимание демонстрационного характера цены.",
      },
      {
        event: "payment_clicked",
        label: "Кнопка оплаты",
        explanation: "Открыто предупреждение об учебной оплате.",
        research: "Убедитесь, что реальные реквизиты не запрашиваются.",
      },
      {
        event: "payment_demo_failed",
        label: "Учебная 404",
        explanation: "Завершён шуточный сценарий. Это не реальный отказ банка.",
        research: "Предложите вернуться к курсу без потери прогресса.",
      },
    ],
  },
};
export type FunnelOptions = {
  windowHours?: number;
  from?: string;
  to?: string;
  device?: string;
  source?: string;
  identity?: "actorId" | "sessionId";
};
export type FunnelResult = {
  step: FunnelStep;
  count: number;
  fromPrevious: number | null;
  fromStart: number | null;
  lost: number;
  lostRate: number | null;
  actors: string[];
};
export function filterEvents(events: AnalyticsEvent[], o: FunnelOptions = {}) {
  const from = o.from ? Date.parse(o.from) : -Infinity,
    to = o.to ? Date.parse(o.to) : Infinity;
  return events.filter((e) => {
    const t = Date.parse(e.timestamp);
    return (
      Number.isFinite(t) &&
      t >= from &&
      t <= to &&
      (!o.device || o.device === "all" || e.device === o.device) &&
      (!o.source || o.source === "all" || e.source === o.source)
    );
  });
}
/** One identity enters a funnel once. Each following event must occur in order inside the window from entry. */
export function calculateFunnel(
  events: AnalyticsEvent[],
  steps: FunnelStep[],
  options: FunnelOptions = {},
): FunnelResult[] {
  if (!steps.length) return [];
  const hours = options.windowHours ?? 24;
  if (!Number.isFinite(hours) || hours <= 0)
    throw new Error("Окно конверсии должно быть положительным");
  const grouped = new Map<string, AnalyticsEvent[]>();
  for (const e of filterEvents(events, options)) {
    const id = e[options.identity ?? "sessionId"];
    const list = grouped.get(id) || [];
    list.push(e);
    grouped.set(id, list);
  }
  const sets = steps.map(() => new Set<string>());
  for (const [identity, list] of grouped) {
    const sorted = list
      .map((e, i) => ({ e, i }))
      .sort(
        (a, b) =>
          Date.parse(a.e.timestamp) - Date.parse(b.e.timestamp) || a.i - b.i,
      )
      .map((v) => v.e);
    let best = 0;
    for (let entry = 0; entry < sorted.length; entry++) {
      if (sorted[entry].type !== steps[0].event) continue;
      let index = 1;
      const context = { ...sorted[entry].params };
      const keys = ["caseId", "attemptId", "lessonId", "courseId"] as const;
      const start = Date.parse(sorted[entry].timestamp);
      for (let j = entry + 1; j < sorted.length && index < steps.length; j++) {
        if (Date.parse(sorted[j].timestamp) - start > hours * 3600000) break;
        if (sorted[j].type === steps[index].event) {
          const next = sorted[j].params;
          if (
            keys.some(
              (key) => context[key] && next[key] && context[key] !== next[key],
            )
          )
            continue;
          for (const key of keys) if (next[key]) context[key] = next[key];
          index++;
        }
      }
      best = Math.max(best, index);
    }
    for (let i = 0; i < best; i++) sets[i].add(identity);
  }
  return steps.map((step, i) => {
    const count = sets[i].size,
      previous = i ? sets[i - 1].size : count,
      start = sets[0].size;
    return {
      step,
      count,
      fromPrevious: previous ? count / previous : null,
      fromStart: start ? count / start : null,
      lost: i ? previous - count : 0,
      lostRate: i && previous ? (previous - count) / previous : null,
      actors: [...sets[i]],
    };
  });
}
export function funnelCsv(rows: FunnelResult[]) {
  const q = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      "Этап;Участники;Конверсия с предыдущего;Конверсия от начала;Отток",
      ...rows.map((r) =>
        [
          r.step.label,
          r.count,
          r.fromPrevious === null ? "" : (r.fromPrevious * 100).toFixed(2),
          r.fromStart === null ? "" : (r.fromStart * 100).toFixed(2),
          r.lost,
        ]
          .map(q)
          .join(";"),
      ),
    ].join("\n")
  );
}
