import { describe,expect,it } from 'vitest';
import { canEnterAdmin,isPublicSupabaseKey,safeAlias,validBackendConfig,validCredentials } from './policy';
const token=(role:string)=>`header.${btoa(JSON.stringify({role}))}.signature`;
describe('Граница доверия авторизации',()=>{
 it('публичный ключ не может быть service_role или secret',()=>{expect(isPublicSupabaseKey(token('anon'))).toBe(true);expect(isPublicSupabaseKey(token('service_role'))).toBe(false);expect(isPublicSupabaseKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(false);expect(isPublicSupabaseKey('sb_publishable_abcdefghijklmnopqrstuvwxyz')).toBe(true);});
 it('запрещает открытый HTTP для внешнего Supabase',()=>{expect(validBackendConfig('http://example.supabase.co',token('anon'))).toBe(false);expect(validBackendConfig('https://example.supabase.co',token('anon'))).toBe(true);expect(validBackendConfig('http://127.0.0.1:54321',token('anon'))).toBe(true);});
 it('роль не получается из произвольного клиентского объекта',()=>{for(const role of [false,null,undefined,'admin','true',1,{role:'admin'},{admin:true}])expect(canEnterAdmin(role)).toBe(false);expect(canEnterAdmin(true)).toBe(true);});
 it('проверяет пароль и псевдоним',()=>{expect(()=>validCredentials('a@b.co','safe-password')).not.toThrow();expect(()=>validCredentials('invalid','safe-password')).toThrow();expect(()=>validCredentials('a@b.co','short')).toThrow();expect(()=>safeAlias('a')).toThrow();expect(safeAlias('  Исследователь  ')).toBe('Исследователь');});
});
