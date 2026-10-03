alter table public.workspaces
  add column if not exists description text;

create or replace function public.preview_workspace_invitation(p_invite_token text)
returns table (
  status text,
  workspace_id uuid,
  workspace_name text,
  inviter_name text,
  role public.project_member_role,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.workspace_invitations%rowtype;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Sign in with the invited email address to view this invitation.';
  end if;

  if p_invite_token is null or btrim(p_invite_token) = '' then
    return query select 'invalid'::text, null::uuid, null::text, null::text,
      null::public.project_member_role, null::timestamptz;
    return;
  end if;

  select wi.* into v_invitation
  from public.workspace_invitations wi
  where wi.token_hash = pg_catalog.sha256(convert_to(p_invite_token, 'UTF8'))
    and lower(wi.email) = v_email;

  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text,
      null::public.project_member_role, null::timestamptz;
    return;
  end if;

  if v_invitation.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text, null::text,
      null::public.project_member_role, v_invitation.expires_at;
    return;
  end if;

  if v_invitation.accepted_at is not null
     or v_invitation.declined_at is not null
     or v_invitation.revoked_at is not null then
    return query select 'unavailable'::text, null::uuid, null::text, null::text,
      null::public.project_member_role, v_invitation.expires_at;
    return;
  end if;

  return query
  select
    'valid'::text,
    v_invitation.workspace_id,
    w.name,
    coalesce(p.full_name, p.email, 'A teammate'),
    v_invitation.role,
    v_invitation.expires_at
  from public.workspaces w
  left join public.profiles p on p.id = v_invitation.invited_by
  where w.id = v_invitation.workspace_id;
end;
$$;

revoke all on function public.preview_workspace_invitation(text) from public, anon;
grant execute on function public.preview_workspace_invitation(text) to authenticated;
