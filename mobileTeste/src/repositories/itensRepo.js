import { supabase } from '../api/supabaseClient.js';

export async function fetchItensByPedidos(pdocPks){
  if (!pdocPks?.length) return [];
  const chunk = (arr, size) => arr.reduce((acc, _, i) => (i % size ? acc : acc.concat([arr.slice(i, i + size)])), []);
  const chunks = chunk(pdocPks, 500);
  let itens = [];
  for (const part of chunks) {
    const { data, error } = await supabase
      .from('dash_itens_pedido_local')
      .select('EPRO_PK, PITEN_QTD, PDOC_PK, PITEN_VLR_TOT_BRUTO, PITEN_VLR_TOT_LIQUIDO, PITEN_VLR_DESCONTO, PITEN_VLR_ACRESCIMO')
      .in('PDOC_PK', part);
    if (error) { console.warn('Erro ao carregar itens de pedido:', error); continue; }
    itens = itens.concat(data || []);
  }
  return itens;
}
