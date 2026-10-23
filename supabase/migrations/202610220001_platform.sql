-- Product Lab 2.0. Run in a new Supabase project using its SQL Editor.
-- Every privileged decision is made in PostgreSQL; no service key belongs in Vite.
begin;
create extension if not exists pgcrypto;
revoke create on schema public from public, anon, authenticated;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null check (char_length(alias) between 2 and 40),
  public_ranking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('learner','editor','admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id,role)
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.roles where user_id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_editor() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.roles where user_id = auth.uid() and role in ('admin','editor'));
$$;
revoke all on function public.is_admin() from public,anon;
revoke all on function public.is_editor() from public,anon;
grant execute on function public.is_admin(),public.is_editor() to anon,authenticated;
create or replace function private.create_profile() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
 insert into public.profiles(id,alias) values (new.id, case when char_length(trim(coalesce(new.raw_user_meta_data->>'alias',''))) between 2 and 40 then trim(new.raw_user_meta_data->>'alias') else 'Участник' end);
 insert into public.roles(user_id,role) values(new.id,'learner');
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure private.create_profile();

create table public.courses (
 id text primary key, title text not null check(char_length(title) between 2 and 160), description text not null default '',
 published boolean not null default false, created_at timestamptz not null default now()
);
create table public.modules (
 id text primary key, course_id text not null references public.courses(id), title text not null, position integer not null check(position >= 0),
 unique(course_id,position)
);
create table public.lessons (
 id text primary key, module_id text not null references public.modules(id), title text not null, content jsonb not null check(jsonb_typeof(content)='object'),
 position integer not null check(position>=0), published boolean not null default false, version integer not null default 1 check(version>0), unique(module_id,position)
);
create table public.cases (
 id text primary key, course_id text not null references public.courses(id), title text not null, description text not null,
 chapter integer not null check(chapter>0), required boolean not null default true, final_case boolean not null default false,
 published boolean not null default false, archived boolean not null default false, created_at timestamptz not null default now()
);
create table public.case_variants (
 id uuid primary key default gen_random_uuid(), case_id text not null references public.cases(id), version integer not null check(version>0),
 variant_index integer not null default 0 check(variant_index>=0), scenario jsonb not null check(jsonb_typeof(scenario)='object'),
 published boolean not null default false, created_at timestamptz not null default now(), unique(case_id,version,variant_index)
);
-- Do not expose answer keys through the REST schema. UI demo rubrics are educational only.
create table private.case_rubrics (
 variant_id uuid primary key references public.case_variants(id), diagnosis text not null,
 partial_diagnosis text, partial_points integer not null default 0 check(partial_points between 0 and 25),
 hypothesis integer not null, primary_metric integer not null, guardrail integer not null, interpretation integer not null,
 decision integer not null check(decision between 0 and 2), reasons integer[] not null check(cardinality(reasons) between 1 and 2)
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), variant_id uuid not null references public.case_variants(id),
 status text not null default 'in_progress' check(status in ('in_progress','completed')),
 started_at timestamptz not null default now(), completed_at timestamptz, updated_at timestamptz not null default now(),
 hints integer[] not null default '{}', score numeric(5,2) check(score between 0 and 100), criteria jsonb,
 check((status='completed' and completed_at is not null and score is not null) or (status='in_progress' and completed_at is null and score is null))
);
create table public.answers (
 attempt_id uuid not null references public.attempts(id), stage integer not null check(stage between 0 and 3),
 answer jsonb not null check(jsonb_typeof(answer)='object'), submitted_at timestamptz not null default now(), primary key(attempt_id,stage)
);
create table public.skill_scores (
 attempt_id uuid not null references public.attempts(id), skill text not null check(skill in ('diagnosis','hypothesis','metrics','interpretation','decision')),
 points numeric not null check(points>=0), maximum numeric not null check(maximum>0 and points<=maximum), primary key(attempt_id,skill)
);
create table public.achievements (
 user_id uuid not null references public.profiles(id), achievement_id text not null, awarded_at timestamptz not null default now(),
 primary key(user_id,achievement_id)
);
create table public.certificates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), course_id text not null references public.courses(id),
 alias text not null, average_score numeric not null check(average_score between 70 and 100), issued_at timestamptz not null default now(),
 public_verification boolean not null default false, unique(user_id,course_id)
);
create table public.analytics_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), session_id uuid not null,
 schema_version integer not null default 1 check(schema_version=1), occurred_at timestamptz not null default now(),
 event_type text not null check(event_type in ('page_view','session_started','signup_started','signup_completed','login_completed','course_viewed','lesson_started','lesson_completed','case_started','case_completed','hint_used','answer_submitted','experiment_viewed','certificate_issued','payment_clicked','payment_demo_failed')),
 params jsonb not null default '{}' check(jsonb_typeof(params)='object' and octet_length(params::text)<=2048),
 check (not (params ?| array['password','email','note','token','card','name','message','text']))
);
create table public.content_versions (
 id uuid primary key default gen_random_uuid(), entity_type text not null check(entity_type in ('lesson','case')), entity_id text not null,
 version integer not null check(version>0), content jsonb not null check(jsonb_typeof(content)='object'),
 status text not null default 'draft' check(status in ('draft','published','archived')), created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), unique(entity_type,entity_id,version)
);
create table public.admin_audit_log (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null,
 entity_type text not null, entity_id text not null, occurred_at timestamptz not null default now(), details jsonb not null default '{}'
);
create table public.guest_progress (
 user_id uuid primary key references public.profiles(id), snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 updated_at timestamptz not null default now(), verified boolean not null default false check(verified=false)
);
create index attempts_user_variant on public.attempts(user_id,variant_id,completed_at desc);
create index variants_case_version on public.case_variants(case_id,version desc);
create index analytics_time_type on public.analytics_events(occurred_at,event_type);
create index analytics_session_time on public.analytics_events(session_id,occurred_at);
create index analytics_user_time on public.analytics_events(user_id,occurred_at);
create index certificates_user on public.certificates(user_id);
create index audit_time on public.admin_audit_log(occurred_at desc);
create index cases_course_published on public.cases(course_id,published,archived);

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.cases enable row level security;
alter table public.case_variants enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.skill_scores enable row level security;
alter table public.achievements enable row level security;
alter table public.certificates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.content_versions enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.guest_progress enable row level security;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy role_read on public.roles for select to authenticated using(user_id=auth.uid() or public.is_admin());
-- No role insert/update/delete policy. Only a trusted SQL administrator can grant roles.
create policy courses_read on public.courses for select to anon,authenticated using(published or (auth.uid() is not null and public.is_editor()));
create policy modules_read on public.modules for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id and c.published) or (auth.uid() is not null and public.is_editor()));
create policy lessons_read on public.lessons for select to anon,authenticated using(published or (auth.uid() is not null and public.is_editor()));
create policy cases_read on public.cases for select to anon,authenticated using((published and not archived) or (auth.uid() is not null and public.is_editor()));
create policy variants_read on public.case_variants for select to anon,authenticated using((published and exists(select 1 from public.cases c where c.id=case_id and c.published and not c.archived)) or (auth.uid() is not null and public.is_editor()));
create policy own_attempts on public.attempts for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy own_answers on public.answers for select to authenticated using(exists(select 1 from public.attempts a where a.id=attempt_id and (a.user_id=auth.uid() or public.is_admin())));
create policy own_skills on public.skill_scores for select to authenticated using(exists(select 1 from public.attempts a where a.id=attempt_id and (a.user_id=auth.uid() or public.is_admin())));
create policy own_achievements on public.achievements for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy own_certificates on public.certificates for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy events_read on public.analytics_events for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy content_read on public.content_versions for select to authenticated using(public.is_editor());
create policy audit_read on public.admin_audit_log for select to authenticated using(public.is_admin());
create policy guest_progress_read on public.guest_progress for select to authenticated using(user_id=auth.uid());

-- Explicit column grants prevent id/created_at changes even though a profile update policy exists.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.courses,public.modules,public.lessons,public.cases,public.case_variants to anon,authenticated;
grant select on public.profiles,public.roles,public.attempts,public.answers,public.skill_scores,public.achievements,public.certificates,public.analytics_events,public.content_versions,public.admin_audit_log,public.guest_progress to authenticated;
grant update(alias,public_ranking) on public.profiles to authenticated;

create or replace function public.start_attempt(p_variant_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.case_variants v join public.cases c on c.id=v.case_id where v.id=p_variant_id and v.published and c.published and not c.archived) then raise exception 'Published variant not found'; end if;
 if not exists(select 1 from private.case_rubrics where variant_id=p_variant_id) then raise exception 'Server rubric not published'; end if;
 insert into public.attempts(user_id,variant_id) values(auth.uid(),p_variant_id) returning id into result;
 return result;
end; $$;
create or replace function public.record_hint(p_attempt_id uuid,p_stage integer) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare result integer;
begin
 if p_stage not between 0 and 3 then raise exception 'Invalid stage'; end if;
 update public.attempts set hints=case when p_stage=any(hints) then hints else array_append(hints,p_stage) end,updated_at=now()
 where id=p_attempt_id and user_id=auth.uid() and status='in_progress' returning cardinality(hints)*2 into result;
 if not found then raise exception 'Attempt unavailable'; end if;
 return result;
end; $$;
create or replace function public.submit_attempt(p_attempt_id uuid,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.attempts; r private.case_rubrics; diagnosis_points numeric; hypothesis_points numeric; metric_points numeric; interpretation_points numeric; decision_points numeric; reason_points numeric; total numeric; selected_reasons integer[]; matched integer; v_criteria jsonb;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found'; end if;
 if a.status='completed' then return jsonb_build_object('score',a.score,'criteria',a.criteria); end if;
 if jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>8192 then raise exception 'Invalid answers'; end if;
 select * into r from private.case_rubrics where variant_id=a.variant_id;
 if not found then raise exception 'Rubric unavailable'; end if;
 select array_agg(distinct value::integer) into selected_reasons from jsonb_array_elements_text(coalesce(p_answers->'reasons','[]'::jsonb));
 if cardinality(selected_reasons) not between 1 and 2 or selected_reasons is null or exists(select 1 from unnest(selected_reasons) x where x<0 or x>5) then raise exception 'Select one or two valid reasons'; end if;
 diagnosis_points:=case when p_answers->>'node'=r.diagnosis then 25 when p_answers->>'node'=r.partial_diagnosis then r.partial_points else 0 end;
 hypothesis_points:=case when (p_answers->>'hypothesis')::integer=r.hypothesis then 20 else 0 end;
 metric_points:=(case when (p_answers->>'primary')::integer=r.primary_metric then 10 else 0 end)+(case when (p_answers->>'guardrail')::integer=r.guardrail then 5 else 0 end);
 interpretation_points:=case when (p_answers->>'interpretation')::integer=r.interpretation then 20 else 0 end;
 decision_points:=case when (p_answers->>'decision')::integer=r.decision then 12 else 0 end;
 select count(*) into matched from unnest(selected_reasons) x where x=any(r.reasons);
 reason_points:=greatest(0,8.0*(matched-(cardinality(selected_reasons)-matched))/cardinality(r.reasons));
 reason_points:=least(8,reason_points);
 total:=greatest(0,diagnosis_points+hypothesis_points+metric_points+interpretation_points+decision_points+reason_points-cardinality(a.hints)*2);
 v_criteria:=jsonb_build_array(jsonb_build_object('name','Диагностика','points',diagnosis_points,'max',25),jsonb_build_object('name','Гипотеза','points',hypothesis_points,'max',20),jsonb_build_object('name','Метрики эксперимента','points',metric_points,'max',15),jsonb_build_object('name','Интерпретация','points',interpretation_points,'max',20),jsonb_build_object('name','Решение','points',decision_points+reason_points,'max',20));
 update public.attempts set status='completed',completed_at=now(),updated_at=now(),score=total,criteria=v_criteria where id=a.id;
 insert into public.answers(attempt_id,stage,answer) values(a.id,0,jsonb_build_object('node',p_answers->'node')),(a.id,1,p_answers-'node'-'interpretation'-'decision'-'reasons'-'note'),(a.id,2,jsonb_build_object('interpretation',p_answers->'interpretation')),(a.id,3,jsonb_build_object('decision',p_answers->'decision','reasons',p_answers->'reasons','note',left(coalesce(p_answers->>'note',''),2000)));
 insert into public.skill_scores values(a.id,'diagnosis',diagnosis_points,25),(a.id,'hypothesis',hypothesis_points,20),(a.id,'metrics',metric_points,15),(a.id,'interpretation',interpretation_points,20),(a.id,'decision',decision_points+reason_points,20);
 insert into public.achievements(user_id,achievement_id) values(auth.uid(),'first_mission') on conflict do nothing;
 if cardinality(a.hints)=0 and total>=70 then insert into public.achievements(user_id,achievement_id) values(auth.uid(),'without_hints') on conflict do nothing; end if;
 return jsonb_build_object('score',total,'criteria',v_criteria,'hint_penalty',cardinality(a.hints)*2);
end; $$;

create or replace function public.issue_certificate(p_course_id text) returns public.certificates language plpgsql security definer set search_path=public,pg_temp as $$
declare average numeric; completed integer; needed integer; has_final boolean; result public.certificates;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select count(*) into needed from public.cases where course_id=p_course_id and required and published and not archived;
 if needed=0 then raise exception 'Course has no published required cases'; end if;
 with best as (select c.id,c.final_case,max(a.score) as score from public.cases c join public.case_variants v on v.case_id=c.id join public.attempts a on a.variant_id=v.id and a.user_id=auth.uid() and a.status='completed' where c.course_id=p_course_id and c.required and c.published and not c.archived group by c.id,c.final_case)
 select count(*),avg(score),coalesce(bool_or(final_case),false) into completed,average,has_final from best;
 if completed<>needed or average<70 or not has_final then raise exception 'Complete every required mission including final and earn average 70+'; end if;
 insert into public.certificates(user_id,course_id,alias,average_score) select auth.uid(),p_course_id,alias,average from public.profiles where id=auth.uid() on conflict(user_id,course_id) do nothing;
 select * into result from public.certificates where user_id=auth.uid() and course_id=p_course_id;
 return result;
end; $$;

-- Imported browser results are private, versioned and explicitly UNVERIFIED.
-- They cannot produce server scores, public ranks or certificates.
create or replace function public.import_guest_progress(p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare previous jsonb; merged jsonb; new_attempts jsonb; new_lessons jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_snapshot)<>'object' or p_snapshot->>'version'<>'2' or jsonb_typeof(p_snapshot->'attempts')<>'array' or octet_length(p_snapshot::text)>524288 then raise exception 'Invalid progress snapshot'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select snapshot into previous from public.guest_progress where user_id=auth.uid();
 previous:=coalesce(previous,'{"attempts":[],"completedLessons":[]}'::jsonb);
 select coalesce(jsonb_agg(entry),'[]'::jsonb) into new_attempts from (
  select distinct on(entry->>'id') entry from jsonb_array_elements(coalesce(previous->'attempts','[]'::jsonb)||p_snapshot->'attempts') entry
  where jsonb_typeof(entry)='object' and entry ? 'id' and entry ? 'updated'
  order by entry->>'id',(entry->>'finished')::boolean desc,entry->>'updated' desc
 ) t;
 select coalesce(jsonb_agg(distinct value),'[]'::jsonb) into new_lessons from jsonb_array_elements(coalesce(previous->'completedLessons','[]'::jsonb)||coalesce(p_snapshot->'completedLessons','[]'::jsonb));
 merged:=p_snapshot||jsonb_build_object('attempts',new_attempts,'completedLessons',new_lessons);
 -- Certificates are not imported: only issue_certificate can create a verified record.
 merged:=jsonb_set(merged,'{certificates}','[]'::jsonb);
 insert into public.guest_progress(user_id,snapshot) values(auth.uid(),merged) on conflict(user_id) do update set snapshot=excluded.snapshot,updated_at=now();
 return jsonb_build_object('imported',true,'updated_at',now());
end; $$;

create or replace function public.record_analytics_event(p_session_id uuid,p_event_type text,p_params jsonb default '{}') returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from jsonb_object_keys(p_params) k where k not in ('page','caseId','lessonId','step','score','hintCount','duration','device','source','courseId')) then raise exception 'Unexpected analytics parameters'; end if;
 if exists(select 1 from jsonb_each(p_params) kv where jsonb_typeof(kv.value) not in ('number','boolean','string') or char_length(kv.value::text)>120) then raise exception 'Invalid analytics value'; end if;
 if (select count(*) from public.analytics_events where user_id=auth.uid() and occurred_at>now()-interval '1 minute')>=120 then raise exception 'Rate limit exceeded'; end if;
 insert into public.analytics_events(user_id,session_id,event_type,params) values(auth.uid(),p_session_id,p_event_type,p_params);
end; $$;

create or replace function public.public_leaderboard(p_weekly boolean default false) returns table(alias text,points numeric,completed bigint,average numeric,achievements bigint) language sql stable security definer set search_path=public,pg_temp as $$
 with best as (select a.user_id,v.case_id,max(a.score) score from public.attempts a join public.case_variants v on v.id=a.variant_id where a.status='completed' and (not p_weekly or a.completed_at>=date_trunc('week',now())) group by a.user_id,v.case_id), ranks as (select b.user_id,sum(b.score) points,count(*) completed,avg(b.score) average from best b group by b.user_id)
 select p.alias,r.points,r.completed,r.average,(select count(*) from public.achievements x where x.user_id=p.id) achievements from ranks r join public.profiles p on p.id=r.user_id where p.public_ranking order by r.points desc,r.completed desc,r.average desc,p.id limit 100;
$$;

create or replace function public.save_content_draft(p_entity_type text,p_entity_id text,p_content jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare next_version integer; result uuid;
begin
 if not public.is_editor() then raise exception 'Editor role required'; end if;
 if p_entity_type not in ('case','lesson') or jsonb_typeof(p_content)<>'object' or char_length(coalesce(p_content->>'title','')) not between 2 and 160 or octet_length(p_content::text)>100000 then raise exception 'Invalid content'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_entity_type||p_entity_id,0));
 select coalesce(max(version),0)+1 into next_version from public.content_versions where entity_type=p_entity_type and entity_id=p_entity_id;
 insert into public.content_versions(entity_type,entity_id,version,content,created_by) values(p_entity_type,p_entity_id,next_version,p_content,auth.uid()) returning id into result;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'draft_created',p_entity_type,p_entity_id,jsonb_build_object('version',next_version));
 return result;
end; $$;
-- Publication is intentionally a separate reviewed SQL operation. No arbitrary client draft
-- becomes a graded scenario without validated mathematics and a private rubric.

revoke all on function public.start_attempt(uuid),public.record_hint(uuid,integer),public.submit_attempt(uuid,jsonb),public.issue_certificate(text),public.import_guest_progress(jsonb),public.record_analytics_event(uuid,text,jsonb),public.save_content_draft(text,text,jsonb),public.public_leaderboard(boolean) from public,anon;
grant execute on function public.start_attempt(uuid),public.record_hint(uuid,integer),public.submit_attempt(uuid,jsonb),public.issue_certificate(text),public.import_guest_progress(jsonb),public.record_analytics_event(uuid,text,jsonb),public.save_content_draft(text,text,jsonb),public.public_leaderboard(boolean) to authenticated;
insert into public.courses(id,title,description,published) values('product-lab','Продуктовые решения на основе данных','Учебный курс Product Lab 2.0',false);
commit;
