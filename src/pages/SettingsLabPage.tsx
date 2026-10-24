import { downloadJson } from "../services/exportJson";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  LockKeyhole,
  RotateCcw,
  Settings2,
  Upload,
} from "lucide-react";
import {
  cloneConfig,
  configWarnings,
  defaults,
  parseSettings,
  settingsExport,
  themeNames,
  type AppConfig,
  type ThemeId,
} from "../config/schema";
import {
  getSettings,
  resetSettings,
  saveSettings,
  useSettings,
} from "../config/store";
import { applyTheme } from "../config/theme";
import { courseAccess, orderedCourses } from "../config/access";
import { lessons } from "../data/lessons";
import type { ProgressState } from "../domain/progress";
import Link from "../components/Link";
import Modal from "../components/Modal";

const tabs = [
  ["access", "Доступ к курсам"],
  ["lessons", "Уроки и задания"],
  ["points", "Баллы и подсказки"],
  ["game", "Геймификация"],
  ["appearance", "Оформление"],
  ["content", "Контент и меню"],
] as const;
export default function SettingsLabPage({
  state,
  onReset,
}: {
  state: ProgressState;
  onReset: () => void;
}) {
  const saved = useSettings();
  const [draft, setDraft] = useState(() => cloneConfig(saved));
  const [tab, setTab] = useState("appearance");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"settings" | "progress" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(cloneConfig(saved)), [saved]);
  useEffect(() => {
    applyTheme(draft);
    return () => applyTheme(getSettings());
  }, [draft]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const warnings = configWarnings(draft);
  const list = orderedCourses(draft);
  function change<
    S extends Exclude<keyof AppConfig, "schemaVersion">,
    K extends keyof AppConfig[S],
  >(section: S, key: K, value: AppConfig[S][K]) {
    setDraft((c) => ({ ...c, [section]: { ...c[section], [key]: value } }));
    setError("");
    setMessage("");
  }
  function apply() {
    try {
      saveSettings(draft);
      setError("");
      setMessage(
        "Настройки применены только в этом браузере. Серверные права не изменены.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить настройки.",
      );
    }
  }
  function exportFile(publish = false) {
    try {
      const valid = parseSettings(draft);
      downloadJson(
        publish ? valid : settingsExport(valid),
        publish
          ? "product-lab-published-config.json"
          : "product-lab-settings.json",
      );
      setMessage(
        publish
          ? "Проверенный файл готов. Для общего изменения замените src/config/published.json в репозитории и проверьте сборку перед деплоем."
          : "Настройки сохранены в JSON.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Проверьте настройки.");
    }
  }
  function order(index: number, dir: number) {
    const ids = list.map((c) => c.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    change("access", "order", ids);
  }
  return (
    <div className="control-center">
      <header className="control-title">
        <div>
          <span className="eyebrow">CONTROL CENTER · ТВОЯ ЛАБОРАТОРИЯ</span>
          <h1>
            Настрой обучение
            <br />
            <em>под свой ритм.</em>
          </h1>
          <p>
            Темы, правила доступа и игровой опыт — без регистрации и базы
            данных.
          </p>
        </div>
        <Settings2 size={45} />
      </header>
      <div className="local-mode-note">
        <LockKeyhole size={23} />
        <div>
          <strong>Локальные настройки этого браузера</strong>
          <p>
            Это открытая лаборатория настроек, не защищённая админка. Изменения
            не меняют сайт других людей и не дают серверных прав. Секретов здесь
            нет.
          </p>
        </div>
        <Link to="/admin/login" className="text-button">
          Серверный вход →
        </Link>
      </div>
      <div className="control-layout">
        <nav className="control-tabs" aria-label="Разделы настроек">
          {tabs.map(([id, title], i) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              <span>0{i + 1}</span>
              {title}
            </button>
          ))}
          <Link to="/my-analytics">Моя аналитика →</Link>
        </nav>
        <div className="control-main">
          {tab === "appearance" ? (
            <>
              <Group
                title="Четыре характера Product Lab"
                description="Превью применяется к странице сразу. Нажмите «Применить», чтобы сохранить выбор."
              >
                <div
                  className="theme-previews"
                  role="radiogroup"
                  aria-label="Предпросмотр тем"
                >
                  {(Object.keys(themeNames) as ThemeId[]).map((id) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={draft.interface.theme === id}
                      className={`theme-preview preview-${id} ${draft.interface.theme === id ? "selected" : ""}`}
                      onClick={() => change("interface", "theme", id)}
                    >
                      <div className="theme-mini" aria-hidden="true">
                        <i />
                        <div>
                          <b />
                          <b />
                          <b />
                        </div>
                        <span>ABC · 123</span>
                      </div>
                      <strong>{themeNames[id]}</strong>
                      <small>
                        {id === "light"
                          ? "Яркая учебная мастерская"
                          : id === "dark"
                            ? "Спокойное вечернее обучение"
                            : id === "christmas"
                              ? "Хвоя, снег и немного праздника"
                              : "Компактный аналитический терминал"}
                      </small>
                      {draft.interface.theme === id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </Group>
              <Group title="Как выглядит твоя мастерская">
                <label className="control-field">
                  Плотность интерфейса
                  <select
                    value={draft.interface.density}
                    onChange={(e) =>
                      change(
                        "interface",
                        "density",
                        e.target.value as AppConfig["interface"]["density"],
                      )
                    }
                  >
                    <option value="compact">Компактная</option>
                    <option value="standard">Стандартная</option>
                    <option value="spacious">Просторная</option>
                  </select>
                </label>
                <label className="control-field">
                  Акцент
                  <select
                    value={draft.interface.accent}
                    onChange={(e) =>
                      change(
                        "interface",
                        "accent",
                        e.target.value as AppConfig["interface"]["accent"],
                      )
                    }
                  >
                    <option value="default">Акцент темы</option>
                    <option value="blue">Синий</option>
                    <option value="violet">Фиолетовый</option>
                    <option value="teal">Бирюзовый</option>
                  </select>
                </label>
                <Toggle
                  label="Плавные переходы и анимации"
                  checked={draft.interface.animations}
                  onChange={(v) => change("interface", "animations", v)}
                  note="Системный reduced motion всегда имеет приоритет."
                />
                <Toggle
                  label="Показывать стикменов"
                  checked={draft.interface.characters}
                  onChange={(v) => change("interface", "characters", v)}
                />
                <Toggle
                  label="Декоративные эффекты"
                  checked={draft.interface.decorations}
                  onChange={(v) => change("interface", "decorations", v)}
                  note="В новогодней теме — снежинки и праздничные акценты."
                />
                <button
                  className="button secondary"
                  onClick={() =>
                    setDraft((c) => ({
                      ...c,
                      interface: { ...defaults.interface },
                    }))
                  }
                >
                  <RotateCcw size={16} />
                  Вернуть оформление по умолчанию
                </button>
              </Group>
            </>
          ) : tab === "access" ? (
            <>
              <Group
                title="Как открываются курсы"
                description="Правила используют реальный каталог; новые курсы автоматически добавятся в конец порядка."
              >
                <label className="control-field">
                  Режим доступа
                  <select
                    value={draft.access.mode}
                    onChange={(e) =>
                      change(
                        "access",
                        "mode",
                        e.target.value as AppConfig["access"]["mode"],
                      )
                    }
                  >
                    <option value="free">Свободное обучение</option>
                    <option value="sequential">Курсы по порядку</option>
                    <option value="foundation">Сначала базовый курс</option>
                    <option value="score">По проходному баллу</option>
                  </select>
                </label>
                <Slider
                  label="Минимальный процент прохождения предыдущего курса"
                  value={draft.access.minCompletion}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => change("access", "minCompletion", v)}
                />
                <Slider
                  label="Минимальный результат предыдущего курса"
                  value={draft.access.minScore}
                  min={0}
                  max={100}
                  unit="/100"
                  onChange={(v) => change("access", "minScore", v)}
                />
                <p className="control-note">
                  Результат курса — среднее лучших ответов на мини-задания.
                  Старые завершённые уроки сохраняются, но результат без
                  записанного ответа не выдумывается. Порядок уроков
                  настраивается отдельно.
                </p>
              </Group>
              <Group title="Порядок и индивидуальные исключения">
                {list.map((c, i) => {
                  const access = courseAccess(state, c.id, draft);
                  return (
                    <div className="course-rule" key={c.id}>
                      <div>
                        <strong>
                          {i + 1}. {c.title}
                        </strong>
                        <small>
                          {access.allowed ? "Доступен" : access.reason}
                        </small>
                      </div>
                      <select
                        aria-label={`Доступ: ${c.title}`}
                        value={draft.access.courseRules[c.id] || "inherit"}
                        onChange={(e) =>
                          change("access", "courseRules", {
                            ...draft.access.courseRules,
                            [c.id]: e.target.value as
                              | "inherit"
                              | "always"
                              | "locked",
                          })
                        }
                      >
                        <option value="inherit">По общему правилу</option>
                        <option value="always">Всегда доступен</option>
                        <option value="locked">Закрыт вручную</option>
                      </select>
                      <button
                        className="icon-button"
                        aria-label={`Поднять курс ${c.title}`}
                        disabled={i === 0}
                        onClick={() => order(i, -1)}
                      >
                        <ArrowUp size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Опустить курс ${c.title}`}
                        disabled={i === list.length - 1}
                        onClick={() => order(i, 1)}
                      >
                        <ArrowDown size={17} />
                      </button>
                    </div>
                  );
                })}
              </Group>
            </>
          ) : tab === "lessons" ? (
            <>
              <Group title="Уроки и мини-задания">
                <Toggle
                  label="Проходить уроки по порядку"
                  checked={draft.lessons.sequential}
                  onChange={(v) => change("lessons", "sequential", v)}
                />
                <Toggle
                  label="Разрешать пропуск теории"
                  checked={draft.lessons.allowSkipTheory}
                  onChange={(v) => change("lessons", "allowSkipTheory", v)}
                  note="Если выключено, завершение требует ответа на мини-задание и отметки изучения теории."
                />
                <Slider
                  label="Число попыток мини-задания"
                  value={draft.lessons.maxAttempts}
                  min={0}
                  max={20}
                  unit=" (0 — без лимита)"
                  onChange={(v) => change("lessons", "maxAttempts", v)}
                />
                <Toggle
                  label="Разрешить повторное прохождение"
                  checked={draft.lessons.allowRepeat}
                  onChange={(v) => change("lessons", "allowRepeat", v)}
                />
                <Toggle
                  label="Показывать правильный ответ после проверки"
                  checked={draft.lessons.showAnswers}
                  onChange={(v) => change("lessons", "showAnswers", v)}
                />
                <Toggle
                  label="Подробные объяснения"
                  checked={draft.lessons.explanations}
                  onChange={(v) => change("lessons", "explanations", v)}
                />
                <Toggle
                  label="Показывать прогресс уроков"
                  checked={draft.lessons.showProgress}
                  onChange={(v) => change("lessons", "showProgress", v)}
                />
              </Group>
              <Group
                title="Интерактивные тренажёры"
                description="Отключение скрывает визуальный тренажёр урока. Теория и мини-задание сохраняются."
              >
                <details className="exercise-settings">
                  <summary>
                    Выбрать упражнения ({draft.lessons.disabledExercises.length}{" "}
                    отключено)
                  </summary>
                  {lessons.map((l) => (
                    <Toggle
                      key={l.id}
                      label={`${l.id} · ${l.title}`}
                      checked={!draft.lessons.disabledExercises.includes(l.id)}
                      onChange={(enabled) =>
                        change(
                          "lessons",
                          "disabledExercises",
                          enabled
                            ? draft.lessons.disabledExercises.filter(
                                (id) => id !== l.id,
                              )
                            : [...draft.lessons.disabledExercises, l.id],
                        )
                      }
                    />
                  ))}
                </details>
              </Group>
            </>
          ) : tab === "points" ? (
            <>
              <Group
                title="Баллы и подсказки"
                description="Правила миссии фиксируются при старте новой попытки. Уже полученные результаты не пересчитываются задним числом."
              >
                <Toggle
                  label="Включить систему баллов"
                  checked={draft.scoring.enabled}
                  onChange={(v) => change("scoring", "enabled", v)}
                />
                <Slider
                  label="Стоимость одной подсказки"
                  value={draft.scoring.hintCost}
                  min={0}
                  max={25}
                  unit=" баллов"
                  onChange={(v) => change("scoring", "hintCost", v)}
                />
                <Slider
                  label="Максимум подсказок за миссию"
                  value={draft.scoring.maxHints}
                  min={0}
                  max={4}
                  onChange={(v) => change("scoring", "maxHints", v)}
                />
                <Slider
                  label="Минимальный проходной балл"
                  value={draft.scoring.passScore}
                  min={0}
                  max={100}
                  unit="/100"
                  onChange={(v) => change("scoring", "passScore", v)}
                />
                <Slider
                  label="XP за первый проход урока"
                  value={draft.scoring.lessonXP}
                  min={0}
                  max={1000}
                  unit=" XP"
                  onChange={(v) => change("scoring", "lessonXP", v)}
                />
                <Slider
                  label="Бонус за прохождение без ошибок"
                  value={draft.scoring.perfectBonus}
                  min={0}
                  max={1000}
                  unit=" XP"
                  onChange={(v) => change("scoring", "perfectBonus", v)}
                />
                <Slider
                  label="Бонус за улучшение результата"
                  value={draft.scoring.improvementBonus}
                  min={0}
                  max={1000}
                  unit=" XP"
                  onChange={(v) => change("scoring", "improvementBonus", v)}
                />
                <p className="control-note">
                  За миссию: 10 × лучший балл. Дополнительные бонусы учитываются
                  максимум один раз на уникальный урок/кейс. Повтор одинакового
                  результата не позволяет накручивать XP.
                </p>
              </Group>
              <Group title="Данные обучения">
                <p>
                  Сброс удалит только учебный прогресс, результаты и
                  сертификаты. Аналитика и настройки останутся. Сначала можно
                  скачать резервную копию в профиле.
                </p>
                <button
                  className="button danger"
                  onClick={() => setConfirm("progress")}
                >
                  Сбросить локальный прогресс
                </button>
              </Group>
            </>
          ) : tab === "game" ? (
            <Group title="Игровой слой — по твоим правилам">
              {(
                [
                  ["achievements", "Достижения"],
                  ["certificates", "Игровые сертификаты"],
                  ["levels", "Уровень и XP в шапке"],
                  ["streaks", "Серии дней обучения"],
                  ["courseCelebration", "Поздравлять с завершением курса"],
                  ["rewardAnimations", "Анимации наград"],
                  ["ranking", "Показывать демонстрационный рейтинг"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  checked={draft.game[key]}
                  onChange={(v) => change("game", key, v)}
                />
              ))}
              <Slider
                label="Результат для успешной миссии"
                min={0}
                max={100}
                unit="/100"
                value={draft.game.successThreshold}
                onChange={(v) => change("game", "successThreshold", v)}
              />
              <Slider
                label="Длина серии успешных миссий"
                min={1}
                max={13}
                value={draft.game.streakTarget}
                onChange={(v) => change("game", "streakTarget", v)}
              />
              <Slider
                label="Порог награды за мастерство"
                min={0}
                max={100}
                unit="/100"
                value={draft.game.masterThreshold}
                onChange={(v) => change("game", "masterThreshold", v)}
              />
            </Group>
          ) : (
            <>
              <Group
                title="Разделы и навигация"
                description="Скрытие раздела — локальная настройка интерфейса, а не механизм защиты данных."
              >
                {(
                  Object.entries({
                    courses: "Курсы",
                    cases: "Практические кейсы",
                    cabinet: "Мой прогресс",
                    lab: "Инструменты",
                    achievements: "Достижения",
                    ranking: "Рейтинг",
                    methodology: "Методология",
                  }) as [keyof AppConfig["content"]["sections"], string][]
                ).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={draft.content.sections[key]}
                    onChange={(v) =>
                      change("content", "sections", {
                        ...draft.content.sections,
                        [key]: v,
                      })
                    }
                  />
                ))}
              </Group>
              <Group title="Состав страниц">
                <Toggle
                  label="Приветственный блок главной"
                  checked={draft.content.showWelcome}
                  onChange={(v) => change("content", "showWelcome", v)}
                />
                <Toggle
                  label="Рекомендации и «Продолжить»"
                  checked={draft.content.recommendations}
                  onChange={(v) => change("content", "recommendations", v)}
                />
                <Toggle
                  label="Информационные баннеры"
                  checked={draft.content.banners}
                  onChange={(v) => change("content", "banners", v)}
                  note="Согласие на аналитику, предупреждения о хранении и безопасности остаются видимыми."
                />
                <Toggle
                  label="Демонстрационные функции"
                  checked={draft.content.showDemos}
                  onChange={(v) => change("content", "showDemos", v)}
                  note="Учебный тариф, демонстрационный рейтинг и образец сертификата."
                />
              </Group>
            </>
          )}
          <div className="control-storage panel">
            <h2>Настройки можно забрать с собой</h2>
            <div className="button-row">
              <button className="button secondary" onClick={() => exportFile()}>
                <Download size={16} />
                Экспорт JSON
              </button>
              <button
                className="button secondary"
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                Импорт JSON
              </button>
              <button
                className="button secondary"
                onClick={() => exportFile(true)}
              >
                Файл для публикации
              </button>
              <button
                className="text-button"
                onClick={() => setConfirm("settings")}
              >
                Восстановить по умолчанию
              </button>
            </div>
            <input
              ref={input}
              hidden
              type="file"
              accept=".json,application/json"
              aria-label="Файл настроек"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 100000)
                    throw new Error("Файл настроек должен быть меньше 100 КБ.");
                  setDraft(parseSettings(JSON.parse(await file.text())));
                  setError("");
                  setMessage(
                    "Файл проверен. Это предпросмотр: нажмите «Применить» для сохранения.",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Некорректный JSON.",
                  );
                } finally {
                  e.target.value = "";
                }
              }}
            />
            <p className="control-note">
              Локальные переопределения имеют приоритет над опубликованным JSON.
              Файл для публикации содержит только проверенные параметры — не
              JavaScript, команды или секреты.
            </p>
          </div>
          {warnings.map((w) => (
            <p className="notice warning" key={w}>
              {w}
            </p>
          ))}
          {error && (
            <p role="alert" className="notice warning">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <div className="control-save">
            <span>
              {dirty
                ? "Есть неприменённые изменения"
                : "Настройки сохранены в этом браузере"}
            </span>
            <button
              className="button secondary"
              disabled={!dirty}
              onClick={() => setDraft(cloneConfig(saved))}
            >
              Отменить
            </button>
            <button className="button primary" onClick={apply}>
              <Check size={17} />
              Применить
            </button>
          </div>
        </div>
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "progress"
              ? "Сбросить учебный прогресс?"
              : "Вернуть опубликованные настройки?"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "progress"
              ? "Попытки, уроки и сертификаты будут удалены в этом браузере. Аналитика и настройки сохранятся."
              : "Локальные переопределения будут удалены. Прогресс и аналитика сохранятся."}
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                try {
                  if (confirm === "progress") onReset();
                  else setDraft(cloneConfig(resetSettings()));
                  setConfirm(null);
                  setMessage(
                    "Готово. Изменения затронули только выбранные данные этого браузера.",
                  );
                } catch {
                  setError("Браузер не разрешил удалить данные.");
                }
              }}
            >
              Подтвердить сброс
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel control-group">
      <h2>{title}</h2>
      {description && <p className="control-note">{description}</p>}
      {children}
    </section>
  );
}
function Toggle({
  label,
  checked,
  onChange,
  note,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  note?: string;
}) {
  return (
    <label className="setting-toggle">
      <span>
        <strong>{label}</strong>
        {note && <small>{note}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <label className="setting-slider">
      <span>
        {label}
        <b>
          {value}
          {unit}
        </b>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
