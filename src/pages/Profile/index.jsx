import { useEffect, useState } from 'react';
import Avatar from '../../components/common/Avatar';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  getProfile,
  getProfileWorkspaces,
  updateProfile,
  uploadProfileAvatar
} from '../../services/profiles/profileService';
import { applyThemePreference } from '../../services/preferences/themeService';

const notificationOptions = [
  ['tasks', 'Task assignments'],
  ['projects', 'Project updates'],
  ['meetings', 'Meeting reminders'],
  ['deadlines', 'Deadline alerts'],
  ['team', 'Team activity'],
  ['ai', 'AI insights']
];

function profileFromRow(row) {
  return {
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    dateOfBirth: row.date_of_birth || '',
    avatarUrl: row.avatar_url || '',
    avatarPath: row.avatar_path || '',
    location: row.location || '',
    bio: row.bio || '',
    jobTitle: row.job_title || '',
    organization: row.organization || '',
    department: row.department || '',
    team: row.team || '',
    skills: (row.skills || []).join(', '),
    experienceYears: row.experience_years ?? '',
    timezone: row.timezone || 'UTC',
    preferences: row.preferences || {},
    workPreferences: row.work_preferences || {},
    createdAt: row.created_at
  };
}

function Field({ label, value, onChange, disabled, placeholder = 'Optional', type = 'text', required = false, maxLength }) {
  return <label className="profile-field">
    <span>{label}{required ? ' *' : ''}</span>
    <input type={type} value={value ?? ''} onChange={onChange} disabled={disabled} placeholder={placeholder} required={required} maxLength={maxLength} />
  </label>;
}

function TextAreaField({ label, value, onChange, disabled, placeholder, maxLength = 2000, rows = 4 }) {
  return <label className="profile-field profile-field-wide">
    <span>{label}</span>
    <textarea value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder} maxLength={maxLength} rows={rows} />
  </label>;
}

function Toggle({ label, checked, onChange, disabled }) {
  return <label className={`profile-toggle${disabled ? ' is-disabled' : ''}`}>
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
    <i aria-hidden="true" />
  </label>;
}

function getTimeZones() {
  if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  return ['UTC', 'America/Los_Angeles', 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo', 'Europe/London'];
}

export default function ProfilePage({ onNavigate, onLogout, session }) {
  const [profile, setProfile] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [editing, setEditing] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!pendingPhoto) {
      setPhotoPreview('');
      return undefined;
    }
    const preview = URL.createObjectURL(pendingPhoto);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [pendingPhoto]);

  const loadProfile = async (isActive = () => true) => {
    setLoading(true);
    setLoadError('');
    try {
      const [row, memberships] = await Promise.all([getProfile(), getProfileWorkspaces()]);
      if (!isActive()) return;
      const loadedProfile = profileFromRow(row);
      setProfile(loadedProfile);
      setSavedProfile(loadedProfile);
      setWorkspaces(memberships);
      applyThemePreference(loadedProfile.preferences.theme, session.user.id, { persist: true });
    } catch (error) {
      if (isActive()) setLoadError(error.message || 'Could not load your profile.');
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadProfile(() => active);
    return () => { active = false; };
  }, [session.user.id]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setProfile((current) => ({ ...current, [key]: value }));
  };
  const updatePreference = (key) => (event) => {
    const value = event.target.value;
    setProfile((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value }
    }));
    if (key === 'theme') applyThemePreference(value, session.user.id);
  };
  const updateWorkPreference = (key) => (event) => {
    const value = event.target.value;
    setProfile((current) => ({
      ...current,
      workPreferences: { ...current.workPreferences, [key]: value }
    }));
  };
  const toggleNotification = (key) => (event) => {
    const checked = event.target.checked;
    setProfile((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        notifications: { ...current.preferences.notifications, [key]: checked }
      }
    }));
  };

  const beginEditing = () => {
    setSaveError('');
    setSuccess('');
    setEditing(true);
  };
  const cancelEditing = () => {
    setProfile(savedProfile);
    setPendingPhoto(null);
    applyThemePreference(savedProfile.preferences.theme, session.user.id);
    setSaveError('');
    setEditing(false);
  };
  const save = async (event) => {
    event.preventDefault();
    setSaveError('');
    setSuccess('');
    if (!profile.fullName.trim()) {
      setSaveError('Enter your full name.');
      return;
    }

    setSaving(true);
    try {
      let avatarPath = profile.avatarPath;
      let avatarUrl = profile.avatarUrl;
      if (pendingPhoto) {
        const uploadedPhoto = await uploadProfileAvatar(pendingPhoto);
        avatarPath = uploadedPhoto.path;
        avatarUrl = uploadedPhoto.url;
      }
      const row = await updateProfile({
        full_name: profile.fullName,
        phone: profile.phone,
        location: profile.location,
        date_of_birth: profile.dateOfBirth,
        bio: profile.bio,
        job_title: profile.jobTitle,
        organization: profile.organization,
        department: profile.department,
        team: profile.team,
        skills: profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        experience_years: profile.experienceYears,
        timezone: profile.timezone,
        avatar_url: avatarPath,
        preferences: profile.preferences,
        work_preferences: profile.workPreferences
      });
      const updatedProfile = {
        ...profile,
        ...profileFromRow(row),
        avatarUrl: avatarUrl || row.avatar_url,
        avatarPath: row.avatar_path || avatarPath
      };
      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);
      setPendingPhoto(null);
      setEditing(false);
      setSuccess('Profile changes saved.');
    } catch (error) {
      setSaveError(error.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = photoPreview || profile?.avatarUrl || '';
  const initials = (profile?.fullName || profile?.email || 'U')
    .split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const timeZones = getTimeZones();
  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Recently';

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} session={session} backgroundVariant="profile">
      <section className="profile-page">
        <header className="profile-page-header">
          <div><button type="button" className="back-button" onClick={() => onNavigate('dashboard')}>← Back to Dashboard</button><h1>Profile & Settings</h1><p>Manage your personal information, work identity and account preferences.</p></div>
          <div className="profile-page-actions">
            {editing ? <>
              <button type="button" className="text-btn" onClick={cancelEditing} disabled={saving}>Cancel</button>
              <button type="submit" form="profile-settings-form" className="primary-inline-button" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </> : <button type="button" className="primary-inline-button" onClick={beginEditing} disabled={loading || Boolean(loadError)}>Edit Profile</button>}
          </div>
        </header>
        {loading && <div className="profile-notice" role="status">Loading your profile and workspace settings…</div>}
        {!loading && loadError && <div className="profile-notice profile-notice-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => loadProfile()}>Retry</button></div>}
        {saveError && <div className="profile-notice profile-notice-error" role="alert">{saveError}</div>}
        {success && <div className="profile-notice profile-notice-success" role="status">{success}</div>}
        {!loading && !loadError && profile && <form id="profile-settings-form" onSubmit={save} className="profile-settings-form">
          <section className="profile-summary profile-card">
            <div className="profile-avatar-wrap">
              <Avatar initials={initials} src={photoUrl} alt={`${profile.fullName || 'Your'} profile photo`} active />
              <label className={`profile-photo-picker${!editing ? ' is-disabled' : ''}`}>
                {pendingPhoto ? 'Change Photo' : 'Profile Photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!editing || saving} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setSaveError('');
                    setPendingPhoto(file);
                  }
                  event.target.value = '';
                }} aria-label="Choose profile photo" />
              </label>
              {editing && <small>JPG, PNG or WebP · max 5 MB</small>}
            </div>
            <div className="profile-summary-copy"><h2>{profile.fullName || 'Your name'}</h2><p>{profile.jobTitle || 'Planwise member'}</p><span>{profile.email}</span><div className="profile-status"><i /> Active</div></div>
            <div className="profile-summary-meta"><span>Organization<strong>{profile.organization || 'Not set'}</strong></span><span>Team<strong>{profile.team || 'Not set'}</strong></span></div>
          </section>

          <div className="profile-grid">
            <section className="profile-card">
              <div className="profile-card-heading"><div><span className="panel-kicker">Account</span><h2>Personal Information</h2></div></div>
              <div className="profile-fields">
                <Field label="Full Name" value={profile.fullName} onChange={update('fullName')} disabled={!editing || saving} required maxLength={120} />
                <Field label="Email" value={profile.email} disabled placeholder="Managed by Supabase Auth" />
                <Field label="Phone Number" value={profile.phone} onChange={update('phone')} disabled={!editing || saving} type="tel" maxLength={40} />
                <Field label="Date of Birth" value={profile.dateOfBirth} onChange={update('dateOfBirth')} disabled={!editing || saving} type="date" />
                <Field label="Location" value={profile.location} onChange={update('location')} disabled={!editing || saving} maxLength={160} />
                <TextAreaField label="Bio" value={profile.bio} onChange={update('bio')} disabled={!editing || saving} placeholder="A little about you…" />
              </div>
            </section>

            <section className="profile-card">
              <div className="profile-card-heading"><div><span className="panel-kicker">Work identity</span><h2>Professional Information</h2></div></div>
              <div className="profile-fields">
                <Field label="Job Title" value={profile.jobTitle} onChange={update('jobTitle')} disabled={!editing || saving} maxLength={120} />
                <Field label="Company" value={profile.organization} onChange={update('organization')} disabled={!editing || saving} maxLength={160} />
                <Field label="Department" value={profile.department} onChange={update('department')} disabled={!editing || saving} maxLength={120} />
                <Field label="Team" value={profile.team} onChange={update('team')} disabled={!editing || saving} maxLength={120} />
                <Field label="Experience (years)" value={profile.experienceYears} onChange={update('experienceYears')} disabled={!editing || saving} type="number" placeholder="e.g. 5" />
                <Field label="Skills" value={profile.skills} onChange={update('skills')} disabled={!editing || saving} placeholder="Design, planning, research" maxLength={2000} />
                <TextAreaField label="Work Preferences" value={profile.workPreferences.notes || ''} onChange={updateWorkPreference('notes')} disabled={!editing || saving} placeholder="Describe the working arrangements that suit you." />
              </div>
            </section>
          </div>

          <div className="profile-grid">
            <section className="profile-card">
              <div className="profile-card-heading"><div><span className="panel-kicker">Workspace</span><h2>Your Workspaces</h2></div></div>
              {workspaces.length ? <div className="workspace-membership-list">{workspaces.map((workspace) => <div className="workspace-membership" key={workspace.id}>
                <span><strong>{workspace.name}</strong><small>Joined {new Date(workspace.joinedAt).toLocaleDateString()}</small></span>
                <span className="workspace-role-badge">{workspace.role}</span>
              </div>)}</div> : <p className="profile-muted">You haven’t joined a workspace yet.</p>}
              <div className="workspace-stats profile-joined"><span>PlanWise member since<strong>{joinedDate}</strong></span></div>
            </section>

            <section className="profile-card">
              <div className="profile-card-heading"><div><span className="panel-kicker">Account controls</span><h2>Preferences</h2></div></div>
              <div className="preference-fields">
                <label className="profile-field"><span>Theme</span><select value={profile.preferences.theme || 'system'} onChange={updatePreference('theme')} disabled={!editing || saving}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
                <label className="profile-field"><span>Default Calendar View</span><select value={profile.preferences.defaultCalendarView || 'Month'} onChange={updatePreference('defaultCalendarView')} disabled={!editing || saving}><option>Month</option><option>Week</option><option>Day</option></select></label>
                <Field label="Language" value={profile.preferences.language || 'English'} onChange={updatePreference('language')} disabled={!editing || saving} maxLength={40} />
                <label className="profile-field"><span>Time Zone</span><select value={profile.timezone} onChange={update('timezone')} disabled={!editing || saving}>{!timeZones.includes(profile.timezone) && <option value={profile.timezone}>{profile.timezone}</option>}{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
                <label className="profile-field"><span>Work style</span><select value={profile.workPreferences.workStyle || ''} onChange={updateWorkPreference('workStyle')} disabled={!editing || saving}><option value="">Choose preference</option><option>Remote</option><option>Hybrid</option><option>On-site</option><option>Flexible</option></select></label>
                <Field label="Working hours" value={profile.workPreferences.workingHours || ''} onChange={updateWorkPreference('workingHours')} disabled={!editing || saving} placeholder="e.g. 9:00 AM–5:00 PM" maxLength={80} />
              </div>
            </section>
          </div>

          <section className="profile-card notification-preferences-card">
            <div className="profile-card-heading"><div><span className="panel-kicker">Alerts</span><h2>Notification Preferences</h2><p className="profile-muted">Choose which activity you want PlanWise to notify you about.</p></div></div>
            <div className="notification-grid">{notificationOptions.map(([key, label]) => <Toggle key={key} label={label} checked={Boolean(profile.preferences.notifications?.[key])} onChange={toggleNotification(key)} disabled={!editing || saving} />)}</div>
          </section>
        </form>}
      </section>
    </DashboardLayout>
  );
}
