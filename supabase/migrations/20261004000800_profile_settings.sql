alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists bio text not null default '',
  add column if not exists department text not null default '',
  add column if not exists skills text[] not null default '{}',
  add column if not exists experience_years integer,
  add column if not exists work_preferences jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_experience_years_check;

alter table public.profiles
  add constraint profiles_experience_years_check
  check (experience_years is null or experience_years between 0 and 80);

alter table public.profiles
  drop constraint if exists profiles_work_preferences_object_check;

alter table public.profiles
  add constraint profiles_work_preferences_object_check
  check (jsonb_typeof(work_preferences) = 'object');

grant insert (
  id, full_name, avatar_url, phone, location, job_title, organization, team,
  timezone, preferences, date_of_birth, bio, department, skills,
  experience_years, work_preferences
) on public.profiles to authenticated;

grant update (
  full_name, avatar_url, phone, location, job_title, organization, team,
  timezone, preferences, date_of_birth, bio, department, skills,
  experience_years, work_preferences
) on public.profiles to authenticated;

create or replace function public.get_my_profile_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(p)
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile_settings() from public, anon;
grant execute on function public.get_my_profile_settings() to authenticated;

revoke select on public.profiles from authenticated;
grant select (id, full_name, email, avatar_url, job_title) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_own on storage.objects;
create policy profile_avatars_select_own on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
