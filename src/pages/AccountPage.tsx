import { useEffect, useState, type FormEvent } from 'react';
import { Cloud, Download, LogIn, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import {track} from '../analytics/events';
import { backendConfigured, completePasswordReset, getCloudProgress, importLocalProgress, requestPasswordReset, signIn, signOut, signUp, updateProfile } from '../services/supabase';
import { mergeProgress, parseProgress } from '../services/progressStore';
import type { ProgressState } from '../domain/progress';

type Props = { progress: ProgressState; onImported?: (state: ProgressState) => void };
export default function AccountPage({ progress, onImported }: Props) {
  const auth = useAuth();
  const [mode,setMode] = useState<'login'|'signup'|'reset'>('login');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [alias,setAlias] = useState(progress.profile.alias);
  const [publicRanking,setPublicRanking] = useState(progress.profile.publicRanking);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{if(auth.profile){setAlias(auth.profile.alias);setPublicRanking(auth.profile.public_ranking);}},[auth.profile?.alias,auth.profile?.public_ranking]);
  async function action(task:()=>Promise<void>) { setBusy(true);setError('');setMessage('');try{await task();}catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие.');}finally{setBusy(false);} }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await action(async()=>{
      if(mode==='signup') { track('signup_started');const authenticated=await signUp(email,password,alias);if(authenticated){track('signup_completed');track('login_completed');}setMessage(authenticated?'Аккаунт создан. Вы вошли в систему.':'Проверьте почту: для завершения регистрации перейдите по ссылке из письма.'); }
      else if(mode==='reset') { await requestPasswordReset(email);setMessage('Если аккаунт с такой почтой существует, инструкция по восстановлению отправлена.'); }
      else { await signIn(email,password);track('login_completed');setMessage('Вы вошли в аккаунт. Локальный прогресс можно импортировать ниже.'); }
      setPassword('');await auth.refresh();
    });
  }
  const configuredMessage = backendConfigured ? 'Подключён режим Supabase. Доступ определяется сессией и серверными политиками.' : 'Сейчас вы гость. Регистрация и облачное хранение станут доступны после подключения Supabase. Локальное обучение работает полностью.';
  return <div className="account-page">
    <div className="page-title"><span className="eyebrow">ВАШЕ ПРОСТРАНСТВО</span><h1>Профиль и аккаунт</h1><p>Сохраните свой путь от первого диагноза до уверенного продуктового решения.</p></div>
    <div className="notice"><Cloud size={22}/><div><strong>{backendConfigured?'Серверная интеграция настроена':'Гостевой режим'}</strong><p>{configuredMessage}</p></div></div>
    {(error||auth.error)&&<div className="notice warning" role="alert">{error||auth.error}</div>}
    {message&&<div className="notice" role="status"><ShieldCheck size={20}/>{message}</div>}
    {auth.loading&&backendConfigured?<div className="panel" aria-busy="true">Проверяем сессию и серверные права…</div>:auth.session?<>
      <section className="panel"><div className="account-title"><UserRound size={26}/><div><h2>{auth.profile?.alias||'Участник Product Lab'}</h2><p className="muted">{auth.session.user.email||'Аккаунт подтверждён'} · {auth.admin?'Администратор — роль подтверждена сервером':'Участник курса'}</p></div></div>
        <button className="button secondary" disabled={busy} onClick={()=>void action(async()=>{await signOut();setMessage('Вы вышли из аккаунта. Локальный прогресс сохранён.');})}><LogOut size={16}/> Выйти</button>
      </section>
      {auth.session.recovery&&<section className="panel"><h2>Новый пароль</h2><p className="muted">Ссылка восстановления подтверждена сервером. Задайте пароль не короче 10 символов.</p><form onSubmit={e=>{e.preventDefault();void action(async()=>{await completePasswordReset(password);setPassword('');setMessage('Пароль изменён.');await auth.refresh();});}} className="account-form"><label>Новый пароль<input type="password" minLength={10} maxLength={128} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>Сохранить новый пароль</button></form></section>}
      <div className="two-columns"><section className="panel"><h2>Публичный псевдоним</h2><p className="muted">В публичном рейтинге используется только псевдоним, без электронной почты. Вы можете не участвовать.</p><form className="account-form" onSubmit={e=>{e.preventDefault();void action(async()=>{await updateProfile({alias,publicRanking});await auth.refresh();setMessage('Настройки профиля сохранены на сервере.');});}}><label>Псевдоним<input minLength={2} maxLength={40} required value={alias} onChange={e=>setAlias(e.target.value)} placeholder={auth.profile?.alias}/></label><label className="checkbox-label"><input type="checkbox" checked={publicRanking} onChange={e=>setPublicRanking(e.target.checked)}/> Показывать меня в публичном рейтинге</label><button className="button primary" disabled={busy}>Сохранить настройки</button></form></section>
      <section className="panel"><h2>Локальный прогресс → аккаунт</h2><p className="muted">На устройстве: {progress.attempts.length} попыток. Импорт выполняется только по вашей кнопке. Сервер объединяет историю и сохраняет более новые и завершённые попытки.</p><p className="tiny muted">Передаются учебные ответы и обоснования. Импорт помечается как непроверенный: локальные оценки не дают серверный рейтинг или подтверждённый сертификат.</p><div className="button-row"><button className="button primary" disabled={busy} onClick={()=>void action(async()=>{await importLocalProgress(progress);setMessage('Локальная история сохранена в приватном облачном архиве. Оценки остаются непроверенными сервером.');})}><Cloud size={16}/> Импортировать локальный прогресс</button><button className="button secondary" disabled={busy||!onImported} onClick={()=>void action(async()=>{const raw=await getCloudProgress();if(!raw){setMessage('В облачном архиве пока нет прогресса.');return;}const incoming=parseProgress(raw);if(!incoming)throw new Error('Облачный архив имеет неподдерживаемую структуру. Локальный прогресс не изменён.');onImported?.(mergeProgress(progress,incoming));setMessage('Облачная история объединена с локальной; более новые попытки сохранены.');})}><Download size={16}/> Загрузить облачную историю</button></div></section></div>
    </>:<div className="two-columns"><section className="panel"><h2>{mode==='signup'?'Создать аккаунт':mode==='reset'?'Восстановить доступ':'Войти в Product Lab'}</h2><p className="muted">{backendConfigured?'Почта и пароль отправляются только в настроенный проект Supabase.':'Форма станет доступна после настройки серверного подключения. Гостевой режим не является авторизацией.'}</p><div className="button-row" role="group" aria-label="Режим авторизации">{([['login','Вход'],['signup','Регистрация'],['reset','Восстановление']] as const).map(([id,title])=><button key={id} className={`button ${mode===id?'primary':'secondary'}`} onClick={()=>{setMode(id);setMessage('');setError('');}}>{title}</button>)}</div><form onSubmit={submit} className="account-form"><fieldset disabled={!backendConfigured||busy}>
      {mode==='signup'&&<label>Псевдоним<input autoComplete="nickname" minLength={2} maxLength={40} required value={alias} onChange={e=>setAlias(e.target.value)}/></label>}
      <label>Электронная почта<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      {mode!=='reset'&&<label>Пароль<input type="password" required minLength={10} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      <button className="button primary" type="submit">{busy?'Выполняем…':mode==='signup'?<><UserRound size={16}/> Зарегистрироваться</>:mode==='reset'?<><Mail size={16}/> Отправить инструкцию</>:<><LogIn size={16}/> Войти</>}</button>
    </fieldset></form></section><section className="panel"><h2>Что доступно гостю</h2><ul><li>Все учебные миссии и лаборатория.</li><li>Локальная история, навыки и достижения.</li><li>Игровой сертификат с отметкой о локальной выдаче.</li><li>Демонстрационные рейтинг и административные дашборды.</li></ul><p className="muted">Без Supabase нет реальных аккаунтов, облачной синхронизации, публичного рейтинга и подтверждённых сервером сертификатов. Для подключения нужны URL проекта, публичный anon-ключ и SQL-миграция.</p></section></div>}
    <style>{`.account-page .account-form{display:grid;gap:18px;margin-top:24px}.account-page fieldset{display:grid;gap:18px;border:0;padding:0;margin:0;min-width:0}.account-page label{display:grid;gap:7px;font-size:13px}.account-page input:not([type=checkbox]){padding:12px 14px;border:1px solid var(--line,#d8dfe8);border-radius:10px;background:var(--card,#fff);color:inherit;min-width:0;width:100%}.account-page .checkbox-label{display:flex;align-items:center;gap:10px}.account-page .account-title{display:flex;gap:14px;align-items:center;margin-bottom:24px}.account-page ul{padding-left:20px;line-height:2}.account-page .panel>.tiny{margin-top:16px}`}</style>
  </div>;
}
