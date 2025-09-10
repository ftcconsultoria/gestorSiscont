// Supabase client (ESM) centralizado
// ATENÇÃO: nunca use service_role no front-end. Use apenas a ANON KEY com RLS ativo.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL pública do seu projeto (não é segredo)
const SUPABASE_URL = 'https://retuujyjqylsyioargmh.supabase.co';

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
    // 4) Ambiente local: perguntar e salvar (somente localhost)
    const isLocal = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (isLocal && typeof window !== 'undefined' && typeof localStorage !== 'undefined'){
      const k = window.prompt('Informe a Supabase ANON KEY (será salva apenas neste navegador)');
      if (k && k.trim().length){ localStorage.setItem('supabase.anon', k.trim()); return k.trim(); }
    }
  }catch{ /* ignore */ }
  console.error('[Supabase] Anon key não configurada. Defina window.__SUPABASE_ANON_KEY__, meta[name="supabase-anon-key"] ou localStorage supabase.anon');
  return '';
}

const SUPABASE_ANON_KEY = resolveAnonKey();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

