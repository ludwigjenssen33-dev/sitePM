import { useCallback, useEffect, useState } from 'react';
import { consumeAuthCallback, getProfile, getSession, hasAdminRole, subscribeAuth, type AuthSession, type Profile } from '../services/supabase';
let callbackTask: Promise<boolean> | null = null;
export function useAuth() {
  const [session,setSession] = useState<AuthSession|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [admin,setAdmin] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const next = await getSession();setSession(next);if(next){const [p,a]=await Promise.all([getProfile(),hasAdminRole()]);setProfile(p);setAdmin(a);}else{setProfile(null);setAdmin(false);}setError(''); }
    catch(e){setError(e instanceof Error?e.message:'Не удалось получить профиль.');setAdmin(false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    let active=true;
    callbackTask ??= consumeAuthCallback().catch(e=>{if(active)setError(e instanceof Error?e.message:'Ошибка подтверждения почты.');return false;});
    void callbackTask.then(()=>{if(active)void refresh();});
    const unsubscribe=subscribeAuth(()=>{if(active)void refresh();});
    return()=>{active=false;unsubscribe();};
  },[refresh]);
  return {session,profile,admin,loading,error,refresh};
}
