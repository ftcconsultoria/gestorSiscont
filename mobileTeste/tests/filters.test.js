import { test, expect, report } from './lib/testHarness.js';
import { filterPedidos, sortPedidosDescPorDataHora } from '../src/filters/applyFilters.js';

const sample = [
  { PDOC_PK: 3, PDOC_DT_EMISSAO: '2024-05-02', PDOC_HR_EMISSAO: '10:30:00', PDOC_VLR_TOTAL: 100, CCOT_VEND_PK: 2, CEMP_PK: 10 },
  { PDOC_PK: 1, PDOC_DT_EMISSAO: '2024-05-01', PDOC_HR_EMISSAO: '09:00:00', PDOC_VLR_TOTAL: 200, CCOT_VEND_PK: 1, CEMP_PK: 10 },
  { PDOC_PK: 2, PDOC_DT_EMISSAO: '2024-05-01', PDOC_HR_EMISSAO: '11:00:00', PDOC_VLR_TOTAL: 150, CCOT_VEND_PK: 2, CEMP_PK: 11 },
  { PDOC_PK: 4, PDOC_DT_EMISSAO: '2024-05-03', PDOC_HR_EMISSAO: '08:00:00', PDOC_VLR_TOTAL: 90,  CCOT_VEND_PK: 3, CEMP_PK: 11 },
];

test('filterPedidos - por hora', () => {
  const r = filterPedidos(sample, { hora: '09' });
  expect(r.map(p => p.PDOC_PK)).toEqual([1]);
});

test('filterPedidos - por período', () => {
  const r = filterPedidos(sample, { dataInicio: '2024-05-01', dataFim: '2024-05-02' });
  expect(r.map(p => p.PDOC_PK).sort()).toEqual([1,2,3]);
});

test('filterPedidos - por vendedor', () => {
  const r = filterPedidos(sample, { vendedor: '2' });
  expect(r.map(p => p.PDOC_PK).sort()).toEqual([2,3]);
});

test('sortPedidosDescPorDataHora', () => {
  const r = sortPedidosDescPorDataHora(sample);
  // Espera ordem: 4 (2024-05-03 08h), 3 (2024-05-02 10:30), 2 (2024-05-01 11h), 1 (2024-05-01 09h)
  expect(r.map(p => p.PDOC_PK)).toEqual([4,3,2,1]);
});

report();
