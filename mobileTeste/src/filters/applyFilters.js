// Lógica pura de filtros (sem tocar no DOM)
import { toMillisFromDateTimeStrings } from '../utils/format.js';

export function filterPedidos(pedidos, { hora = '', dataInicio = '', dataFim = '', vendedor = '' } = {}){
  let filtrados = pedidos || [];
  if (hora) {
    filtrados = filtrados.filter(p => String(p?.PDOC_HR_EMISSAO || '').slice(0,2) === hora);
  }
  if (dataInicio || dataFim) {
    filtrados = filtrados.filter(p => {
      const d = String(p?.PDOC_DT_EMISSAO || '').slice(0,10);
      const geIni = dataInicio ? (d >= dataInicio) : true;
      const leFim = dataFim ? (d <= dataFim) : true;
      return geIni && leFim;
    });
  }
  if (vendedor) {
    filtrados = filtrados.filter(p => String(p?.CCOT_VEND_PK ?? '') === vendedor);
  }
  return filtrados;
}

export function sortPedidosDescPorDataHora(pedidos){
  return (pedidos || []).slice().sort((a,b) => {
    const ta = toMillisFromDateTimeStrings(a?.PDOC_DT_EMISSAO, a?.PDOC_HR_EMISSAO);
    const tb = toMillisFromDateTimeStrings(b?.PDOC_DT_EMISSAO, b?.PDOC_HR_EMISSAO);
    return tb - ta;
  });
}
