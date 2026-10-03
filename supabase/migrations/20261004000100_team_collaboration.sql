alter type public.task_status add value if not exists 'in_review';

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_member_role not null default 'member',
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (length(btrim(email)) > 3),
  role public.project_member_role not null default 'member' check (role <> 'owner'),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

alter table public.projects
  add column if not exists workspace_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_workspace_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces (id) on delete set null;
  end if;
end;
$$;

alter table public.tasks
  add column if not exists reviewer_id uuid references public.profiles (id) on delete set null,
  add column if not exists review_requested_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_feedback text;

create index workspaces_created_by_idx on public.workspaces (created_by);
create index workspace_members_user_workspace_idx on public.workspace_members (user_id, workspace_id);
create index workspace_invitations_workspace_created_idx on public.workspace_invitations (workspace_id, created_at desc);
create index workspace_invitations_email_pending_idx on public.workspace_invitations (lower(email), expires_at)
  where accepted_at is null and revoked_at is null;
create index projects_workspace_created_idx on public.projects (workspace_id, created_at desc);
create index tasks_reviewer_status_idx on public.tasks (reviewer_id, status)
  where reviewer_id is not null;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
    );
$$;

create or replace function public.can_manage_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
    );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and p_project_id is not null
    and (
      exists (
        select 1 from public.projects p
        where p.id = p_project_id
          and (p.owner_id = auth.uid() or public.is_workspace_member(p.workspace_id))
      )
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p_project_id and pm.user_id = auth.uid()
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
  select p_user_id is not null and p_project_id is not null
    and (
      exists (
        select 1 from public.projects p
        where p.id = p_project_id
          and (
            p.owner_id = p_user_id
            or exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = p.workspace_id and wm.user_id = p_user_id
            )
          )
      )
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p_project_id and pm.user_id = p_user_id
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
  select auth.uid() is not null and p_project_id is not null
    and (
      exists (
        select 1 from public.projects p
        where p.id = p_project_id
          and (
            p.owner_id = auth.uid()
            or exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = p.workspace_id
                and wm.user_id = auth.uid()
                and wm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
            )
          )
      )
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p_project_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
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
      select 1 from public.tasks t
      where t.id = p_task_id
        and (
          (t.project_id is not null and public.is_project_member(t.project_id, p_user_id))
          or (t.project_id is null and p_user_id = t.created_by)
        )
    );
$$;

create or replace function public.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, added_by)
  values (new.id, new.created_by, 'owner'::public.project_member_role, new.created_by)
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

create or replace function public.guard_task_review_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reviewer_id is distinct from old.reviewer_id
     and not public.can_manage_task(old.id) then
    raise exception 'Only a project manager can assign a task reviewer.';
  end if;

  if new.review_feedback is distinct from old.review_feedback
     and auth.uid() is distinct from old.reviewer_id
     and not public.can_manage_task(old.id) then
    raise exception 'Only the assigned reviewer or a project manager can update review feedback.';
  end if;

  if new.reviewer_id is distinct from old.reviewer_id and new.reviewer_id is not null then
    if new.project_id is null
       or not public.is_project_member(new.project_id, new.reviewer_id) then
      raise exception 'The reviewer must be a member of the task project or workspace.';
    end if;
  end if;

  if new.status = 'in_review' and old.status is distinct from new.status then
    if new.reviewer_id is null then
      raise exception 'Assign a reviewer before submitting this task for review.';
    end if;
    if new.project_id is null
       or not public.is_project_member(new.project_id, new.reviewer_id) then
      raise exception 'The reviewer must be a member of the task project or workspace.';
    end if;
    new.review_requested_at := now();
    new.reviewed_at := null;
  end if;

  if new.status = 'completed'
     and old.status is distinct from new.status
     and old.reviewer_id is not null then
    if old.status <> 'in_review' then
      raise exception 'A task assigned for review must be submitted for review before completion.';
    end if;
    if auth.uid() is distinct from old.reviewer_id
       and not public.can_manage_task(old.id) then
      raise exception 'Only the assigned reviewer or a project manager can approve this task.';
    end if;
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  if old.status = 'in_review' and new.status = 'in_progress'
     and auth.uid() is distinct from old.reviewer_id
     and not public.can_manage_task(old.id) then
    raise exception 'Only the assigned reviewer or a project manager can return this task for changes.';
  end if;

  return new;
end;
$$;

create or replace function public.log_workspace_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_name text;
begin
  select w.name into v_workspace_name
  from public.workspaces w
  where w.id = new.workspace_id;

  if new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
    values (
      new.user_id,
      'team_activity',
      'Added to workspace',
      'You have been added to ' || coalesce(v_workspace_name, 'a workspace') || '.',
      'workspace',
      new.workspace_id,
      jsonb_build_object('workspace_id', new.workspace_id, 'role', new.role)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_title text;
begin
  select t.title into v_task_title from public.tasks t where t.id = new.task_id;
  if new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
    values (
      new.user_id,
      'task_assigned',
      'Task assigned to you',
      coalesce(v_task_title, 'A task') || ' has been assigned to you.',
      'task',
      new.task_id,
      jsonb_build_object('task_id', new.task_id)
    );
  end if;
  return new;
end;
$$;

create or replace function public.log_task_review_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if new.reviewer_id is distinct from old.reviewer_id then
    v_action := 'task_reviewer_assigned';
  elsif new.status = 'in_review' and old.status is distinct from new.status then
    v_action := 'task_review_requested';
  elsif new.status = 'completed' and old.status = 'in_review' then
    v_action := 'task_review_approved';
  else
    return new;
  end if;

  insert into public.activity_logs (actor_id, project_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    new.project_id,
    v_action,
    'task',
    new.id,
    jsonb_build_object(
      'status', new.status,
      'reviewer_id', new.reviewer_id,
      'review_feedback', new.review_feedback
    )
  );
  return new;
end;
$$;

create or replace function public.log_task_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  select t.* into v_task from public.tasks t
  where t.id = coalesce(new.task_id, old.task_id);

  insert into public.activity_logs (actor_id, project_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_task.project_id,
    case when tg_op = 'INSERT' then 'task_assignee_added' else 'task_assignee_removed' end,
    'task',
    v_task.id,
    jsonb_build_object('assignee_id', coalesce(new.user_id, old.user_id))
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.create_workspace_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role public.project_member_role default 'member',
  p_expires_at timestamptz default now() + interval '7 days'
)
returns table (invitation_id uuid, invite_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_invitation_id uuid;
  v_email text := lower(btrim(p_email));
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create an invitation.';
  end if;
  if not public.can_manage_workspace(p_workspace_id) then
    raise exception 'Only workspace owners and admins can invite members.';
  end if;
  if v_email is null or v_email = '' or position('@' in v_email) < 2 then
    raise exception 'A valid email address is required.';
  end if;
  if p_role = 'owner'::public.project_member_role then
    raise exception 'Workspace invitations cannot grant the owner role.';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future.';
  end if;

  insert into public.workspace_invitations (
    workspace_id, email, role, invited_by, token_hash, expires_at
  )
  values (
    p_workspace_id,
    v_email,
    p_role,
    auth.uid(),
    pg_catalog.sha256(convert_to(v_token::text, 'UTF8')),
    p_expires_at
  )
  returning id into v_invitation_id;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
  select p.id, 'team_activity', 'Workspace invitation',
    'You have been invited to join a workspace.',
    'workspace_invitation', v_invitation_id,
    jsonb_build_object('workspace_id', p_workspace_id, 'invitation_id', v_invitation_id)
  from public.profiles p
  where lower(p.email) = v_email and p.id <> auth.uid();

  return query select v_invitation_id, v_token::text;
end;
$$;

create or replace function public.accept_workspace_invitation(p_invite_token text)
returns table (workspace_id uuid, role public.project_member_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Sign in with the invited email address to accept this invitation.';
  end if;
  if p_invite_token is null or btrim(p_invite_token) = '' then
    raise exception 'A valid invitation token is required.';
  end if;

  select wi.* into v_invitation
  from public.workspace_invitations wi
  where wi.token_hash = pg_catalog.sha256(convert_to(p_invite_token, 'UTF8'))
    and wi.accepted_at is null
    and wi.revoked_at is null
    and wi.expires_at > now()
    and lower(wi.email) = v_email
  for update;

  if not found then
    raise exception 'This invitation is invalid, expired, revoked, or belongs to a different email address.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, added_by)
  values (v_invitation.workspace_id, v_user_id, v_invitation.role, v_invitation.invited_by)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  return query select v_invitation.workspace_id, v_invitation.role;
end;
$$;

create trigger workspaces_add_owner_membership
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner_membership();
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger tasks_guard_review_workflow
  before update of status, reviewer_id, review_feedback on public.tasks
  for each row execute function public.guard_task_review_workflow();
create trigger tasks_log_review_activity
  after update of status, reviewer_id on public.tasks
  for each row execute function public.log_task_review_activity();
create trigger task_assignees_log_activity
  after insert or delete on public.task_assignees
  for each row execute function public.log_task_assignment_activity();
create trigger task_assignees_notify
  after insert on public.task_assignees
  for each row execute function public.notify_task_assignment();
create trigger workspace_members_notify
  after insert on public.workspace_members
  for each row execute function public.log_workspace_membership_activity();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;

create policy workspaces_select_member on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert_creator on public.workspaces
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy workspaces_update_manager on public.workspaces
  for update to authenticated using (public.can_manage_workspace(id))
  with check (public.can_manage_workspace(id));
create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated using (
    created_by = (select auth.uid())
    and public.can_manage_workspace(id)
  );

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_members_insert_manager on public.workspace_members
  for insert to authenticated with check (
    public.can_manage_workspace(workspace_id)
    and role <> 'owner'::public.project_member_role
    and (added_by is null or added_by = (select auth.uid()))
  );
create policy workspace_members_update_manager on public.workspace_members
  for update to authenticated using (
    public.can_manage_workspace(workspace_id)
    and role <> 'owner'::public.project_member_role
  )
  with check (
    public.can_manage_workspace(workspace_id)
    and role <> 'owner'::public.project_member_role
  );
create policy workspace_members_delete_manager on public.workspace_members
  for delete to authenticated using (
    public.can_manage_workspace(workspace_id)
    and role <> 'owner'::public.project_member_role
  );

create policy workspace_invitations_select_manager on public.workspace_invitations
  for select to authenticated using (public.can_manage_workspace(workspace_id));
create policy workspace_invitations_update_manager on public.workspace_invitations
  for update to authenticated using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists projects_insert_owner on public.projects;
create policy projects_insert_owner on public.projects
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (workspace_id is null or public.can_manage_workspace(workspace_id))
  );

drop policy if exists projects_update_manager on public.projects;
create policy projects_update_manager on public.projects
  for update to authenticated using (public.can_manage_project(id))
  with check (
    public.can_manage_project(id)
    and (workspace_id is null or public.can_manage_workspace(workspace_id))
  );

drop policy if exists activity_logs_select_member on public.activity_logs;
create policy activity_logs_select_member on public.activity_logs
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (project_id is not null and public.is_project_member(project_id))
    or (entity_type = 'task' and entity_id is not null and public.can_access_task(entity_id))
  );

drop policy if exists tasks_update_accessible on public.tasks;
create policy tasks_update_accessible on public.tasks
  for update to authenticated using (public.can_access_task(id))
  with check (public.can_access_task(id));

revoke all on public.workspaces, public.workspace_members, public.workspace_invitations
  from public, anon, authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select (id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at),
  update (revoked_at) on public.workspace_invitations to authenticated;
grant all on public.workspaces, public.workspace_members, public.workspace_invitations to service_role;
grant update (workspace_id) on public.projects to authenticated;
grant update (reviewer_id, review_feedback)
  on public.tasks to authenticated;
grant all on public.activity_logs to service_role;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.can_manage_workspace(uuid) from public, anon;
revoke all on function public.add_workspace_owner_membership() from public, anon, authenticated;
revoke all on function public.guard_task_review_workflow() from public, anon, authenticated;
revoke all on function public.log_workspace_membership_activity() from public, anon, authenticated;
revoke all on function public.notify_task_assignment() from public, anon, authenticated;
revoke all on function public.log_task_review_activity() from public, anon, authenticated;
revoke all on function public.log_task_assignment_activity() from public, anon, authenticated;
revoke all on function public.create_workspace_invitation(uuid, text, public.project_member_role, timestamptz)
  from public, anon;
revoke all on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.can_manage_workspace(uuid) to authenticated, service_role;
grant execute on function public.create_workspace_invitation(uuid, text, public.project_member_role, timestamptz)
  to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;
grant execute on function public.is_project_member(uuid, uuid) to service_role;
grant execute on function public.can_manage_project(uuid) to authenticated, service_role;
grant execute on function public.can_assign_task(uuid, uuid) to authenticated, service_role;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'workspaces',
      'workspace_members',
      'workspace_invitations',
      'projects',
      'project_members',
      'tasks',
      'task_assignees',
      'activity_logs'
    ]
    loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
