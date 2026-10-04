# Planwise AI foundation (Step 1)

The `ai-assistant` Supabase Edge Function authenticates with Supabase Auth and uses the caller's bearer token with the public/publishable key for all workspace reads. It does not use a service-role key and does not execute model-proposed database changes. Only the `personal_assistant` route is enabled; the other specialist agents are registered as disabled contracts.

## Local setup

1. Add a Gemini API key to `supabase/functions/.env`. This file is ignored by Git. Do not paste a real key into source files, Vite environment variables, or browser code.
2. Start the local Supabase stack and serve the function with the secret file explicitly loaded:

   ```powershell
   supabase start
   supabase functions serve ai-assistant --env-file supabase/functions/.env
   ```

3. Run the PlanWise Vite app with its normal Supabase URL and public anon/publishable key configuration, then sign in with a confirmed user and open the dashboard. Use **Ask AI** and submit a question.
4. To confirm auth enforcement, make a POST request to the local function without a user `Authorization: Bearer <access-token>` header; Supabase should reject it with 401. An authenticated request accepts exactly `{ "message": "What should I work on today?" }` and returns an `AgentResponse` JSON object.

## Deployment

Set the Gemini key as a Supabase Edge Function secret (never commit or deploy the local `.env`):

```powershell
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy ai-assistant
```

The browser calls the function through the authenticated Supabase client. The Edge Function builds context through RLS using that user's token; Gemini output is schema-validated before it is returned.
