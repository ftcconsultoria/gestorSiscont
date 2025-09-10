// Renderização da tabela de pedidos
import { fmtBRL, toNum, toBRDate } from '../utils/format.js';

export function renderTable(tbodyEl, pedidos, getVendedorNome){
  tbodyEl.innerHTML = '';
  if (!pedidos?.length){
    tbodyEl.innerHTML = `<tr><td colspan="4">Nenhum pedido encontrado</td></tr>`;
    return;
  }
  pedidos.forEach(ped => {
    const tr = document.createElement('tr');
    const vendedorNome = getVendedorNome(ped.CCOT_VEND_PK);
    tr.innerHTML = `
      <td>${ped.PDOC_PK ?? ''}</td>
      <td>${toBRDate(ped.PDOC_DT_EMISSAO)}</td>
      <td>${fmtBRL.format(toNum(ped.PDOC_VLR_TOTAL))}</td>
      <td>${vendedorNome}</td>
    `;
    tbodyEl.appendChild(tr);
  });
}
