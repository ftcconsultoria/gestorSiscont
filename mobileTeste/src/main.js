// Ponto de orquestração da UI
import { PAGE_SIZE, fetchPedidos } from './repositories/pedidosRepo.js';
import { fetchItensByPedidos } from './repositories/itensRepo.js';
import { fetchUsuariosByIds } from './repositories/usuariosRepo.js';
import { fetchProdutosByIds } from './repositories/produtosRepo.js';

import { state, getVendedorNome, setVendedores, getProdutoNome, setProdutos } from './state/store.js';

import { filterPedidos, sortPedidosDescPorDataHora } from './filters/applyFilters.js';
import { renderTable } from './ui/table.js';
import { calcKPIs, renderKPIs } from './ui/kpis.js';
import { initHourFilter, updateListBadge, populateVendedorFiltro } from './ui/filters.js';

import { destroyAllCharts } from './ui/charts/chartService.js';
import { renderLineChart } from './ui/charts/lineChart.js';
import { renderEmpresaBarChart } from './ui/charts/barEmpresaChart.js';
import { renderMonthlyBarChart } from './ui/charts/monthlyBar.js';
import { renderTopProdutosBarChart } from './ui/charts/topProdutosDonut.js';
import { renderSparkBar } from './ui/charts/sparkBar.js';
import { renderSparkLine } from './ui/charts/sparkLine.js';

import { aggregateByDate, aggregateByEmpresa, aggregateTopProdutos, aggregateByMonth } from './utils/aggregate.js';
import { toNum, fmtBRL, toBRDateShort, brShortToISO } from './utils/format.js';

// Config para métricas adicionais
let ordersSparkRange = 7;
let monthsRange = 6;

// Boot
import { initAuth, signOut } from './auth/authUI.js';
import { fetchEmpresasDoUsuario } from './repositories/authRepo.js';
import { fetchEmpresasInfoByIds, fetchEmpresasRazaoByIds } from './repositories/empresasRepo.js';

document.addEventListener('DOMContentLoaded', () => {
  // Aguarda autenticacao antes de iniciar a UI
  initAuth(() => {
  // Navbar: seletor de empresa + sair
  try { initEmpresaTopSelect(); } catch(_) {}
  try { updateEmpresaBadgeFromStorage(); } catch(_) {}
  try { initSignOutButton(); } catch(_) {}
  try { initSidebarNav(); } catch(_) {}
  // Filtro hora
  initHourFilter(document.getElementById('horaFiltro'), applyAndRender);

  // Eventos período e aplicar
  const dataIni = document.getElementById('dataInicio');
  const dataFim = document.getElementById('dataFim');
  const btnReload = document.getElementById('btnReload');
  const btnMesAtual = document.getElementById('btnMesAtual');
  if (dataIni) dataIni.addEventListener('change', () => loadPedidos(true));
  if (dataFim) dataFim.addEventListener('change', () => loadPedidos(true));
  if (btnReload) btnReload.addEventListener('click', () => loadPedidos(true));
  if (btnMesAtual) btnMesAtual.addEventListener('click', () => {
    const isoFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (dataIni) dataIni.value = toBRDateShort(isoFromDate(startOfMonth));
    if (dataFim) dataFim.value = toBRDateShort(isoFromDate(endOfMonth));
    loadPedidos(true);
  });
  // Máscara dd/mm/yy
  attachBRDateMask(dataIni);
  attachBRDateMask(dataFim);

  // Filtro vendedor
  const vendSelect = document.getElementById('vendedorFiltro');
  if (vendSelect) vendSelect.addEventListener('change', applyAndRender);

  // Registrar SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  // Toggle de tema (dark/light)
  const btnTheme = document.getElementById('themeToggle');
  if (false && btnTheme){
    const saved = localStorage.getItem('theme');
    // data-theme removido: usamos data-bs-theme
    btnTheme.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-bs-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-bs-theme', next);
      localStorage.setItem('bs-theme', next);
      // Re-render para aplicar nova paleta aos gráficos
      applyAndRender();
    });
  }

  // Alterna 2 ↔ 20 ao clicar no título
  const titulo = document.getElementById('listaTitulo');
  if (titulo) {
    titulo.addEventListener('click', () => {
      state.listLimit = (state.listLimit >= 20) ? 2 : 20;
      applyAndRender();
    });
  }

  // Botões paginar
  const btnMore = document.getElementById('btnCarregarMais');
  if (btnMore) btnMore.addEventListener('click', () => loadPedidos(false));
  const btnAll = document.getElementById('btnCarregarTudo');
  if (btnAll) btnAll.addEventListener('click', () => loadAllPedidos());

  // Carrega inicial
  loadPedidos(true);

  // Bootstrap theme variable toggle (data-bs-theme)
  try{
    const saved = localStorage.getItem('bs-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themePref = saved || (prefersDark ? 'dark' : 'light');
    if (themePref) document.documentElement.setAttribute('data-bs-theme', themePref);
    const btnTheme = document.getElementById('themeToggle');
    if (btnTheme){
      btnTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        localStorage.setItem('bs-theme', next);
        try{ applyAndRender(); }catch(_){ }
      });
    }
  }catch(_){}

  // Dropdown de range para Total Orders
  document.querySelectorAll('[data-range]')?.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const v = parseInt(el.getAttribute('data-range')||'7',10);
      if (Number.isFinite(v)) ordersSparkRange = v;
      applyAndRender();
    });
  });

  // Dropdown de range para Faturamento Mensal (6/12 meses)
  document.querySelectorAll('[data-range-months]')?.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const v = parseInt(el.getAttribute('data-range-months')||'6',10);
      if (Number.isFinite(v)) monthsRange = v;
      const lbl = document.getElementById('monthsRangeLabel');
      if (lbl) lbl.textContent = `${monthsRange} meses`;
      applyAndRender();
    });
  });

  // Weather + Feriados
  try { initWeatherAndHolidays(); } catch(_) { /* ignore */ }
  }); // fim initAuth
});

function getSavedUser(){
  try { return JSON.parse(localStorage.getItem('appUser')||'null'); } catch { return null; }
}

function updateEmpresaBadgeFromStorage(){
  try{
    const badge = document.getElementById('empresaNomeBadge');
    if (!badge) return;
    const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null');
    const id = (saved?.CEMP_PK !== undefined && saved?.CEMP_PK !== null) ? String(saved.CEMP_PK) : '';
    const name = saved?.name || saved?.CEMP_RAZAO || saved?.CEMP_FANTASIA || '';
    if (name || id){
      badge.textContent = name ? `${name}${id?` (CEMP_PK ${id})`:''}` : `Empresa ${id}`;
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

  const fillSelect = (sel, labelsMap) => {
    if (!sel) return;
    sel.innerHTML = '';
    empresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = String(e.CEMP_PK);
      const label = labelsMap?.get(String(e.CEMP_PK)) || labelsMap?.get(Number(e.CEMP_PK));
      opt.textContent = label ? `${label} (CEMP_PK ${e.CEMP_PK})` : `Empresa ${e.CEMP_PK}`;
      sel.appendChild(opt);
    });
  };
  // Busca nomes das empresas, se possível
  let labels = new Map();
  try{
    const ids = empresas.map(e => e.CEMP_PK).filter(v => v !== null && v !== undefined);
    const info = await fetchEmpresasInfoByIds(ids);
    (info || []).forEach(row => {
      const name = row?.name || '';
      const k = row?.CEMP_PK;
      if (k !== undefined && k !== null && name){
        labels.set(String(k), name);
        const num = Number(k);
        if (!Number.isNaN(num)) labels.set(num, name);
      }
    });
  }catch(_){ /* ignore */ }

  // Sobrescreve labels com CEMP_RAZAO da CADE_EMPRESA quando disponvel
  try{
    const ids = empresas.map(e => e.CEMP_PK).filter(v => v !== null && v !== undefined);
    const infoRazao = await fetchEmpresasRazaoByIds(ids);
    (infoRazao || []).forEach(row => {
      const k = row?.CEMP_PK; const name = row?.name || '';
      if (k !== undefined && k !== null && name){
        labels.set(String(k), name);
        const num = Number(k); if (!Number.isNaN(num)) labels.set(num, name);
      }
    });
  }catch(_){ /* ignore */ }

  fillSelect(select, labels);
  fillSelect(selectMobile, labels);

  let currentCemp = null;
  try {
    const saved = JSON.parse(localStorage.getItem('empresaAtual')||'null');
    if (saved?.CEMP_PK !== undefined){
      currentCemp = String(saved.CEMP_PK);
    }
  } catch {}
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
    loadPedidos(true);
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

function initSidebarNav(){
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const links = sidebar.querySelectorAll('a.offcanvas-link[data-target]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('data-target');
      const section = document.getElementById(targetId);
      if (!targetId || !section) return;
      e.preventDefault();
      try{
        const off = window.bootstrap?.Offcanvas?.getOrCreateInstance(sidebar);
        off?.hide();
      }catch(_){ /* ignore */ }
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function loadPedidos(reset){
  if (reset){ state.pageFrom = 0; state.hasMore = true; state.allPedidos = []; }
  const diText = document.getElementById('dataInicio')?.value;
  const dfText = document.getElementById('dataFim')?.value;
  const di = brShortToISO(diText);
  const df = brShortToISO(dfText);

  try {
    const data = await fetchPedidos({ di, df, from: state.pageFrom, to: state.pageFrom + PAGE_SIZE - 1 });
    state.allPedidos = [...state.allPedidos, ...data];
    state.pageFrom += data.length;
    state.hasMore = data.length === PAGE_SIZE;
  } catch (error){
    console.error('Erro ao carregar pedidos:', error);
  }

  // Atualiza UI de paginação
  const btnMore = document.getElementById('btnCarregarMais');
  if (btnMore) {
    btnMore.disabled = !state.hasMore;
    btnMore.textContent = state.hasMore ? 'Carregar mais' : 'Tudo carregado';
  }

  // Popula vendedor e aplica filtros
  populateVendedorFiltro(document.getElementById('vendedorFiltro'), state.allPedidos, getVendedorNome);

  const idsVendedores = Array.from(new Set((state.allPedidos || []).map(p => p?.CCOT_VEND_PK).filter(v => v !== null && v !== undefined)));
  try{
    const rows = await fetchUsuariosByIds(idsVendedores);
    setVendedores(rows);
    // repopula com nomes
    populateVendedorFiltro(document.getElementById('vendedorFiltro'), state.allPedidos, getVendedorNome);
  }catch(err){ console.warn('Falha ao carregar vendedores:', err); }

  applyAndRender();
}

async function loadAllPedidos(){
  const btnAll = document.getElementById('btnCarregarTudo');
  const btnMore = document.getElementById('btnCarregarMais');
  const btnReload = document.getElementById('btnReload');
  const proceed = window.confirm('Aviso: carregar tudo pode ser lento e consumir muitos dados. Deseja continuar?');
  if (!proceed) return;
  try{
    if (btnAll) { btnAll.disabled = true; btnAll.textContent = 'Carregando tudo...'; }
    if (btnMore) { btnMore.disabled = true; }
    if (btnReload) { btnReload.disabled = true; }

    await loadPedidos(true);
    while (state.hasMore) {
      await loadPedidos(false);
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    if (btnReload) btnReload.disabled = false;
    if (btnAll) {
      btnAll.disabled = !state.hasMore;
      btnAll.textContent = state.hasMore ? 'Carregar tudo' : 'Tudo carregado';
    }
    if (btnMore) {
      btnMore.disabled = !state.hasMore;
      btnMore.textContent = state.hasMore ? 'Carregar mais' : 'Tudo carregado';
    }
  }
}

function applyAndRender(){
  // Coleta filtros
  const hora = document.getElementById('horaFiltro')?.value ?? '';
  const dataInicio = brShortToISO(document.getElementById('dataInicio')?.value ?? '');
  const dataFim = brShortToISO(document.getElementById('dataFim')?.value ?? '');
  const vendedor = document.getElementById('vendedorFiltro')?.value ?? '';

  // Filtro/ordenar
  const filtrados = filterPedidos(state.allPedidos, { hora, dataInicio, dataFim, vendedor });
  const visiveis = sortPedidosDescPorDataHora(filtrados).slice(0, Math.max(0, state.listLimit || 2));

  // Tabela
  const tbody = document.querySelector('#pedidosTable tbody');
  if (tbody) renderTable(tbody, visiveis, getVendedorNome);

  // KPIs
  renderKPIs(calcKPIs(filtrados));

  // Sparklines semanais
  try{ renderSparklinesDaily(filtrados); }catch(_){ /* ignore */ }
  try{ renderAdditionalCards(filtrados); }catch(_){ /* ignore */ }

  // Badge
  updateListBadge(document.getElementById('listaAviso'), filtrados.length, visiveis.length, state.listLimit);

  // Gráficos
  renderCharts(filtrados);
}

function attachBRDateMask(el){
  if (!el) return;
  el.placeholder = 'dd/mm/yy';
  el.setAttribute('inputmode', 'numeric');
  const fmt = (val) => {
    const digits = String(val).replace(/\D+/g, '').slice(0,8);
    let out = '';
    if (digits.length >= 2) out = digits.slice(0,2) + '/'; else return digits;
    if (digits.length >= 4) out += digits.slice(2,4) + '/'; else return out + digits.slice(2);
    out += digits.slice(4);
    return out;
  };
  el.addEventListener('input', () => {
    const pos = el.selectionStart;
    el.value = fmt(el.value);
    // Cursor rough keep
    try{ el.setSelectionRange(pos, pos); }catch(_){ }
    el.classList.remove('is-invalid');
  });
  el.addEventListener('blur', () => {
    const iso = brShortToISO(el.value);
    if (!iso && el.value.trim() !== '') el.classList.add('is-invalid');
    else el.classList.remove('is-invalid');
  });
}

async function renderCharts(pedidos){
  destroyAllCharts();
  // Agregações locais
  const byDate = aggregateByDate(pedidos);
  const lineLabels = Object.keys(byDate).sort();
  const lineData = lineLabels.map(l => byDate[l]);
  const lineLabelsBR = lineLabels.map(l => toBRDateShort(l));

  const byEmp = aggregateByEmpresa(pedidos);
  const empLabels = Object.keys(byEmp);
  const empData = empLabels.map(l => byEmp[l]);

  const lineEl = document.getElementById('lineChart');
  if (lineEl) renderLineChart(lineEl.getContext('2d'), lineLabelsBR, lineData);

  const barEl = document.getElementById('barChart');
  if (barEl) renderEmpresaBarChart(barEl.getContext('2d'), empLabels, empData);

  // Faturamento Mensal (últimos N meses)
  const byMonth = aggregateByMonth(pedidos);
  const lastN = lastNMonthsKeys(monthsRange || 6);
  const monthLabelsBR = lastN.map(k => formatMonthBR(k));
  const actual = lastN.map(k => byMonth[k] || 0);

  // Projeções: mês corrente por pacing (dias úteis); futuros por YoY * (1+trend)
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  function businessDaysInMonth(y,m){
    let count=0; const d=new Date(y,m-1,1); while(d.getMonth()===m-1){ const wd=d.getDay(); if(wd>=1&&wd<=5) count++; d.setDate(d.getDate()+1);} return count;
  }
  function businessDaysElapsedInCurrentMonth(){
    let count=0; const d=new Date(now.getFullYear(), now.getMonth(), 1); const end=new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while(d<=end){ const wd=d.getDay(); if(wd>=1&&wd<=5) count++; d.setDate(d.getDate()+1);} return Math.max(1,count);
  }

  // Trend (YoY) baseado em soma 12 meses recentes vs 12 anteriores
  function computeYoYTrend(){
    const keys24 = lastNMonthsKeys(24);
    const recent12 = keys24.slice(12).reduce((s,k)=>s+(byMonth[k]||0),0);
    const prev12 = keys24.slice(0,12).reduce((s,k)=>s+(byMonth[k]||0),0);
    if (prev12>0) return (recent12/prev12)-1; else return 0;
  }
  const trend = computeYoYTrend();

  const proj = lastN.map(k => {
    const [Y,M] = k.split('-').map(n=>parseInt(n,10));
    if (k < nowKey) return byMonth[k] || 0; // passado: proj = realizado
    if (k === nowKey){
      const mtd = byMonth[k] || 0;
      const totalBD = businessDaysInMonth(Y,M);
      const elapsedBD = businessDaysElapsedInCurrentMonth();
      return (mtd/elapsedBD)*totalBD;
    }
    // futuro: YoY * (1+trend)
    const lastYearKey = `${Y-1}-${String(M).padStart(2,'0')}`;
    const base = byMonth[lastYearKey];
    const avgRecent = lastNMonthsKeys(12).reduce((s,kk)=>s+(byMonth[kk]||0),0)/12 || 0;
    const candidate = (base!==undefined ? base : avgRecent);
    return candidate * (1 + trend);
  });

  const monthlyEl = document.getElementById('barMonthly');
  if (monthlyEl) renderMonthlyBarChart(monthlyEl.getContext('2d'), monthLabelsBR, actual, proj);

  // Top produtos – buscar itens e nomes
  const ids = Array.from(new Set((pedidos || []).map(p => p?.PDOC_PK).filter(Boolean)));
  const pieEl = document.getElementById('pieChart');
  if (!pieEl) return;

  if (!ids.length){
    renderTopProdutosBarChart(pieEl.getContext('2d'), [], [], [], []);
    return;
  }

  const itens = await fetchItensByPedidos(ids);
  const { top, byProdVal } = aggregateTopProdutos(itens);
  const topIds = top.map(([id]) => id);
  try{
    const produtos = await fetchProdutosByIds(topIds.map(id => Number(id)).filter(Number.isFinite));
    setProdutos(produtos);
  }catch(err){ console.warn('Falha carregar produtos', err); }

  const labels = top.map(([prod]) => String(prod));
  const quantities = top.map(([,q]) => q);
  const sales = top.map(([prod]) => byProdVal[prod] || 0);
  const names = labels.map(id => getProdutoNome(id) || 'Descrição indisponível');
  renderTopProdutosBarChart(pieEl.getContext('2d'), labels, quantities, sales, names);
}

function lastNDaysLabels(n){
  const labels = [];
  const today = new Date();
  for (let i=n-1; i>=0; i--){
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(d.toISOString().slice(0,10));
  }
  return labels;
}

function lastNMonthsKeys(n){
  const keys = [];
  const today = new Date();
  // set to first of current month
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i=n-1; i>=0; i--){
    const d = new Date(first.getFullYear(), first.getMonth()-i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    keys.push(k);
  }
  return keys;
}

function formatMonthBR(key){
  // key: YYYY-MM
  const [Y,M] = key.split('-').map(s=>parseInt(s,10));
  const d = new Date(Y, (M||1)-1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short' });
}

// Versão diária do spark com tooltip (data + valor)
function renderSparklinesDaily(pedidos){
  const byDate = aggregateByDate(pedidos);
  const labels = lastNDaysLabels(7);
  const values = labels.map(l => byDate[l] || 0);
  const orders = labels.map(l => (pedidos || []).filter(p => String(p?.PDOC_DT_EMISSAO||'').slice(0,10)===l).length);

  const sum = values.reduce((a,b)=>a+b,0);
  const prevLabels = lastNDaysLabels(14).slice(0,7);
  const prevSum = prevLabels.map(l => byDate[l] || 0).reduce((a,b)=>a+b,0);
  const diff = prevSum ? (((sum - prevSum)/prevSum)*100) : 0;

  const elTotal = document.getElementById('spark-weekly-total');
  const elDiff = document.getElementById('spark-weekly-diff');
  const elOrders = document.getElementById('spark-weekly-orders');
  if (elTotal) elTotal.textContent = fmtBRL.format(sum);
  if (elDiff) elDiff.textContent = `${diff.toFixed(1)}%`;
  if (elOrders) elOrders.textContent = String(orders.reduce((a,b)=>a+b,0));

  const labelsBR = labels.map(l => toBRDateShort(l));
  const spark1 = document.getElementById('sparkWeekly');
  if (spark1) renderSparkBar(spark1.getContext('2d'), values, labelsBR, { currency: true });
  try{ const legend = document.getElementById('sparkWeeklyLegend'); if (legend) legend.innerHTML = ''; }catch(_){ }
  const spark2 = document.getElementById('sparkWeeklyOrders');
  if (spark2) renderSparkBar(spark2.getContext('2d'), orders, labelsBR);
}

function renderSparklines(pedidos){
  const byDate = aggregateByDate(pedidos);

  // Helpers para semanas (Seg-Dom)
  const isoToDate = (iso) => { const [Y,M,D] = String(iso).slice(0,10).split('-').map(n=>parseInt(n,10)); return new Date(Y,(M||1)-1,D||1); };
  const dateToISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const startOfWeekMonday = (d) => { const x=new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w=x.getDay(); const diff=(w===0?-6:1-w); x.setDate(x.getDate()+diff); return x; };
  const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const lastNWeeksStarts = (n) => { const thisMon=startOfWeekMonday(new Date()); const arr=[]; for(let i=n-1;i>=0;i--){ const d=new Date(thisMon); d.setDate(thisMon.getDate()-(i*7)); arr.push(dateToISO(d)); } return arr; };

  // 7 baldes semanais (Seg-Dom)
  const weekStarts = lastNWeeksStarts(7);
  const weeklyValues = weekStarts.map(ws => {
    const start = isoToDate(ws);
    let sum = 0;
    for(let i=0;i<7;i++){
      const key = dateToISO(addDays(start,i));
      sum += byDate[key] || 0;
    }
    return sum;
  });

  // Total e variação: semana atual vs anterior
  const currentWeekTotal = weeklyValues[weeklyValues.length-1] || 0;
  const prevWeekTotal = weeklyValues.length>1 ? weeklyValues[weeklyValues.length-2] : 0;
  const diff = prevWeekTotal ? (((currentWeekTotal - prevWeekTotal)/prevWeekTotal)*100) : 0;

  const elTotal = document.getElementById('spark-weekly-total');
  const elDiff = document.getElementById('spark-weekly-diff');
  const elOrders = document.getElementById('spark-weekly-orders');
  if (elTotal) elTotal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentWeekTotal);
  if (elDiff) elDiff.textContent = `${diff.toFixed(1)}%`;
  // valor será definido após calcular 'orders' (últimos 7 dias)

  const spark1 = document.getElementById('sparkWeekly');
  if (spark1) renderSparkBar(spark1.getContext('2d'), weeklyValues);
  // Legenda com intervalo da semana e valor
  try{
    const legend = document.getElementById('sparkWeeklyLegend');
    if (legend){
      const html = weekStarts.map((ws, idx) => {
        const start = isoToDate(ws);
        const end = addDays(start,6);
        const range = `${toBRDateShort(dateToISO(start))}–${toBRDateShort(dateToISO(end))}`;
        const v = fmtBRL.format(weeklyValues[idx] || 0);
        return `<span class="me-3">${range}: <span class="fw-semibold text-body">${v}</span></span>`;
      }).join('');
      legend.innerHTML = html;
    }
  }catch(_){ }
  // Mantém o gráfico de Pedidos Semanais original (dias)
  const dayLabels = lastNDaysLabels(7);
  const orders = dayLabels.map(l => (pedidos || []).filter(p => String(p?.PDOC_DT_EMISSAO||'').slice(0,10)===l).length);
  if (elOrders) elOrders.textContent = String(orders.reduce((a,b)=>a+b,0));
  const spark2 = document.getElementById('sparkWeeklyOrders');
  if (spark2) renderSparkBar(spark2.getContext('2d'), orders);
}

function renderAdditionalCards(pedidos){
  // Total Orders line sparkline
  const byDateCount = {};
  (pedidos||[]).forEach(p=>{ const d=String(p?.PDOC_DT_EMISSAO||'').slice(0,10); byDateCount[d]=(byDateCount[d]||0)+1; });
  const labels = lastNDaysLabels(ordersSparkRange || 7);
  const ordersVals = labels.map(l=>byDateCount[l]||0);
  const ordersTotal = ordersVals.reduce((a,b)=>a+b,0);
  const elOrdersTotal = document.getElementById('metric-orders-total');
  if (elOrdersTotal) elOrdersTotal.textContent = String(ordersTotal);
  const sparkOrders = document.getElementById('sparkOrdersLine');
  if (sparkOrders) renderSparkLine(sparkOrders.getContext('2d'), ordersVals);

  // Vendas por vendedor: soma do valor de venda (PDOC_VLR_TOTAL)
  const byVendVal = {};
  (pedidos||[]).forEach(p=>{
    const v = p?.CCOT_VEND_PK ?? '—';
    const val = toNum(p?.PDOC_VLR_TOTAL);
    byVendVal[v] = (byVendVal[v] || 0) + val;
  });
  const total = Object.values(byVendVal).reduce((a,b)=>a+b,0) || 1;
  const entries = Object.entries(byVendVal).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const list = document.getElementById('runningProjectsList');
  if (list){
    list.innerHTML = '';
    entries.forEach(([vend,value], i)=>{
      const pct = Math.round((value/total)*100);
      const nome = (typeof getVendedorNome === 'function') ? (getVendedorNome(vend) || vend) : vend;
      const li = document.createElement('li');
      li.className = 'list-group-item px-0';
      li.innerHTML = `
        <div class="d-flex justify-content-between small"><span>${nome}</span><span>${fmtBRL.format(value)} (${pct}%)</span></div>
        <div class="progress" role="progressbar" aria-label="Progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar bg-${['primary','success','warning'][i%3]}" style="width:${pct}%"></div>
        </div>`;
      list.appendChild(li);
    });
    if (!entries.length){
      const li = document.createElement('li');
      li.className = 'list-group-item px-0 small text-muted';
      li.textContent = 'Sem dados para exibir';
      list.appendChild(li);
    }
  }
}

// Weather + Holidays
function initWeatherAndHolidays(){
  const def = { lat: -23.5505, lon: -46.6333 }; // São Paulo
  const getPos = () => new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(def);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(def),
      { enableHighAccuracy:false, timeout:5000, maximumAge:3600000 }
    );
  });

  (async () => {
    // Fallbacks de UI para quando as APIs falharem
    const setWeatherUnavailable = () => {
      try{
        const elCity = document.getElementById('weather-city');
        const elTemp = document.getElementById('weather-temp');
        const elStat = document.getElementById('weather-status');
        const elExtra = document.getElementById('weather-extra');
        const elIcon = document.getElementById('weather-icon');
        if (elCity) elCity.textContent = 'Indisponível';
        if (elTemp) elTemp.textContent = '--';
        if (elStat) elStat.textContent = '';
        if (elExtra) elExtra.textContent = 'Dados não disponíveis';
        if (elIcon) elIcon.className = 'bi bi-cloud-fill display-6 text-primary';
      }catch(_){ /* ignore */ }
    };
    try{
      const weekdayPt = (iso) => {
        try{
          const s = String(iso).slice(0,10);
          const [Y,M,D] = s.split('-').map(n=>parseInt(n,10));
          // Usa Date local para evitar parse ISO (UTC) que desloca o dia
          const d = new Date(Y, (M||1)-1, D||1);
          const name = d.toLocaleDateString('pt-BR', { weekday: 'long' });
          return name ? (name.charAt(0).toUpperCase() + name.slice(1)) : '';
        }catch{ return ''; }
      };
      const { lat, lon } = await getPos();

      // Weather
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      const wx = await res.json();
      const t = Math.round(wx?.current_weather?.temperature ?? 0);
      const code = wx?.current_weather?.weathercode;
      const tmax = Math.round(wx?.daily?.temperature_2m_max?.[0] ?? t);
      const tmin = Math.round(wx?.daily?.temperature_2m_min?.[0] ?? t);
      const prec = wx?.daily?.precipitation_probability_max?.[0];

      const status = weatherCodeToPt(code);
      const city = await reverseGeocode(lat, lon);

      const elCity = document.getElementById('weather-city');
      const elTemp = document.getElementById('weather-temp');
      const elStat = document.getElementById('weather-status');
      const elExtra = document.getElementById('weather-extra');
      const elIcon = document.getElementById('weather-icon');
      if (elCity) elCity.textContent = city || 'Localidade';
      if (elTemp) elTemp.textContent = `${t}°`;
      if (elStat) elStat.textContent = status || '';
      if (elExtra) elExtra.textContent = `Máx ${tmax}° • Mín ${tmin}° • Precipitação: ${prec ?? 0}%`;
      if (elIcon){
        const icon = weatherIconForCode(code);
        elIcon.className = `bi ${icon} display-6 ${/sun|brightness/i.test(icon)?'text-warning':'text-primary'}`;
      }

      // Holidays (Brazil, próximos)
      const hres = await fetch('https://date.nager.at/api/v3/NextPublicHolidays/BR');
      const h = await hres.json();
      const ul = document.getElementById('holidayList');
      if (ul){
        ul.innerHTML = '';
        (h || []).slice(0,3).forEach(item => {
          const li = document.createElement('li');
          const wd = weekdayPt(item.date);
          li.textContent = `${toBRDateShort(item.date)} (${wd}) — ${item.localName || item.name}`;
          ul.appendChild(li);
        });
        if (!ul.children.length){
          const li = document.createElement('li');
          li.className = 'text-muted';
          li.textContent = 'Não foi possível carregar feriados';
          ul.appendChild(li);
        }
      }
      // Adiciona ícones/descricao se carregou da Nager
      try{
        const ulIcon = document.getElementById('holidayList');
        if (ulIcon && ulIcon.children.length > 0){
          const nlist = (h || []).slice(0,3);
          if (nlist.length){
            ulIcon.innerHTML = '';
            nlist.forEach(item => {
              const national = !!(item.global || (item.types||[]).includes('Public'));
              const li = document.createElement('li');
              const wd = weekdayPt(item.date);
              li.innerHTML = `<i class=\"bi bi-flag-fill text-primary me-1\"></i>${toBRDateShort(item.date)} <span class=\"text-muted\">(${wd})</span> — ${(item.localName||item.name)} <span class=\"text-muted\">(${national?'Nacional':'Regional'})</span>`;
              ulIcon.appendChild(li);
            });
          }
        }
      }catch(_){ /* ignore */ }

      // Fallback: BrasilAPI, caso a lista esteja vazia
      try{
        const ul2 = document.getElementById('holidayList');
        if (ul2 && ul2.children.length === 0){
          const year = new Date().getFullYear();
          const collect = async (y) => {
            const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${y}`);
            if (!r.ok) return [];
            return await r.json();
          };
          const all = [...await collect(year), ...await collect(year+1)];
          const todayStr = new Date().toISOString().slice(0,10);
          const upcoming = all.filter(x => x.date >= todayStr && String(x.type||'').toLowerCase()==='national').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
          upcoming.forEach(item => {
            const li = document.createElement('li');
            const wd = weekdayPt(item.date);
            li.innerHTML = `<i class=\"bi bi-flag-fill text-primary me-1\"></i>${toBRDateShort(item.date)} <span class=\"text-muted\">(${wd})</span> — ${item.name} <span class=\"text-muted\">(Nacional)</span>`;
            ul2.appendChild(li);
          });
        }
      }catch(_){ /* ignore */ }

    }catch(err){
      console.warn('Falha ao atualizar Weather/Feriados', err);
      setWeatherUnavailable();
      try{
        const ul = document.getElementById('holidayList');
        if (ul){
          ul.innerHTML = '';
          const li = document.createElement('li');
          li.className = 'text-muted';
          li.textContent = 'Não foi possível carregar feriados';
          ul.appendChild(li);
        }
      }catch(_){ /* ignore */ }
    }
  })();
}

function weatherCodeToPt(code){
  const map = {
    0:'Céu limpo', 1:'Principalmente limpo', 2:'Parcialmente nublado', 3:'Nublado',
    45:'Nevoeiro', 48:'Nevoeiro', 51:'Garoa leve', 53:'Garoa', 55:'Garoa forte',
    61:'Chuva leve', 63:'Chuva', 65:'Chuva forte', 71:'Neve leve', 73:'Neve', 75:'Neve forte',
    80:'Aguaceiros leves', 81:'Aguaceiros', 82:'Aguaceiros fortes', 95:'Trovoadas', 96:'Trovoadas com granizo', 99:'Trovoadas com granizo'
  };
  return map[code] || 'Condição desconhecida';
}

function weatherIconForCode(code){
  // Bootstrap Icons mapping
  const sun = 'bi-sun-fill';
  const cloudSun = 'bi-cloud-sun-fill';
  const cloud = 'bi-cloud-fill';
  const fog = 'bi-cloud-fog2-fill';
  const drizzle = 'bi-cloud-drizzle-fill';
  const rain = 'bi-cloud-rain-fill';
  const snow = 'bi-cloud-snow-fill';
  const storm = 'bi-cloud-lightning-rain-fill';
  const hail = 'bi-cloud-hail-fill';
  const map = {
    0:sun, 1:cloudSun, 2:cloudSun, 3:cloud,
    45:fog, 48:fog, 51:drizzle, 53:drizzle, 55:drizzle,
    61:rain, 63:rain, 65:rain, 71:snow, 73:snow, 75:snow,
    80:rain, 81:rain, 82:rain, 95:storm, 96:hail, 99:hail
  };
  return map[code] || cloud;
}

async function reverseGeocode(lat, lon){
  // Try a CORS-friendly endpoint first; fall back silently to Open‑Meteo
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
      { mode: 'cors' }
    );
    if (r.ok) {
      const j = await r.json();
      const city = j.city || j.locality || j.principalSubdivision || '';
      const admin1 = j.principalSubdivision || (j.localityInfo && j.localityInfo.administrative && j.localityInfo.administrative[0] && j.localityInfo.administrative[0].name) || '';
      const name = [city, admin1].filter(Boolean).join(', ');
      if (name) return name;
    }
  } catch (_) { /* fall through */ }

  try {
    const r2 = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=pt&format=json`,
      { mode: 'cors' }
    );
    if (!r2.ok) return '';
    const j2 = await r2.json();
    const g = j2?.results?.[0];
    if (!g) return '';
    return [g.name, g.admin1].filter(Boolean).join(', ');
  } catch { return ''; }
}
