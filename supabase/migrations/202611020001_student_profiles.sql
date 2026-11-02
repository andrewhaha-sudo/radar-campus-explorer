-- Run in a dedicated Supabase project. No RADAR tables or accounts are modified.
begin;

create table public.explorer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar text not null default 'boy' check (avatar in ('boy','girl')),
  name text not null default '' check (char_length(name) <= 80),
  grade text not null default '' check (grade in ('','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','College')),
  section text not null default '' check (char_length(section) <= 80),
  teacher text not null default '' check (char_length(teacher) <= 80),
  sex text not null default '' check (sex in ('','Male','Female')),
  sharing boolean not null default false,
  visibility jsonb not null default '{"name":false,"grade":false,"section":false,"teacher":false,"sex":false,"photo":false}',
  photo_available boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint explorer_visibility_valid check (
    jsonb_typeof(visibility) = 'object'
    and visibility ?& array['name','grade','section','teacher','sex','photo']
    and visibility - array['name','grade','section','teacher','sex','photo'] = '{}'::jsonb
    and jsonb_typeof(visibility->'name') = 'boolean'
    and jsonb_typeof(visibility->'grade') = 'boolean'
    and jsonb_typeof(visibility->'section') = 'boolean'
    and jsonb_typeof(visibility->'teacher') = 'boolean'
    and jsonb_typeof(visibility->'sex') = 'boolean'
    and jsonb_typeof(visibility->'photo') = 'boolean'
  )
);
create table public.explorer_presence (
  user_id uuid primary key references public.explorer_profiles(user_id) on delete cascade,
  scene text not null check (scene in ('campus','a1','b1','b2','c1','c2','lab1','d1','e1','e2','six1','six2')),
  x double precision not null check (x between 0 and 2048),
  y double precision not null check (y between 0 and 1254),
  direction text not null check (direction in ('up','down','left','right')),
  moving boolean not null default false,
  updated_at timestamptz not null default now()
);

create function public.explorer_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger explorer_profile_timestamp before insert or update on public.explorer_profiles
for each row execute function public.explorer_touch_updated_at();
create trigger explorer_presence_timestamp before insert or update on public.explorer_presence
for each row execute function public.explorer_touch_updated_at();

alter table public.explorer_profiles enable row level security;
alter table public.explorer_presence enable row level security;
revoke all on public.explorer_profiles, public.explorer_presence from public, anon, authenticated;
grant select, insert, update on public.explorer_profiles to authenticated;
grant select, insert, update, delete on public.explorer_presence to authenticated;
create policy "Owner reads profile" on public.explorer_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner creates profile" on public.explorer_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner edits profile" on public.explorer_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner reads presence" on public.explorer_presence for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner creates presence" on public.explorer_presence for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner updates presence" on public.explorer_presence for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner removes presence" on public.explorer_presence for delete to authenticated using (user_id = (select auth.uid()));

-- The only cross-account profile read returns permitted fields, never the raw row.
create function public.get_explorer_student(target_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'avatar', p.avatar,
    'name', case when (p.visibility->>'name')::boolean then p.name else null end,
    'grade', case when (p.visibility->>'grade')::boolean then p.grade else null end,
    'section', case when (p.visibility->>'section')::boolean then p.section else null end,
    'teacher', case when (p.visibility->>'teacher')::boolean then p.teacher else null end,
    'sex', case when (p.visibility->>'sex')::boolean then p.sex else null end,
    'photo_available', p.photo_available and (p.visibility->>'photo')::boolean,
    'updated_at', p.updated_at
  ) from public.explorer_profiles p
  where p.user_id = target_id and p.sharing and auth.uid() is not null;
$$;
create function public.list_explorer_students()
returns table(user_id uuid, avatar text, name text, scene text, x double precision, y double precision, direction text, moving boolean)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.avatar,
    case when (p.visibility->>'name')::boolean then p.name else null end,
    s.scene, s.x, s.y, s.direction, s.moving
  from public.explorer_profiles p join public.explorer_presence s using (user_id)
  where auth.uid() is not null and p.user_id <> auth.uid() and p.sharing
    and s.updated_at > now() - interval '30 seconds'
  order by s.updated_at desc limit 100;
$$;
create function public.can_view_explorer_photo(owner_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    owner_id = auth.uid()::text or exists (
      select 1 from public.explorer_profiles p
      where p.user_id::text = owner_id and p.sharing and p.photo_available
        and (p.visibility->>'photo')::boolean
    )
  );
$$;
revoke all on function public.explorer_touch_updated_at() from public, anon, authenticated;
revoke all on function public.get_explorer_student(uuid), public.list_explorer_students(), public.can_view_explorer_photo(text) from public, anon;
grant execute on function public.get_explorer_student(uuid), public.list_explorer_students(), public.can_view_explorer_photo(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('explorer-student-photos','explorer-student-photos',false,2097152,array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];

-- One fixed object per account: replacement overwrites it; removal deletes it.
-- No public or signed URLs are created by the application.
create policy "Read permitted explorer portrait" on storage.objects for select to authenticated using (
  bucket_id = 'explorer-student-photos'
  and name ~ '^[0-9a-f-]{36}/portrait[.]webp$'
  and public.can_view_explorer_photo(split_part(name, '/', 1))
);
create policy "Upload own explorer portrait" on storage.objects for insert to authenticated with check (
  bucket_id = 'explorer-student-photos' and name = auth.uid()::text || '/portrait.webp'
);
create policy "Replace own explorer portrait" on storage.objects for update to authenticated using (
  bucket_id = 'explorer-student-photos' and name = auth.uid()::text || '/portrait.webp'
) with check (
  bucket_id = 'explorer-student-photos' and name = auth.uid()::text || '/portrait.webp'
);
create policy "Remove own explorer portrait" on storage.objects for delete to authenticated using (
  bucket_id = 'explorer-student-photos' and name = auth.uid()::text || '/portrait.webp'
);
commit;
