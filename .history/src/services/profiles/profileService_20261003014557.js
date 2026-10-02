import { supabase } from '../../lib/supabaseClient.js';

const profileColumns = 'id,full_name,email,avatar_url,phone,location,job_title,organization,team,timezone,preferences,created_at,updated_at';

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function getProfile(userId) {
  requireClient();
  const { data, error } = await supabase.from('profiles')
    .select(profileColumns)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Your profile is not available yet. Sign out and sign in again, or contact your administrator.');
  return data;
}

export async function updateProfile(userId, values) {
  requireClient();
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
    .eq('id', userId)
    .select(profileColumns)
    .single();
  if (error) throw error;
  return data;
}