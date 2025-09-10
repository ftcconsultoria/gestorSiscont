import { supabase } from '../api/supabaseClient.js';

const TABLE_CANDIDATES = [
  'CADE_EMPRESA',
  'empresa',
  'empresas',
  'dash_empresas_local'
];

const NAME_FIELDS = [
  'CEMP_RAZAO', 'CEMP_FANTASIA', 'RAZAO_SOCIAL', 'NOME_FANTASIA',
  'RAZAO', 'FANTASIA', 'NOME', 'nome', 'descricao', 'DESCRICAO'
];

function pickName(obj){
  for (const k of NAME_FIELDS){
    if (obj && obj[k] && String(obj[k]).trim().length){
      return String(obj[k]).trim();
    }
  }
  return null;
}

export async function fetchEmpresasInfoByIds(ids){
  if (!ids?.length) return [];

  // Tenta obter nomes diretamente da tabela de vínculo, caso tenha colunas de nome
  try {
    const { data, error } = await supabase
      .from('dash_usuario_empresa')
      .select('*')
      .in('CEMP_PK', ids);
    if (!error && Array.isArray(data) && data.length){
      const mapped = data.map(row => ({
        CEMP_PK: row?.CEMP_PK,
        name: pickName(row)
      })).filter(x => x.CEMP_PK !== undefined && x.CEMP_PK !== null && x.name);
      if (mapped.length){ return mapped; }
    }
  } catch(_){}

  // Caso contrário, tenta em tabelas candidatas
  for (const table of TABLE_CANDIDATES){
    try{
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('CEMP_PK', ids);
      if (!error && Array.isArray(data) && data.length){
        return data.map(row => ({
          CEMP_PK: row?.CEMP_PK,
          name: pickName(row)
        }));
      }
    }catch(_){ /* tenta próxima */ }
  }

  return [];
}

// Busca diretamente na tabela CADE_EMPRESA os nomes (CEMP_RAZAO)
export async function fetchEmpresasRazaoByIds(ids){
  if (!ids?.length) return [];
  try{
    const { data, error } = await supabase
      .from('CADE_EMPRESA')
      .select('CEMP_PK, CEMP_RAZAO')
      .in('CEMP_PK', ids);
    if (error) throw error;
    return (data || []).map(r => ({ CEMP_PK: r?.CEMP_PK, name: r?.CEMP_RAZAO || null }));
  }catch(err){
    return [];
  }
}
