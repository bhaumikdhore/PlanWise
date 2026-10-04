alter type public.task_priority add value if not exists 'urgent';

create or replace function public.can_assign_task(p_task_id uuid, p_user_id uuid)
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
            and t.project_id is not null
            and public.can_contribute_to_project(t.project_id, auth.uid())
          )
        )
        and (
          (t.project_id is not null and public.can_contribute_to_project(t.project_id, p_user_id))
          or (t.project_id is null and p_user_id = t.created_by)
        )
    );
$$;

drop policy if exists tasks_delete_manager on public.tasks;
create policy tasks_delete_manager on public.tasks
  for delete to authenticated using (
    public.can_manage_task(id)
    or (
      created_by = (select auth.uid())
      and project_id is not null
      and public.can_contribute_to_project(project_id)
    )
  );

drop policy if exists task_assignees_delete_task_manager on public.task_assignees;
create policy task_assignees_delete_task_manager on public.task_assignees
  for delete to authenticated using (
    public.can_manage_task(task_id)
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.created_by = (select auth.uid())
        and t.project_id is not null
        and public.can_contribute_to_project(t.project_id)
    )
  );

grant execute on function public.can_assign_task(uuid, uuid) to authenticated, service_role;
