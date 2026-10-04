create or replace function public.create_task_for_authenticated_user(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_status text,
  p_priority text,
  p_category text,
  p_due_at timestamptz,
  p_reviewer_id uuid,
  p_review_feedback text,
  p_completed_at timestamptz
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_status text := coalesce(nullif(pg_catalog.btrim(p_status), ''), 'todo');
  v_priority text := coalesce(nullif(pg_catalog.btrim(p_priority), ''), 'medium');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before creating a task.';
  end if;

  if not public.can_create_task(p_project_id, v_user_id) then
    raise exception using errcode = '42501', message = 'You cannot create a task in this project.';
  end if;

  if p_title is null or pg_catalog.length(pg_catalog.btrim(p_title)) not between 1 and 200
    or pg_catalog.length(coalesce(p_description, '')) > 5000
    or pg_catalog.length(coalesce(p_category, '')) > 80
    or pg_catalog.length(coalesce(p_review_feedback, '')) > 5000 then
    raise exception using errcode = '22023', message = 'Task details are invalid.';
  end if;

  if v_status not in ('todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'Choose a valid task status.';
  end if;

  if v_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'Choose a valid task priority.';
  end if;

  if p_reviewer_id is not null
    and (
      p_project_id is null
      or not public.is_project_member(p_project_id, p_reviewer_id)
    ) then
    raise exception using errcode = '42501', message = 'The reviewer must belong to this project.';
  end if;

  insert into public.tasks (
    project_id,
    created_by,
    title,
    description,
    status,
    priority,
    category,
    due_at,
    reviewer_id,
    review_feedback,
    completed_at
  )
  values (
    p_project_id,
    v_user_id,
    pg_catalog.btrim(p_title),
    coalesce(p_description, ''),
    v_status::public.task_status,
    v_priority::public.task_priority,
    nullif(pg_catalog.btrim(coalesce(p_category, '')), ''),
    p_due_at,
    p_reviewer_id,
    nullif(pg_catalog.btrim(coalesce(p_review_feedback, '')), ''),
    p_completed_at
  )
  returning * into v_task;

  return next v_task;
  return;
end;
$$;

revoke all on function public.create_task_for_authenticated_user(
  uuid, text, text, text, text, text, timestamptz, uuid, text, timestamptz
) from public, anon;
grant execute on function public.create_task_for_authenticated_user(
  uuid, text, text, text, text, text, timestamptz, uuid, text, timestamptz
) to authenticated;
