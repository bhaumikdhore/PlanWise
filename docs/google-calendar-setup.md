# Google Calendar integration setup

Google Calendar OAuth is handled by the `google-calendar` Supabase Edge Function. Google client secrets, access tokens, and refresh tokens are never sent to or stored in the browser. The function stores encrypted OAuth tokens in Supabase; the encryption key must remain stable and backed up so existing connections can be read.

## Configure Google Cloud

1. Create or select a Google Cloud project and enable the **Google Calendar API**.
2. Configure the OAuth consent screen and add the users who can test the integration.
3. Create an OAuth 2.0 **Web application** client. Do not put its client secret in a `VITE_` variable.
4. Add this exact authorized redirect URI:

   ```text
   https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/google-calendar/callback
   ```

The integration requests only `https://www.googleapis.com/auth/calendar.events.owned` for event access to calendars owned by the authorizing user. It does not request access to Google contacts, email, or calendar settings.

## Configure Planwise and deploy

Apply the database migration and deploy the function from the application directory:

```powershell
npx supabase login
npx supabase link --project-ref <SUPABASE_PROJECT_REF>
npx supabase db push
npx supabase functions deploy google-calendar --no-verify-jwt
```

The callback is public so Google can reach it. The function verifies the single-use OAuth state and PKCE verifier, and encrypts Google tokens before storing them server-side. All API endpoints require the signed-in user's Supabase access token; the service-role key and Google client secret remain Edge Function secrets and must never be added to frontend configuration.

Create a 32-byte encryption key (keep the output private) and set the function secrets. `APP_URL` must be the exact Planwise frontend origin with no path; CORS permits browser requests only from this origin. When developing locally, set it to the local Vite origin (for example, `http://localhost:5173`) and set it back to the production origin for production. `GOOGLE_CLIENT_ID` is not a secret, but is configured server-side here to keep all integration settings together.

```powershell
$key = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx supabase secrets set GOOGLE_CLIENT_ID="<GOOGLE_OAUTH_CLIENT_ID>" GOOGLE_CLIENT_SECRET="<GOOGLE_OAUTH_CLIENT_SECRET>" GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY="$key" APP_URL="https://<PLANWISE_APP_ORIGIN>"
```

The normal Vite client configuration must also include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`). Configure the Supabase project URL and public client key in the frontend hosting environment; never expose `SUPABASE_SERVICE_ROLE_KEY` or Google OAuth secrets there.

For local development, set the function secrets to the local Vite origin and add that origin to the Google OAuth client's authorized JavaScript origins if required by the OAuth configuration. Keep production and development OAuth redirect URIs aligned with the function URL above.

## Sync behavior

- `Sync now` imports Google events for the currently displayed date range. Google event IDs are used to upsert imported events; cancelled or removed events in that range are removed from the local import. Events already imported in other date ranges remain intact.
- Events created in Planwise are local unless **Also create this event in Google Calendar** is selected. Google-origin events can be edited, moved, and deleted in both calendars while the connection is active. Guest changes use Google Calendar's `sendUpdates=all`.
- Planwise events and imported Google events are stored in the browser's local calendar cache; that cache contains event data only, never OAuth credentials. For shared or cross-device Planwise calendar storage, move calendar-event persistence to an authenticated database table.
- Disconnect revokes the Google token and removes the encrypted server-side credentials. Google event copies that were previously imported remain in the local calendar cache.
