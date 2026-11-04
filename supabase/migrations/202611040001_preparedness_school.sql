-- Standalone school services. Run after the student profile migration.
begin;
create table public.explorer_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('teacher','admin')),
 label text not null check(length(label) between 1 and 80)
);
create function public.explorer_is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.explorer_staff where user_id=auth.uid());
$$;
create function public.explorer_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.explorer_staff where user_id=auth.uid() and role='admin');
$$;
revoke all on function public.explorer_is_staff(), public.explorer_is_admin() from public;
grant execute on function public.explorer_is_staff(), public.explorer_is_admin() to authenticated;
alter table public.explorer_staff enable row level security;
revoke all on public.explorer_staff from public,anon,authenticated;
grant select,insert,update,delete on public.explorer_staff to authenticated;
create policy staff_read on public.explorer_staff for select to authenticated using(user_id=auth.uid() or public.explorer_is_admin());
create policy staff_manage on public.explorer_staff for all to authenticated using(public.explorer_is_admin()) with check(public.explorer_is_admin());

create table public.explorer_notices (
 id uuid primary key default gen_random_uuid(), created_by uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(title) between 1 and 120), body text not null check(length(body) between 1 and 2000),
 severity text not null check(severity in ('information','advisory','urgent')),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.explorer_drills (
 id uuid primary key default gen_random_uuid(), created_by uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(title) between 1 and 120), location text not null check(length(location) between 1 and 200),
 scheduled_at timestamptz not null, cancelled boolean not null default false, created_at timestamptz not null default now()
);
create table public.explorer_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('hazard','help')), description text not null check(length(description) between 1 and 2000),
 location text not null check(length(location) between 1 and 200), status text not null default 'submitted' check(status in ('submitted','reviewing','resolved')),
 created_at timestamptz not null default now()
);
create function public.explorer_valid_checklist(items text[]) returns boolean language sql immutable set search_path='' as $$
 select items <@ array['plan','signals','assembly','access','practice','review']::text[] and cardinality(items)=(select count(distinct i) from unnest(items) i);
$$;
create table public.explorer_learning_records (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 80),
 earthquake smallint check(earthquake between 0 and 3), flood smallint check(flood between 0 and 3), fire smallint check(fire between 0 and 3),
 checklist text[] not null default '{}' check(public.explorer_valid_checklist(checklist)),
 points integer generated always as ((coalesce(earthquake,0)+coalesce(flood,0)+coalesce(fire,0))*10+cardinality(checklist)*5) stored,
 updated_at timestamptz not null default now()
);
create trigger learning_timestamp before insert or update on public.explorer_learning_records for each row execute function public.explorer_touch_updated_at();
create table public.explorer_drill_participants (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 drill_id uuid not null references public.explorer_drills(id) on delete cascade,
 status text not null check(status in ('planned','attended')), primary key(user_id,drill_id)
);
create table public.explorer_community (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('offer','request')), body text not null check(length(body) between 1 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','closed')),
 created_at timestamptz not null default now()
);
create table public.explorer_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
 recipient text not null check(length(recipient) between 1 and 120),
 wallet text not null check(wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.explorer_donations (
 signature text primary key check(signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.explorer_campaigns(id),
 lamports bigint not null check(lamports>0), confirmed_at timestamptz not null, created_at timestamptz not null default now()
);
create table public.explorer_school_settings (
 id boolean primary key default true check(id), contact_name text not null check(length(contact_name) between 1 and 120),
 contact_phone text not null check(contact_phone ~ '^\+?[0-9]{7,15}$')
);

alter table public.explorer_notices enable row level security;
alter table public.explorer_drills enable row level security;
alter table public.explorer_reports enable row level security;
alter table public.explorer_learning_records enable row level security;
alter table public.explorer_drill_participants enable row level security;
alter table public.explorer_community enable row level security;
alter table public.explorer_campaigns enable row level security;
alter table public.explorer_donations enable row level security;
alter table public.explorer_school_settings enable row level security;
revoke all on public.explorer_notices,public.explorer_drills,public.explorer_reports,public.explorer_learning_records,public.explorer_drill_participants,public.explorer_community,public.explorer_campaigns,public.explorer_donations,public.explorer_school_settings from public,anon,authenticated;
grant select on public.explorer_notices, public.explorer_school_settings to anon,authenticated;
grant select on public.explorer_drills,public.explorer_reports,public.explorer_learning_records,public.explorer_drill_participants,public.explorer_community,public.explorer_campaigns,public.explorer_donations to authenticated;
grant insert(title,body,severity) on public.explorer_notices to authenticated;
grant update(active) on public.explorer_notices to authenticated;
grant insert(title,location,scheduled_at) on public.explorer_drills to authenticated;
grant update(cancelled) on public.explorer_drills to authenticated;
grant insert(kind,description,location) on public.explorer_reports to authenticated;
grant update(status) on public.explorer_reports to authenticated;
grant insert(user_id,display_name,earthquake,flood,fire,checklist),update(user_id,display_name,earthquake,flood,fire,checklist),delete on public.explorer_learning_records to authenticated;
grant insert(user_id,drill_id,status),update(user_id,drill_id,status),delete on public.explorer_drill_participants to authenticated;
grant insert(kind,body),update(status) on public.explorer_community to authenticated;
grant insert(title,recipient,wallet),update(active) on public.explorer_campaigns to authenticated;
grant insert,update on public.explorer_school_settings to authenticated;

create policy notice_read on public.explorer_notices for select to anon,authenticated using(active);
create policy notice_insert on public.explorer_notices for insert to authenticated with check(public.explorer_is_staff() and created_by=auth.uid());
create policy notice_staff_read on public.explorer_notices for select to authenticated using(public.explorer_is_staff());
create policy notice_update on public.explorer_notices for update to authenticated using(public.explorer_is_staff()) with check(public.explorer_is_staff());
create policy drill_read on public.explorer_drills for select to authenticated using(true);
create policy drill_insert on public.explorer_drills for insert to authenticated with check(public.explorer_is_staff() and created_by=auth.uid());
create policy drill_update on public.explorer_drills for update to authenticated using(public.explorer_is_staff()) with check(public.explorer_is_staff());
create policy report_read on public.explorer_reports for select to authenticated using(user_id=auth.uid() or public.explorer_is_staff());
create policy report_insert on public.explorer_reports for insert to authenticated with check(user_id=auth.uid() and status='submitted');
create policy report_update on public.explorer_reports for update to authenticated using(public.explorer_is_staff()) with check(public.explorer_is_staff());
create policy learning_read on public.explorer_learning_records for select to authenticated using(user_id=auth.uid() or public.explorer_is_staff());
create policy learning_insert on public.explorer_learning_records for insert to authenticated with check(user_id=auth.uid());
create policy learning_update on public.explorer_learning_records for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy learning_delete on public.explorer_learning_records for delete to authenticated using(user_id=auth.uid());
create policy participant_read on public.explorer_drill_participants for select to authenticated using(user_id=auth.uid() or public.explorer_is_staff());
create policy participant_insert on public.explorer_drill_participants for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.explorer_drills d where d.id=drill_id and not d.cancelled and (status='planned' or d.scheduled_at<=now())));
create policy participant_update on public.explorer_drill_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.explorer_drills d where d.id=drill_id and not d.cancelled and (status='planned' or d.scheduled_at<=now())));
create policy participant_delete on public.explorer_drill_participants for delete to authenticated using(user_id=auth.uid());
create policy community_read on public.explorer_community for select to authenticated using(status='approved' or user_id=auth.uid() or public.explorer_is_staff());
create policy community_insert on public.explorer_community for insert to authenticated with check(user_id=auth.uid() and status='pending');
create policy community_update on public.explorer_community for update to authenticated using(public.explorer_is_staff()) with check(public.explorer_is_staff());
create policy campaign_read on public.explorer_campaigns for select to authenticated using(active or public.explorer_is_admin());
create policy campaign_insert on public.explorer_campaigns for insert to authenticated with check(public.explorer_is_admin());
create policy campaign_update on public.explorer_campaigns for update to authenticated using(public.explorer_is_admin()) with check(public.explorer_is_admin());
create policy donation_read on public.explorer_donations for select to authenticated using(user_id=auth.uid() or public.explorer_is_admin());
create policy settings_read on public.explorer_school_settings for select to anon,authenticated using(true);
create policy settings_manage on public.explorer_school_settings for all to authenticated using(public.explorer_is_admin()) with check(public.explorer_is_admin());

create table public.explorer_geo_zones (
 id uuid primary key default gen_random_uuid(), label text not null check(length(label) between 1 and 120),
 kind text not null check(kind in ('hazard','assembly')), lat double precision not null check(lat between -85 and 85),
 lon double precision not null check(lon between -180 and 180), radius integer not null check(radius between 10 and 5000),
 expires_at timestamptz not null, created_at timestamptz not null default now(), check(expires_at>created_at)
);
alter table public.explorer_geo_zones enable row level security;
revoke all on public.explorer_geo_zones from public,anon,authenticated;
grant select,insert(label,kind,lat,lon,radius,expires_at),delete on public.explorer_geo_zones to authenticated;
create policy zone_read on public.explorer_geo_zones for select to authenticated using(expires_at>now() or public.explorer_is_staff());
create policy zone_insert on public.explorer_geo_zones for insert to authenticated with check(public.explorer_is_staff());
create policy zone_delete on public.explorer_geo_zones for delete to authenticated using(public.explorer_is_staff());

create table public.explorer_audit (
 id bigint generated always as identity primary key, actor uuid, entity text not null, operation text not null,
 record_id text, created_at timestamptz not null default now()
);
alter table public.explorer_audit enable row level security;
revoke all on public.explorer_audit from public,anon,authenticated;
grant select on public.explorer_audit to authenticated;
create policy audit_read on public.explorer_audit for select to authenticated using(public.explorer_is_admin());
create function public.explorer_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare record jsonb;
begin
 record := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.explorer_audit(actor,entity,operation,record_id) values(auth.uid(),tg_table_name,tg_op,coalesce(record->>'id',record->>'signature',record->>'user_id'));
 return coalesce(new,old);
end;
$$;
revoke all on function public.explorer_audit_change() from public,anon,authenticated;
create trigger audit_staff after insert or update or delete on public.explorer_staff for each row execute function public.explorer_audit_change();
create trigger audit_notices after insert or update on public.explorer_notices for each row execute function public.explorer_audit_change();
create trigger audit_drills after insert or update on public.explorer_drills for each row execute function public.explorer_audit_change();
create trigger audit_reports after insert or update on public.explorer_reports for each row execute function public.explorer_audit_change();
create trigger audit_community after insert or update on public.explorer_community for each row execute function public.explorer_audit_change();
create trigger audit_campaigns after insert or update on public.explorer_campaigns for each row execute function public.explorer_audit_change();
create trigger audit_settings after insert or update on public.explorer_school_settings for each row execute function public.explorer_audit_change();
create trigger audit_donations after insert on public.explorer_donations for each row execute function public.explorer_audit_change();
create trigger audit_zones after insert or delete on public.explorer_geo_zones for each row execute function public.explorer_audit_change();
create function public.explorer_admin_roster() returns table(user_id uuid,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select u.id,u.created_at from auth.users u join public.explorer_profiles p on p.user_id=u.id
 where public.explorer_is_admin() order by u.created_at desc limit 100;
$$;
revoke all on function public.explorer_admin_roster() from public,anon;
grant execute on function public.explorer_admin_roster() to authenticated;
-- Supabase service role is used only by the donation verification Edge Function.
grant select on public.explorer_campaigns to service_role;
grant select,insert on public.explorer_donations to service_role;
commit;
