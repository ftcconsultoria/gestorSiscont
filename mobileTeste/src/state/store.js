// Estado simples do app e caches de nomes
export const state = {
  listLimit: 2,
  pageFrom: 0,
  hasMore: true,
  allPedidos: [],
};

export const vendedoresMap = new Map();
export const produtosMap = new Map();

export function getVendedorNome(pk){
  if (pk === null || pk === undefined) return '';
  // Tenta chaves em diferentes tipos para evitar mismatch (string/number)
  return (
    vendedoresMap.get(pk) ||
    vendedoresMap.get(Number(pk)) ||
    vendedoresMap.get(String(pk)) ||
    ''
  );
}
export function setVendedores(rows){
  (rows || []).forEach(row => {
    const k = row?.CCOT_VEND_PK;
    const n = row?.CUSU_USUARIO;
    if (k !== null && k !== undefined){
      const name = n || '';
      vendedoresMap.set(k, name);
      vendedoresMap.set(String(k), name);
      const num = Number(k);
      if (!Number.isNaN(num)) vendedoresMap.set(num, name);
    }
  });
}

export function getProdutoNome(pk){
  if (pk === null || pk === undefined) return '';
  return produtosMap.get(Number(pk)) || produtosMap.get(String(pk)) || '';
}
export function setProdutos(rows){
  (rows || []).forEach(r => {
    const k = r?.EPRO_PK;
    const name = r?.EPRO_DESCRICAO || '';
    if (k !== null && k !== undefined){
      produtosMap.set(k, name);
      produtosMap.set(String(k), name);
    }
  });
}
