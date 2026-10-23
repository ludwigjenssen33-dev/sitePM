import { useState, type FormEvent } from "react";
import { ArrowRight, HardDrive, ShieldCheck, UserRound } from "lucide-react";
import type { ProgressState } from "../domain/progress";
import Link from "../components/Link";
import ProgressBackup from "../features/retention/ProgressBackup";
export default function AccountPage({
  progress,
  onImported,
}: {
  progress: ProgressState;
  onImported?: (s: ProgressState) => void;
}) {
  const [alias, setAlias] = useState(progress.profile.alias);
  const [saved, setSaved] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (alias.trim().length >= 2) {
      onImported?.({
        ...progress,
        profile: { ...progress.profile, alias: alias.trim() },
      });
      setSaved(true);
    }
  }
  return (
    <div className="account-page">
      <div className="page-title">
        <span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span>
        <h1>Профиль без регистрации</h1>
        <p>Просто учись. Твой путь сохраняется на этом устройстве.</p>
      </div>
      <div className="two-columns">
        <section className="panel">
          <UserRound size={28} />
          <h2>Как тебя называть?</h2>
          <form className="admin-form" onSubmit={submit}>
            <label>
              Псевдоним
              <input
                minLength={2}
                maxLength={40}
                autoComplete="nickname"
                required
                value={alias}
                onChange={(e) => {
                  setAlias(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <button className="button primary" disabled={!onImported}>
              Сохранить имя
            </button>
          </form>
          {saved && (
            <p className="success" role="status">
              Готово. Это имя появится на игровом сертификате.
            </p>
          )}
        </section>
        <section className="panel">
          <HardDrive size={28} />
          <h2>Твой прогресс — рядом</h2>
          <p>
            Уроки, попытки, заметки и награды хранятся в этом браузере. При
            очистке хранилища они исчезнут: сохраняй резервную копию перед
            сменой устройства.
          </p>
          <p className="muted">
            Для обучения аккаунт и пароль не нужны. Административный вход
            предназначен только владельцу платформы.
          </p>
          <Link className="text-button" to="/privacy">
            Настройки аналитики и приватность
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
      {onImported && <ProgressBackup state={progress} onChange={onImported} />}
    </div>
  );
}
