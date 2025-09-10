import { supabase } from '../api/supabaseClient.js';

export const PAGE_SIZE = 200;

export async function fetchPedidos({ di, df, from, to }){
  let query = supabase
    .from('dash_pedidos_local')
    .select('*')
    .order('PDOC_DT_EMISSAO', { ascending: false })
    .order('PDOC_HR_EMISSAO', { ascending: false })
    .range(from, to);

  if (di) query = query.gte('PDOC_DT_EMISSAO', di);
  if (df) query = query.lte('PDOC_DT_EMISSAO', df);

  try {
    const empresaAtual = localStorage.getItem('empresaAtual');
    if (empresaAtual) {
      const emp = JSON.parse(empresaAtual);
      if (emp?.CEMP_PK !== undefined && emp?.CEMP_PK !== null) {
        try { console.info('[Pedidos] Filtrando por CEMP_PK =', emp.CEMP_PK); } catch(_){}
        query = query.eq('CEMP_PK', emp.CEMP_PK);
      }
    }
  } catch(_){}

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
