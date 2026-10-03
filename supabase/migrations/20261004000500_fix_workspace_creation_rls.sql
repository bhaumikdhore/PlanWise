drop policy if exists workspaces_insert_creator on public.workspaces;
create policy workspaces_insert_creator on public.workspaces
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
  );

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (
    public.is_workspace_member(id)
    or created_by = (select auth.uid())
  );
