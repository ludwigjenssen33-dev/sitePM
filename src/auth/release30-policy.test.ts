import {it,expect} from 'vitest';
import sql from '../../supabase/migrations/202610240001_product_lab_3.sql?raw';
import {cases,decisions} from '../data/cases';
import {reasonOptions} from '../lib/scoring';
it('серверная рубрика принимает все решения и причины клиента',()=>{expect(sql).toContain(`check(decision between 0 and ${decisions.length-1})`);expect(sql).toContain(`x>${reasonOptions.length-1}`);expect(sql).toContain('when r.decision=3 and chosen=1 then 6');expect(sql).toContain('when r.decision=0 and chosen=3 then 6');});
it('порядок миссий на сервере включает все кейсы клиента, итоговая — последняя',()=>{const order=sql.match(/array\[([^\]]+)\]/)![1].split(',').map(s=>s.trim().replace(/'/g,''));expect(order).toEqual(cases.map(c=>c.id));expect(order[order.length-1]).toBe('final');});
it('миграция не содержит секретов и не выдаёт права анонимам',()=>{expect(sql).not.toMatch(/password\s*[:=]|service_role|eyJ[a-zA-Z0-9]/i);expect(sql).toContain('revoke all on function public.submit_attempt(uuid,jsonb) from public,anon');});
