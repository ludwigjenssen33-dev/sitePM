// Только доверенный оператор. Этот модуль не импортируется в frontend.
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function provisionAdmin({base,key,email,fetcher=fetch,saveCredentials}={}){
 base=(base||'').replace(/\/$/,'');
 if(!/^https:\/\/[^/]+$/.test(base)||!key)throw new Error('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в серверном окружении. Аккаунт не создан. Никогда не добавляйте service-role key с префиксом VITE_.');
 const login=email||`admin-${randomBytes(5).toString('hex')}@productlab.invalid`;
 const password=randomBytes(24).toString('base64url');const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};let id;
 try{
  const response=await fetcher(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:login,password,email_confirm:true,user_metadata:{alias:'Администратор Product Lab'}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Создание пользователя: HTTP ${response.status}. Проверьте серверный ключ и настройки Auth.`);
  const user=await response.json();if(!user.id)throw new Error('Сервер не вернул ID пользователя.');id=user.id;
  const role=await fetcher(base+'/rest/v1/roles?on_conflict=user_id,role',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:id,role:'admin'}),signal:AbortSignal.timeout(15000)});
  if(!role.ok)throw new Error(`Назначение роли: HTTP ${role.status}. Примените SQL-миграции перед созданием администратора.`);
  const credentials={login,password,userId:id,createdAt:new Date().toISOString(),notice:'Храните в менеджере паролей. Файл не должен попасть в Git.'};
  let path;if(saveCredentials)path=await saveCredentials(credentials);else{await mkdir('.private',{recursive:true,mode:0o700});path=`.private/admin-${Date.now()}.json`;await writeFile(path,JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});}
  return {userId:id,path};
 }catch(error){if(id){try{const rollback=await fetcher(base+'/auth/v1/admin/users/'+encodeURIComponent(id),{method:'DELETE',headers,signal:AbortSignal.timeout(15000)});if(!rollback.ok)throw new Error('Не удалось удалить неполный аккаунт.');}catch{throw new Error('Создание не завершено. Не удалось удалить только что созданный неполный аккаунт: проверьте Auth Users в Supabase.');}}throw error;}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){try{const result=await provisionAdmin({base:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,email:process.env.ADMIN_EMAIL});console.log(`Администратор создан. Логин и пароль записаны в ${result.path}. Пароль не напечатан в логах.`);}catch(e){console.error(e instanceof Error?e.message:'Не удалось создать аккаунт.');process.exitCode=1;}}
