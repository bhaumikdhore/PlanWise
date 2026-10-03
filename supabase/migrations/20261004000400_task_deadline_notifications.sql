create or replace function public.notify_upcoming_task_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to check task deadlines.';
  end if;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, payload)
  select v_user_id,
    'deadline',
    'Deadline approaching: ' || t.title,
    'This task is due within the next 24 hours.',
    'task',
    t.id,
    jsonb_build_object('task_id', t.id, 'project_id', t.project_id, 'due_at', t.due_at)
  from public.tasks t
  where t.due_at > now()
    and t.due_at <= now() + interval '24 hours'
    and t.status not in ('completed'::public.task_status, 'cancelled'::public.task_status)
    and (
      t.created_by = v_user_id
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id and ta.user_id = v_user_id
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_user_id
        and n.type = 'deadline'
        and n.entity_type = 'task'
        and n.entity_id = t.id
    );
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function public.notify_upcoming_task_deadlines() from public, anon;
grant execute on function public.notify_upcoming_task_deadlines() to authenticated;
