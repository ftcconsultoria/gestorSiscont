import { supabase } from '../api/supabaseClient.js';

function isDebugAuth(){
  try{
    if (typeof location !== 'undefined'){
      const u = new URL(location.href);
      if (u.searchParams.get('debug') === '1') return true;
    }
    if (typeof localStorage !== 'undefined'){
      const v = localStorage.getItem('debug.auth');
      if (v && /^(1|true|on)$/i.test(v)) return true;
    }
  }catch(_){ /* ignore */ }
  return false;
}

function allowAdminBypass(){
  try{
    if (typeof window !== 'undefined' && window.__ALLOW_ADMIN_BY_PASS__) return true; // legacy key
    if (typeof window !== 'undefined' && window.__ALLOW_ADMIN_BYPASS__ === true) return true;
    if (typeof localStorage !== 'undefined'){
      const v = localStorage.getItem('auth.allowAdminBypass');
      if (v && /^(1|true|on)$/i.test(v)) return true;
    }
    if (typeof location !== 'undefined'){
      const h = location.hostname || '';
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(h)) return true;
    }
  }catch(_){ /* ignore */ }
  return false;
}

const USERS_TABLE = 'dash_login_usuario'; // id, login_email, login_senha
const USER_EMPRESA_TABLE = 'dash_usuario_empresa'; // usuario_id, CEMP_PK (fallback)
const LOGIN_EMPRESA_TABLE = 'dash_login_empresa'; // id_login, CEMP_PK
const EMPRESA_TABLE = 'CADE_EMPRESA'; // CEMP_PK, CEMP_NOME_FANTASIA / CEMP_FANTASIA / NOME_FANTASIA

// Aceita um cliente opcional (útil para testes)
export async function loginComTabela(email, senha, client = supabase){
  const emailNorm = String(email || '').trim().toLowerCase();
  const senhaInput = String(senha ?? '');

  // Bypass administrativo: "admin" / "admin" (somente ambiente local ou quando explicitamente habilitado)
  if (emailNorm === 'admin' && senhaInput.trim() === 'admin' && allowAdminBypass()){
    if (isDebugAuth()) console.debug('[login] bypass admin');
    return { id: -1, login_email: 'admin', login_senha: 'admin', is_admin: true };
  }

  // Tenta correspondência exata (case-insensitive)
  let res = await client
    .from(USERS_TABLE)
    .select('*')
    .ilike('login_email', emailNorm)
    .limit(1)
    .maybeSingle();
  if (res.error) throw res.error;

  if (isDebugAuth()){
    console.debug('[login] consulta 1:', { emailNorm, found: !!res.data });
  }

  // Fallback: tolera espaços ou caracteres ao final do e-mail salvo
  if (!res.data){
    const pattern = `${emailNorm}%`; // e-mail + qualquer sufixo (ex.: espaços)
    res = await client
      .from(USERS_TABLE)
      .select('*')
      .ilike('login_email', pattern)
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    if (isDebugAuth()){
      console.debug('[login] consulta 2 (fallback):', { pattern, found: !!res.data });
    }
  }

  const row = res.data;
  if (!row) return null;

  // Compara senha; tolera espaços no valor salvo
  const senhaDB = (row?.login_senha != null && typeof row.login_senha.trim === 'function') ? row.login_senha.trim() : row?.login_senha;
  if (isDebugAuth()){
    console.debug('[login] row retornado:', {
      id: row?.id,
      login_email: row?.login_email,
      email_len: (row?.login_email||'').length,
      senha_len: (row?.login_senha||'').length,
      senhaDB_len: (senhaDB||'').length,
    });
    console.debug('[login] comparação de senha:', {
      input_len: senhaInput.length,
      matchExact: senhaDB === senhaInput,
      matchTrim: senhaDB === senhaInput.trim()
    });
  }
  if (senhaDB === senhaInput || senhaDB === senhaInput.trim()) return row;
  return null;
}

export async function fetchEmpresasDoUsuario({ usuarioId, email }){
  // Implementa a consulta equivalente ao SQL desejado:
  // SELECT e."CEMP_PK", e."CEMP_NOME_FANTASIA"
  // FROM dash_login_usuario u
  // JOIN dash_login_empresa le ON le.id_login = u.id
  // JOIN "CADE_EMPRESA" e ON e."CEMP_PK" = le."CEMP_PK"
  // WHERE u.login_email = <email do usuário>

  // 1) Resolve o id do usuário, se necessário
  let id = usuarioId;
  try{
    if ((id === undefined || id === null) && email){
      const { data: userRow, error: userErr } = await supabase
        .from(USERS_TABLE)
        .select('id')
        .eq('login_email', email)
        .maybeSingle();
      if (!userErr && userRow?.id !== undefined && userRow?.id !== null){
        id = userRow.id;
      }
    }
  }catch(_){ /* ignore */ }

  // 2) Busca os CEMP_PK vinculados ao login
  let empresaIds = [];
  try{
    if (id !== undefined && id !== null){
      const { data: vincs, error: vincErr } = await supabase
        .from(LOGIN_EMPRESA_TABLE)
        .select('CEMP_PK')
        .eq('id_login', id);
      if (!vincs && vincErr) throw vincErr;
      empresaIds = (vincs || []).map(r => r?.CEMP_PK).filter(v => v !== undefined && v !== null);
    }
  }catch(_){ /* segue para fallbacks abaixo */ }

  // 3) Se não conseguiu por id, tenta fallback por email na tabela legado de vínculo
  if ((!empresaIds || empresaIds.length === 0) && email){
    try{
      const { data: vincsByEmail, error: vbeErr } = await supabase
        .from(USER_EMPRESA_TABLE)
        .select('CEMP_PK')
        .eq('login_email', email);
      if (!vincsByEmail && vbeErr) throw vbeErr;
      empresaIds = (vincsByEmail || []).map(r => r?.CEMP_PK).filter(v => v !== undefined && v !== null);
    }catch(_){ /* ignore */ }
  }

  // 4) Carrega nomes (preferindo Nome Fantasia) da CADE_EMPRESA
  if (empresaIds && empresaIds.length){
    try{
      const { data: empresas, error: empErr } = await supabase
        .from(EMPRESA_TABLE)
        .select('CEMP_PK, CEMP_NOME_FANTASIA, CEMP_FANTASIA, NOME_FANTASIA, CEMP_RAZAO')
        .in('CEMP_PK', empresaIds);
      if (empErr) throw empErr;
      return (empresas || []).map(r => ({
        CEMP_PK: r?.CEMP_PK,
        CEMP_NOME_FANTASIA: r?.CEMP_NOME_FANTASIA || r?.CEMP_FANTASIA || r?.NOME_FANTASIA || null,
        CEMP_RAZAO: r?.CEMP_RAZAO || null
      })).filter(x => x.CEMP_PK !== undefined && x.CEMP_PK !== null);
    }catch(_){ /* cai para fallback */ }
  }

  // 5) Fallback final: mapeamento simples via dash_usuario_empresa (sem nomes)
  try{
    if (id !== undefined && id !== null){
      const { data, error } = await supabase
        .from(USER_EMPRESA_TABLE)
        .select('CEMP_PK')
        .eq('usuario_id', id);
      if (!error && Array.isArray(data)) return data;
    }
  }catch(_){ /* ignore */ }
  try{
    if (email){
      const { data, error } = await supabase
        .from(USER_EMPRESA_TABLE)
        .select('CEMP_PK')
        .eq('login_email', email);
      if (!error && Array.isArray(data)) return data;
    }
  }catch(_){ /* ignore */ }

  return [];
}
