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
  on conflict on constraint workspace_members_workspace_id_user_id_key do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  return query select v_invitation.workspace_id, v_invitation.role;
end;
$$;
