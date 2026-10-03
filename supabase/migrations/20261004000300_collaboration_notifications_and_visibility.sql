alter type public.task_status add value if not exists 'blocked';

alter table public.workspace_invitations
  add column if not exists declined_at timestamptz;

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_terminal_state_check;

alter table public.workspace_invitations
  add constraint workspace_invitations_terminal_state_check
  check (num_nonnulls(accepted_at, revoked_at, declined_at) <= 1);

drop policy if exists profiles_select_collaborators on public.profiles;
create policy profiles_select_collaborators on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members own_member
      join public.workspace_members shared_member
        on shared_member.workspace_id = own_member.workspace_id
      where own_member.user_id = (select auth.uid())
        and shared_member.user_id = profiles.id
    )
    or exists (
      select 1
      from public.project_members own_member
      join public.project_members shared_member
        on shared_member.project_id = own_member.project_id
      where own_member.user_id = (select auth.uid())
        and shared_member.user_id = profiles.id
    )
  );

create or replace function public.can_contribute_to_project(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
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
        where pm.project_id = p_project_id
          and pm.user_id = p_user_id
          and pm.role <> 'viewer'::public.project_member_role
      )
      or exists (
        select 1
        from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = p_project_id
          and wm.user_id = p_user_id
          and wm.role <> 'viewer'::public.project_member_role
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
  select auth.uid() is not null
    and exists (
      select 1
      from public.tasks t
      where t.id = p_task_id
        and (
          (t.project_id is null and t.created_by = auth.uid())
          or (t.project_id is not null and public.can_manage_project(t.project_id))
        )
    );
$$;

create or replace function public.can_update_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.tasks t
      where t.id = p_task_id
        and (
          public.can_manage_task(t.id)
          or (
            t.created_by = auth.uid()
            and (t.project_id is null or public.can_contribute_to_project(t.project_id, auth.uid()))
          )
          or (
            (t.project_id is null or public.can_contribute_to_project(t.project_id, auth.uid()))
            and exists (
              select 1 from public.task_assignees ta
              where ta.task_id = t.id and ta.user_id = auth.uid()
            )
          )
        )
    );
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
  else
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
    select distinct wm.user_id, 'team_activity', 'Invitation accepted',
      coalesce((select p.full_name from public.profiles p where p.id = new.user_id), 'A member')
        || ' joined ' || coalesce(v_workspace_name, 'your workspace') || '.',
      'workspace', new.workspace_id,
      jsonb_build_object('workspace_id', new.workspace_id, 'member_id', new.user_id)
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id
      and wm.user_id <> new.user_id
      and wm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role);
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
  elsif new.status = 'completed' then
    v_action := 'task_completed';
  elsif new.status = 'in_progress' and old.status = 'in_review' then
    v_action := 'task_review_changes_requested';
  elsif new.status is distinct from old.status then
    v_action := 'task_status_changed';
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
      'previous_status', old.status,
      'status', new.status,
      'reviewer_id', new.reviewer_id,
      'review_feedback', new.review_feedback
    )
  );
  return new;
end;
$$;

create or replace function public.notify_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_notification_title text;
  v_notification_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  v_title := case
    when new.status = 'in_review' then 'Submitted for review'
    when new.status = 'completed' and old.status = 'in_review' then 'Task approved'
    when new.status = 'in_progress' and old.status = 'in_review' then 'Changes requested'
    when new.status = 'blocked' then 'Task blocked'
    else 'Task status updated'
  end;
  v_notification_title := v_title || ': ' || new.title;
  v_notification_body := 'Task status changed from '
    || replace(old.status::text, '_', ' ') || ' to '
    || replace(new.status::text, '_', ' ') || '.';

  with recipients as (
    select new.created_by as user_id
    union
    select ta.user_id from public.task_assignees ta where ta.task_id = new.id
    union
    select new.reviewer_id where new.reviewer_id is not null
    union
    select pm.user_id
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
      and new.status = 'in_review'
    union
    select wm.user_id
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = new.project_id
      and wm.role in ('owner'::public.project_member_role, 'admin'::public.project_member_role)
      and new.status = 'in_review'
  )
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
  select r.user_id, 'team_activity', v_notification_title, v_notification_body,
    'task', new.id,
    jsonb_build_object('task_id', new.id, 'project_id', new.project_id, 'status', new.status)
  from recipients r
  where r.user_id is not null and r.user_id <> auth.uid();

  return new;
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
    and wi.declined_at is null
    and wi.expires_at > now()
    and lower(wi.email) = v_email
  for update;

  if not found then
    raise exception 'This invitation is invalid, expired, revoked, already handled, or belongs to a different email address.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, added_by)
  values (v_invitation.workspace_id, v_user_id, v_invitation.role, v_invitation.invited_by)
  on conflict on constraint workspace_members_workspace_id_user_id_key do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  return query select v_invitation.workspace_id, v_invitation.role;
end;
$$;

create or replace function public.decline_workspace_invitation(p_invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_workspace_id uuid;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Sign in with the invited email address to decline this invitation.';
  end if;
  if p_invite_token is null or btrim(p_invite_token) = '' then
    raise exception 'A valid invitation token is required.';
  end if;

  update public.workspace_invitations wi
  set declined_at = now()
  where wi.token_hash = pg_catalog.sha256(convert_to(p_invite_token, 'UTF8'))
    and wi.accepted_at is null
    and wi.revoked_at is null
    and wi.declined_at is null
    and wi.expires_at > now()
    and lower(wi.email) = v_email
  returning wi.workspace_id into v_workspace_id;

  if v_workspace_id is null then
    raise exception 'This invitation is invalid, expired, already handled, or belongs to a different email address.';
  end if;
  return v_workspace_id;
end;
$$;

create trigger tasks_notify_status_change
  after update of status on public.tasks
  for each row execute function public.notify_task_status_change();

drop policy if exists tasks_insert_member on public.tasks;
create policy tasks_insert_member on public.tasks
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (project_id is null or public.can_contribute_to_project(project_id))
  );

drop policy if exists tasks_update_accessible on public.tasks;
create policy tasks_update_accessible on public.tasks
  for update to authenticated using (public.can_update_task(id))
  with check (public.can_update_task(id));

revoke all on function public.notify_task_status_change() from public, anon, authenticated;
revoke all on function public.decline_workspace_invitation(text) from public, anon;
revoke all on function public.can_contribute_to_project(uuid, uuid) from public, anon;
revoke all on function public.can_update_task(uuid) from public, anon;
grant select (declined_at) on public.workspace_invitations to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.decline_workspace_invitation(text) to authenticated;
grant execute on function public.can_contribute_to_project(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_update_task(uuid) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
