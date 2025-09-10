import { test, expect, report } from './lib/testHarness.js';
import { aggregateByDate, aggregateByEmpresa, aggregateTopProdutos } from '../src/utils/aggregate.js';

const pedidos = [
  { CEMP_PK: 10, PDOC_DT_EMISSAO: '2024-05-01', PDOC_VLR_TOTAL: 100 },
  { CEMP_PK: 10, PDOC_DT_EMISSAO: '2024-05-01', PDOC_VLR_TOTAL: 50 },
  { CEMP_PK: 11, PDOC_DT_EMISSAO: '2024-05-02', PDOC_VLR_TOTAL: 70 },
];

const itens = [
  { EPRO_PK: 1, PITEN_QTD: 2, PITEN_VLR_TOTAL: 20 },
  { EPRO_PK: 1, PITEN_QTD: 4, PITEN_VLR_TOTAL: 40 },
  { EPRO_PK: 2, PITEN_QTD: 10, PITEN_VLR_TOTAL: 100 },
  { EPRO_PK: 3, PITEN_QTD: 1, PITEN_VLR_TOTAL: 5 },
];

test('aggregateByDate soma por dia', () => {
  const r = aggregateByDate(pedidos);
  expect(r).toEqual({ '2024-05-01': 150, '2024-05-02': 70 });
});

test('aggregateByEmpresa soma por empresa', () => {
  const r = aggregateByEmpresa(pedidos);
  expect(r).toEqual({ 10: 150, 11: 70 });
});

test('aggregateTopProdutos top por quantidade', () => {
  const { top, byProdVal } = aggregateTopProdutos(itens);
  // produto 2 (10), produto 1 (6), produto 3 (1)
  expect(top.map(([id, q]) => [Number(id), q])).toEqual([[2,10],[1,6],[3,1]]);
  expect(byProdVal).toEqual({ 1: 60, 2: 100, 3: 5 });
});

report();
