// Agregações puras sobre arrays de pedidos/itens
import { toNum } from './format.js';

export function aggregateByDate(pedidos){
  const byDate = {};
  (pedidos || []).forEach(p => {
    const key = String(p?.PDOC_DT_EMISSAO || '').slice(0,10) || 'Sem data';
    byDate[key] = (byDate[key] || 0) + toNum(p?.PDOC_VLR_TOTAL);
  });
  return byDate;
}

export function aggregateByEmpresa(pedidos){
  const byEmp = {};
  (pedidos || []).forEach(p => {
    const key = p?.CEMP_PK ?? 'Sem empresa';
    byEmp[key] = (byEmp[key] || 0) + toNum(p?.PDOC_VLR_TOTAL);
  });
  return byEmp;
}

export function aggregateByMonth(pedidos){
  const byMonth = {};
  (pedidos || []).forEach(p => {
    const d = String(p?.PDOC_DT_EMISSAO || '').slice(0,10);
    if (!d) return;
    const key = d.slice(0,7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + toNum(p?.PDOC_VLR_TOTAL);
  });
  return byMonth;
}

export function aggregateTopProdutos(itens){
  const byProdQty = {};
  const byProdVal = {};
  (itens || []).forEach(it => {
    const prod = it?.EPRO_PK ?? '—';
    const qtd = toNum(it?.PITEN_QTD);
    // Compatibilidade: usa líquido se existir, senão bruto, senão campo antigo
    const val = (
      toNum(it?.PITEN_VLR_TOT_LIQUIDO) ||
      toNum(it?.PITEN_VLR_TOT_BRUTO) ||
      toNum(it?.PITEN_VLR_TOTAL)
    );
    byProdQty[prod] = (byProdQty[prod] || 0) + qtd;
    byProdVal[prod] = (byProdVal[prod] || 0) + val;
  });
  const top = Object.entries(byProdQty).sort((a,b) => b[1]-a[1]).slice(0,10);
  return { top, byProdVal };
}
