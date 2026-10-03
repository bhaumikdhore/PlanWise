import { useEffect, useMemo, useState } from 'react';
import Avatar from '../../components/common/Avatar';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getProjects } from '../../services/projects/projectService';
import { syncProjectMembers } from '../../services/projects/projectMemberService';
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  declineWorkspaceInvitation,
  getWorkspaceOverview,
  inviteWorkspaceMember,
  linkProjectToWorkspace,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole
} from '../../services/projects/workspaceService';

const roleOptions = ['admin', 'member', 'viewer'];
const initialsFor = (profile, fallback) => {
  const name = profile?.full_name || profile?.email || fallback || 'U';
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
};

function inviteStatus(invitation) {
  if (invitation.accepted_at) return 'Accepted';
  if (invitation.declined_at) return 'Declined';
  if (invitation.revoked_at) return 'Revoked';
  if (new Date(invitation.expires_at) <= new Date()) return 'Expired';
  return 'Pending';
}

export default function TeamPage({ onNavigate, onLogout, session }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    const [nextWorkspaces, nextProjects] = await Promise.all([
      getWorkspaceOverview(),
      getProjects({ id: session.user.id, profile: session.user.user_metadata || {} })
    ]);
    setWorkspaces(nextWorkspaces);
    setProjects(nextProjects.filter((project) => !project.archived));
    setSelectedId((current) => current && nextWorkspaces.some(({ id }) => id === current)
      ? current
      : nextWorkspaces[0]?.id || '');
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      getWorkspaceOverview(),
      getProjects({ id: session.user.id, profile: session.user.user_metadata || {} })
    ]).then(([nextWorkspaces, nextProjects]) => {
      if (!active) return;
      setWorkspaces(nextWorkspaces);
      setProjects(nextProjects.filter((project) => !project.archived));
      setSelectedId(nextWorkspaces[0]?.id || '');
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load team workspaces.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  const workspace = useMemo(() => workspaces.find(({ id }) => id === selectedId) || null, [workspaces, selectedId]);
  const currentMember = workspace?.members.find(({ user_id }) => user_id === session.user.id);
  const canManage = ['owner', 'admin'].includes(currentMember?.role);

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await action();
      if (successMessage) setSuccess(successMessage);
      return true;
    } catch (actionError) {
      setError(actionError.message || 'The action could not be completed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateWorkspace = async (event) => {
    event.preventDefault();
    const created = await runAction(
      () => createWorkspace(workspaceName, session.user.id),
      'Workspace created.'
    );
    if (!created) return;
    setWorkspaceName('');
    await refresh();
    setSelectedId((await getWorkspaceOverview()).find(({ name }) => name === workspaceName.trim())?.id || '');
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    const result = await runAction(async () => {
      const invitation = await inviteWorkspaceMember({ workspaceId: workspace.id, email: inviteEmail, role: inviteRole });
      setInviteLink(invitation.url);
    }, 'Invitation link created. Share it with the invited teammate.');
    if (!result) return;
    setInviteEmail('');
    await refresh();
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess('Invitation link copied.');
    } catch {
      setError('Clipboard access was unavailable. Select and copy the invitation link.');
    }
  };

  const handleInviteDecision = async (accept) => {
    const result = await runAction(
      () => accept ? acceptWorkspaceInvitation(inviteToken) : declineWorkspaceInvitation(inviteToken),
      accept ? 'Invitation accepted. You have joined the workspace.' : 'Invitation declined.'
    );
    if (!result) return;
    setInviteToken('');
    sessionStorage.removeItem('planwise-pending-invite');
    window.history.replaceState({}, '', '/team');
    await refresh();
  };

  const handleMemberRole = async (member, role) => {
    const result = await runAction(
      () => updateWorkspaceMemberRole(member.id, role),
      'Member role updated.'
    );
    if (result) await refresh();
  };

  const handleRemoveMember = async (member) => {
    const name = member.profile?.full_name || member.profile?.email || 'this member';
    if (!window.confirm(`Remove ${name} from this workspace?`)) return;
    const result = await runAction(() => removeWorkspaceMember(member.id), 'Member removed.');
    if (result) await refresh();
  };

  const handleRevokeInvite = async (invitation) => {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    const result = await runAction(() => revokeWorkspaceInvitation(invitation.id), 'Invitation revoked.');
    if (result) await refresh();
  };

  const handleProjectMembers = async (project, event) => {
    const selectedMembers = Array.from(event.target.selectedOptions, (option) => option.value);
    const result = await runAction(
      () => syncProjectMembers(project.id, selectedMembers, session.user.id),
      `Members updated for ${project.name}.`
    );
    if (result) await refresh();
  };

  const handleProjectWorkspace = async (project, workspaceId) => {
    const result = await runAction(
      () => linkProjectToWorkspace(project.id, workspaceId),
      `Workspace link updated for ${project.name}.`
    );
    if (result) await refresh();
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} session={session} backgroundVariant="dashboard">
      <section className="team-page">
        <header className="team-page-heading">
          <div>
            <span className="panel-kicker">People and projects</span>
            <h1>Team workspace</h1>
            <p>Bring your projects and teammates together in one shared space.</p>
          </div>
          <Button type="button" variant="secondary" onClick={refresh} disabled={saving || loading}>Refresh</Button>
        </header>

        {error && <div className="team-feedback team-error" role="alert">{error}</div>}
        {success && <div className="team-feedback team-success" role="status">{success}</div>}
        {inviteToken && <section className="team-invitation-callout">
          <div><strong>You have a workspace invitation</strong><span>Accept to join the team, or decline this invitation.</span></div>
          <div className="team-inline-actions">
            <Button type="button" variant="primary" onClick={() => handleInviteDecision(true)} disabled={saving}>{saving ? 'Working…' : 'Accept invitation'}</Button>
            <Button type="button" variant="secondary" onClick={() => handleInviteDecision(false)} disabled={saving}>Decline</Button>
          </div>
        </section>}

        {loading ? <div className="team-loading" role="status">Loading workspaces…</div> : <>
          <section className="team-create-card">
            <div><h2>Create a workspace</h2><p>Workspace roles apply only to that workspace; they do not change a user&apos;s global account role.</p></div>
            <form onSubmit={handleCreateWorkspace}>
              <label className="sr-only" htmlFor="new-workspace-name">Workspace name</label>
              <input id="new-workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Product team" maxLength={100} required />
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Creating…' : 'Create workspace'}</Button>
            </form>
          </section>

          {!workspaces.length ? <section className="team-empty-state">
            <span aria-hidden="true">◎</span><h2>No workspaces yet</h2>
            <p>Create a workspace above, or open an invitation link to join an existing team.</p>
          </section> : <>
            <div className="team-workspace-picker">
              <label htmlFor="workspace-picker">Workspace</label>
              <select id="workspace-picker" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {currentMember && <span className={`team-role-chip role-${currentMember.role}`}>{currentMember.role}</span>}
            </div>

            {workspace && <>
              <section className="team-metric-grid" aria-label="Workspace overview">
                <article><span>Members</span><strong>{workspace.members.length}</strong></article>
                <article><span>Active tasks</span><strong>{workspace.tasks.filter((task) => !['completed', 'cancelled'].includes(task.status)).length}</strong></article>
                <article><span>Awaiting review</span><strong>{workspace.tasks.filter((task) => task.status === 'in_review').length}</strong></article>
                <article><span>Completed</span><strong>{workspace.tasks.filter((task) => task.status === 'completed').length}</strong></article>
                <article><span>Overdue</span><strong>{workspace.tasks.filter((task) => task.due_at && new Date(task.due_at) < new Date() && !['completed', 'cancelled'].includes(task.status)).length}</strong></article>
              </section>

              {canManage && <section className="team-panel">
                <div className="team-panel-heading"><div><h2>Invite a member</h2><p>Use a one-time invitation link. Email delivery can be connected through a server-side function when one is configured.</p></div></div>
                <form className="team-invite-form" onSubmit={handleInvite}>
                  <label>Email address<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" /></label>
                  <label>Workspace role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{roleOptions.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>
                  <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Creating link…' : 'Create invite link'}</Button>
                </form>
                {inviteLink && <div className="team-invite-link">
                  <label htmlFor="workspace-invite-link">Invitation link</label>
                  <div><input id="workspace-invite-link" readOnly value={inviteLink} onFocus={(event) => event.target.select()} /><Button type="button" variant="secondary" onClick={handleCopyLink}>Copy link</Button></div>
                </div>}
              </section>}

              <section className="team-panel">
                <div className="team-panel-heading"><div><h2>Members</h2><p>Member status and open task workload in this workspace.</p></div></div>
                <div className="team-member-list">
                  {workspace.members.map((member) => {
                    const personName = member.profile?.full_name || member.profile?.email || `Member ${member.user_id.slice(0, 8)}`;
                    return <article className="team-member-row" key={member.id}>
                      <Avatar initials={initialsFor(member.profile, personName)} />
                      <div className="team-member-identity"><strong>{personName}{member.user_id === session.user.id ? ' (you)' : ''}</strong><span>{member.profile?.email || member.user_id}</span></div>
                      <span className="team-member-workload">{member.workload} active task{member.workload === 1 ? '' : 's'}</span>
                      <span className="team-member-status">Active</span>
                      {canManage && member.role !== 'owner' ? <div className="team-member-actions">
                        <label className="sr-only" htmlFor={`member-role-${member.id}`}>Role for {personName}</label>
                        <select id={`member-role-${member.id}`} value={member.role} disabled={saving} onChange={(event) => handleMemberRole(member, event.target.value)}>
                          {roleOptions.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
                        </select>
                        <button type="button" className="team-remove-button" disabled={saving || member.user_id === session.user.id} onClick={() => handleRemoveMember(member)}>Remove</button>
                      </div> : <span className={`team-role-chip role-${member.role}`}>{member.role}</span>}
                    </article>;
                  })}
                  {!workspace.members.length && <div className="team-empty-inline">No members found for this workspace.</div>}
                </div>
              </section>

              <section className="team-panel">
                <div className="team-panel-heading"><div><h2>Invitations</h2><p>Track pending, accepted, declined, expired, and revoked invitations.</p></div></div>
                <div className="team-invitation-list">
                  {workspace.invitations.map((invitation) => {
                    const status = inviteStatus(invitation);
                    return <article className="team-invitation-row" key={invitation.id}>
                      <div><strong>{invitation.email}</strong><span>{invitation.role[0].toUpperCase() + invitation.role.slice(1)} · {new Date(invitation.created_at).toLocaleDateString()}</span></div>
                      <span className={`team-invite-status status-${status.toLowerCase()}`}>{status}</span>
                      {canManage && status === 'Pending' && <button type="button" className="team-remove-button" disabled={saving} onClick={() => handleRevokeInvite(invitation)}>Revoke</button>}
                    </article>;
                  })}
                  {!workspace.invitations.length && <div className="team-empty-inline">No invitations to show.</div>}
                </div>
              </section>

              <section className="team-panel">
                <div className="team-panel-heading"><div><h2>Projects</h2><p>Connect existing projects to this workspace and manage their direct project members.</p></div></div>
                <div className="team-project-list">
                  {projects.map((project) => <article className="team-project-row" key={project.id}>
                    <div className="team-project-title"><strong>{project.name}</strong><span>{project.status}</span></div>
                    <label>Workspace
                      <select value={project.workspaceId || ''} disabled={!canManage || saving} onChange={(event) => handleProjectWorkspace(project, event.target.value)}>
                        <option value="">No workspace</option>
                        {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                    {project.workspaceId === workspace.id && <label>Project members
                      <select multiple size="3" value={project.members || []} disabled={!canManage || saving} onChange={(event) => handleProjectMembers(project, event)}>
                        {workspace.members.map((member) => <option key={member.user_id} value={member.user_id}>
                          {member.profile?.full_name || member.profile?.email || member.user_id} ({member.role})
                        </option>)}
                      </select>
                      <small>Use Ctrl/Command to select multiple members. Workspace membership itself also grants project access.</small>
                    </label>}
                    <span className="team-project-count">{project.members?.length || 0} direct members</span>
                  </article>)}
                  {!projects.length && <div className="team-empty-inline">No accessible projects yet. Create one in Projects, then link it here.</div>}
                </div>
              </section>

              <section className="team-panel">
                <div className="team-panel-heading"><div><h2>Recent team activity</h2><p>Recent project and task changes visible to this workspace.</p></div></div>
                <div className="team-invitation-list">
                  {workspace.activity.slice(0, 12).map((entry) => <article className="team-invitation-row" key={entry.id}>
                    <div><strong>{entry.actor?.full_name || entry.actor?.email || 'A teammate'} {entry.action.replaceAll('_', ' ')}</strong><span>{entry.metadata?.title || entry.metadata?.name || entry.entity_type}</span></div>
                    <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                  </article>)}
                  {!workspace.activity.length && <div className="team-empty-inline">Team activity will appear here as people collaborate on projects and tasks.</div>}
                </div>
              </section>
            </>}
          </>}
        </>}
      </section>
    </DashboardLayout>
  );
}
