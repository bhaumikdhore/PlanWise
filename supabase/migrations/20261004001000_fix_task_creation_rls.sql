drop policy if exists tasks_insert_member on public.tasks;

create policy tasks_insert_member on public.tasks
  for insert to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and (
      project_id is null
      or public.can_contribute_to_project(project_id, auth.uid())
    )
  );
