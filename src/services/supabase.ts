import { canEnterAdmin, safeAlias, validBackendConfig, validCredentials } from '../auth/policy';
import type { ProgressState } from '../domain/progress';
import {track} from '../analytics/events';

const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const backendConfigured = validBackendConfig(baseUrl, publicKey);
export type AuthUser = { id: string; email?: string };
export type AuthSession = { access_token: string; refresh_token: string; expires_at: number; user: AuthUser; recovery?: boolean };
export type Profile = { id: string; alias: string; public_ranking: boolean; created_at: string };
const sessionKey = 'product-lab-auth-v1';
const listeners = new Set<(session: AuthSession | null) => void>();
let memorySession: AuthSession | null = null;
let refreshFlight: Promise<AuthSession | null> | null = null;
function sessionFromRaw(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.access_token !== 'string' || typeof r.refresh_token !== 'string' || typeof r.expires_at !== 'number' || !r.user || typeof r.user !== 'object' || typeof (r.user as AuthUser).id !== 'string') return null;
  return r as AuthSession;
}
function persistSession(session: AuthSession | null): void {
  memorySession = session;
  try { if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session)); else sessionStorage.removeItem(sessionKey); } catch { /* A session still works in memory when storage is blocked. */ }
  listeners.forEach(listener => listener(session));
}
function readSession(): AuthSession | null {
  if (!backendConfigured) return null;
  if (memorySession) return memorySession;
  try { memorySession = sessionFromRaw(JSON.parse(sessionStorage.getItem(sessionKey) || 'null')); } catch { memorySession = null; }
  return memorySession;
}
export function subscribeAuth(listener: (session: AuthSession | null) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
function requireBackend(): void { if (!backendConfigured) throw new Error('Supabase не настроен. Сейчас доступен гостевой режим с локальным прогрессом.'); }
async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  requireBackend();
  const session = authenticated ? await getSession() : null;
  if (authenticated && !session) throw new Error('Для этой операции войдите в аккаунт.');
  const headers: Record<string, string> = { apikey: publicKey, 'Content-Type': 'application/json', ...(options.headers as Record<string,string> || {}) };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('Не удалось связаться с Supabase. Проверьте подключение и настройки проекта. Локальный прогресс сохранён.'); }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Сессия завершилась. Войдите снова.');
    if (response.status === 403) throw new Error('Недостаточно прав для этой операции.');
    if (response.status === 429) throw new Error('Слишком много запросов. Попробуйте позже.');
    const code = typeof body?.error_code === 'string' ? body.error_code : '';
    if (code === 'invalid_credentials') throw new Error('Неверная почта или пароль.');
    if (code === 'email_not_confirmed') throw new Error('Подтвердите почту по ссылке из письма.');
    if (code === 'user_already_exists') throw new Error('Аккаунт уже существует. Попробуйте вход или восстановление доступа.');
    if (code === 'weak_password') throw new Error('Пароль не соответствует политике безопасности сервера.');
    throw new Error(`Сервер не выполнил операцию (HTTP ${response.status}). Проверьте миграции и настройки доступа.`);
  }
  return body as T;
}
function normalizeTokenResponse(response: Record<string, unknown>, recovery = false): AuthSession | null {
  if (!response.access_token || !response.refresh_token || !response.user) return null;
  return sessionFromRaw({ ...response, expires_at: typeof response.expires_at === 'number' ? response.expires_at : Date.now()/1000 + Number(response.expires_in || 3600), recovery });
}
export async function getSession(): Promise<AuthSession | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at > Date.now()/1000 + 45) return session;
  if (refreshFlight) return refreshFlight;
  refreshFlight = (async () => {
    try {
      const result = await request<Record<string, unknown>>('/auth/v1/token?grant_type=refresh_token', { method:'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }, false);
      const refreshed = normalizeTokenResponse(result, session.recovery);
      persistSession(refreshed); return refreshed;
    } catch { persistSession(null); return null; }
    finally { refreshFlight = null; }
  })();
  return refreshFlight;
}
export async function consumeAuthCallback(): Promise<boolean> {
  if (!backendConfigured || typeof location === 'undefined') return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  // Remove credentials from the URL before any navigation or external link can occur.
  history.replaceState(null, '', `${location.pathname}${location.search}#account`);
  const response = await fetch(`${baseUrl}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Ссылка подтверждения недействительна или устарела.');
  const user = await response.json() as AuthUser;
  persistSession({ access_token, refresh_token, expires_at: Date.now()/1000 + Number(params.get('expires_in') || 3600), user, recovery: params.get('type') === 'recovery' });
  if(params.get('type')==='signup')track('signup_completed');
  track('login_completed');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return true;
}
export async function signIn(email: string, password: string): Promise<void> {
  validCredentials(email, password);
  const result = await request<Record<string, unknown>>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, false);
  const session = normalizeTokenResponse(result);
  if (!session) throw new Error('Сервер не вернул корректную сессию.');
  persistSession(session);
}
export async function signUp(email: string, password: string, alias: string): Promise<boolean> {
  validCredentials(email, password);
  const result = await request<Record<string, unknown>>('/auth/v1/signup', { method:'POST', body:JSON.stringify({ email:email.trim(),password,data:{alias:safeAlias(alias)} }) }, false);
  const session = normalizeTokenResponse(result);
  if (session) persistSession(session);
  return !!session;
}
export async function signOut(): Promise<void> {
  try { if (await getSession()) await request('/auth/v1/logout', { method:'POST' }); }
  finally { persistSession(null); }
}
export async function requestPasswordReset(email: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Укажите корректную почту.');
  await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(location.origin + '/')}`, { method:'POST',body:JSON.stringify({email:email.trim()}) }, false);
}
export async function completePasswordReset(password: string): Promise<void> {
  if (password.length < 10 || password.length > 128) throw new Error('Пароль должен содержать от 10 до 128 символов.');
  await request('/auth/v1/user', {method:'PUT',body:JSON.stringify({password})});
  const session = await getSession(); if (session) persistSession({...session,recovery:false});
}
export async function getProfile(): Promise<Profile | null> {
  const session = await getSession(); if (!session) return null;
  const rows = await request<Profile[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,alias,public_ranking,created_at`);
  return rows[0] || null;
}
export async function updateProfile(data: { alias: string; publicRanking: boolean }): Promise<Profile> {
  const session = await getSession(); if (!session) throw new Error('Войдите в аккаунт.');
  const rows = await request<Profile[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`, { method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({alias:safeAlias(data.alias),public_ranking:data.publicRanking}) });
  if (!rows[0]) throw new Error('Профиль не найден. Проверьте миграции.');
  return rows[0];
}
export async function hasAdminRole(): Promise<boolean> {
  if (!await getSession()) return false;
  try { return canEnterAdmin(await request<unknown>('/rest/v1/rpc/is_admin', {method:'POST',body:'{}'})); } catch { return false; }
}
export async function importLocalProgress(state: ProgressState): Promise<{ imported: boolean; updated_at: string }> {
  return request('/rest/v1/rpc/import_guest_progress', {method:'POST',body:JSON.stringify({p_snapshot:state})});
}
export async function getCloudProgress(): Promise<ProgressState | null> {
  const result = await request<{snapshot:ProgressState}[]>('/rest/v1/guest_progress?select=snapshot');
  return result[0]?.snapshot || null;
}
export type ServerCriterion = { name: string; points: number; max: number };
export type ServerResult = { score: number; criteria: ServerCriterion[]; hint_penalty?: number };
export async function startServerAttempt(variantId: string): Promise<string> { return request('/rest/v1/rpc/start_attempt',{method:'POST',body:JSON.stringify({p_variant_id:variantId})}); }
export async function recordServerHint(attemptId: string, stage: number): Promise<number> { return request('/rest/v1/rpc/record_hint',{method:'POST',body:JSON.stringify({p_attempt_id:attemptId,p_stage:stage})}); }
export async function submitServerAttempt(attemptId: string, answers: unknown): Promise<ServerResult> { return request('/rest/v1/rpc/submit_attempt',{method:'POST',body:JSON.stringify({p_attempt_id:attemptId,p_answers:answers})}); }
export async function issueServerCertificate(courseId='product-lab'): Promise<unknown> { return request('/rest/v1/rpc/issue_certificate',{method:'POST',body:JSON.stringify({p_course_id:courseId})}); }
export async function getServerLeaderboard(weekly=false): Promise<{alias:string;points:number;completed:number;average:number;achievements:number}[]> { return request('/rest/v1/rpc/public_leaderboard',{method:'POST',body:JSON.stringify({p_weekly:weekly})}); }
export async function saveServerContentDraft(entityType:'case'|'lesson',entityId:string,content:Record<string,unknown>):Promise<string>{return request('/rest/v1/rpc/save_content_draft',{method:'POST',body:JSON.stringify({p_entity_type:entityType,p_entity_id:entityId,p_content:content})});}
async function exactCount(table:'profiles'|'attempts'|'certificates'):Promise<number>{
  const session=await getSession();if(!session)throw new Error('Войдите в аккаунт.');
  const response=await fetch(`${baseUrl}/rest/v1/${table}?select=id`,{method:'HEAD',headers:{apikey:publicKey,Authorization:`Bearer ${session.access_token}`,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Не удалось загрузить серверную статистику (HTTP ${response.status}).`);
  const total=response.headers.get('content-range')?.split('/')[1];
  if(!total||total==='*'||!Number.isFinite(Number(total)))throw new Error('Сервер не вернул точный размер выборки.');
  return Number(total);
}
export async function getAdminOverview():Promise<{profiles:number;attempts:number;certificates:number}> {
  if(!await hasAdminRole())throw new Error('Доступ администратора не подтверждён сервером.');
  const [profiles,attempts,certificates]=await Promise.all([exactCount('profiles'),exactCount('attempts'),exactCount('certificates')]);
  return {profiles,attempts,certificates};
}
export type ServerAnalyticsEvent={id:string;user_id:string|null;session_id:string;schema_version:number;occurred_at:string;event_type:string;actor_id?:string|null;device?:'mobile'|'desktop'|'unknown';traffic_source?:'direct'|'search'|'social'|'referral'|'unknown';params:Record<string,string|number|boolean>};
/** Real events only; missing device/source must remain unknown in a reporting adapter. */
export async function getServerEvents():Promise<{events:ServerAnalyticsEvent[];truncated:boolean}> {
  if(!await hasAdminRole())throw new Error('Доступ администратора не подтверждён сервером.');
  const since=new Date(Date.now()-30*86400000).toISOString();const events:ServerAnalyticsEvent[]=[];
  for(let offset=0;offset<10000;offset+=1000){
    const batch=await request<ServerAnalyticsEvent[]>(`/rest/v1/analytics_events?select=id,user_id,session_id,schema_version,occurred_at,event_type,actor_id,device,traffic_source,params&occurred_at=gte.${encodeURIComponent(since)}&order=occurred_at.asc,id.asc&offset=${offset}&limit=1000`);
    events.push(...batch);if(batch.length<1000)return {events,truncated:false};
  }
  return {events,truncated:true};
}

export type AdminTable='profiles'|'attempts'|'certificates'|'content_versions'|'admin_audit_log';
export async function getAdminRows(table:AdminTable):Promise<Record<string,unknown>[]>{
 if(!await hasAdminRole())throw new Error('Доступ администратора не подтверждён сервером.');
 const selections:Record<AdminTable,string>={profiles:'id,alias,public_ranking,created_at',attempts:'id,user_id,variant_id,status,score,started_at,completed_at',certificates:'id,user_id,course_id,issued_at',content_versions:'id,entity_type,entity_id,version,status,created_at',admin_audit_log:'id,actor_id,action,entity_type,entity_id,occurred_at'};
 if(!Object.hasOwn(selections,table))throw new Error('Неизвестная таблица.');
 return request(`/rest/v1/${table}?select=${selections[table]}&limit=200&order=${table==='attempts'?'started_at':table==='certificates'?'issued_at':table==='admin_audit_log'?'occurred_at':'created_at'}.desc`);
}
export async function setServerRole(userId:string,role:'learner'|'editor'|'admin'){
 if(!await hasAdminRole())throw new Error('Нужны права администратора.');
 if(!/^[0-9a-f-]{36}$/i.test(userId)||!['learner','editor','admin'].includes(role))throw new Error('Некорректная роль или пользователь.');
 return request('/rest/v1/rpc/admin_set_role',{method:'POST',body:JSON.stringify({p_user_id:userId,p_role:role})});
}
