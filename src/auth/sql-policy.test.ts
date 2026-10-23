import sql from '../../supabase/migrations/202610220001_platform.sql?raw';
import {describe,it,expect} from 'vitest';
describe('Конфигурация SQL-политик (структурная проверка, не запуск БД)',()=>{
 it('включает RLS для всех пользовательских сущностей',()=>{for(const table of ['profiles','roles','attempts','answers','skill_scores','achievements','certificates','analytics_events','guest_progress','admin_audit_log'])expect(sql).toContain(`alter table public.${table} enable row level security`);});
 it('не разрешает клиентам запись роли, оценки или сертификата',()=>{expect(sql).not.toMatch(/create policy[^;]+on public\.(roles|certificates|attempts)[^;]+for (insert|update|all)/i);expect(sql).toContain('revoke all on all tables in schema public from anon,authenticated');expect(sql).toContain('revoke all on schema private from public, anon, authenticated');});
 it('проверяет владельца, неизменность результата и серверную рубрику',()=>{expect(sql).toContain("where id=p_attempt_id and user_id=auth.uid() for update");expect(sql).toContain("if a.status='completed'");expect(sql).toContain('from private.case_rubrics');expect(sql).toContain('where c.course_id=p_course_id and c.required and c.published');});
 it('импорт не создаёт проверенные результаты',()=>{expect(sql).toContain('verified boolean not null default false check(verified=false)');expect(sql).toContain("merged:=jsonb_set(merged,'{certificates}','[]'::jsonb)");});
});
