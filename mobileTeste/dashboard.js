// Importa Chart.js como ES Module — garante disponibilidade no script de módulo
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ===== Chart.js ESM: import único e registro automático ===== */
// limpa possível poluição global deixada por UMD antigo
if (typeof window !== 'undefined' && 'Chart' in window) {
  try { delete window.Chart; } catch (_) { /* ignore */ }
}

// importa o pacote ESM e registra tudo (controllers/elements/scales)
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm';
Chart.register(...registerables);

// (debug) garanta que veio uma função construtora
console.debug('Chart typeof:', typeof Chart); // deve imprimir "function"

// Limite de linhas exibidas na tabela (inicialmente 2)
let listLimit = 2;

// Paginação no backend
const PAGE_SIZE = 200;
let pageFrom = 0;   // índice inicial
let hasMore = true; // se ainda há mais páginas

// Configuração da tabela de usuários (vendedores)
const USERS_TABLE = 'CADE_USUARIO';
const USER_PK_FIELD = 'CCOT_VEND_PK';
const USER_NAME_FIELD = 'CUSU_USUARIO';
const vendedoresMap = new Map(); // pk -> nome (cache)

const SUPABASE_URL = 'https://retuujyjqylsyioargmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHV1anlqcXlsc3lpb2FyZ21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3MzIyOCwiZXhwIjoyMDY1ODQ5MjI4fQ._gXWfexTRD_Clwps3aXPtGCTv_e10pZQpsOFIQQPMds';
// ⚠️ Em produção, NUNCA use service_role no front-end.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let allPedidos = [];
let charts = {}; // instâncias dos gráficos

document.addEventListener('DOMContentLoaded', () => {
  // popula filtro de hora
  const select = document.getElementById('horaFiltro');
  if (select) {
    for (let i = 0; i < 24; i++) {
      const v = String(i).padStart(2, '0');
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    }
    select.addEventListener('change', applyFilter);
  }

  // eventos para período (data início/fim) e botão aplicar
  const dataIni = document.getElementById('dataInicio');
  const dataFim = document.getElementById('dataFim');
  const btnReload = document.getElementById('btnReload');
  if (dataIni) dataIni.addEventListener('change', () => loadPedidos(true));
  if (dataFim) dataFim.addEventListener('change', () => loadPedidos(true));
  if (btnReload) btnReload.addEventListener('click', () => loadPedidos(true));

  // evento para filtro de vendedor
  const vendSelect = document.getElementById('vendedorFiltro');
  if (vendSelect) {
    vendSelect.addEventListener('change', applyFilter);
  }

  // carrega dados
  loadPedidos();

  // registra SW (ok manter)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  // Alterna a quantidade exibida (2 ↔ 20) ao clicar no título
  const titulo = document.getElementById('listaTitulo');
  if (titulo) {
    titulo.addEventListener('click', () => {
      listLimit = (listLimit >= 20) ? 2 : 20;
      applyFilter();
    });
  }

  // Botão Carregar Mais (paginação incremental)
  const btnMore = document.getElementById('btnCarregarMais');
  if (btnMore) {
    btnMore.addEventListener('click', () => loadPedidos(false));
  }

  // Botão Carregar Tudo (aviso de performance)
  const btnAll = document.getElementById('btnCarregarTudo');
  if (btnAll) {
    btnAll.addEventListener('click', () => loadAllPedidos());
  }
});

async function loadPedidos(reset = false) {
  if (reset) { pageFrom = 0; hasMore = true; allPedidos = []; }

  let query = supabase
    .from('pedidos_local')
    .select('*')
    .order('PDOC_DT_EMISSAO', { ascending: false })
    .order('PDOC_HR_EMISSAO', { ascending: false });

  // Filtro de período no backend
  const di = document.getElementById('dataInicio')?.value;
  const df = document.getElementById('dataFim')?.value;
  if (di) query = query.gte('PDOC_DT_EMISSAO', di);
  if (df) query = query.lte('PDOC_DT_EMISSAO', df);

  const from = pageFrom;
  const to = pageFrom + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error } = await query;

  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';

  if (error || !Array.isArray(data)) {
    console.error('Erro ao carregar pedidos:', error);
    tbody.innerHTML = `<tr><td colspan="4">Erro ao carregar pedidos</td></tr>`;
    renderCharts([]); // ainda desenha “vazio” p/ não ficar branco
    return;
  }

  allPedidos = [...allPedidos, ...(data || [])];
  pageFrom += (data || []).length;
  hasMore = (data || []).length === PAGE_SIZE;

  const btnMore = document.getElementById('btnCarregarMais');
  if (btnMore) {
    btnMore.disabled = !hasMore;
    btnMore.textContent = hasMore ? 'Carregar mais' : 'Tudo carregado';
  }
  applyFilter();

  // Popula filtro de vendedor com base nos pedidos carregados
  populateVendedorFiltro();

  // Carrega nomes dos vendedores e atualiza a lista ao concluir
  const idsVendedores = Array.from(new Set((allPedidos || [])
    .map(p => p?.CCOT_VEND_PK)
    .filter(v => v !== null && v !== undefined)));
  ensureVendedores(idsVendedores).then(() => {
    try { applyFilter(); } catch (_) {}
    try { populateVendedorFiltro(); } catch (_) {}
  });
}

// Carrega todas as páginas respeitando o período selecionado
async function loadAllPedidos(){
  const btnAll = document.getElementById('btnCarregarTudo');
  const btnMore = document.getElementById('btnCarregarMais');
  const btnReload = document.getElementById('btnReload');
  try{
    const proceed = window.confirm('Aviso: carregar tudo pode ser lento e consumir muitos dados. Deseja continuar?');
    if (!proceed) return;

    if (btnAll) { btnAll.disabled = true; btnAll.textContent = 'Carregando tudo...'; }
    if (btnMore) { btnMore.disabled = true; }
    if (btnReload) { btnReload.disabled = true; }

    await loadPedidos(true);
    // busca páginas subsequentes
    while (hasMore) {
      await loadPedidos(false);
      await new Promise(r => setTimeout(r, 0));
    }
  } catch (e) {
    console.warn('Falha ao carregar tudo:', e);
  } finally {
    if (btnReload) btnReload.disabled = false;
    if (btnAll) {
      btnAll.disabled = !hasMore;
      btnAll.textContent = hasMore ? 'Carregar tudo' : 'Tudo carregado';
    }
    if (btnMore) {
      btnMore.disabled = !hasMore;
      btnMore.textContent = hasMore ? 'Carregar mais' : 'Tudo carregado';
    }
  }
}

function renderTable(pedidos) {
  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';

  if (!pedidos?.length) {
    tbody.innerHTML = `<tr><td colspan="4">Nenhum pedido encontrado</td></tr>`;
    return;
  }

  const toBRDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (!isNaN(dt)) {
        return dt.toLocaleDateString('pt-BR');
      }
      // fallback para string YYYY-MM-DD
      const s = String(d).slice(0,10);
      const [y,m,day] = s.split('-');
      return (y && m && day) ? `${day}/${m}/${y}` : s;
    } catch (_) { return String(d); }
  };

  pedidos.forEach(ped => {
    const tr = document.createElement('tr');
    const vendedorNome = getVendedorNome(ped.CCOT_VEND_PK);
    tr.innerHTML = `
      <td>${ped.PDOC_PK ?? ''}</td>
      <td>${toBRDate(ped.PDOC_DT_EMISSAO)}</td>
      <td>${fmtBRL.format(toNum(ped.PDOC_VLR_TOTAL))}</td>
      <td>${vendedorNome}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Busca e cache de vendedores (CADE_USUARIO)
function getVendedorNome(pk){
  if (pk === null || pk === undefined) return '';
  return vendedoresMap.get(pk) || '';
}

async function ensureVendedores(ids){
  try{
    const faltantes = (ids || []).filter(id => !vendedoresMap.has(id));
    if (!faltantes.length) return;
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select(`${USER_PK_FIELD}, ${USER_NAME_FIELD}`)
      .in(USER_PK_FIELD, faltantes);
    if (error) { console.warn('Falha ao carregar vendedores:', error); return; }
    (data || []).forEach(row => {
      const k = row?.[USER_PK_FIELD];
      const n = row?.[USER_NAME_FIELD];
      if (k !== null && k !== undefined) vendedoresMap.set(k, n || '');
    });
  } catch(err){
    console.warn('Erro em ensureVendedores:', err);
  }
}

function applyFilter() {
  const hora = document.getElementById('horaFiltro')?.value ?? '';
  const dataIni = document.getElementById('dataInicio')?.value ?? '';
  const dataFim = document.getElementById('dataFim')?.value ?? '';
  const vend = document.getElementById('vendedorFiltro')?.value ?? '';
  let filtrados = allPedidos;

  if (hora) {
    filtrados = filtrados.filter(p => {
      const h = (p.PDOC_HR_EMISSAO || '').toString().slice(0, 2);
      return h === hora;
    });
  }

  // Período (inclusive)
  if (dataIni || dataFim) {
    filtrados = filtrados.filter(p => {
      const d = (p.PDOC_DT_EMISSAO || '').toString().slice(0, 10);
      const geIni = dataIni ? (d >= dataIni) : true;
      const leFim = dataFim ? (d <= dataFim) : true;
      return geIni && leFim;
    });
  }

  if (vend) {
    filtrados = filtrados.filter(p => String(p?.CCOT_VEND_PK ?? '') === vend);
  }

  // Ordena por data/hora de emissão (desc) e limita a 20 itens para a listagem
  const toMillis = (p) => {
    const d = String(p?.PDOC_DT_EMISSAO ?? '').slice(0, 10); // YYYY-MM-DD
    const h = String(p?.PDOC_HR_EMISSAO ?? '').slice(0, 8);  // HH:MM:SS
    const iso = d ? `${d}T${h || '00:00:00'}` : '';
    const t = Date.parse(iso);
    return Number.isNaN(t) ? 0 : t;
  };

  const visiveis = (filtrados || [])
    .slice()
    .sort((a, b) => toMillis(b) - toMillis(a))
    .slice(0, Math.max(0, listLimit || 2));

  renderTable(visiveis);
  // Mantém KPIs e gráficos com o conjunto completo filtrado
  updateKPIs(filtrados);
  renderCharts(filtrados);

  // Atualiza aviso visual de limitação
  const aviso = document.getElementById('listaAviso');
  if (aviso) {
    const total = (filtrados || []).length;
    const exibidos = (visiveis || []).length;
    if (total === 0) {
      aviso.textContent = 'Nenhum pedido encontrado';
      aviso.style.display = '';
    } else if (total > exibidos) {
      if ((listLimit || 2) < 20) {
        aviso.textContent = `Exibindo ${exibidos} de ${total} (clique para ver 20)`;
      } else {
        aviso.textContent = `Exibindo ${exibidos} de ${total} (últimos 20)`;
      }
      aviso.style.display = '';
    } else {
      aviso.textContent = `Exibindo ${exibidos} de ${total}`;
      aviso.style.display = '';
    }
  }
}

// Formatador BRL
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Converte número
const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0);

// Atualiza os 4 cards de KPI
function updateKPIs(pedidos){
  const total = (pedidos || []).reduce((s, p) => s + toNum(p.PDOC_VLR_TOTAL), 0);
  const qtd   = (pedidos || []).length;
  const ticket = qtd ? (total / qtd) : 0;

  const empresasSet = new Set((pedidos || []).map(p => p.CEMP_PK ?? '—'));
  const empresas = empresasSet.size;

  // injeta na UI
  const elFat = document.getElementById('kpi-faturamento');
  const elTic = document.getElementById('kpi-ticket');
  const elQtd = document.getElementById('kpi-pedidos');
  const elEmp = document.getElementById('kpi-empresas');

  if (elFat) elFat.textContent = fmtBRL.format(total);
  if (elTic) elTic.textContent = fmtBRL.format(ticket);
  if (elQtd) elQtd.textContent = String(qtd);
  if (elEmp) elEmp.textContent = String(empresas);
}

function renderCharts(pedidos) {
  // helper numérico e de data
  const toDateLabel = (d) => {
    if (!d) return 'Sem data';
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toISOString().slice(0,10);
  };

  // agrega
  const byDate = {};
  const byEmpresa = {};
  (pedidos || []).forEach(p => {
    const total = toNum(p.PDOC_VLR_TOTAL);
    const d = toDateLabel(p.PDOC_DT_EMISSAO);
    const emp = p.CEMP_PK ?? 'Sem empresa';
    byDate[d] = (byDate[d] || 0) + total;
    byEmpresa[emp] = (byEmpresa[emp] || 0) + total;
  });

  const lineLabels = Object.keys(byDate).sort();
  const lineData   = lineLabels.map(l => byDate[l]);
  // Dados por empresa para o gráfico de barras
  const empresaLabels = Object.keys(byEmpresa);
  const empresaData   = empresaLabels.map(l => byEmpresa[l]);
  // Pie chart passa a mostrar top 10 produtos (atualizado assincronamente)

  // destrói instâncias antigas (evita sobreposição)
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  // opções base
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 }
  };

  // LINE
  const lineEl = document.getElementById('lineChart');
  if (lineEl) {
    charts.line = new Chart(lineEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: lineLabels,
        datasets: [{
          label: 'Total por Data',
          data: lineData,
          tension: 0.25,
          pointRadius: 3
        }]
      },
      options: baseOpts
    });
  }

  // Top 10 Produtos em barras
  renderTopProductsPie(pedidos, baseOpts);

  // BAR (Total por Empresa)
  const barEl = document.getElementById('barChart');
  if (barEl) {
    charts.bar = new Chart(barEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: empresaLabels,
        datasets: [{
          label: 'Total por Empresa',
          data: empresaData
        }]
      },
      options: {
        ...baseOpts,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  console.debug('[charts] linhas:', lineLabels.length, 'empresas:', empresaLabels.length);
}
function populateVendedorFiltro(){
  const select = document.getElementById('vendedorFiltro');
  if (!select) return;
  const current = select.value;
  // limpa
  while (select.firstChild) select.removeChild(select.firstChild);
  // opção Todos
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'Todos';
  select.appendChild(optAll);
  // coletar IDs presentes nos pedidos
  const ids = Array.from(new Set((allPedidos || [])
    .map(p => p?.CCOT_VEND_PK)
    .filter(v => v !== null && v !== undefined)));
  const items = ids.map(id => ({ id, nome: getVendedorNome(id) || String(id) }));
  items.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  items.forEach(({id, nome}) => {
    const o = document.createElement('option');
    o.value = String(id);
    o.textContent = nome;
    select.appendChild(o);
  });
  // restaura seleção se possível
  const exists = ids.some(id => String(id) === current);
  select.value = exists ? current : '';
}

// Renderiza gráfico de barras com top 10 produtos por quantidade
async function renderTopProductsPie(pedidos, baseOpts){
  const pieEl = document.getElementById('pieChart');
  if (!pieEl) return;
  // destrói instância anterior
  charts.pie?.destroy();

  // Coleta os IDs de pedido; usa PDOC_PK (mais comum nos itens)
  const ids = Array.from(new Set((pedidos || []).map(p => p?.PDOC_PK).filter(Boolean)));
  if (!ids.length) {
    // nada a mostrar
    charts.pie = new Chart(pieEl.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [] }] },
      options: { ...baseOpts, scales: { y: { beginAtZero: true } } }
    });
    return;
  }

  // Busca itens dos pedidos filtrados
  let itens = [];
  const chunk = (arr, size) => arr.reduce((acc, _, i) => (i % size ? acc : acc.concat([arr.slice(i, i + size)])), []);
  const chunks = chunk(ids, 500);
  for (const part of chunks) {
    const { data, error } = await supabase
      .from('intes_pedido_local')
      .select('EPRO_PK, PITEN_QTD, PITEN_VLR_TOTAL, PDOC_PK')
      .in('PDOC_PK', part);
    if (error) { console.warn('Erro ao carregar itens de pedido:', error); continue; }
    itens = itens.concat(data || []);
  }

  // Agrega por produto (quantidade)
  const byProd = {};
  const byProdVal = {};
  itens.forEach(it => {
    const prod = it?.EPRO_PK ?? '—';
    const qtd = toNum(it?.PITEN_QTD);
    const val = toNum(it?.PITEN_VLR_TOTAL);
    byProd[prod] = (byProd[prod] || 0) + qtd;
    byProdVal[prod] = (byProdVal[prod] || 0) + val;
  });

  // Top 10
  const entries = Object.entries(byProd).sort((a,b) => b[1]-a[1]).slice(0,10);
  const topIds = entries.map(([prod]) => prod);
  // garante nomes dos produtos (descrição)
  await ensureProdutos(topIds);
  // Rótulos visuais: usar o código do produto (não o nome)
  const prodIds   = entries.map(([prod]) => String(prod));
  const prodNames = entries.map(([prod]) => getProdutoNome(prod) || 'Descrição indisponível');
  const pieData   = entries.map(([,q]) => q);
  const pieSales  = entries.map(([prod]) => byProdVal[prod] || 0);
  const colors = prodIds.length
    ? prodIds.map((_, i) => `hsl(${(i*360)/Math.max(1,prodIds.length)},70%,55%)`)
    : ['#d0d0d0'];

  charts.pie = new Chart(pieEl.getContext('2d'), {
    type: 'bar',
    data: {
      labels: prodIds,
      datasets: [{ label: 'Quantidade', data: pieData, backgroundColor: colors, sales: pieSales, names: prodNames }]
    },
    options: {
      ...baseOpts,
      scales: { y: { beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: {
            // 1ª linha: descrição do produto (não exibir no eixo/legenda)
            title: (items) => {
              const idx = items?.[0]?.dataIndex ?? 0;
              return (items?.[0]?.dataset?.names?.[idx]) || 'Descrição indisponível';
            },
            // 2ª linha: soma em reais das vendas
            label: (ctx) => {
              const sales = ctx.dataset?.sales?.[ctx.dataIndex] ?? 0;
              return `Vendas: ${fmtBRL.format(sales)}`;
            },
            // 3ª linha: soma da quantidade vendida
            afterLabel: (ctx) => {
              const qty = ctx.dataset?.data?.[ctx.dataIndex] ?? 0;
              return `Qtd: ${qty}`;
            }
          }
        }
      }
    }
  });
}

// ==== Nomes de produtos (cache local) ====
const PRODUCTS_TABLE = 'produtos_locais';
const PRODUCT_PK_FIELD = 'EPRO_PK';
const PRODUCT_NAME_FIELD = 'EPRO_DESCRICAO';
const produtosMap = new Map(); // pk -> nome

function getProdutoNome(pk){
  if (pk === null || pk === undefined) return '';
  return produtosMap.get(Number(pk)) || produtosMap.get(String(pk)) || '';
}

async function ensureProdutos(ids){
  try{
    // Normaliza para número quando possível e remove inválidos
    const norm = (ids || [])
      .map(id => (typeof id === 'number' ? id : Number(id)))
      .filter(n => Number.isFinite(n));
    const faltantes = norm.filter(id => !produtosMap.has(id) && !produtosMap.has(String(id)));
    if (!faltantes.length) return;

    // tenta na tabela informada
    let { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .select(`${PRODUCT_PK_FIELD}, ${PRODUCT_NAME_FIELD}`)
      .in(PRODUCT_PK_FIELD, faltantes);

    // fallback para possível nome singular
    if (error) {
      console.warn('Falha produtos (tabela produtos_locais). Tentando fallback produtos_local:', error?.message || error);
      const alt = 'produtos_local';
      const res2 = await supabase
        .from(alt)
        .select(`${PRODUCT_PK_FIELD}, ${PRODUCT_NAME_FIELD}`)
        .in(PRODUCT_PK_FIELD, faltantes);
      data = res2.data; error = res2.error;
    }

    if (error) { console.warn('Falha ao carregar produtos:', error); return; }
    (data || []).forEach(row => {
      const kNum = row?.[PRODUCT_PK_FIELD];
      const name = row?.[PRODUCT_NAME_FIELD] || '';
      if (kNum !== null && kNum !== undefined) {
        produtosMap.set(kNum, name);
        produtosMap.set(String(kNum), name);
      }
    });
  } catch(err){
    console.warn('Erro em ensureProdutos:', err);
  }
}
