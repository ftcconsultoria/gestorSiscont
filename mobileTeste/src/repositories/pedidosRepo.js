import { supabase, isSupabaseEnabled } from '../api/supabaseClient.js';

export const PAGE_SIZE = 200;

export async function fetchPedidos({ di, df, from, to }){
  if (!isSupabaseEnabled()) return [];
  let query = supabase
    .from('dash_pedidos_local')
    .select('*')
    .order('PDOC_DT_EMISSAO', { ascending: false })
    .order('PDOC_HR_EMISSAO', { ascending: false })
    .range(from, to);

  if (di) query = query.gte('PDOC_DT_EMISSAO', di);
  if (df) query = query.lte('PDOC_DT_EMISSAO', df);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
