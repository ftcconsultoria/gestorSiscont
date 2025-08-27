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

function renderCharts(pedidos) {
  if (!Array.isArray(pedidos) || typeof Chart === 'undefined') {
    return;
  }

  // Line chart: total value by date
  const totalsByDate = {};
  pedidos.forEach(p => {
    const date = p.PDOC_DT_EMISSAO || 'Sem data';
    const total = parseFloat(p.PDOC_VLR_TOTAL) || 0;
    totalsByDate[date] = (totalsByDate[date] || 0) + total;
  });
  const lineLabels = Object.keys(totalsByDate).sort();
  const lineData = lineLabels.map(l => totalsByDate[l]);
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: lineLabels,
      datasets: [{
        label: 'Total por Data',
        data: lineData,
        borderColor: 'blue',
        fill: false
      }]
    }
  });

  // Pie chart: total value by company
  const totalsByEmpresa = {};
  pedidos.forEach(p => {
    const empresa = p.CEMP_PK || 'Sem empresa';
    const total = parseFloat(p.PDOC_VLR_TOTAL) || 0;
    totalsByEmpresa[empresa] = (totalsByEmpresa[empresa] || 0) + total;
  });
  const pieLabels = Object.keys(totalsByEmpresa);
  const pieData = pieLabels.map(l => totalsByEmpresa[l]);
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieLabels.map((_, i) => `hsl(${(i * 360) / pieLabels.length}, 70%, 60%)`)
      }]
    }
  });
}
