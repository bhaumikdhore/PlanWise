import { supabase } from '../../lib/supabaseClient.js';

const allowedRoles = new Set(['admin', 'member', 'viewer']);

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

async function getProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles')
    .select('id,full_name,email,avatar_url,job_title')
    .in('id', ids);
  if (error) throw error;
  return data;
}

export async function getCollaboratorProfiles(userIds) {
  requireClient();
  return getProfiles(userIds);
}

export async function getWorkspaceOverview() {
  requireClient();
  const { data: workspaces, error: workspaceError } = await supabase.from('workspaces')
    .select('id,name,created_by,created_at')
    .order('created_at', { ascending: false });
  if (workspaceError) throw workspaceError;
  if (!workspaces.length) return [];

  const workspaceIds = workspaces.map(({ id }) => id);
  const [
    { data: memberships, error: membershipError },
    { data: invitations, error: invitationError },
    { data: projects, error: projectError }
  ] = await Promise.all([
    supabase.from('workspace_members')
      .select('id,workspace_id,user_id,role,added_by,created_at')
      .in('workspace_id', workspaceIds),
    supabase.from('workspace_invitations')
      .select('id,workspace_id,email,role,expires_at,accepted_at,declined_at,revoked_at,created_at')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false }),
    supabase.from('projects')
      .select('id,name,workspace_id,owner_id,status')
      .in('workspace_id', workspaceIds)
  ]);
  if (membershipError) throw membershipError;
  if (invitationError) throw invitationError;
  if (projectError) throw projectError;

  const projectIds = projects.map(({ id }) => id);
  let tasks = [];
  let projectMembers = [];
  let activity = [];
  if (projectIds.length) {
    const [
      { data: taskRows, error: taskError },
      { data: memberRows, error: projectMemberError },
      { data: activityRows, error: activityError }
    ] = await Promise.all([
      supabase.from('tasks').select('id,project_id,status,due_at,task_assignees(user_id)').in('project_id', projectIds),
      supabase.from('project_members').select('id,project_id,user_id,role').in('project_id', projectIds),
      supabase.from('activity_logs').select('id,actor_id,project_id,action,entity_type,entity_id,metadata,created_at')
        .in('project_id', projectIds).order('created_at', { ascending: false }).limit(50)
    ]);
    if (taskError) throw taskError;
    if (projectMemberError) throw projectMemberError;
    if (activityError) throw activityError;
    tasks = taskRows;
    projectMembers = memberRows;
    activity = activityRows;
  }
  const memberProfiles = await getProfiles([
    ...memberships.map(({ user_id }) => user_id),
    ...projectMembers.map(({ user_id }) => user_id),
    ...activity.map(({ actor_id }) => actor_id)
  ]);
  const profileMap = new Map(memberProfiles.map((profile) => [profile.id, profile]));

  return workspaces.map((workspace) => {
    const members = memberships
      .filter((member) => member.workspace_id === workspace.id)
      .map((member) => ({ ...member, profile: profileMap.get(member.user_id) || null }));
    const workspaceProjects = projects.filter((project) => project.workspace_id === workspace.id);
    const workspaceProjectIds = new Set(workspaceProjects.map(({ id }) => id));
    const workspaceTasks = tasks.filter((task) => workspaceProjectIds.has(task.project_id));
    const workload = new Map(members.map(({ user_id }) => [user_id, 0]));
    workspaceTasks.filter((task) => !['completed', 'cancelled'].includes(task.status)).forEach((task) => {
      task.task_assignees.forEach(({ user_id }) => {
        if (workload.has(user_id)) workload.set(user_id, workload.get(user_id) + 1);
      });
    });
    return {
      ...workspace,
      members: members.map((member) => ({ ...member, workload: workload.get(member.user_id) || 0 })),
      invitations: invitations.filter((invitation) => invitation.workspace_id === workspace.id),
      projects: workspaceProjects.map((project) => ({
        ...project,
        members: projectMembers
          .filter((member) => member.project_id === project.id)
          .map((member) => ({ ...member, profile: profileMap.get(member.user_id) || null }))
      })),
      tasks: workspaceTasks,
      activity: activity
        .filter((entry) => workspaceProjectIds.has(entry.project_id))
        .map((entry) => ({ ...entry, actor: profileMap.get(entry.actor_id) || null }))
    };
  });
}

export async function createWorkspace(name, userId) {
  requireClient();
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Enter a workspace name.');
  const { data, error } = await supabase.from('workspaces')
    .insert({ name: cleanName, created_by: userId })
    .select('id,name,created_by,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function inviteWorkspaceMember({ workspaceId, email, role = 'member' }) {
  requireClient();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Enter a valid email address.');
  if (!allowedRoles.has(role)) throw new Error('Choose a valid invitation role.');
  const { data, error } = await supabase.rpc('create_workspace_invitation', {
    p_workspace_id: workspaceId,
    p_email: cleanEmail,
    p_role: role
  });
  if (error) throw error;
  const invitation = Array.isArray(data) ? data[0] : data;
  if (!invitation?.invite_token) throw new Error('The invitation was created but no invitation link was returned.');
  return {
    id: invitation.invitation_id,
    token: invitation.invite_token,
    url: `${window.location.origin}/team?invite=${encodeURIComponent(invitation.invite_token)}`
  };
}

export async function acceptWorkspaceInvitation(token) {
  requireClient();
  const { data, error } = await supabase.rpc('accept_workspace_invitation', { p_invite_token: token });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function declineWorkspaceInvitation(token) {
  requireClient();
  const { data, error } = await supabase.rpc('decline_workspace_invitation', { p_invite_token: token });
  if (error) throw error;
  return data;
}

export async function updateWorkspaceMemberRole(membershipId, role) {
  requireClient();
  if (!['admin', 'member', 'viewer'].includes(role)) throw new Error('Choose a valid workspace role.');
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', membershipId);
  if (error) throw error;
}

export async function removeWorkspaceMember(membershipId) {
  requireClient();
  const { error } = await supabase.from('workspace_members').delete().eq('id', membershipId);
  if (error) throw error;
}

export async function revokeWorkspaceInvitation(invitationId) {
  requireClient();
  const { error } = await supabase.from('workspace_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId);
  if (error) throw error;
}

export async function linkProjectToWorkspace(projectId, workspaceId) {
  requireClient();
  const { error } = await supabase.from('projects')
    .update({ workspace_id: workspaceId || null })
    .eq('id', projectId);
  if (error) throw error;
}
