import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminRequest } from "../auth/admin";
import { useAuth } from "../auth/useAuth";
import { navigate } from "../domain/router";
import Link from "../components/Link";
import LabScene from "../components/illustrations/LabScene";
export default function AdminLoginPage() {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminRequest("login", { username, password });
      setPassword("");
      window.dispatchEvent(new Event("product-lab:admin-session"));
      navigate("/admin/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Вход не выполнен.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-login-layout">
      <div className="admin-login-story">
        <span className="eyebrow">ЗА КУЛИСАМИ PRODUCT LAB</span>
        <h1>
          Хорошему обучению
          <br />
          нужен внимательный
          <br />
          <em>исследователь.</em>
        </h1>
        <LabScene variant="guide" />
        <p>
          Закрытое пространство владельца платформы. Для обучения аккаунт не
          нужен.
        </p>
      </div>
      <section className="panel admin-login-form">
        <span className="login-lock">
          <LockKeyhole size={27} />
        </span>
        <h2>Вход администратора</h2>
        <p className="muted">
          Сервер проверит учётные данные. Доступ не хранится в браузерном
          прогрессе.
        </p>
        {auth.loading ? (
          <p role="status">Проверяем сервер…</p>
        ) : auth.admin ? (
          <>
            <div className="notice">
              <ShieldCheck />
              Вход уже выполнен.
            </div>
            <Link className="button primary" to="/admin/dashboard">
              Открыть панель
              <ArrowRight size={18} />
            </Link>
          </>
        ) : (
          <>
            <form onSubmit={submit} className="admin-form">
              <label>
                Логин
                <input
                  autoComplete="username"
                  required
                  maxLength={120}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="button primary full"
                disabled={busy || !auth.status.configured}
              >
                {busy ? "Проверяем…" : "Войти в панель"}
                <ArrowRight size={18} />
              </button>
            </form>
            {!auth.status.configured && (
              <div className="notice warning" role="status">
                Вход закрыт: сначала требуется защищённая настройка сервера
                владельцем. Публичного пароля и демо-входа нет.
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="tiny muted">
          Не более 5 попыток с одного адреса за 15 минут. Сессия действует 8
          часов.
        </p>
        <Link to="/courses" className="text-button">
          Я здесь учиться →
        </Link>
      </section>
    </div>
  );
}
