import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://retuujyjqylsyioargmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHV1anlqcXlsc3lpb2FyZ21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3MzIyOCwiZXhwIjoyMDY1ODQ5MjI4fQ._gXWfexTRD_Clwps3aXPtGCTv_e10pZQpsOFIQQPMds';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadPedidos() {
  const { data, error } = await supabase
    .from('pedidos_local')
    .select('*')
    .limit(50);

  if (error) {
    console.error('Erro ao carregar pedidos:', error);
    return;
  }

  const tbody = document.querySelector('#pedidosTable tbody');
  tbody.innerHTML = '';
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
}

document.addEventListener('DOMContentLoaded', () => {
  loadPedidos();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});
