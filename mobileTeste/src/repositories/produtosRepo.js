import { supabase, isSupabaseEnabled } from '../api/supabaseClient.js';

const PRODUCTS_TABLE = 'dash_produtos_local';
const PRODUCT_PK_FIELD = 'EPRO_PK';
const PRODUCT_NAME_FIELD = 'EPRO_DESCRICAO';

export async function fetchProdutosByIds(ids){
  if (!isSupabaseEnabled() || !ids?.length) return [];
  // tenta na tabela principal
  let { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select(`${PRODUCT_PK_FIELD}, ${PRODUCT_NAME_FIELD}`)
    .in(PRODUCT_PK_FIELD, ids);
  if (error) {
    // fallback: tenta nome antigo se necessário
    const res2 = await supabase
      .from('produtos_local')
      .select(`${PRODUCT_PK_FIELD}, ${PRODUCT_NAME_FIELD}`)
      .in(PRODUCT_PK_FIELD, ids);
    data = res2.data; error = res2.error;
  }
  if (error) throw error;
  return data || [];
}
