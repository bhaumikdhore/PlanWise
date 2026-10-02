import { useEffect, useState } from 'react';
import Avatar from '../../components/common/Avatar';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getProfile, updateProfile } from '../../services/profiles/profileService';

function Field({ label, value, onChange, disabled = false, placeholder = 'Optional' }) {
  return <label className="profile-field"><span>{label}</span><input value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} /></label>;
}

function Toggle({ label, checked, onChange }) {
  return <label className="profile-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} /><i /></label>;
}

export default function ProfilePage({ onNavigate, onLogout, session }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({ tasks: true, projects: true, meetings: true, deadlines: true, team: false, ai: false });
  const [theme, setTheme] = useState(localStorage.getItem('planwise-theme') === 'dark' ? 'Dark' : 'Light');
    
  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const row = await getProfile(session.user.id);
      const preferences = row.preferences || {};
      setProfile({
        fullName: row.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
        email: session.user.email || row.email || '',
        phone: row.phone || '',
        location: row.location || '',
        jobTitle: row.job_title || '',
        organization: row.organization || '',
        team: row.team || '',
        timezone: row.timezone || 'UTC',
        preferences,
        createdAt: row.created_at
      });
      if (preferences.theme) setTheme(preferences.theme);
      if (preferences.notifications) setNotifications((current) => ({ ...current, ...preferences.notifications }));
    } catch (loadError) {
      setError(loadError.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  };
    
  useEffect(() => { loadProfile(); }, [session.user.id]);
    
  const update = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const toggle = (key) => () => setNotifications((current) => ({ ...current, [key]: !current[key] }));
  const saveTheme = (value) => {
    setTheme(value);
    document.documentElement.dataset.theme = value === 'Dark' ? 'dark' : 'light';
    localStorage.setItem('planwise-theme', value === 'Dark' ? 'dark' : 'light');
  };
    
  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const row = await updateProfile(session.user.id, {
        full_name: profile.fullName.trim(),
        phone: profile.phone,
        location: profile.location,
        job_title: profile.jobTitle,
        organization: profile.organization,
        team: profile.team,
        timezone: profile.timezone,
        preferences: { ...profile.preferences, theme, notifications }
      });
      setProfile((current) => ({ ...current, fullName: row.full_name || '', preferences: row.preferences || {} }));
      setEditing(false);
      setSuccess('Profile changes saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };
    
  const initials = (profile?.fullName || profile?.email || 'U').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    
  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="profile">
      <section className="profile-page">
        <div className="profile-page-header">
          <div><button type="button" className="back-button" onClick={() => onNavigate('dashboard')}>← Back to Dashboard</button><h1>Profile</h1><p>Manage your personal information, workspace identity and account preferences.</p></div>
          <button type="button" className="profile-logout-button" onClick={onLogout}>Log Out</button>
        </div>
        {loading && <div role="status">Loading your profile…</div>}
        {!loading && error && <div role="alert"><span>{error}</span><button type="button" onClick={loadProfile}>Retry</button></div>}
        {success && <div role="status">{success}</div>}
        {!loading && !error && profile && <>
          <section className="profile-summary profile-card">
            <div className="profile-avatar-wrap"><Avatar initials={initials} active /><button type="button" className="text-btn small" disabled>Change Photo</button></div>
            <div className="profile-summary-copy"><h2>{profile.fullName || 'Your name'}</h2><p>{profile.jobTitle || 'Planwise member'}</p><span>{profile.email}</span><div className="profile-status"><i /> Active</div></div>
            <div className="profile-summary-meta"><span>Organization<strong>{profile.organization || 'Not set'}</strong></span><span>Team<strong>{profile.team || 'Not set'}</strong></span></div>
          </section>
          <div className="profile-grid">
            <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Account</span><h2>Personal Information</h2></div><button type="button" className="text-btn" onClick={() => { setEditing((value) => !value); setSuccess(''); }}>{editing ? 'Cancel' : 'Edit Profile'}</button></div><div className="profile-fields"><Field label="Full Name" value={profile.fullName} onChange={update('fullName')} disabled={!editing} /><Field label="Email" value={profile.email} disabled placeholder="Managed by Supabase Auth" /><Field label="Phone Number" value={profile.phone} onChange={update('phone')} disabled={!editing} /><Field label="Location" value={profile.location} onChange={update('location')} disabled={!editing} /></div></section>
            <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Work identity</span><h2>Professional Information</h2></div></div><div className="profile-fields"><Field label="Job Title" value={profile.jobTitle} onChange={update('jobTitle')} disabled={!editing} /><Field label="Organization" value={profile.organization} onChange={update('organization')} disabled={!editing} /><Field label="Team" value={profile.team} onChange={update('team')} disabled={!editing} /><Field label="Role" value="Managed by project membership" disabled /></div></section>
          </div>
          <div className="profile-grid">
            <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Workspace</span><h2>Planwise Workspace</h2></div></div><div className="workspace-stats"><span>Workspace<strong>Planwise</strong></span><span>Joined<strong>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Recently'}</strong></span></div></section>
            <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Account controls</span><h2>Preferences</h2></div></div><div className="preference-fields"><label className="profile-field"><span>Theme</span><select value={theme} onChange={(event) => saveTheme(event.target.value)}><option>Light</option><option>Dark</option><option>System</option></select></label><label className="profile-field"><span>Default Calendar View</span><select value={profile.preferences.defaultCalendarView || 'Month'} onChange={(event) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, defaultCalendarView: event.target.value } }))}><option>Month</option><option>Week</option><option>Day</option></select></label><label className="profile-field"><span>Language</span><select value={profile.preferences.language || 'English'} onChange={(event) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, language: event.target.value } }))}><option>English</option></select></label><label className="profile-field"><span>Time Zone</span><select value={profile.timezone} onChange={update('timezone')}><option>UTC</option><option>Asia/Kolkata</option><option>America/New_York</option></select></label></div></section>
          </div>
          <section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Alerts</span><h2>Notification Preferences</h2></div></div><div className="notification-grid"><Toggle label="Task assignments" checked={notifications.tasks} onChange={toggle('tasks')} /><Toggle label="Project updates" checked={notifications.projects} onChange={toggle('projects')} /><Toggle label="Meeting reminders" checked={notifications.meetings} onChange={toggle('meetings')} /><Toggle label="Deadline alerts" checked={notifications.deadlines} onChange={toggle('deadlines')} /><Toggle label="Team activity" checked={notifications.team} onChange={toggle('team')} /><Toggle label="AI insights" checked={notifications.ai} onChange={toggle('ai')} /></div><button type="button" className="primary-inline-button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button></section>
          <div className="profile-grid"><section className="profile-card"><div className="profile-card-heading"><div><span className="panel-kicker">Protection</span><h2>Security</h2></div></div><div className="security-row"><span>Password<strong>Managed by Supabase Auth</strong></span><button type="button" className="text-btn" disabled>Change Password</button></div><div className="security-row"><span>Two-factor authentication<strong>Not configured</strong></span><button type="button" className="text-btn" disabled>Set Up</button></div></section><section className="profile-card account-actions"><div className="profile-card-heading"><div><span className="panel-kicker">Session</span><h2>Account Actions</h2></div></div><p>End your current Planwise session.</p><button type="button" className="profile-logout-button" onClick={onLogout}>Log Out</button></section></div>
        </>}
      </section>
    </DashboardLayout>
  );
}
