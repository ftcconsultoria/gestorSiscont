// Supabase client (ESM) centralizado
// ATENÇÃO: nunca use service_role no front-end. Use apenas a ANON KEY com RLS ativo.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL pública do seu projeto (não é segredo)
const SUPABASE_URL = 'https://retuujyjqylsyioargmh.supabase.co';

// ANON KEY padrão (fornecida pelo usuário)
const DEFAULT_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHV1anlqcXlsc3lpb2FyZ21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNzMyMjgsImV4cCI6MjA2NTg0OTIyOH0.DQ1pbuyuVqHrVg5qg4P9LwEf4Ue6AdMrYWEa1BDQDT8';

function resolveAnonKey(){
  try{
    // 1) Variáveis globais opcionais (defina antes de carregar o app)
    if (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__) {
      return String(window.__SUPABASE_ANON_KEY__);
    }
    // 2) <meta name="supabase-anon-key" content="...">
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="supabase-anon-key"]') : null;
    if (meta?.content) return meta.content.trim();
    // 3) localStorage (prático em desenvolvimento)
    if (typeof localStorage !== 'undefined'){
      const v = localStorage.getItem('supabase.anon');
      if (v) return v.trim();
    }
  }catch{ /* ignore */ }
  // 4) Não perguntar via prompt; se ausente, retorna vazio e usar DEFAULT.
  return '';
}

const SUPABASE_ANON_KEY = resolveAnonKey() || DEFAULT_SUPABASE_ANON;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utilidades de diagnóstico (não expõem a chave)
export function getSupabaseConfigInfo(){
  let source = 'default';
  try{
    if (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__) source = 'window.__SUPABASE_ANON_KEY__';
    else if (typeof document !== 'undefined' && document.querySelector('meta[name="supabase-anon-key"]')) source = 'meta[supabase-anon-key]';
    else if (typeof localStorage !== 'undefined' && localStorage.getItem('supabase.anon')) source = 'localStorage:supabase.anon';
  }catch(_){ /* ignore */ }
  try{
    const urlHost = new URL(SUPABASE_URL).host;
    return { url: SUPABASE_URL, host: urlHost, keySource: source };
  }catch{ return { url: SUPABASE_URL, host: '', keySource: source }; }
}

export async function probeLoginUser(email){
  const out = { foundExact:false, foundFallback:false, error:null };
  try{
    const emailNorm = String(email||'').trim().toLowerCase();
    let r1 = await supabase.from('dash_login_usuario').select('id, login_email').ilike('login_email', emailNorm).limit(1).maybeSingle();
    if (r1?.error){ out.error = r1.error; return out; }
    out.foundExact = !!r1?.data;
    if (!out.foundExact){
      const pattern = `${emailNorm}%`;
      let r2 = await supabase.from('dash_login_usuario').select('id, login_email').ilike('login_email', pattern).limit(1).maybeSingle();
      if (r2?.error){ out.error = r2.error; return out; }
      out.foundFallback = !!r2?.data;
    }
  }catch(err){ out.error = err; }
  return out;
}

// Registro de auditoria de tentativas de login
// Crie a tabela sugerida: public.dash_login_audit (id bigserial pk, ts timestamptz default now(), email text, success bool, reason text, user_id bigint null, user_agent text)
// Garanta RLS/Policy permitindo INSERT para role anon somente nesses campos.
export async function logAuthAttempt({ email, success, reason, userId }){
  try{
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0,512) : '';
    const row = {
      email: String(email || '').slice(0, 320),
      success: !!success,
      reason: String(reason || '').slice(0, 600),
      user_id: (userId === undefined ? null : userId),
      user_agent: ua,
      ts: new Date().toISOString()
    };
    const { error } = await supabase.from('dash_login_audit').insert([row]);
    if (error) { /* provável RLS ausente; não quebra UX */ console.debug('[audit] insert failed:', error?.message || error); }
  }catch(err){ console.debug('[audit] unexpected error:', err?.message || err); }
}
