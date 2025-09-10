// Inicialização para páginas secundárias: autenticação, seletor de empresa e sair
import { initAuth, signOut } from './auth/authUI.js';
import { fetchEmpresasDoUsuario } from './repositories/authRepo.js';
import { fetchEmpresasRazaoByIds, fetchEmpresasInfoByIds } from './repositories/empresasRepo.js';

function getSavedUser(){
  try { return JSON.parse(localStorage.getItem('appUser')||'null'); } catch { return null; }
}

function updateEmpresaBadgeFromStorage(){
  try{
    const badge = document.getElementById('empresaNomeBadge');
    if (!badge) return;
    const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null');
    const name = saved?.name || saved?.CEMP_RAZAO || saved?.CEMP_FANTASIA || '';
    if (name){
      badge.textContent = name;
      badge.classList.remove('d-none');
    } else if (saved?.CEMP_PK){
      badge.textContent = `Empresa ${saved.CEMP_PK}`;
      badge.classList.remove('d-none');
    } else {
      badge.textContent = '';
      badge.classList.add('d-none');
    }
  }catch{}
}

async function initEmpresaTopSelect(){
  const user = getSavedUser();
  const select = document.getElementById('empresaTopSelect');
  const selectMobile = document.getElementById('empresaTopSelectMobile');
  if (!select && !selectMobile) return;
  if (!user){
    if (select) select.classList.add('d-none');
    if (selectMobile) selectMobile.closest('.mb-3')?.classList.add('d-none');
    return;
  }

  let empresas = [];
  try {
    empresas = await fetchEmpresasDoUsuario({ usuarioId: user?.id, email: user?.login_email || user?.email });
  } catch (e){ console.warn('Erro carregando empresas:', e); }
  if (!empresas || empresas.length === 0){
    if (select) select.classList.add('d-none');
    if (selectMobile) selectMobile.closest('.mb-3')?.classList.add('d-none');
    return;
  }

  // labels de empresa (prioriza CEMP_RAZAO)
  let labels = new Map();
  try{
    const ids = empresas.map(e => e.CEMP_PK).filter(v => v !== null && v !== undefined);
    const infoRazao = await fetchEmpresasRazaoByIds(ids);
    (infoRazao || []).forEach(row => {
      const name = row?.name || '';
      const k = row?.CEMP_PK;
      if (k !== undefined && k !== null && name){
        labels.set(String(k), name);
        const num = Number(k);
        if (!Number.isNaN(num)) labels.set(num, name);
      }
    });
    const missing = ids.filter(id => !labels.has(String(id)) && !labels.has(Number(id)));
    if (missing.length){
      const info = await fetchEmpresasInfoByIds(missing);
      (info || []).forEach(row => {
        const name = row?.name || '';
        const k = row?.CEMP_PK;
        if (k !== undefined && k !== null && name){
          labels.set(String(k), name);
          const num = Number(k);
          if (!Number.isNaN(num)) labels.set(num, name);
        }
      });
    }
  }catch(_){ /* ignore */ }

  const fillSelect = (sel, labelsMap) => {
    if (!sel) return;
    sel.innerHTML = '';
    empresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = String(e.CEMP_PK);
      const label = labelsMap?.get(String(e.CEMP_PK)) || labelsMap?.get(Number(e.CEMP_PK));
      opt.textContent = label ? `${label}` : `Empresa ${e.CEMP_PK}`;
      sel.appendChild(opt);
    });
  };
  fillSelect(select, labels);
  fillSelect(selectMobile, labels);

  let currentCemp = null;
  try{
    const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null');
    if (saved?.CEMP_PK !== undefined){ currentCemp = String(saved.CEMP_PK); }
  }catch{}
  if (!currentCemp && empresas.length){
    localStorage.setItem('empresaAtual', JSON.stringify(empresas[0]));
    currentCemp = String(empresas[0].CEMP_PK);
  }
  if (select && currentCemp) select.value = currentCemp;
  if (selectMobile && currentCemp) selectMobile.value = currentCemp;

  // Preenche nome salvo e badge
  try{
    if (currentCemp){
      const label = labels.get(currentCemp) || labels.get(Number(currentCemp));
      if (label){
        const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null') || {};
        saved.name = label;
        saved.CEMP_PK = Number(currentCemp);
        localStorage.setItem('empresaAtual', JSON.stringify(saved));
      }
    }
  }catch{}
  updateEmpresaBadgeFromStorage();

  const onChange = (value) => {
    const CEMP_PK = Number(value);
    const chosen = empresas.find(e => String(e.CEMP_PK) === String(CEMP_PK)) || { CEMP_PK };
    const label = labels.get(String(CEMP_PK)) || labels.get(Number(CEMP_PK));
    const payload = { ...chosen };
    if (label) payload.name = label;
    localStorage.setItem('empresaAtual', JSON.stringify(payload));
    if (select && select.value !== String(CEMP_PK)) select.value = String(CEMP_PK);
    if (selectMobile && selectMobile.value !== String(CEMP_PK)) selectMobile.value = String(CEMP_PK);
    updateEmpresaBadgeFromStorage();
  };
  if (select){ select.classList.remove('d-none'); select.addEventListener('change', () => onChange(select.value)); }
  if (selectMobile){ selectMobile.closest('.mb-3')?.classList.remove('d-none'); selectMobile.addEventListener('change', () => onChange(selectMobile.value)); }
}

function initSignOutButton(){
  const bind = (id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => { signOut(); });
  };
  bind('btnSignOut');
  bind('btnSignOutMobile');
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth(() => {
    try { initEmpresaTopSelect(); } catch(_) {}
    try { updateEmpresaBadgeFromStorage(); } catch(_) {}
    try { initSignOutButton(); } catch(_) {}
    try{
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
    }catch(_){ /* ignore */ }
  });
});

