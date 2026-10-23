/** Only public Supabase credentials belong in the browser. */
export function isPublicSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return key.length > 20;
  if (key.startsWith('sb_secret_')) return false;
  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const body = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return body.role === 'anon';
  } catch { return false; }
}
export function validBackendConfig(url: string, key: string): boolean {
  try { const parsed = new URL(url); return (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) && !parsed.username && !parsed.password && isPublicSupabaseKey(key); }
  catch { return false; }
}
export function canEnterAdmin(serverConfirmedRole: unknown): boolean { return serverConfirmedRole === true; }
export function safeAlias(alias: string): string {
  const trimmed = alias.trim();
  if (trimmed.length < 2 || trimmed.length > 40) throw new Error('Псевдоним должен содержать от 2 до 40 символов.');
  return trimmed;
}
export function validCredentials(email: string, password: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Укажите корректную электронную почту.');
  if (password.length < 10 || password.length > 128) throw new Error('Пароль должен содержать от 10 до 128 символов.');
}
