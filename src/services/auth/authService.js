import { supabase } from '../../lib/supabaseClient';

export async function signInWithGoogle() {
  if (!supabase) return { error: new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.') };

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` }
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}