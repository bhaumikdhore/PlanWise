import { supabase } from '../../lib/supabaseClient.js';

const functionUrl = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar`
  : '';

export const hasCalendarBackend = Boolean(functionUrl && supabase);

async function requestCalendarBackend(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      const detail = error.message ? ` (${error.message})` : '';
      throw new Error(`The request to ${url} from ${window.location.origin} failed before the Google Calendar service returned a response${detail}. Check the Edge Function deployment, network access, and that APP_URL exactly matches this site's origin.`);
    }
    throw new Error('Could not send the Google Calendar request. Please try again.');
  }
}

export async function googleCalendarRequest(path, { method = 'GET', body } = {}) {
  if (!hasCalendarBackend) {
    throw new Error('Configure VITE_SUPABASE_URL and deploy the Google Calendar Edge Function before connecting Google Calendar.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not verify your Planwise session: ${error.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your Planwise session has expired. Sign in again to continue.');

  const response = await requestCalendarBackend(`${functionUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Google Calendar request failed (${response.status}).`);
  return result;
}
