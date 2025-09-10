// UI dos filtros e badge de lista
export function initHourFilter(selectEl, onChange){
  if (!selectEl) return;
  for (let i=0; i<24; i++){
    const v = String(i).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    selectEl.appendChild(opt);
  }
  selectEl.addEventListener('change', onChange);
}

export function updateListBadge(badgeEl, total, exibidos, listLimit){
  if (!badgeEl) return;
  if (total === 0) {
    badgeEl.textContent = 'Nenhum pedido encontrado';
  } else if (total > exibidos) {
    if ((listLimit || 2) < 20) {
      badgeEl.textContent = `Exibindo ${exibidos} de ${total} (clique para ver 20)`;
    } else {
      badgeEl.textContent = `Exibindo ${exibidos} de ${total} (últimos 20)`;
    }
  } else {
    badgeEl.textContent = `Exibindo ${exibidos} de ${total}`;
  }
}

export function populateVendedorFiltro(selectEl, allPedidos, getVendedorNome){
  if (!selectEl) return;
  const current = selectEl.value;
  while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'Todos';
  selectEl.appendChild(optAll);
  const ids = Array.from(new Set((allPedidos || [])
    .map(p => p?.CCOT_VEND_PK)
    .filter(v => v !== null && v !== undefined)));
  const items = ids.map(id => ({ id, nome: getVendedorNome(id) || String(id) }));
  items.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  items.forEach(({id, nome}) => {
    const o = document.createElement('option');
    o.value = String(id);
    o.textContent = nome;
    selectEl.appendChild(o);
  });
  const exists = ids.some(id => String(id) === current);
  selectEl.value = exists ? current : '';
}
