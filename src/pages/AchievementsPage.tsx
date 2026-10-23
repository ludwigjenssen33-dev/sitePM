import {
  ArrowRight,
  Award,
  Check,
  LockKeyhole,
  Sparkles,
  Trophy,
} from "lucide-react";
import { achievements, level, type ProgressState } from "../domain/progress";
import LabScene from "../components/illustrations/LabScene";
import Link from "../components/Link";
export default function AchievementsPage({ state }: { state: ProgressState }) {
  const items = achievements(state);
  const earned = items.filter((x) => x.earned);
  const lv = level(state);
  return (
    <div className="achievements-page">
      <section className="achievement-hero">
        <div>
          <span className="eyebrow">МАЛЕНЬКИЕ ПОБЕДЫ. БОЛЬШОЙ ПУТЬ.</span>
          <h1>
            Это ты
            <br />
            <em>прокачался.</em>
          </h1>
          <p>
            Награды за осмысленные решения. Каждый навык — результат твоей
            практики.
          </p>
          <div className="achievement-count">
            <Trophy size={23} />
            {earned.length} из {items.length} наград · уровень {lv.number}
          </div>
          <Link className="button primary" to="/map">
            Продолжить приключение
            <ArrowRight size={18} />
          </Link>
        </div>
        <LabScene variant="celebrate" />
      </section>
      <div className="achievement-grid">
        {items.map((a, i) => (
          <section
            className={`achievement-card ${a.earned ? "earned" : "locked"}`}
            key={a.id}
          >
            <span className="achievement-medal">
              {a.earned ? <Award size={38} /> : <LockKeyhole size={30} />}
            </span>
            <span className="eyebrow">
              НАГРАДА {String(i + 1).padStart(2, "0")}
            </span>
            <h2>{a.title}</h2>
            <p>{a.description}</p>
            <span className="achievement-state">
              {a.earned ? (
                <>
                  <Check size={16} />
                  Получена
                </>
              ) : (
                <>Впереди — твоя победа</>
              )}
            </span>
          </section>
        ))}
      </div>
      <section className="certificate-invite panel">
        <Sparkles size={32} />
        <div>
          <h2>Награда за весь маршрут</h2>
          <p>
            Пройди обязательные миссии со средним результатом от 70/100 и получи
            игровой сертификат.
          </p>
        </div>
        <Link className="button secondary" to="/cabinet/certificate">
          Мой сертификат
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
