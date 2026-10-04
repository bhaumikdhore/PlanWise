create or replace function public.can_create_task(
  p_project_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_created_by = auth.uid()
    and (
      p_project_id is null
      or exists (
        select 1
        from public.projects p
        where p.id = p_project_id
          and (
            p.owner_id = auth.uid()
            or exists (
              select 1
              from public.project_members pm
              where pm.project_id = p.id
                and pm.user_id = auth.uid()
                and pm.role <> 'viewer'::public.project_member_role
            )
            or exists (
              select 1
              from public.workspace_members wm
              where wm.workspace_id = p.workspace_id
                and wm.user_id = auth.uid()
                and wm.role <> 'viewer'::public.project_member_role
            )
          )
      )
    );
$$;

revoke all on function public.can_create_task(uuid, uuid) from public, anon;
grant execute on function public.can_create_task(uuid, uuid) to authenticated;

drop policy if exists tasks_insert_member on public.tasks;
create policy tasks_insert_member on public.tasks
  for insert to authenticated
  with check (public.can_create_task(project_id, created_by));
