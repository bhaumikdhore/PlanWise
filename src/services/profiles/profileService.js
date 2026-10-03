import { supabase } from '../../lib/supabaseClient.js';

const profileColumns = 'id,full_name,email,avatar_url,phone,location,job_title,organization,team,timezone,preferences,created_at,updated_at';

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function getProfile() {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to load your profile.');

  const { data, error } = await supabase.from('profiles')
    .select(profileColumns)
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Your profile is not available yet. Sign out and sign in again, or contact your administrator.');
  return { ...data, email: user.email || data.email || '' };
}

export async function updateProfile(values) {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to update your profile.');

  const payload = {
    full_name: values.full_name,
    phone: values.phone,
    location: values.location,
    job_title: values.job_title,
    organization: values.organization,
    team: values.team,
    timezone: values.timezone,
    preferences: values.preferences
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const { data, error } = await supabase.from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select(profileColumns)
    .single();
  if (error) throw error;
  const updatedProfile = { ...data, email: user.email || data.email || '' };
  window.dispatchEvent(new CustomEvent('planwise-profile-updated', { detail: updatedProfile }));
  return updatedProfile;
}

export function isProfileComplete(profile) {
  return Boolean(
    profile?.full_name?.trim()
    && profile?.job_title?.trim()
    && profile?.organization?.trim()
  );
}