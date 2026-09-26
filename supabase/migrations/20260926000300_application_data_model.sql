do $$
begin
  create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.project_member_role as enum ('owner', 'admin', 'member', 'viewer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.task_status as enum ('todo', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.task_priority as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.meeting_status as enum ('upcoming', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.calendar_event_provider as enum ('planwise', 'google');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.ai_message_role as enum ('user', 'assistant', 'system');
exception
  when duplicate_object then null;
end
$$;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists job_title text,
  add column if not exists organization text,
  add column if not exists team text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_preferences_object_check;

alter table public.profiles
  add constraint profiles_preferences_object_check
  check (jsonb_typeof(preferences) = 'object');

do $$
begin
  if to_regclass('public.calendar_connections') is null
     and to_regclass('public.google_calendar_connections') is not null then
    alter table public.google_calendar_connections rename to calendar_connections;
  end if;
end
$$;

create table if not exists public.calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  encrypted_tokens text not null,
  calendar_id text not null default 'primary',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections
  add column if not exists provider text not null default 'google';

alter table public.calendar_connections
  drop constraint if exists calendar_connections_provider_check;

alter table public.calendar_connections
  add constraint calendar_connections_provider_check check (provider = 'google');

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  status public.project_status not null default 'planning',
  start_date date,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_member_role not null default 'member',
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  category text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  meeting_link text,
  reminder_minutes integer not null default 10 check (reminder_minutes between 0 and 10080),
  meeting_type text not null default 'team_meeting',
  status public.meeting_status not null default 'upcoming',
  notes text not null default '',
  action_items jsonb not null default '[]'::jsonb check (jsonb_typeof(action_items) = 'array'),
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  meeting_id uuid unique references public.meetings (id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'UTC',
  location text,
  meeting_link text,
  category text not null default 'meeting',
  color text not null default 'blue' check (color in ('blue', 'purple', 'green', 'amber', 'rose')),
  reminder_minutes integer not null default 10 check (reminder_minutes between 0 and 10080),
  provider public.calendar_event_provider not null default 'planwise',
  external_id text,
  attendees jsonb not null default '[]'::jsonb check (jsonb_typeof(attendees) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_bucket text not null default 'project-files',
  storage_path text not null,
  name text not null check (length(btrim(name)) > 0),
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('task_assigned', 'project_updated', 'meeting_reminder', 'deadline', 'team_activity', 'ai_insight', 'system')),
  title text not null check (length(btrim(title)) > 0),
  body text not null default '',
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.project_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  target_date date,
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'on_track' check (status in ('on_track', 'in_progress', 'complete')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_status_idx on public.projects (owner_id, status);
create index if not exists project_members_user_project_idx on public.project_members (user_id, project_id);
create index if not exists tasks_project_due_idx on public.tasks (project_id, due_at);
create index if not exists tasks_creator_due_idx on public.tasks (created_by, due_at);
create index if not exists task_assignees_user_task_idx on public.task_assignees (user_id, task_id);
create index if not exists meetings_project_start_idx on public.meetings (project_id, starts_at);
create index if not exists meetings_creator_start_idx on public.meetings (created_by, starts_at);
create index if not exists meeting_participants_user_meeting_idx on public.meeting_participants (user_id, meeting_id);
create index if not exists calendar_events_user_start_idx on public.calendar_events (user_id, starts_at);
create index if not exists calendar_events_project_start_idx on public.calendar_events (project_id, starts_at);
create unique index if not exists calendar_events_provider_external_idx
  on public.calendar_events (user_id, provider, external_id)
  where external_id is not null;
create index if not exists files_project_created_idx on public.files (project_id, created_at desc);
create index if not exists files_uploader_created_idx on public.files (uploaded_by, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_user_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index if not exists activity_logs_project_created_idx on public.activity_logs (project_id, created_at desc);
create index if not exists activity_logs_actor_created_idx on public.activity_logs (actor_id, created_at desc);
create index if not exists ai_conversations_user_updated_idx on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_conversations_project_idx on public.ai_conversations (project_id);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages (conversation_id, created_at);
create index if not exists project_goals_project_target_idx on public.project_goals (project_id, target_date);
create index if not exists calendar_connections_last_synced_idx on public.calendar_connections (last_synced_at);
create index if not exists google_calendar_oauth_states_user_idx on public.google_calendar_oauth_states (user_id);
create index if not exists google_calendar_oauth_states_expiry_idx on public.google_calendar_oauth_states (expires_at);

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_project_id is not null
    and (
      exists (
        select 1
        from public.projects p
        where p.id = p_project_id and p.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.project_members pm
        where pm.project_id = p_project_id and pm.user_id = auth.uid()
      )
    );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_project_id is not null
    and (
      exists (
        select 1
        from public.projects p
        where p.id = p_project_id and p.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.project_members pm
        where pm.project_id = p_project_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
      )
    );
$$;

create or replace function public.can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        t.created_by = auth.uid()
        or (t.project_id is not null and public.is_project_member(t.project_id))
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_manage_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        t.created_by = auth.uid()
        or (t.project_id is not null and public.can_manage_project(t.project_id))
      )
  );
$$;

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and p_project_id is not null
    and (
      exists (
        select 1 from public.projects p
        where p.id = p_project_id and p.owner_id = p_user_id
      )
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p_project_id and pm.user_id = p_user_id
      )
    );
$$;

create or replace function public.can_assign_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_task(p_task_id)
    and exists (
      select 1
      from public.tasks t
      where t.id = p_task_id
        and (
          (t.project_id is not null and public.is_project_member(t.project_id, p_user_id))
          or (t.project_id is null and p_user_id = t.created_by)
        )
    );
$$;

create or replace function public.can_access_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.meetings m
    where m.id = p_meeting_id
      and (
        m.created_by = auth.uid()
        or (m.project_id is not null and public.is_project_member(m.project_id))
        or exists (
          select 1
          from public.meeting_participants mp
          where mp.meeting_id = m.id and mp.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_manage_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.meetings m
    where m.id = p_meeting_id
      and (
        m.created_by = auth.uid()
        or (m.project_id is not null and public.can_manage_project(m.project_id))
      )
  );
$$;

create or replace function public.can_access_ai_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.ai_conversations c
      where c.id = p_conversation_id and c.user_id = auth.uid()
    );
$$;

create or replace function public.add_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'owner'::public.project_member_role, new.owner_id)
  on conflict (project_id, user_id) do update set role = 'owner'::public.project_member_role;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_add_owner_membership on public.projects;
create trigger projects_add_owner_membership
after insert on public.projects
for each row execute function public.add_project_owner_membership();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at before update on public.meetings
for each row execute function public.set_updated_at();
drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();
drop trigger if exists files_updated_at on public.files;
create trigger files_updated_at before update on public.files
for each row execute function public.set_updated_at();
drop trigger if exists calendar_connections_updated_at on public.calendar_connections;
create trigger calendar_connections_updated_at before update on public.calendar_connections
for each row execute function public.set_updated_at();
drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();
drop trigger if exists project_goals_updated_at on public.project_goals;
create trigger project_goals_updated_at before update on public.project_goals
for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.project_goals enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_insert_owner on public.projects;
drop policy if exists projects_update_manager on public.projects;
drop policy if exists projects_delete_manager on public.projects;
create policy projects_select_member on public.projects
  for select to authenticated using (public.is_project_member(id));
create policy projects_insert_owner on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update_manager on public.projects
  for update to authenticated using (public.can_manage_project(id))
  with check (public.can_manage_project(id));
create policy projects_delete_manager on public.projects
  for delete to authenticated using (public.can_manage_project(id));

drop policy if exists project_members_select_member on public.project_members;
drop policy if exists project_members_insert_manager on public.project_members;
drop policy if exists project_members_update_manager on public.project_members;
drop policy if exists project_members_delete_manager on public.project_members;
create policy project_members_select_member on public.project_members
  for select to authenticated using (public.is_project_member(project_id));
create policy project_members_insert_manager on public.project_members
  for insert to authenticated with check (
    public.can_manage_project(project_id)
    and role <> 'owner'
    and (added_by is null or added_by = (select auth.uid()))
  );
create policy project_members_update_manager on public.project_members
  for update to authenticated using (public.can_manage_project(project_id) and role <> 'owner')
  with check (public.can_manage_project(project_id) and role <> 'owner');
create policy project_members_delete_manager on public.project_members
  for delete to authenticated using (public.can_manage_project(project_id) and role <> 'owner');

drop policy if exists tasks_select_accessible on public.tasks;
drop policy if exists tasks_insert_member on public.tasks;
drop policy if exists tasks_update_accessible on public.tasks;
drop policy if exists tasks_delete_manager on public.tasks;
create policy tasks_select_accessible on public.tasks
  for select to authenticated using (public.can_access_task(id));
create policy tasks_insert_member on public.tasks
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy tasks_update_accessible on public.tasks
  for update to authenticated using (public.can_access_task(id))
  with check (public.can_access_task(id));
create policy tasks_delete_manager on public.tasks
  for delete to authenticated using (public.can_manage_task(id));

drop policy if exists task_assignees_select_task_member on public.task_assignees;
drop policy if exists task_assignees_insert_task_manager on public.task_assignees;
drop policy if exists task_assignees_delete_task_manager on public.task_assignees;
create policy task_assignees_select_task_member on public.task_assignees
  for select to authenticated using (public.can_access_task(task_id));
create policy task_assignees_insert_task_manager on public.task_assignees
  for insert to authenticated with check (
    public.can_assign_task(task_id, user_id)
    and (assigned_by is null or assigned_by = (select auth.uid()))
  );
create policy task_assignees_delete_task_manager on public.task_assignees
  for delete to authenticated using (public.can_manage_task(task_id));

drop policy if exists meetings_select_participant on public.meetings;
drop policy if exists meetings_insert_member on public.meetings;
drop policy if exists meetings_update_manager on public.meetings;
drop policy if exists meetings_delete_manager on public.meetings;
create policy meetings_select_participant on public.meetings
  for select to authenticated using (public.can_access_meeting(id));
create policy meetings_insert_member on public.meetings
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy meetings_update_manager on public.meetings
  for update to authenticated using (public.can_manage_meeting(id))
  with check (public.can_manage_meeting(id));
create policy meetings_delete_manager on public.meetings
  for delete to authenticated using (public.can_manage_meeting(id));

drop policy if exists meeting_participants_select_accessible on public.meeting_participants;
drop policy if exists meeting_participants_insert_manager on public.meeting_participants;
drop policy if exists meeting_participants_delete_manager on public.meeting_participants;
create policy meeting_participants_select_accessible on public.meeting_participants
  for select to authenticated using (public.can_access_meeting(meeting_id));
create policy meeting_participants_insert_manager on public.meeting_participants
  for insert to authenticated with check (public.can_manage_meeting(meeting_id));
create policy meeting_participants_delete_manager on public.meeting_participants
  for delete to authenticated using (public.can_manage_meeting(meeting_id));

drop policy if exists calendar_events_select_owner_or_member on public.calendar_events;
drop policy if exists calendar_events_insert_owner on public.calendar_events;
drop policy if exists calendar_events_update_owner on public.calendar_events;
drop policy if exists calendar_events_delete_owner on public.calendar_events;
create policy calendar_events_select_owner_or_member on public.calendar_events
  for select to authenticated using (
    user_id = (select auth.uid())
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy calendar_events_insert_owner on public.calendar_events
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy calendar_events_update_owner on public.calendar_events
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy calendar_events_delete_owner on public.calendar_events
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists files_select_owner_or_member on public.files;
drop policy if exists files_insert_member on public.files;
drop policy if exists files_update_owner_or_manager on public.files;
drop policy if exists files_delete_owner_or_manager on public.files;
create policy files_select_owner_or_member on public.files
  for select to authenticated using (
    uploaded_by = (select auth.uid())
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy files_insert_member on public.files
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy files_update_owner_or_manager on public.files
  for update to authenticated using (
    uploaded_by = (select auth.uid())
    or (project_id is not null and public.can_manage_project(project_id))
  )
  with check (
    uploaded_by = (select auth.uid())
    or (project_id is not null and public.can_manage_project(project_id))
  );
create policy files_delete_owner_or_manager on public.files
  for delete to authenticated using (
    uploaded_by = (select auth.uid())
    or (project_id is not null and public.can_manage_project(project_id))
  );

drop policy if exists notifications_select_recipient on public.notifications;
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_select_recipient on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_recipient on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists activity_logs_select_member on public.activity_logs;
drop policy if exists activity_logs_insert_actor on public.activity_logs;
create policy activity_logs_select_member on public.activity_logs
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy activity_logs_insert_actor on public.activity_logs
  for insert to authenticated with check (
    actor_id = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );

drop policy if exists ai_conversations_select_owner on public.ai_conversations;
drop policy if exists ai_conversations_insert_owner on public.ai_conversations;
drop policy if exists ai_conversations_update_owner on public.ai_conversations;
drop policy if exists ai_conversations_delete_owner on public.ai_conversations;
create policy ai_conversations_select_owner on public.ai_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_conversations_insert_owner on public.ai_conversations
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy ai_conversations_update_owner on public.ai_conversations
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or public.is_project_member(project_id))
  );
create policy ai_conversations_delete_owner on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists ai_messages_select_conversation_owner on public.ai_messages;
drop policy if exists ai_messages_insert_user_prompt on public.ai_messages;
create policy ai_messages_select_conversation_owner on public.ai_messages
  for select to authenticated using (public.can_access_ai_conversation(conversation_id));
create policy ai_messages_insert_user_prompt on public.ai_messages
  for insert to authenticated with check (
    role = 'user'::public.ai_message_role
    and public.can_access_ai_conversation(conversation_id)
  );

drop policy if exists project_goals_select_member on public.project_goals;
drop policy if exists project_goals_insert_member on public.project_goals;
drop policy if exists project_goals_update_manager on public.project_goals;
drop policy if exists project_goals_delete_manager on public.project_goals;
create policy project_goals_select_member on public.project_goals
  for select to authenticated using (public.is_project_member(project_id));
create policy project_goals_insert_member on public.project_goals
  for insert to authenticated with check (
    created_by = (select auth.uid()) and public.is_project_member(project_id)
  );
create policy project_goals_update_manager on public.project_goals
  for update to authenticated using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
create policy project_goals_delete_manager on public.project_goals
  for delete to authenticated using (public.can_manage_project(project_id));

revoke all on public.profiles, public.projects, public.project_members, public.tasks,
  public.task_assignees, public.meetings, public.meeting_participants,
  public.calendar_connections, public.calendar_events, public.files,
  public.notifications, public.activity_logs, public.ai_conversations,
  public.ai_messages, public.project_goals, public.google_calendar_oauth_states
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, full_name, avatar_url, phone, location, job_title, organization, team, timezone, preferences)
  on public.profiles to authenticated;
grant update (full_name, avatar_url, phone, location, job_title, organization, team, timezone, preferences)
  on public.profiles to authenticated;
grant select, insert, delete on public.projects to authenticated;
grant update (name, description, status, start_date, due_date, archived_at)
  on public.projects to authenticated;
grant select, insert, update, delete on public.project_members, public.task_assignees,
  public.meeting_participants, public.calendar_events to authenticated;
grant select, insert, delete on public.meetings, public.files, public.project_goals to authenticated;
grant update (project_id, title, description, starts_at, ends_at, location, meeting_link,
  reminder_minutes, meeting_type, status, notes, action_items, google_event_id)
  on public.meetings to authenticated;
grant update (project_id, storage_bucket, storage_path, name, mime_type, size_bytes)
  on public.files to authenticated;
grant update (title, target_date, progress, status) on public.project_goals to authenticated;
grant select, insert, delete on public.tasks to authenticated;
grant update (project_id, title, description, status, priority, category, due_at, completed_at)
  on public.tasks to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant all on public.profiles, public.projects, public.project_members, public.tasks,
  public.task_assignees, public.meetings, public.meeting_participants,
  public.calendar_connections, public.calendar_events, public.files,
  public.notifications, public.activity_logs, public.ai_conversations,
  public.ai_messages, public.project_goals, public.google_calendar_oauth_states
  to service_role;

revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.is_project_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_manage_project(uuid) from public, anon;
revoke all on function public.can_access_task(uuid) from public, anon;
revoke all on function public.can_manage_task(uuid) from public, anon;
revoke all on function public.can_assign_task(uuid, uuid) from public, anon;
revoke all on function public.can_access_meeting(uuid) from public, anon;
revoke all on function public.can_manage_meeting(uuid) from public, anon;
revoke all on function public.can_access_ai_conversation(uuid) from public, anon;
revoke all on function public.add_project_owner_membership() from public, anon, authenticated;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;
grant execute on function public.is_project_member(uuid, uuid) to service_role;
grant execute on function public.can_manage_project(uuid) to authenticated, service_role;
grant execute on function public.can_access_task(uuid) to authenticated, service_role;
grant execute on function public.can_manage_task(uuid) to authenticated, service_role;
grant execute on function public.can_assign_task(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_meeting(uuid) to authenticated, service_role;
grant execute on function public.can_manage_meeting(uuid) to authenticated, service_role;
grant execute on function public.can_access_ai_conversation(uuid) to authenticated, service_role;
