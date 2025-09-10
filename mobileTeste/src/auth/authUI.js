import { supabase } from '../api/supabaseClient.js';
import { loginComTabela, fetchEmpresasDoUsuario } from '../repositories/authRepo.js';

function ensureOverlay(){
  let overlay = document.getElementById('loginOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'loginOverlay';
  overlay.className = 'login-overlay d-flex align-items-center justify-content-center p-3';
  overlay.innerHTML = `
    <div class="card shadow login-card" style="max-width:380px;width:100%">
      <div class="card-body">
        <h5 class="card-title mb-3">Entrar</h5>
        <div class="mb-3">
          <label class="form-label" for="loginEmail">E-mail</label>
          <input type="email" id="loginEmail" class="form-control" placeholder="voce@empresa.com" autocomplete="username">
        </div>
        <div class="mb-2">
          <label class="form-label" for="loginSenha">Senha</label>
          <input type="password" id="loginSenha" class="form-control" placeholder="********" autocomplete="current-password">
        </div>
        <div class="d-grid gap-2 mt-2">
          <button id="btnLogin" class="btn btn-primary" type="button">Entrar</button>
        </div>
        <div id="loginError" class="text-danger small mt-2" style="display:none"></div>
        <div id="empresaSelectWrap" class="mt-3" style="display:none">
          <label class="form-label">Empresa</label>
          <div class="d-flex gap-2">
            <select id="empresaSelect" class="form-select"></select>
            <button id="btnSelecionarEmpresa" class="btn btn-success" type="button">OK</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function hideOverlay(){
  const o = document.getElementById('loginOverlay');
  if (o && o.parentNode) o.parentNode.removeChild(o);
}

function showError(msg){
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function saveUserSession(user){
  localStorage.setItem('appUser', JSON.stringify(user));
}

function getUserSession(){
  try{ return JSON.parse(localStorage.getItem('appUser')||'null'); }catch{ return null; }
}

async function handleEmpresas(user, onDone){
  try{
    const empresas = await fetchEmpresasDoUsuario({ usuarioId: user?.id, email: user?.login_email || user?.email });
    if (Array.isArray(empresas) && empresas.length > 0){
      // Mantm escolha previa, se existir na lista; senao usa a primeira
      try{
        const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null');
        const exists = empresas.some(e => String(e.CEMP_PK) === String(saved?.CEMP_PK));
        if (!exists){
          localStorage.setItem('empresaAtual', JSON.stringify(empresas[0]));
        }
      }catch{
        localStorage.setItem('empresaAtual', JSON.stringify(empresas[0]));
      }
    } else {
      localStorage.removeItem('empresaAtual');
    }
  }catch(err){
    console.warn('Falha ao buscar empresas do usuario:', err);
    // Mantm estado atual (se houver) e segue
  }
  // Sempre fecha overlay aps tratar empresas e prossegue
  hideOverlay();
  onDone(user);
}

export async function initAuth(onLoggedIn){
  const overlay = ensureOverlay();

  const savedUser = getUserSession();
  const { data: sessionData } = await supabase.auth.getSession();
  if ((savedUser || sessionData?.session) && overlay){
    hideOverlay();
    onLoggedIn(savedUser || sessionData.session.user);
    return;
  }

  document.getElementById('btnLogin')?.addEventListener('click', async () => {
    showError('');
    const email = document.getElementById('loginEmail')?.value?.trim();
    const senha = document.getElementById('loginSenha')?.value ?? '';
    if (!email || !senha){ showError('Informe e-mail e senha.'); return; }
    try{
      const userRow = await loginComTabela(email, senha);
      if (!userRow){ showError('E-mail ou senha invalidos.'); return; }
      saveUserSession(userRow);
      await handleEmpresas(userRow, onLoggedIn);
    }catch(err){
      console.error(err);
      showError('Falha ao autenticar.');
    }
  });

  // Login via Google desativado por enquanto
}

export function signOut(){
  try{ localStorage.removeItem('appUser'); }catch{}
  try{ localStorage.removeItem('empresaAtual'); }catch{}
  try{ supabase.auth.signOut(); }catch{}
  location.reload();
}
