import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://retuujyjqylsyioargmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHV1anlqcXlsc3lpb2FyZ21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3MzIyOCwiZXhwIjoyMDY1ODQ5MjI4fQ._gXWfexTRD_Clwps3aXPtGCTv_e10pZQpsOFIQQPMds';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadPedidos() {
  const { data, error } = await supabase
    .from('pedidos_local')
    .select('*')
    .limit(50);

  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';

  if (error || !Array.isArray(data)) {
    console.error('Erro ao carregar pedidos:', error);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7">Erro ao carregar pedidos</td>`;
    tbody.appendChild(tr);
    return;
  }

  if (data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7">Nenhum pedido encontrado</td>`;
    tbody.appendChild(tr);
    return;
  }

  data.forEach(ped => {
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

  renderCharts(data);
}

document.addEventListener('DOMContentLoaded', () => {
  loadPedidos();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});

let charts = {}; // para destruir e recriar ao atualizar dados

function renderCharts(pedidos) {
  if (typeof Chart === 'undefined') return;

  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0);
  const toDateLabel = (d) => {
    if (!d) return 'Sem data';
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toISOString().slice(0,10);
  };

  // --- Agregações ---
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
  const lineData = lineLabels.map(l => byDate[l]);
  const pieLabels  = Object.keys(byEmpresa);
  const pieData    = pieLabels.map(l => byEmpresa[l]);

  // destrói instâncias anteriores (evita sobreposição)
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  // opções padrão para evitar altura 0 e manter responsivo
  const baseOpts = { responsive: true, maintainAspectRatio: false };

  // --- LINE ---
  const lineEl = document.getElementById('lineChart');
  if (lineEl) {
    charts.line = new Chart(lineEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: lineLabels,
        datasets: [{ label: 'Total por Data', data: lineData, tension: 0.25 }]
      },
      options: baseOpts
    });
  }

  // --- PIE ---
  const pieEl = document.getElementById('pieChart');
  if (pieEl) {
    const colors = pieLabels.length
      ? pieLabels.map((_, i) => `hsl(${(i*360)/Math.max(1,pieLabels.length)},70%,60%)`)
      : ['#ccc'];
    charts.pie = new Chart(pieEl.getContext('2d'), {
      type: 'pie',
      data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: colors }] },
      options: baseOpts
    });
  }

  // --- BAR (NOVO) ---
  const barEl = document.getElementById('barChart');
  if (barEl) {
    charts.bar = new Chart(barEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: pieLabels,
        datasets: [{ label: 'Total por Empresa', data: pieData }]
      },
      options: {
        ...baseOpts,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // debug: ajuda a confirmar dados
  console.debug('[charts] linhas:', lineLabels.length, 'empresas:', pieLabels.length);
}
