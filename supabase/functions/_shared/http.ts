import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGEM = Deno.env.get('SITE_URL') ? new URL(Deno.env.get('SITE_URL')!).origin : '*';
export const cors = {
  'Access-Control-Allow-Origin': ORIGEM,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const admin = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Usuário dono do token enviado pelo app, ou null. */
export async function usuarioDa(req: Request): Promise<User | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

export async function eAssinante(db: SupabaseClient, uid: string): Promise<boolean> {
  const { data } = await db.from('assinaturas').select('valido_ate').eq('user_id', uid).maybeSingle();
  return !!(data?.valido_ate && new Date(data.valido_ate) > new Date());
}
