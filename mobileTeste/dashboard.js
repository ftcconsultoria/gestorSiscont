// Importa Chart.js como ES Module — garante disponibilidade no script de módulo
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

  // carrega dados
  loadPedidos();

  // registra SW (ok manter)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});

async function loadPedidos() {
  const { data, error } = await supabase
    .from('pedidos_local')
    .select('*')
    .limit(200);

  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';

  if (error || !Array.isArray(data)) {
    console.error('Erro ao carregar pedidos:', error);
    tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar pedidos</td></tr>`;
    renderCharts([]); // ainda desenha “vazio” p/ não ficar branco
    return;
  }

  allPedidos = data;
  applyFilter();
}

function renderTable(pedidos) {
  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';

  if (!pedidos?.length) {
    tbody.innerHTML = `<tr><td colspan="7">Nenhum pedido encontrado</td></tr>`;
    return;
  }

  pedidos.forEach(ped => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ped.PDOC_UUID}</td>
      <td>${ped.PDOC_PK}</td>
      <td>${ped.CEMP_PK}</td>
      <td>${ped.PDOC_DT_EMISSAO ?? ''}</td>
      <td>${ped.PDOC_HR_EMISSAO ?? ''}</td>
      <td>${ped.PDOC_VLR_TOTAL ?? ''}</td>
      <td>${ped.CCOT_VEND_PK ?? ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function applyFilter() {
  const select = document.getElementById('horaFiltro');
  const hora = select?.value ?? '';
  let filtrados = allPedidos;

  if (hora) {
    filtrados = allPedidos.filter(p => {
      const h = (p.PDOC_HR_EMISSAO || '').toString().slice(0, 2);
      return h === hora;
    });
  }

  renderTable(filtrados);
  updateKPIs(filtrados);
  renderCharts(filtrados);
  updateKPIs(filtrados);
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
  const pieLabels  = Object.keys(byEmpresa);
  const pieData    = pieLabels.map(l => byEmpresa[l]);

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

  // PIE
  const pieEl = document.getElementById('pieChart');
  if (pieEl) {
    const colors = pieLabels.length
      ? pieLabels.map((_, i) => `hsl(${(i*360)/Math.max(1,pieLabels.length)},70%,55%)`)
      : ['#d0d0d0'];
    charts.pie = new Chart(pieEl.getContext('2d'), {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{ data: pieData, backgroundColor: colors }]
      },
      options: baseOpts
    });
  }

  // BAR
  const barEl = document.getElementById('barChart');
  if (barEl) {
    charts.bar = new Chart(barEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: pieLabels,
        datasets: [{
          label: 'Total por Empresa',
          data: pieData
        }]
      },
      options: {
        ...baseOpts,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  console.debug('[charts] linhas:', lineLabels.length, 'empresas:', pieLabels.length);
}

function updateKPIs(pedidos){
  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0);
  const total = (pedidos || []).reduce((sum, p) => sum + toNum(p.PDOC_VLR_TOTAL), 0);
  const qtd = pedidos?.length || 0;
  const ticket = qtd ? total / qtd : 0;
  const empresas = new Set((pedidos || []).map(p => p.CEMP_PK).filter(Boolean)).size;
  const fmt = (n) => n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('kpi-faturamento').textContent = fmt(total);
  document.getElementById('kpi-ticket').textContent = fmt(ticket);
  document.getElementById('kpi-pedidos').textContent = qtd;
  document.getElementById('kpi-empresas').textContent = empresas;
}
