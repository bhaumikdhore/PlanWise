import { useState } from 'react';
import Avatar from '../../components/common/Avatar';
import DashboardLayout from '../../layouts/DashboardLayout';
import { projectList, teamMembers, userProfile } from '../../data/mock/dashboardData';

const initialProfile = {
  name: userProfile.name,
  email: 'bhaumik@example.com',
  phone: '',
  location: '',
  jobTitle: userProfile.role,
  organization: 'Planwise',
  team: 'Project Management',
  role: userProfile.role
};

function Field({ label, value, onChange, disabled = false, placeholder = 'Optional' }) {
  return <label className="profile-field"><span>{label}</span><input value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} /></label>;
}

function Toggle({ label, checked, onChange }) {
  return <label className="profile-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} /><i /></label>;
}

export default function ProfilePage({ onNavigate, onLogout }) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('planwise-theme') === 'dark' ? 'Dark' : 'Light');
  const [notifications, setNotifications] = useState({ tasks: true, projects: true, meetings: true, deadlines: true, team: false, ai: false });

  const update = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const toggle = (key) => () => setNotifications((current) => ({ ...current, [key]: !current[key] }));
  const saveTheme = (value) => {
    setTheme(value);
    document.documentElement.dataset.theme = value === 'Dark' ? 'dark' : 'light';
    localStorage.setItem('planwise-theme', value === 'Dark' ? 'dark' : 'light');
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="profile">
      <section className="profile-page">
        <div className="profile-page-header">
          <div><button type="button" className="back-button" onClick={() => onNavigate('dashboard')}>← Back to Dashboard</button><h1>Profile</h1><p>Manage your personal information, workspace identity and account preferences.</p></div>
          <button type="button" className="profile-logout-button" onClick={onLogout}>Log Out</button>
        </div>

        <section className="profile-summary profile-card">
          <div className="profile-avatar-wrap"><Avatar initials={userProfile.initials} active /><button type="button" className="text-btn small">Change Photo</button></div>
          <div className="profile-summary-copy"><h2>{profile.name}</h2><p>{profile.jobTitle}</p><span>{profile.email}</span><div className="profile-status"><i /> Active</div></div>
          <div className="profile-summary-meta"><span>Organization<strong>{profile.organization}</strong></span><span>Team<strong>{profile.team}</strong></span></div>
        </section>

        <div className="profile-grid">
          <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Account</span><h2>Personal Information</h2></div><button type="button" className="text-btn" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel' : 'Edit Profile'}</button></div><div className="profile-fields"><Field label="Full Name" value={profile.name} onChange={update('name')} disabled={!editing} /><Field label="Email" value={profile.email} onChange={update('email')} disabled={!editing} /><Field label="Phone Number" value={profile.phone} onChange={update('phone')} disabled={!editing} /><Field label="Location" value={profile.location} onChange={update('location')} disabled={!editing} /></div>{editing && <button type="button" className="primary-inline-button" onClick={() => setEditing(false)}>Save Changes</button>}</section>
          <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Work identity</span><h2>Professional Information</h2></div></div><div className="profile-fields"><Field label="Job Title" value={profile.jobTitle} onChange={update('jobTitle')} /><Field label="Organization" value={profile.organization} onChange={update('organization')} /><Field label="Team" value={profile.team} onChange={update('team')} /><label className="profile-field"><span>Role</span><select value={profile.role} onChange={update('role')}><option>Project Manager</option><option>Team Member</option><option>Administrator</option></select></label></div></section>
        </div>

        <div className="profile-grid">
          <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Workspace</span><h2>Planwise Workspace</h2></div></div><div className="workspace-stats"><span>Workspace<strong>Planwise</strong></span><span>Workspace Role<strong>{profile.role}</strong></span><span>Joined<strong>August 2026</strong></span><span>Active Projects<strong>{projectList.length}</strong></span><span>Team Members<strong>{teamMembers.length}</strong></span></div></section>
          <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Account controls</span><h2>Preferences</h2></div></div><div className="preference-fields"><label className="profile-field"><span>Theme</span><select value={theme} onChange={(event) => saveTheme(event.target.value)}><option>Light</option><option>Dark</option><option>System</option></select></label><label className="profile-field"><span>Default Calendar View</span><select defaultValue="Month"><option>Month</option><option>Week</option><option>Day</option></select></label><label className="profile-field"><span>Language</span><select defaultValue="English"><option>English</option></select></label><label className="profile-field"><span>Time Zone</span><select defaultValue="IST / UTC+5:30"><option>Detect automatically</option><option>IST / UTC+5:30</option><option>UTC</option></select></label></div></section>
        </div>

        <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Alerts</span><h2>Notification Preferences</h2></div></div><div className="notification-grid"><Toggle label="Task assignments" checked={notifications.tasks} onChange={toggle('tasks')} /><Toggle label="Project updates" checked={notifications.projects} onChange={toggle('projects')} /><Toggle label="Meeting reminders" checked={notifications.meetings} onChange={toggle('meetings')} /><Toggle label="Deadline alerts" checked={notifications.deadlines} onChange={toggle('deadlines')} /><Toggle label="Team activity" checked={notifications.team} onChange={toggle('team')} /><Toggle label="AI insights" checked={notifications.ai} onChange={toggle('ai')} /></div></section>

        <div className="profile-grid"><section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Protection</span><h2>Security</h2></div></div><div className="security-row"><span>Password<strong>••••••••••••</strong></span><button type="button" className="text-btn">Change Password</button></div><div className="security-row"><span>Two-factor authentication<strong>Not configured</strong></span><button type="button" className="text-btn">Set Up</button></div></section><section className="profile-card account-actions"><div className="profile-card-heading"><div><span className="panel-kicker">Session</span><h2>Account Actions</h2></div></div><p>End your current Planwise session.</p><button type="button" className="profile-logout-button" onClick={onLogout}>Log Out</button></section></div>
      </section>
    </DashboardLayout>
  );
}
