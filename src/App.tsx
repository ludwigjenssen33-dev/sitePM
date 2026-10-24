import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  Home,
  LayoutGrid,
  Map,
  Menu,
  Play,
  Settings2,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { cases } from "./data/cases";
import { useSettings, getSettings } from "./config/store";
import { legacyScoringRules } from "./config/schema";
import { useTheme } from "./config/theme";
import { courseAccess, lessonAccess, orderedCourses } from "./config/access";
import { locateLesson } from "./data/courses";
import {
  installActiveLearning,
  setLearningContext,
} from "./analytics/activity";
import ThemeSwitch from "./components/ThemeSwitch";
import { courses, courseProgress, getCourse } from "./data/courses";
import { APP_VERSION } from "./data/releases";
import { missionAccess, learningActivity } from "./domain/learningPath";
import { lessons } from "./data/lessons";
import {
  achievements,
  bestAttempts,
  level,
  startAttempt,
  updateAttempt,
  completeLearningLesson,
  submitLesson,
  uniqueId,
  emptyProgress,
  type Attempt,
  type ProgressState,
} from "./domain/progress";
import {
  loadProgress,
  saveProgress,
  clearLearningProgress,
} from "./services/progressStore";
import { navigate, resolveRoute } from "./domain/router";
import { useAuth } from "./auth/useAuth";
import {
  analyticsConsent,
  setAnalyticsConsent,
  track,
} from "./analytics/events";
import HomePage from "./pages/HomePage";
import Modal from "./components/Modal";
import Link from "./components/Link";
const SharedResultPage = lazy(() => import("./pages/SharedResultPage"));
const CasesPage = lazy(() => import("./pages/CasesPage"));
const MissionPage = lazy(() => import("./pages/MissionPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const CabinetPage = lazy(() => import("./pages/CabinetPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const LabPage = lazy(() => import("./pages/LabPage"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage"));
const SettingsLabPage = lazy(() => import("./pages/SettingsLabPage"));
const MyAnalyticsPage = lazy(() => import("./pages/MyAnalyticsPage"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const LessonModal = lazy(() => import("./features/learning/LessonModal"));
function routeNow() {
  return resolveRoute(location.pathname, location.hash);
}
export default function App() {
  const config = useSettings();
  useTheme();
  const [route, setRoute] = useState(routeNow);
  const previousCourse = useRef<string | null>(null);
  const [state, setState] = useState<ProgressState>(loadProgress);
  const [menu, setMenu] = useState(false);
  const [slide, setSlide] = useState<string | null>(null);
  const [consent, setConsent] = useState(analyticsConsent);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const auth = useAuth();
  const lv = level(state);
  const best = bestAttempts(state);
  const missionId = route.startsWith("/mission/") ? route.split("/")[2] : null;
  const validMission = cases.some((c) => c.id === missionId);
  const active = missionId
    ? state.attempts.find((a) => a.id === state.active[missionId])
    : undefined;
  const access = missionId ? missionAccess(state, missionId, auth.admin) : null;
  useEffect(() => {
    const f = () => {
      setRoute(routeNow());
      setMenu(false);
      setSlide(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", f);
    window.addEventListener("hashchange", f);
    return () => {
      window.removeEventListener("popstate", f);
      window.removeEventListener("hashchange", f);
    };
  }, []);
  // Обучение начинается без навязанного модального окна; инструкция доступна по кнопке.
  useEffect(() => {
    if (route.startsWith("/admin")) return;
    track("page_view", {
      route: route.startsWith("/mission/") ? "/mission" : route,
    });
    if (route === "/cases" || route === "/map")
      track("course_viewed", { courseId: "product-lab" });
    else if (/^\/courses\/[^/]+$/.test(route) && getCourse(route.split("/")[2]))
      track("course_viewed", { courseId: route.split("/")[2] });
    const current =
      route.startsWith("/courses/") && getCourse(route.split("/")[2])
        ? route.split("/")[2]
        : null;
    if (current) {
      if (previousCourse.current && previousCourse.current !== current)
        track("course_transition", {
          fromCourseId: previousCourse.current,
          courseId: current,
        });
      previousCourse.current = current;
    }
  }, [route]);
  useEffect(() => {
    setStorageError(!saveProgress(stateRef.current));
  }, []);
  useEffect(() => installActiveLearning(), []);
  useEffect(() => {
    const cp = route.split("/");
    const lesson = slide
      ? locateLesson(slide)
      : cp[1] === "courses" && cp[3]
        ? locateLesson(cp[3])
        : null;
    setLearningContext(
      lesson
        ? { courseId: lesson.course.id, lessonId: slide || cp[3] }
        : cp[1] === "courses" && !cp[3] && getCourse(cp[2])
          ? { courseId: cp[2] }
          : cp[1] === "mission" && validMission
            ? { caseId: cp[2] }
            : {},
    );
  }, [route, slide, validMission]);
  useEffect(() => {
    const update = () => setConsent(analyticsConsent());
    window.addEventListener("product-lab:consent", update);
    return () => window.removeEventListener("product-lab:consent", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function persist(next: ProgressState) {
    setState(next);
    stateRef.current = next;
    setStorageError(!saveProgress(next));
  }
  useEffect(() => {
    if (
      validMission &&
      missionId &&
      !auth.loading &&
      missionAccess(stateRef.current, missionId, auth.admin).allowed &&
      !stateRef.current.active[missionId]
    ) {
      persist(startAttempt(stateRef.current, missionId));
      track("case_started", { caseId: missionId });
    }
  }, [missionId, validMission, active?.id, auth.admin, auth.loading]);
  function start(id: string) {
    const s = stateRef.current;
    const permitted = missionAccess(s, id, auth.admin);
    if (!permitted.allowed) {
      setToast(permitted.reason);
      navigate("/map");
      return;
    }
    if (!s.active[id]) {
      const next = startAttempt(s, id);
      persist(next);
      track("case_started", { caseId: id, attemptId: next.active[id] });
    }
    navigate("/mission/" + id);
  }
  function repeat(id: string, variant: number) {
    if (!config.lessons.allowRepeat) {
      setToast("Повторы отключены в локальных настройках.");
      return;
    }
    track("case_retried", { caseId: id, variant });
    const next = startAttempt(stateRef.current, id, variant);
    persist(next);
    track("case_started", { caseId: id, attemptId: next.active[id], variant });
    window.scrollTo(0, 0);
  }
  function update(a: Attempt) {
    const previous = stateRef.current;
    if (
      a.finished &&
      !previous.attempts.find((old) => old.id === a.id)?.finished
    ) {
      const rules = a.rules || legacyScoringRules;
      const oldBest = bestAttempts(previous).find((x) => x.caseId === a.caseId);
      a = {
        ...a,
        bonusXP: rules.enabled
          ? Math.max(
              (a.criteria?.every((r) => r.points === r.max) &&
              !a.answers.hints?.length
                ? rules.perfectBonus
                : 0) +
                (oldBest && a.score > oldBest.score
                  ? rules.improvementBonus
                  : 0),
            )
          : 0,
      };
    }
    const next = updateAttempt(previous, a);
    persist(next);
    if (
      a.finished &&
      !previous.attempts.find((old) => old.id === a.id)?.finished
    ) {
      const earned = achievements(next).filter(
        (x) =>
          x.earned &&
          !achievements(previous).find((y) => y.id === x.id)?.earned,
      );
      if (config.game.achievements && config.game.courseCelebration)
        setToast(
          earned.length
            ? `Новое достижение: ${earned[0].title} ✨`
            : "Миссия завершена. Новый опыт — в твоём профиле.",
        );
    }
  }
  function openLesson(id: string) {
    if (!lessons.some((l) => l.id === id)) return;
    const permitted = lessonAccess(stateRef.current, id, config);
    if (!permitted.allowed) {
      setToast(permitted.reason);
      return;
    }
    setSlide(id);
    track("lesson_started", { lessonId: id });
  }
  function completeLesson(id: string) {
    const s = stateRef.current;
    const loc = locateLesson(id);
    if (!loc) return;
    const done = s.completedLessons.includes(id);
    const permitted = lessonAccess(s, id, config);
    if (!permitted.allowed && !done) {
      setToast(permitted.reason);
      return;
    }
    const next = completeLearningLesson(s, id);
    persist(next);
    if (!done)
      track("lesson_completed", { lessonId: id, courseId: loc.course.id });
    if (
      config.game.courseCelebration &&
      courseProgress(loc.course, next.completedLessons).percent === 100 &&
      courseProgress(loc.course, s.completedLessons).percent < 100
    )
      setToast(`Курс «${loc.course.title}» пройден. Отличная работа!`);
  }
  function checkLesson(id: string, answer: number) {
    const s = stateRef.current,
      l = lessons.find((l) => l.id === id),
      loc = locateLesson(id);
    if (!l || !loc) return false;
    const permission = lessonAccess(s, id, config);
    if (!permission.allowed) {
      setToast(permission.reason);
      return false;
    }
    const checks = s.lessonAttempts?.filter((a) => a.lessonId === id) || [];
    if (
      config.lessons.maxAttempts &&
      checks.length >= config.lessons.maxAttempts
    ) {
      setToast("Лимит попыток мини-задания исчерпан.");
      return false;
    }
    const a = {
      id: uniqueId("check"),
      lessonId: id,
      courseId: loc.course.id,
      answer,
      correct: answer === (l.correct ?? 0),
      updated: new Date().toISOString(),
    };
    persist(submitLesson(s, a));
    track("answer_submitted", {
      lessonId: id,
      courseId: loc.course.id,
      attemptId: a.id,
      correct: a.correct ? 1 : 0,
    });
    if (!a.correct)
      track("exercise_error", {
        lessonId: id,
        courseId: loc.course.id,
        attemptId: a.id,
      });
    return true;
  }
  function resetProgress() {
    clearLearningProgress();
    const fresh = emptyProgress();
    persist({
      ...fresh,
      profile: {
        ...fresh.profile,
        alias: stateRef.current.profile.alias,
        publicRanking: stateRef.current.profile.publicRanking,
      },
    });
    setToast("Учебный прогресс сброшен. Настройки и аналитика сохранены.");
  }

  const coursePath = route.startsWith("/courses/")
    ? route.split("/").slice(2)
    : null;
  const lessonPermission = coursePath?.[1]
    ? lessonAccess(state, coursePath[1], config)
    : null;
  const sectionKey = route.startsWith("/courses")
    ? "courses"
    : route.startsWith("/mission") || route === "/map" || route === "/cases"
      ? "cases"
      : route.startsWith("/cabinet")
        ? "cabinet"
        : route.slice(1);
  const hidden =
    config.content.sections[
      sectionKey as keyof typeof config.content.sections
    ] === false ||
    (route === "/ranking" &&
      (!config.game.ranking || !config.content.showDemos)) ||
    (route === "/achievements" && !config.game.achievements) ||
    (route === "/cabinet/certificate" && !config.game.certificates);

  const cabinetTab =
    route === "/cabinet"
      ? "overview"
      : (route.startsWith("/cabinet/") &&
          (["courses", "skills", "certificate", "profile"] as const).find(
            (t) => route === "/cabinet/" + t,
          )) ||
        null;
  const allNav = [
    { to: "/", label: "Главная", icon: Home },
    { to: "/courses", label: "Курсы", icon: BookOpen },
    { to: "/cases", label: "Практика", icon: LayoutGrid },
    { to: "/cabinet", label: "Мой прогресс", icon: UserRound },
    { to: "/lab", label: "Инструменты", icon: FlaskConical },
    { to: "/achievements", label: "Достижения", icon: Trophy },
    ...(auth.admin
      ? [{ to: "/admin/dashboard", label: "Админ-панель", icon: ShieldCheck }]
      : []),
  ];
  const nav = allNav.filter(
    (n) =>
      config.content.sections[
        (n.to === "/cases"
          ? "cases"
          : n.to.slice(1)) as keyof typeof config.content.sections
      ] !== false ||
      n.to === "/" ||
      n.to.startsWith("/admin"),
  );
  const section = (to: string) =>
    to === "/"
      ? route === "/"
      : to === "/cases"
        ? route === "/cases" ||
          route === "/map" ||
          route.startsWith("/mission/")
        : route === to || route.startsWith(to + "/");
  // Быстрый возврат: следующий урок в начатом курсе, иначе первый непройденный.
  const resume = (() => {
    const done = state.completedLessons;
    const c =
      orderedCourses(config).find((x) => {
        const p = courseProgress(x, done);
        return p.done > 0 && p.next;
      }) ||
      orderedCourses(config).find(
        (x) =>
          courseProgress(x, done).next &&
          courseAccess(state, x.id, config).allowed,
      );
    const next = c && courseProgress(c, done).next;
    return c && next ? `/courses/${c.id}/${next}` : null;
  })();
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Product Lab — главная">
            <span className="brand-mark">
              <FlaskConical size={24} />
            </span>
            <strong>
              product<span>lab</span>
              <i />
            </strong>
          </Link>
          <nav className="desktop-nav" aria-label="Основная навигация">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={section(n.to) ? "active" : ""}
                aria-current={section(n.to) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeSwitch />
            {config.game.streaks && learningActivity(state).streak > 0 && (
              <span className="learning-streak" title="Дни обучения подряд">
                🔥 {learningActivity(state).streak}
              </span>
            )}
            <Link
              className="xp-badge"
              to="/cabinet/skills"
              title="Мои навыки и XP"
            >
              <Zap size={16} />
              {lv.currentXP.toLocaleString("ru-RU")} XP
            </Link>
            <button
              className="menu-button"
              aria-label={menu ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Мобильная навигация">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={section(n.to) ? "active" : ""}
                aria-current={section(n.to) ? "page" : undefined}
              >
                <n.icon size={19} />
                {n.label}
                <ArrowUpRight size={17} />
              </Link>
            ))}
            <Link to="/settings-lab">
              <Settings2 size={19} />
              Локальные настройки
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/my-analytics">
              <BarChart3 size={19} />
              Моя аналитика
              <ArrowUpRight size={17} />
            </Link>
          </nav>
        )}
      </header>
      {route !== "/" && (
        <div className="workspace-bar">
          <div>
            <span className="mode-dot" />
            {auth.admin
              ? "Администратор · защищённая сессия"
              : "Без регистрации · прогресс в этом браузере"}
            <button onClick={() => setOnboarding(true)}>Как учиться?</button>
          </div>
          <div>
            {resume && !route.startsWith("/courses/") && (
              <Link to={resume} className="resume-link">
                <Play size={14} />
                Продолжить обучение
              </Link>
            )}
            <Link to="/my-analytics">Моя аналитика</Link>
            <Link to="/settings-lab">Настройки</Link>
          </div>
        </div>
      )}
      <main
        className={`main-content ${route === "/" ? "landing" : "workspace"}`}
      >
        {storageError && (
          <div role="alert" className="notice warning">
            Браузер не разрешил сохранить прогресс. Ответы доступны до закрытия
            страницы; проверьте свободное место и настройки хранилища.
          </div>
        )}
        <div className="route-transition" key={route}>
          <Suspense
            fallback={
              <div
                className="page-skeleton"
                role="status"
                aria-label="Загрузка раздела"
              >
                <div />
                <div />
                <div />
                <span>Открываем лабораторию идей…</span>
              </div>
            }
          >
            {hidden ? (
              <section className="panel locked-mission">
                <h1>Раздел скрыт в этом браузере</h1>
                <p>
                  Это локальная настройка отображения. Учебные результаты
                  сохранены.
                </p>
                <Link className="button primary" to="/settings-lab">
                  Изменить настройки
                </Link>
              </section>
            ) : route === "/settings-lab" ? (
              <SettingsLabPage state={state} onReset={resetProgress} />
            ) : route === "/my-analytics" ? (
              <MyAnalyticsPage state={state} />
            ) : route === "/" ? (
              <HomePage onStart={start} state={state} />
            ) : route === "/map" || route === "/cases" ? (
              <CasesPage
                state={state}
                onStart={start}
                map={route === "/map"}
                isAdmin={auth.admin}
              />
            ) : validMission && !auth.loading && !access?.allowed ? (
              <section className="locked-mission panel">
                <ShieldCheck size={38} />
                <h1>Ещё один шаг — и эта миссия откроется</h1>
                <p>{access?.reason}</p>
                <button
                  className="button primary"
                  onClick={() => navigate("/map")}
                >
                  Вернуться на дорожку
                  <ArrowRight size={18} />
                </button>
              </section>
            ) : validMission && active ? (
              <MissionPage
                key={active.id}
                id={missionId!}
                attempt={active}
                state={state}
                onUpdate={update}
                onRepeat={repeat}
                openLesson={openLesson}
              />
            ) : validMission ? (
              <div className="page-skeleton" role="status">
                Готовим миссию…
              </div>
            ) : route === "/courses" ? (
              <CoursesPage completed={state.completedLessons} state={state} />
            ) : coursePath &&
              coursePath[1] &&
              getCourse(coursePath[0]) &&
              !lessonPermission?.allowed ? (
              <section className="panel locked-mission">
                <h1>Урок пока закрыт</h1>
                <p>{lessonPermission?.reason}</p>
                <div className="button-row">
                  <Link
                    className="button primary"
                    to={`/courses/${coursePath[0]}`}
                  >
                    Посмотреть программу
                  </Link>
                  <Link className="button secondary" to="/settings-lab">
                    Локальные правила
                  </Link>
                </div>
              </section>
            ) : coursePath && coursePath[1] && getCourse(coursePath[0]) ? (
              <LessonPage
                key={coursePath[1]}
                courseId={coursePath[0]}
                lessonId={coursePath[1]}
                state={state}
                onCheck={checkLesson}
                completed={state.completedLessons}
                onComplete={completeLesson}
              />
            ) : coursePath && getCourse(coursePath[0]) ? (
              <CoursePage
                id={coursePath[0]}
                state={state}
                completed={state.completedLessons}
              />
            ) : cabinetTab ? (
              <CabinetPage
                state={state}
                tab={cabinetTab}
                onChange={persist}
                onReset={resetProgress}
                openLesson={openLesson}
              />
            ) : route === "/ranking" ? (
              <RankingPage state={state} onChange={persist} />
            ) : route === "/lab" ? (
              <LabPage openLesson={openLesson} />
            ) : route === "/admin/login" ? (
              <AdminLoginPage />
            ) : route === "/admin" || route === "/admin/dashboard" ? (
              <AdminDashboardPage />
            ) : route === "/achievements" ? (
              <AchievementsPage state={state} />
            ) : route === "/methodology" ? (
              <InfoPage />
            ) : route === "/privacy" ? (
              <InfoPage privacy />
            ) : route === "/shared" ? (
              <SharedResultPage />
            ) : (
              <InfoPage notFound payment={route === "/404"} />
            )}
          </Suspense>
        </div>
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <Link to="/" className="brand">
              <span className="brand-mark">
                <FlaskConical size={24} />
              </span>
              <strong>
                product<span>lab</span>
                <i />
              </strong>
            </Link>
            <p>
              От проблемы в метриках
              <br />
              до обоснованного продуктового решения.
            </p>
            <span className="footer-chip">
              <span className="mode-dot" />
              Версия {APP_VERSION} · Учебная платформа
            </span>
          </div>
          <div>
            <strong>Учиться</strong>
            {[
              ["Курсы", "/courses"],
              ["Кейсы и миссии", "/cases"],
              ["Карта обучения", "/map"],
              ["Лаборатория", "/lab"],
            ].map(([l, r]) => (
              <Link key={r} to={r}>
                {l}
              </Link>
            ))}
          </div>
          <div>
            <strong>Расти</strong>
            {[
              ["Мой кабинет", "/cabinet"],
              ["Навыки и история", "/cabinet/skills"],
              ["Сертификат", "/cabinet/certificate"],
              ["Рейтинг", "/ranking"],
            ].map(([l, r]) => (
              <Link key={r} to={r}>
                {l}
              </Link>
            ))}
          </div>
          <div>
            <strong>О платформе</strong>
            {[
              ["Методология и источники", "/methodology"],
              ["Конфиденциальность", "/privacy"],
              ["Локальные настройки", "/settings-lab"],
              ["Моя аналитика", "/my-analytics"],
              ["Вход администратора", "/admin/login"],
            ].map(([l, r]) => (
              <Link key={r} to={r}>
                {l}
              </Link>
            ))}
            <button onClick={() => setOnboarding(true)}>
              Как это работает
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© Product Lab, 2026. Компании, данные и отзывы вымышлены.</span>
          <span>
            Создано для обучения. Эффективность пока не подтверждена
            исследованием.
          </span>
        </div>
      </footer>
      {consent === null &&
        !route.startsWith("/admin") &&
        !["/settings-lab", "/my-analytics"].includes(route) && (
          <div
            className="consent-bar"
            role="region"
            aria-label="Настройки аналитики"
          >
            <ShieldCheck size={21} />
            <p>
              <strong>Твой прогресс — твой выбор.</strong> С твоего согласия
              учебные события и активное время сохраняются только в этом
              браузере. На сервер ничего не отправляется. Заметки и личные
              данные не записываются. Отказ не ограничивает обучение.
            </p>
            <button
              className="text-button"
              onClick={() => navigate("/privacy")}
            >
              Подробнее
            </button>
            <button
              className="button secondary compact"
              onClick={() => {
                setAnalyticsConsent(false);
                setConsent(false);
              }}
            >
              Без аналитики
            </button>
            <button
              className="button primary compact"
              onClick={() => {
                setAnalyticsConsent(true);
                setConsent(true);
                track("session_started");
                track("page_view", { route });
              }}
            >
              Разрешить
            </button>
          </div>
        )}
      {slide && (
        <Suspense fallback={null}>
          <LessonModal
            key={slide}
            state={state}
            onCheck={checkLesson}
            id={slide}
            onClose={() => setSlide(null)}
            onNavigate={setSlide}
            onComplete={completeLesson}
          />
        </Suspense>
      )}
      {onboarding && (
        <Modal
          title="Твоя первая продуктовая миссия"
          onClose={() => setOnboarding(false)}
        >
          <div className="onboarding-steps">
            {[
              {
                icon: Map,
                title: "Выбери историю",
                text: `На карте — ${cases.length} бизнес-историй. Все, кроме итоговой, открыты в любом порядке; итоговая — после трёх завершённых.`,
              },
              {
                icon: BookOpen,
                title: "Изучи только нужное",
                text: `${courses.length} курсов и ${lessons.length} уроков — в разделе «Курсы». Теория доступна и в миссии; подсказки направляют мысль; их стоимость задаётся в локальных настройках.`,
              },
              {
                icon: Trophy,
                title: "Объясни решение",
                text: "Выбери действие и причины. Получи разбор, XP и рекомендации. Повторяй с новыми данными.",
              },
            ].map((s, i) => (
              <div key={s.title}>
                <span>
                  <s.icon size={24} />
                </span>
                <div>
                  <h3>
                    {i + 1}. {s.title}
                  </h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="button primary full"
            onClick={() => {
              setOnboarding(false);
              navigate("/map");
            }}
          >
            Поехали
            <ArrowRight size={18} />
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={23} />
          {toast}
          <button aria-label="Закрыть уведомление" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}
