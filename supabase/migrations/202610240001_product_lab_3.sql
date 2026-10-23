-- Product Lab 3.0. Apply after 202610230001_release_1_3.sql. No credentials, passwords or keys belong here.
-- 1) Серверная рубрика синхронизирована с клиентской: решения 0–3 (включая «Ограниченный пилот»),
--    причины 0–6, частичный балл за осторожный соседний вариант решения.
-- 2) Порядок миссий дополнен новыми кейсами 3.0.
-- 3) Публичный рейтинг остаётся без email: только псевдоним и агрегаты.
begin;

alter table private.case_rubrics drop constraint if exists case_rubrics_decision_check;
alter table private.case_rubrics add constraint case_rubrics_decision_check check(decision between 0 and 3);

create or replace function public.submit_attempt(p_attempt_id uuid,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.attempts; r private.case_rubrics; diagnosis_points numeric; hypothesis_points numeric; metric_points numeric; interpretation_points numeric; decision_points numeric; reason_points numeric; total numeric; selected_reasons integer[]; matched integer; chosen integer; v_criteria jsonb; unique_hints integer;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found'; end if;
 if a.status='completed' then return jsonb_build_object('score',a.score,'criteria',a.criteria); end if;
 if jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>8192 then raise exception 'Invalid answers'; end if;
 select * into r from private.case_rubrics where variant_id=a.variant_id;
 if not found then raise exception 'Rubric unavailable'; end if;
 select array_agg(distinct value::integer) into selected_reasons from jsonb_array_elements_text(coalesce(p_answers->'reasons','[]'::jsonb));
 -- Семь вариантов причин (0–6), как в src/lib/scoring.ts.
 if cardinality(selected_reasons) not between 1 and 2 or selected_reasons is null or exists(select 1 from unnest(selected_reasons) x where x<0 or x>6) then raise exception 'Select one or two valid reasons'; end if;
 diagnosis_points:=case when p_answers->>'node'=r.diagnosis then 25 when p_answers->>'node'=r.partial_diagnosis then r.partial_points else 0 end;
 hypothesis_points:=case when (p_answers->>'hypothesis')::integer=r.hypothesis then 20 else 0 end;
 metric_points:=(case when (p_answers->>'primary')::integer=r.primary_metric then 10 else 0 end)+(case when (p_answers->>'guardrail')::integer=r.guardrail then 5 else 0 end);
 interpretation_points:=case when (p_answers->>'interpretation')::integer=r.interpretation then 20 else 0 end;
 chosen:=(p_answers->>'decision')::integer;
 -- 12 за верное решение; 6 — пилот вместо подтверждённого внедрения или «не внедрять» вместо пилота (decisionPoints на клиенте).
 decision_points:=case when chosen=r.decision then 12 when r.decision=3 and chosen=1 then 6 when r.decision=0 and chosen=3 then 6 else 0 end;
 select count(*) into matched from unnest(selected_reasons) x where x=any(r.reasons);
 reason_points:=least(8,greatest(0,round(8.0*(matched-(cardinality(selected_reasons)-matched))/cardinality(r.reasons))));
 select count(distinct h) into unique_hints from unnest(a.hints) h where h between 0 and 3;
 total:=greatest(0,diagnosis_points+hypothesis_points+metric_points+interpretation_points+decision_points+reason_points-unique_hints*2);
 v_criteria:=jsonb_build_array(jsonb_build_object('name','Диагностика метрик','points',diagnosis_points,'max',25),jsonb_build_object('name','Формулировка гипотез','points',hypothesis_points,'max',20),jsonb_build_object('name','Выбор метрик эксперимента','points',metric_points,'max',15),jsonb_build_object('name','Интерпретация A/B-тестов','points',interpretation_points,'max',20),jsonb_build_object('name','Принятие решений','points',decision_points+reason_points,'max',20));
 update public.attempts set status='completed',completed_at=now(),updated_at=now(),score=total,criteria=v_criteria where id=a.id;
 insert into public.answers(attempt_id,stage,answer) values(a.id,0,jsonb_build_object('node',p_answers->'node')),(a.id,1,p_answers-'node'-'interpretation'-'decision'-'reasons'-'note'),(a.id,2,jsonb_build_object('interpretation',p_answers->'interpretation')),(a.id,3,jsonb_build_object('decision',p_answers->'decision','reasons',p_answers->'reasons','note',left(coalesce(p_answers->>'note',''),2000)));
 insert into public.skill_scores values(a.id,'diagnosis',diagnosis_points,25),(a.id,'hypothesis',hypothesis_points,20),(a.id,'metrics',metric_points,15),(a.id,'interpretation',interpretation_points,20),(a.id,'decision',decision_points+reason_points,20);
 insert into public.achievements(user_id,achievement_id) values(auth.uid(),'first_mission') on conflict do nothing;
 if unique_hints=0 and total>=70 then insert into public.achievements(user_id,achievement_id) values(auth.uid(),'without_hints') on conflict do nothing; end if;
 return jsonb_build_object('score',total,'criteria',v_criteria,'hint_penalty',unique_hints*2);
end; $$;
revoke all on function public.submit_attempt(uuid,jsonb) from public,anon;
grant execute on function public.submit_attempt(uuid,jsonb) to authenticated;

-- Порядок миссий 3.0: новые кейсы перед итоговой. Позиции пересчитываются через временный сдвиг,
-- чтобы не нарушить уникальный индекс cases_course_position.
update public.cases set position=position+1000;
with ordered as (
 select id,row_number() over(partition by course_id order by array_position(array['market','stream','food','ads','interface','price','recommend','quality','fintech','fitness','saas','ecommerce','final'],id) nulls last,id) as rank
 from public.cases
) update public.cases c set position=o.rank from ordered o where c.id=o.id;

commit;
