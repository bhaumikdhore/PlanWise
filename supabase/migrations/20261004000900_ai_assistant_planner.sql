create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_dependencies_distinct_tasks check (task_id <> depends_on_task_id),
  constraint task_dependencies_unique unique (task_id, depends_on_task_id)
);

alter table public.task_dependencies enable row level security;

drop policy if exists task_dependencies_select_accessible on public.task_dependencies;
create policy task_dependencies_select_accessible on public.task_dependencies
  for select to authenticated using (
    public.can_access_task(task_id)
    and public.can_access_task(depends_on_task_id)
  );

revoke all on public.task_dependencies from public, anon, authenticated;
grant select on public.task_dependencies to authenticated;

create or replace function public.append_ai_exchange(
  p_conversation_id uuid,
  p_project_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid := p_conversation_id;
  v_existing_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_user_content is null or length(btrim(p_user_content)) = 0 or length(p_user_content) > 4000
    or p_assistant_content is null or length(p_assistant_content) > 3000
    or p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Invalid conversation exchange';
  end if;
  if p_project_id is not null and not public.is_project_member(p_project_id) then
    raise exception 'Project access denied';
  end if;

  if v_conversation_id is null then
    insert into public.ai_conversations (user_id, project_id, title)
    values (v_user_id, p_project_id, left(btrim(p_user_content), 80))
    returning id into v_conversation_id;
  else
    select project_id into v_existing_project_id
    from public.ai_conversations
    where id = v_conversation_id and user_id = v_user_id
    for update;
    if not found or v_existing_project_id is distinct from p_project_id then
      raise exception 'Conversation is unavailable for this context';
    end if;
  end if;

  insert into public.ai_messages (conversation_id, role, content, metadata)
  values (v_conversation_id, 'user'::public.ai_message_role, p_user_content, '{}'::jsonb);
  insert into public.ai_messages (conversation_id, role, content, metadata)
  values (v_conversation_id, 'assistant'::public.ai_message_role, p_assistant_content, p_metadata);

  update public.ai_conversations
  set updated_at = now()
  where id = v_conversation_id and user_id = v_user_id;

  return v_conversation_id;
end;
$$;

revoke all on function public.append_ai_exchange(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.append_ai_exchange(uuid, uuid, text, text, jsonb) to authenticated;

create or replace function public.create_ai_planned_tasks(
  p_project_id uuid,
  p_tasks jsonb
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_index integer := 0;
  v_count integer;
  v_title text;
  v_description text;
  v_category text;
  v_priority public.task_priority;
  v_due_at timestamptz;
  v_new_id uuid;
  v_task_ids uuid[] := array[]::uuid[];
  v_dependency jsonb;
  v_dependency_index integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Tasks must be an array';
  end if;
  v_count := jsonb_array_length(p_tasks);
  if v_count < 1 or v_count > 20 then
    raise exception 'Select between 1 and 20 tasks';
  end if;
  if p_project_id is not null and not public.can_contribute_to_project(p_project_id, v_user_id) then
    raise exception 'You cannot create tasks in this project';
  end if;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_item) as keys(key_name)
        where key_name not in ('title', 'description', 'priority', 'category', 'due_at', 'depends_on')
      ) then
      raise exception 'Invalid planned task';
    end if;
    if jsonb_typeof(v_item -> 'title') <> 'string'
      or (v_item ? 'description' and jsonb_typeof(v_item -> 'description') <> 'string')
      or (v_item ? 'category' and jsonb_typeof(v_item -> 'category') <> 'string')
      or (v_item ? 'priority' and jsonb_typeof(v_item -> 'priority') <> 'string')
      or (v_item ? 'due_at' and v_item -> 'due_at' <> 'null'::jsonb
        and jsonb_typeof(v_item -> 'due_at') <> 'string') then
      raise exception 'Invalid planned task fields';
    end if;

    v_title := btrim(coalesce(v_item ->> 'title', ''));
    v_description := coalesce(v_item ->> 'description', '');
    v_category := nullif(btrim(coalesce(v_item ->> 'category', 'AI subtask')), '');
    if length(v_title) < 1 or length(v_title) > 200 or length(v_description) > 2000
      or length(coalesce(v_category, '')) > 80 then
      raise exception 'Invalid planned task fields';
    end if;
    if coalesce(v_item ->> 'priority', 'medium') not in ('low', 'medium', 'high', 'urgent') then
      raise exception 'Invalid planned task priority';
    end if;
    v_priority := (coalesce(v_item ->> 'priority', 'medium'))::public.task_priority;

    v_due_at := null;
    if v_item ? 'due_at' and v_item ->> 'due_at' is not null then
      begin
        v_due_at := (v_item ->> 'due_at')::timestamptz;
      exception when others then
        raise exception 'Invalid planned task due date';
      end;
    end if;

    if v_item ? 'depends_on' and jsonb_typeof(v_item -> 'depends_on') <> 'array' then
      raise exception 'Invalid task dependencies';
    end if;
    for v_dependency in
      select value from jsonb_array_elements(coalesce(v_item -> 'depends_on', '[]'::jsonb))
    loop
      if jsonb_typeof(v_dependency) <> 'number'
        or (v_dependency #>> '{}') !~ '^[0-9]+$' then
        raise exception 'Invalid task dependency index';
      end if;
      v_dependency_index := (v_dependency #>> '{}')::integer;
      if v_dependency_index < 0 or v_dependency_index >= v_index then
        raise exception 'Task dependencies must point to an earlier selected task';
      end if;
    end loop;

    insert into public.tasks (
      project_id, created_by, title, description, status, priority, category, due_at
    )
    values (
      p_project_id, v_user_id, v_title, v_description,
      'todo'::public.task_status, v_priority, v_category, v_due_at
    )
    returning id into v_new_id;
    v_task_ids := array_append(v_task_ids, v_new_id);

    insert into public.task_assignees (task_id, user_id, assigned_by)
    values (v_new_id, v_user_id, v_user_id);

    insert into public.activity_logs (actor_id, project_id, action, entity_type, entity_id, metadata)
    values (
      v_user_id, p_project_id, 'ai_task_created', 'task', v_new_id,
      jsonb_build_object('title', v_title, 'status', 'todo', 'source', 'ai_task_planner')
    );
    v_index := v_index + 1;
  end loop;

  v_index := 0;
  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    for v_dependency in
      select value from jsonb_array_elements(coalesce(v_item -> 'depends_on', '[]'::jsonb))
    loop
      v_dependency_index := (v_dependency #>> '{}')::integer;
      insert into public.task_dependencies (task_id, depends_on_task_id, created_by)
      values (v_task_ids[v_index + 1], v_task_ids[v_dependency_index + 1], v_user_id)
      on conflict (task_id, depends_on_task_id) do nothing;
    end loop;
    v_index := v_index + 1;
  end loop;

  return query
  select task_row.*
  from public.tasks task_row
  where task_row.id = any(v_task_ids)
  order by array_position(v_task_ids, task_row.id);
end;
$$;

revoke all on function public.create_ai_planned_tasks(uuid, jsonb) from public, anon;
grant execute on function public.create_ai_planned_tasks(uuid, jsonb) to authenticated;
