import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? '';
const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const encryptionSecret = Deno.env.get('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY') ?? '';
const callbackUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/google-calendar/callback`;
const requiredScope = 'https://www.googleapis.com/auth/calendar.events.owned';
const apiBase = 'https://www.googleapis.com/calendar/v3';

const admin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') ?? '';
  let configuredOrigin = '';
  try {
    configuredOrigin = appUrl ? new URL(appUrl).origin : '';
  } catch {
    configuredOrigin = '';
  }
  return {
    ...(origin && origin === configuredOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function redirect(request: Request, target: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders(request), Location: target, 'Cache-Control': 'no-store' } });
}

function appRedirect(result: 'connected' | 'error') {
  const url = new URL('/calendar', appUrl);
  url.searchParams.set('google', result);
  return url.toString();
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array) {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function encryptionKey() {
  const key = base64ToBytes(encryptionSecret);
  if (key.length !== 32) throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be base64-encoded 32-byte key material.');
  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoded);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string) {
  const [encodedIv, encodedPayload] = value.split('.');
  if (!encodedIv || !encodedPayload) throw new Error('Stored Google Calendar credentials are invalid.');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(encodedIv) },
    await encryptionKey(),
    base64ToBytes(encodedPayload)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function authenticate(request: Request) {
  if (!admin) throw new ApiError(503, 'Supabase server credentials are not configured.');
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new ApiError(401, 'Sign in to Planwise to use Google Calendar.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Your Planwise session is invalid or expired. Sign in again.');
  return data.user;
}

function isGoogleConfigured() {
  if (!admin || !clientId || !clientSecret || !appUrl || !encryptionSecret) return false;
  try {
    const parsedAppUrl = new URL(appUrl);
    const isHttpOrigin = parsedAppUrl.protocol === 'https:' || parsedAppUrl.protocol === 'http:';
    const isOriginOnly = parsedAppUrl.pathname === '/' && !parsedAppUrl.search && !parsedAppUrl.hash && !parsedAppUrl.username && !parsedAppUrl.password;
    return isHttpOrigin && isOriginOnly && base64ToBytes(encryptionSecret).length === 32;
  } catch {
    return false;
  }
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function loadConnection(userId: string) {
  if (!admin) throw new ApiError(503, 'Supabase server credentials are not configured.');
  const { data, error } = await admin.from('calendar_connections')
    .select('encrypted_tokens, calendar_id, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[google-calendar] Connection could not be loaded', { code: error.code });
    throw new ApiError(500, 'Could not load the Google Calendar connection.');
  }
  if (!data) throw new ApiError(409, 'Google Calendar is not connected to this Planwise account.');
  return data;
}

async function saveTokens(userId: string, tokens: Record<string, unknown>) {
  if (!admin) throw new ApiError(503, 'Supabase server credentials are not configured.');
  const { error } = await admin.from('calendar_connections').upsert({
    user_id: userId,
    encrypted_tokens: await encrypt(tokens),
    calendar_id: 'primary',
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) {
    console.error('[google-calendar] Encrypted connection could not be stored', { code: error.code });
    throw new ApiError(500, 'Could not securely save the Google Calendar connection.');
  }
}

async function accessToken(userId: string, connection: { encrypted_tokens: string }) {
  const tokens = await decrypt(connection.encrypted_tokens);
  if (tokens.expires_at && Date.now() < Date.parse(tokens.expires_at) - 60_000) return tokens.access_token as string;
  if (!tokens.refresh_token) throw new ApiError(401, 'Google Calendar authorization expired. Reconnect your Google account.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token as string,
      grant_type: 'refresh_token'
    })
  });
  const result = await response.json();
  if (!response.ok) {
    const message = result.error === 'invalid_grant'
      ? 'Google authorization expired or was revoked. Reconnect your Google account.'
      : 'Google could not refresh the Calendar authorization. Try again or reconnect your account.';
    throw new ApiError(401, message);
  }
  const refreshed = {
    ...tokens,
    access_token: result.access_token,
    expires_at: new Date(Date.now() + Number(result.expires_in || 3600) * 1000).toISOString()
  };
  await saveTokens(userId, refreshed);
  return refreshed.access_token as string;
}

async function googleRequest(userId: string, connection: { encrypted_tokens: string; calendar_id: string }, path: string, init: RequestInit = {}) {
  const token = await accessToken(userId, connection);
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers }
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    const message = typeof result.error?.message === 'string' ? result.error.message.slice(0, 240) : 'Google Calendar request failed.';
    throw new ApiError(response.status === 401 ? 401 : 502, message);
  }
  return result;
}

function oauthReady() {
  return Boolean(isGoogleConfigured() && Deno.env.get('GOOGLE_CLIENT_ID') && Deno.env.get('GOOGLE_CLIENT_SECRET'));
}

async function connect(request: Request, userId: string) {
  if (!oauthReady()) throw new ApiError(503, 'Google Calendar is not configured yet. Add the server-side Google OAuth and encryption environment variables first.');
  const state = crypto.randomUUID();
  const verifier = bytesToBase64(crypto.getRandomValues(new Uint8Array(48)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const challenge = bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const { error } = await admin!.from('google_calendar_oauth_states').insert({
    state_hash: await sha256(state),
    user_id: userId,
    code_verifier: verifier,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
  });
  if (error) {
    console.error('[google-calendar] OAuth state could not be stored', { code: error.code });
    throw new ApiError(500, 'Could not start Google authorization. Please try again.');
  }
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: requiredScope,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  return json(request, { authUrl: authUrl.toString() });
}

async function oauthCallback(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code');
  if (!oauthReady() || !state || !code || url.searchParams.has('error')) return redirect(request, appRedirect('error'));
  const stateHash = await sha256(state);
  const { data: storedState, error: stateError } = await admin!.from('google_calendar_oauth_states')
    .delete()
    .eq('state_hash', stateHash)
    .gt('expires_at', new Date().toISOString())
    .select('user_id, code_verifier')
    .maybeSingle();
  if (stateError || !storedState) {
    console.error('[google-calendar] OAuth state validation failed', { code: stateError?.code });
    return redirect(request, appRedirect('error'));
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
      code_verifier: storedState.code_verifier
    })
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token || !tokens.refresh_token) {
    console.error('[google-calendar] OAuth token exchange failed', {
      status: response.status,
      providerError: typeof tokens.error === 'string' ? tokens.error : undefined
    });
    return redirect(request, appRedirect('error'));
  }
  try {
    await saveTokens(storedState.user_id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
      scope: tokens.scope
    });
    return redirect(request, appRedirect('connected'));
  } catch (error) {
    console.error('[google-calendar] OAuth credentials could not be stored', {
      error: error instanceof Error ? error.name : 'UnknownError'
    });
    return redirect(request, appRedirect('error'));
  }
}

async function handleApi(request: Request, userId: string, pathname: string) {
  if (pathname.endsWith('/status') && request.method === 'GET') {
    if (!admin) return json(request, { configured: false, connected: false, lastSyncedAt: null });
    const { data, error } = await admin.from('calendar_connections').select('last_synced_at').eq('user_id', userId).maybeSingle();
    if (error) throw new ApiError(500, 'Could not check Google Calendar connection status.');
    return json(request, {
      configured: oauthReady(),
      connected: Boolean(data),
      lastSyncedAt: data?.last_synced_at || null
    });
  }

  if (pathname.endsWith('/connect') && request.method === 'POST') return connect(request, userId);
  if (pathname.endsWith('/disconnect') && request.method === 'POST') {
    const connection = await loadConnection(userId);
    const tokens = await decrypt(connection.encrypted_tokens);
    const revokeToken = tokens.refresh_token || tokens.access_token;
    if (revokeToken) {
      const response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: revokeToken as string })
      });
      if (!response.ok && response.status !== 400) throw new ApiError(502, 'Google could not revoke the connection. Please try again.');
    }
    const { error } = await admin!.from('calendar_connections').delete().eq('user_id', userId);
    if (error) throw new ApiError(500, 'Could not remove the Google Calendar connection.');
    return json(request, { disconnected: true });
  }

  const connection = await loadConnection(userId);
  if (pathname.endsWith('/events') && request.method === 'GET') {
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin');
    const timeMax = url.searchParams.get('timeMax');
    if (!timeMin || !timeMax || !Number.isFinite(Date.parse(timeMin)) || !Number.isFinite(Date.parse(timeMax)) || Date.parse(timeMax) <= Date.parse(timeMin)) {
      throw new ApiError(400, 'Choose a valid calendar date range before syncing.');
    }
    const items: unknown[] = [];
    let pageToken = '';
    let completed = false;
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '2500',
        ...(pageToken ? { pageToken } : {})
      });
      const result = await googleRequest(userId, connection, `/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params}`);
      items.push(...(result.items || []));
      pageToken = result.nextPageToken || '';
      if (!pageToken) {
        completed = true;
        break;
      }
    }
    if (!completed) throw new ApiError(502, 'Google returned too many events to sync at once. Choose a shorter calendar range and try again.');
    const { error } = await admin!.from('calendar_connections').update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) throw new ApiError(500, 'Events were read, but the sync status could not be saved.');
    return json(request, { items });
  }

  const eventMatch = pathname.match(/\/events\/([^/]+)$/);
  if (pathname.endsWith('/events') && request.method === 'POST') {
    const event = await request.json();
    if (!event.summary || !event.start || !event.end) throw new ApiError(400, 'Event title, start, and end are required.');
    const result = await googleRequest(userId, connection, `/calendars/${encodeURIComponent(connection.calendar_id)}/events?sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify(event)
    });
    return json(request, result, 201);
  }
  if (eventMatch && request.method === 'PATCH') {
    const event = await request.json();
    const result = await googleRequest(userId, connection, `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(decodeURIComponent(eventMatch[1]))}?sendUpdates=all`, {
      method: 'PATCH',
      body: JSON.stringify(event)
    });
    return json(request, result);
  }
  if (eventMatch && request.method === 'DELETE') {
    await googleRequest(userId, connection, `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(decodeURIComponent(eventMatch[1]))}?sendUpdates=all`, { method: 'DELETE' });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  throw new ApiError(404, 'Google Calendar endpoint not found.');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  const url = new URL(request.url);
  if (url.pathname.endsWith('/callback') && request.method === 'GET') {
    try {
      return await oauthCallback(request);
    } catch (error) {
      console.error('[google-calendar] OAuth callback failed unexpectedly', {
        error: error instanceof Error ? error.name : 'UnknownError'
      });
      return redirect(request, appRedirect('error'));
    }
  }
  try {
    const user = await authenticate(request);
    return await handleApi(request, user.id, url.pathname);
  } catch (error) {
    if (error instanceof ApiError) return json(request, { error: error.message }, error.status);
    console.error('[google-calendar] Request failed unexpectedly', {
      method: request.method,
      error: error instanceof Error ? error.name : 'UnknownError'
    });
    return json(request, { error: 'Google Calendar request failed unexpectedly. Please try again.' }, 500);
  }
});
