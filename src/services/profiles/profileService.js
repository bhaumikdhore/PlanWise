import { supabase } from '../../lib/supabaseClient.js';
import { applyThemePreference } from '../preferences/themeService.js';

const avatarBucket = 'profile-avatars';
const preferenceDefaults = {
  theme: 'system',
  language: 'English',
  defaultCalendarView: 'Month',
  notifications: {
    tasks: true,
    projects: true,
    meetings: true,
    deadlines: true,
    team: false,
    ai: false
  }
};

async function withSignedAvatar(profile) {
  const avatarPath = profile.avatar_url || '';
  if (!avatarPath || /^https?:\/\//i.test(avatarPath)) {
    return { ...profile, avatar_path: avatarPath, avatar_url: avatarPath };
  }
  const { data, error } = await supabase.storage.from(avatarBucket).createSignedUrl(avatarPath, 60 * 60);
  if (error) throw error;
  return { ...profile, avatar_path: avatarPath, avatar_url: data.signedUrl };
}

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function getProfile() {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to load your profile.');

  const { data, error } = await supabase.rpc('get_my_profile_settings');
  if (error) throw error;
  if (!data) throw new Error('Your profile is not available yet. Sign out and sign in again, or contact your administrator.');
  const preferences = {
    ...preferenceDefaults,
    ...(data.preferences || {}),
    theme: ['light', 'dark', 'system'].includes(String(data.preferences?.theme || '').toLowerCase())
      ? String(data.preferences.theme).toLowerCase()
      : preferenceDefaults.theme,
    notifications: {
      ...preferenceDefaults.notifications,
      ...(data.preferences?.notifications || {})
    }
  };
  const profile = await withSignedAvatar({ ...data, preferences, email: user.email || data.email || '' });
  return profile;
}

export async function updateProfile(values) {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to update your profile.');

  const payload = {
    full_name: String(values.full_name || '').trim(),
    phone: String(values.phone || '').trim(),
    location: String(values.location || '').trim(),
    job_title: String(values.job_title || '').trim(),
    organization: String(values.organization || '').trim(),
    team: String(values.team || '').trim(),
    timezone: String(values.timezone || 'UTC').trim(),
    preferences: values.preferences,
    avatar_url: values.avatar_url,
    date_of_birth: values.date_of_birth || null,
    bio: String(values.bio || '').trim(),
    department: String(values.department || '').trim(),
    skills: values.skills || [],
    experience_years: values.experience_years === '' || values.experience_years === null
      ? null
      : Number(values.experience_years),
    work_preferences: values.work_preferences || {}
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  if (!payload.full_name) throw new Error('Enter your full name.');
  if (payload.full_name.length > 120 || payload.phone.length > 40 || payload.location.length > 160
    || payload.job_title.length > 120 || payload.organization.length > 160
    || payload.team.length > 120 || payload.department.length > 120 || payload.bio.length > 2000) {
    throw new Error('One or more profile fields exceed the allowed length.');
  }
  if (payload.experience_years !== null && (!Number.isInteger(payload.experience_years) || payload.experience_years < 0 || payload.experience_years > 80)) {
    throw new Error('Experience must be a whole number between 0 and 80.');
  }
  if (!Array.isArray(payload.skills) || payload.skills.length > 30
    || payload.skills.some((skill) => typeof skill !== 'string' || skill.trim().length > 60)) {
    throw new Error('Enter up to 30 skills, each no longer than 60 characters.');
  }
  if (payload.date_of_birth && (Number.isNaN(Date.parse(payload.date_of_birth)) || payload.date_of_birth > new Date().toISOString().slice(0, 10))) {
    throw new Error('Enter a valid date of birth that is not in the future.');
  }
  if (!payload.preferences || typeof payload.preferences !== 'object' || Array.isArray(payload.preferences)) {
    throw new Error('Profile preferences must be a valid object.');
  }
  if (!payload.work_preferences || typeof payload.work_preferences !== 'object' || Array.isArray(payload.work_preferences)) {
    throw new Error('Work preferences must be a valid object.');
  }
  const { error } = await supabase.from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('id')
    .single();
  if (error) throw error;
  const updatedProfile = await getProfile();
  if (updatedProfile.preferences?.theme) {
    applyThemePreference(updatedProfile.preferences.theme, user.id, { persist: true });
  }
  window.dispatchEvent(new CustomEvent('planwise-profile-updated', { detail: updatedProfile }));
  return updatedProfile;
}

export async function updateProfilePreferences(preferenceUpdates) {
  const current = await getProfile();
  return updateProfile({
    full_name: current.full_name,
    phone: current.phone,
    location: current.location,
    job_title: current.job_title,
    organization: current.organization,
    team: current.team,
    timezone: current.timezone,
    avatar_url: current.avatar_path,
    date_of_birth: current.date_of_birth,
    bio: current.bio,
    department: current.department,
    skills: current.skills,
    experience_years: current.experience_years,
    work_preferences: current.work_preferences,
    preferences: { ...current.preferences, ...preferenceUpdates }
  });
}

export async function getProfileWorkspaces() {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to load your workspaces.');

  const { data, error } = await supabase.from('workspace_members')
    .select('role,created_at,workspace:workspaces(id,name,created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.filter((membership) => membership.workspace).map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    role: membership.role,
    joinedAt: membership.created_at
  }));
}

export async function uploadProfileAvatar(file) {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to upload a profile photo.');
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file?.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photos must be 5 MB or smaller.');

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(avatarBucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(avatarBucket)
    .createSignedUrl(path, 60 * 60);
  if (signedUrlError) throw signedUrlError;
  return { path, url: signedUrl.signedUrl };
}

export function isProfileComplete(profile) {
  return Boolean(
    profile?.full_name?.trim()
    && profile?.job_title?.trim()
    && profile?.organization?.trim()
  );
}