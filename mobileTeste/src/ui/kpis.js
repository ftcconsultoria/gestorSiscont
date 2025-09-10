// KPIs: cálculo e render
import { fmtBRL, toNum } from '../utils/format.js';

export function calcKPIs(pedidos){
  const total = (pedidos || []).reduce((s, p) => s + toNum(p?.PDOC_VLR_TOTAL), 0);
  const qtd = (pedidos || []).length;
  const ticket = qtd ? total / qtd : 0;
  const empresas = new Set((pedidos || []).map(p => p?.CEMP_PK ?? '—')).size;
  return { total, qtd, ticket, empresas };
}

export function renderKPIs({ total, qtd, ticket, empresas }){
  const elFat = document.getElementById('kpi-faturamento');
  const elTic = document.getElementById('kpi-ticket');
  const elQtd = document.getElementById('kpi-pedidos');
  const elEmp = document.getElementById('kpi-empresas');
  if (elFat) elFat.textContent = fmtBRL.format(total);
  if (elTic) elTic.textContent = fmtBRL.format(ticket);
  if (elQtd) elQtd.textContent = String(qtd);
  if (elEmp) elEmp.textContent = String(empresas);
}
