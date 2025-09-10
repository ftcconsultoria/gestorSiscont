import { supabase, getSupabaseConfigInfo, probeLoginUser, logAuthAttempt } from '../api/supabaseClient.js';
import { loginComTabela, fetchEmpresasDoUsuario } from '../repositories/authRepo.js';

function showError(msg){
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function showStatus(msg, type='info'){
  let el = document.getElementById('loginStatus');
  if (!el){
    el = document.createElement('div');
    el.id = 'loginStatus';
    el.className = 'small mt-2';
    const btn = document.getElementById('btnLogin');
    btn?.closest('.d-grid')?.insertAdjacentElement('afterend', el);
  }
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
  el.style.color = type === 'success' ? '#198754' : (type === 'error' ? '#dc3545' : '#6c757d');
}

function supaErrorToFriendly(err){
  try{
    const code = (err?.code || '').toString();
    const msg = (err?.message || err?.msg || '').toString().toLowerCase();
    if (code === '42501' || /permission denied|rls|row-level|policy/i.test(msg)){
      return 'Permissão negada (RLS). Habilite SELECT na tabela "dash_login_usuario" para a role anônima (ou crie uma policy apropriada).';
    }
    if (/invalid api key|apikey|jwt|token/i.test(msg)){
      return 'Chave do Supabase inválida ou ausente.';
    }
    if (/failed to fetch|network|timeout/i.test(msg)){
      return 'Falha de rede ao acessar o Supabase.';
    }
    return null;
  }catch{ return null; }
}

async function diagnoseNoUser(email){
  try{
    // Verifica se há algum erro de permissão geral
    const probe = await supabase.from('dash_login_usuario').select('id').limit(1);
    if (probe?.error){
      const m = supaErrorToFriendly(probe.error);
      return m || 'Erro de permissão ao consultar usuários (RLS).';
    }
    // Verifica acesso filtrando pelo e-mail (pode retornar vazio por RLS ou inexistência)
    const probeByEmail = await supabase.from('dash_login_usuario').select('id').ilike('login_email', String(email||'').trim()).limit(1);
    if (probeByEmail?.error){
      const m = supaErrorToFriendly(probeByEmail.error);
      return m || 'Erro de permissão ao consultar e-mail (RLS).';
    }
  }catch(_){ /* ignore */ }
  return null;
}

function saveUserSession(user){
  try{ localStorage.setItem('appUser', JSON.stringify(user)); }catch{}
}

function getUserSession(){
  try{ return JSON.parse(localStorage.getItem('appUser')||'null'); }catch{ return null; }
}

async function handleEmpresas(user){
  try{
    const empresas = await fetchEmpresasDoUsuario({ usuarioId: user?.id, email: user?.login_email || user?.email });
    const wrap = document.getElementById('empresaSelectWrap');
    const select = document.getElementById('empresaSelect');
    const btnOk = document.getElementById('btnSelecionarEmpresa');

    if (!Array.isArray(empresas) || empresas.length === 0){
      // Sem vínculo: segue direto para o dashboard
      try{ localStorage.removeItem('empresaAtual'); }catch{}
      window.location.href = 'dashboard.html';
      return;
    }

    // Se só uma, já salva e segue
    if (empresas.length === 1){
      try{ localStorage.setItem('empresaAtual', JSON.stringify(empresas[0])); }catch{}
      window.location.href = 'dashboard.html';
      return;
    }

    // Prepara UI de seleção
    if (wrap && select && btnOk){
      select.innerHTML = '';
      empresas.forEach(e => {
        const fantasia = e?.CEMP_NOME_FANTASIA || e?.CEMP_FANTASIA || e?.NOME_FANTASIA || '';
        const opt = document.createElement('option');
        opt.value = String(e.CEMP_PK);
        opt.textContent = `${e.CEMP_PK} - ${fantasia || 'Empresa'}`;
        if (e?.CEMP_RAZAO) opt.title = `Razão Social: ${e.CEMP_RAZAO}`;
        select.appendChild(opt);
      });
      wrap.style.display = 'block';
      btnOk.addEventListener('click', () => {
        const val = select.value;
        const chosen = empresas.find(x => String(x.CEMP_PK) === String(val)) || empresas[0];
        try{ localStorage.setItem('empresaAtual', JSON.stringify(chosen)); }catch{}
        window.location.href = 'dashboard.html';
      });
    } else {
      // Fallback: salva primeira e segue
      try{ localStorage.setItem('empresaAtual', JSON.stringify(empresas[0])); }catch{}
      window.location.href = 'dashboard.html';
    }
  }catch(err){
    console.warn('Falha ao buscar empresas do usuario:', err);
    window.location.href = 'dashboard.html';
  }
}

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

function showDebugBanner(){
  if (!isDebugAuth()) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1050;background:#0d6efd;color:#fff;padding:8px 12px;font:500 13px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;gap:8px;align-items:center;justify-content:space-between;box-shadow:0 2px 6px rgba(0,0,0,.15)';
  bar.innerHTML = `
    <span>Modo de Diagnóstico de Login ativo — veja detalhes no Console (F12). Query ?debug=1 ou localStorage.debug.auth=1</span>
    <div class="d-flex gap-2">
      <button id="dbgAuthOff" class="btn btn-sm btn-light">Desativar</button>
    </div>`;
  document.body.appendChild(bar);
  document.getElementById('dbgAuthOff')?.addEventListener('click', () => {
    try{ localStorage.removeItem('debug.auth'); }catch{}
    const u = new URL(location.href); u.searchParams.delete('debug');
    location.replace(u.toString());
  });
  // Empurra o conteúdo pra baixo para não cobrir o topo
  document.body.style.paddingTop = '40px';
}

async function main(){
  showError('');
  try{ showDebugBanner(); }catch(_){ }
  // Se já logado, redireciona para o dashboard
  const saved = getUserSession();
  const comingFromDashboard = (document?.referrer || '').includes('dashboard.html');
  try{
    const { data: sessionData } = await supabase.auth.getSession();
    // Redireciona automaticamente somente se não vier do dashboard (para evitar loop)
    // e se a conexão básica com o Supabase responder sem erro crítico
    if (!comingFromDashboard && (saved || sessionData?.session)){
      try{
        const probe = await supabase.from('dash_login_usuario').select('id').limit(1);
        if (!probe?.error){
          window.location.href = 'dashboard.html';
          return;
        }
        // Se há erro (ex.: RLS/Network), fica na tela de login e exibe um aviso suave
        showStatus('Sessão encontrada, mas conexão indisponível. Faça login novamente.', 'info');
      }catch{ /* mantém na página de login */ }
    }
  }catch{ /* mantém na página de login */ }

  const btn = document.getElementById('btnLogin');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    showError('');
    showStatus('Validando credenciais...', 'info');
    const email = document.getElementById('loginEmail')?.value?.trim();
    const senha = document.getElementById('loginSenha')?.value ?? '';
    if (!email || !senha){ showError('Informe e-mail e senha.'); return; }
    try{
      // Info de conexão
      try{
        const cfg = getSupabaseConfigInfo();
        console.debug('[login] supabase config:', cfg);
      }catch(_){ }

      const userRow = await loginComTabela(email, senha);
      if (!userRow){
        // Diagnóstico adicional para diferenciar RLS de credenciais inválidas
        const diag = await diagnoseNoUser(email);
        const probe = await probeLoginUser(email);
        const detail = probe?.error ? (supaErrorToFriendly(probe.error) || (probe.error?.message||'Erro desconhecido'))
          : (probe.foundExact || probe.foundFallback ? 'Senha incorreta.' : 'Usuário não encontrado.');
        const reason = diag || detail || 'E-mail ou senha inválidos.';
        showError(reason);
        showStatus(`Falha ao autenticar: ${reason}`, 'error');
        try{ await logAuthAttempt({ email, success:false, reason }); }catch{}
        return;
      }
      saveUserSession(userRow);
      showStatus('Login realizado com sucesso. Redirecionando...', 'success');
      try{ await logAuthAttempt({ email, success:true, reason:'ok', userId: userRow?.id }); }catch{}
      await handleEmpresas(userRow);
    }catch(err){
      console.error(err);
      const friendly = supaErrorToFriendly(err);
      const reason = friendly || (err?.message||'erro desconhecido');
      showError(reason);
      showStatus(`Falha ao autenticar: ${reason}`, 'error');
      try{ await logAuthAttempt({ email, success:false, reason }); }catch{}
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
