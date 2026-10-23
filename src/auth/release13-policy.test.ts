import {it,expect} from 'vitest';
import sql from '../../supabase/migrations/202610230001_release_1_3.sql?raw';
it('анонимный сбор не открывает таблицы и не принимает свободный текст',()=>{expect(sql).toContain('grant execute on function public.collect_product_event');expect(sql).not.toMatch(/grant (insert|update|all).*analytics_events/i);expect(sql).toContain("else raise exception 'Unapproved parameter'");expect(sql).toContain('on conflict(id) do nothing');expect(sql).toContain('Rate limited');});
it('назначение роли требует сервера и не позволяет снять свой доступ',()=>{expect(sql).toContain('not public.is_admin()');expect(sql).toContain('p_user_id=auth.uid()');expect(sql).toContain("'role_changed'");expect(sql).toContain('revoke all on function public.admin_set_role(uuid,text) from public,anon');});

it('порядок миссий проверяется также серверным RPC',()=>{expect(sql).toContain('Previous mission required');expect(sql).toContain('not public.is_admin()');expect(sql).toContain("a.status='completed'");expect(sql).toContain('cases_course_position');});
