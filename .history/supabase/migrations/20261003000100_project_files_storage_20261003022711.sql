insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do update set public = false;

drop policy if exists project_files_read on storage.objects;
create policy project_files_read on storage.objects
  for select to authenticated using (
    bucket_id = 'project-files'
    and exists (
      select 1
      from public.files f
      where f.storage_bucket = bucket_id
        and f.storage_path = name
        and (
          f.uploaded_by = (select auth.uid())
          or (f.project_id is not null and public.is_project_member(f.project_id))
        )
    )
  );

drop policy if exists project_files_insert on storage.objects;
create policy project_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-files'
    and (
      (
        cardinality(storage.foldername(name)) = 1
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      or (
        cardinality(storage.foldername(name)) = 2
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
          select 1
          from public.projects p
          where p.id::text = (storage.foldername(name))[1]
            and public.is_project_member(p.id)
        )
      )
    )
  );

drop policy if exists project_files_delete_uploader_or_manager on storage.objects;
create policy project_files_delete_uploader_or_manager on storage.objects
  for delete to authenticated using (
    bucket_id = 'project-files'
    and exists (
      select 1
      from public.files f
      where f.storage_bucket = bucket_id
        and f.storage_path = name
        and (
          f.uploaded_by = (select auth.uid())
          or (f.project_id is not null and public.can_manage_project(f.project_id))
        )
    )
  );