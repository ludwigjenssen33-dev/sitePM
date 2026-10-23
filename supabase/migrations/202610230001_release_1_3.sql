-- Apply after 202610220001_platform.sql. No real credentials belong here.
begin;
alter table public.analytics_events add column if not exists actor_id uuid;
alter table public.analytics_events add column if not exists device text not null default 'unknown' check(device in ('mobile','desktop','unknown'));
alter table public.analytics_events add column if not exists traffic_source text not null default 'unknown' check(traffic_source in ('direct','search','social','referral','unknown'));
alter table public.analytics_events add column if not exists received_at timestamptz not null default now();
create index if not exists analytics_actor_time on public.analytics_events(actor_id,occurred_at);
create or replace function public.collect_product_event(p_event_id uuid,p_session_id uuid,p_actor_id uuid,p_event_type text,p_occurred_at timestamptz,p_device text,p_source text,p_params jsonb default '{}') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;v jsonb;
begin
 if p_event_id is null or p_session_id is null or p_actor_id is null then raise exception 'Missing identity';end if;
 if p_event_type not in ('page_view','session_started','signup_started','signup_completed','login_completed','course_viewed','lesson_started','lesson_completed','case_started','case_completed','hint_used','answer_submitted','experiment_viewed','certificate_issued','payment_clicked','payment_demo_failed') then raise exception 'Invalid event';end if;
 if p_device not in ('mobile','desktop','unknown') or p_source not in ('direct','search','social','referral','unknown') then raise exception 'Invalid segment';end if;
 if p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' or p_occurred_at<now()-interval '30 days' then raise exception 'Invalid time';end if;
 if p_params is null or jsonb_typeof(p_params)<>'object' or octet_length(p_params::text)>2048 then raise exception 'Invalid params';end if;
 for k,v in select * from jsonb_each(p_params) loop
  if k in ('caseId','lessonId','courseId','attemptId','route') then
   if jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^[A-Za-z0-9_/-]{1,80}$' then raise exception 'Invalid identifier';end if;
  elsif k in ('step','score','hints','durationMs','variant','reasonCount') then
   if jsonb_typeof(v)<>'number' then raise exception 'Invalid number';end if;
   if (v#>>'{}')::numeric<0 or (v#>>'{}')::numeric>case k when 'score' then 100 when 'step' then 10 when 'hints' then 20 when 'durationMs' then 86400000 when 'variant' then 100 else 6 end then raise exception 'Out of range';end if;
  else raise exception 'Unapproved parameter';end if;
 end loop;
 if exists(select 1 from public.analytics_events where id=p_event_id) then return;end if;
 if (select count(*) from public.analytics_events where actor_id=p_actor_id and received_at>now()-interval '1 minute')>=120 then raise exception 'Rate limited';end if;
 insert into public.analytics_events(id,user_id,actor_id,session_id,event_type,occurred_at,device,traffic_source,params)
 values(p_event_id,auth.uid(),p_actor_id,p_session_id,p_event_type,p_occurred_at,p_device,p_source,p_params)
 on conflict(id) do nothing;
end;$$;
revoke all on function public.collect_product_event(uuid,uuid,uuid,text,timestamptz,text,text,jsonb) from public;
grant execute on function public.collect_product_event(uuid,uuid,uuid,text,timestamptz,text,text,jsonb) to anon,authenticated;
-- Stable curriculum order is also enforced by the server grading entry point.
alter table public.cases add column if not exists position integer;
with ordered as (
 select id,row_number() over(partition by course_id order by array_position(array['market','stream','food','ads','interface','price','recommend','quality','final'],id) nulls last,id) as rank
 from public.cases
) update public.cases c set position=o.rank from ordered o where c.id=o.id;
alter table public.cases alter column position set not null;
alter table public.cases add constraint cases_position_positive check(position>=1);
create unique index if not exists cases_course_position on public.cases(course_id,position);
create or replace function public.start_attempt(p_variant_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;current_case text;current_course text;current_position integer;previous_case text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select c.id,c.course_id,c.position into current_case,current_course,current_position from public.case_variants v join public.cases c on c.id=v.case_id where v.id=p_variant_id and v.published and c.published and not c.archived;
 if not found then raise exception 'Published variant not found';end if;
 if not exists(select 1 from private.case_rubrics where variant_id=p_variant_id) then raise exception 'Server rubric not published';end if;
 select id into previous_case from public.cases where course_id=current_course and position<current_position and published and not archived order by position desc limit 1;
 if not public.is_admin() and previous_case is not null
 and not exists(select 1 from public.attempts a join public.case_variants v on v.id=a.variant_id where a.user_id=auth.uid() and v.case_id=previous_case and a.status='completed')
 and not exists(select 1 from public.attempts a join public.case_variants v on v.id=a.variant_id where a.user_id=auth.uid() and v.case_id=current_case)
 then raise exception 'Previous mission required';end if;
 insert into public.attempts(user_id,variant_id) values(auth.uid(),p_variant_id) returning id into result;return result;
end;$$;
revoke all on function public.start_attempt(uuid) from public,anon;
grant execute on function public.start_attempt(uuid) to authenticated;
-- Admin can manage roles only through an audited server-side function.
create or replace function public.admin_set_role(p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator role required';end if;
 if p_role not in ('learner','editor','admin') then raise exception 'Invalid role';end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Unknown user';end if;
 if p_user_id=auth.uid() and p_role<>'admin' then raise exception 'Cannot remove your own administrator access';end if;
 delete from public.roles where user_id=p_user_id and role in ('admin','editor');
 insert into public.roles(user_id,role) values(p_user_id,p_role) on conflict do nothing;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'role_changed','profile',p_user_id::text,jsonb_build_object('role',p_role));
end;$$;
revoke all on function public.admin_set_role(uuid,text) from public,anon;
grant execute on function public.admin_set_role(uuid,text) to authenticated;
commit;
