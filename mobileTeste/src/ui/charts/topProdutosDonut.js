import { getBaseOpts, setChart, Chart, getPalette } from './chartService.js';

// Mantém o mesmo nome de export para não quebrar o restante do app
export function renderTopProdutosBarChart(ctx, labels, quantities, sales, names){
  const pal = getPalette();
  const colors = labels.length
    ? labels.map((_, i) => `hsl(${(i*360)/Math.max(1,labels.length)},70%,55%)`)
    : [pal.primary];

  const opts = getBaseOpts();
  setChart('pie', new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        label: 'Quantidade',
        data: quantities,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        sales,
        names
      }]
    },
    options: {
      ...opts,
      cutout: '60%',
      plugins: {
        ...opts.plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items?.[0]?.dataIndex ?? 0;
              return (items?.[0]?.dataset?.names?.[idx]) || 'Descrição indisponível';
            },
            label: (ctx) => {
              const salesVal = ctx.dataset?.sales?.[ctx.dataIndex] ?? 0;
              return `Vendas: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(salesVal)}`;
            },
            afterLabel: (ctx) => {
              const qty = ctx.dataset?.data?.[ctx.dataIndex] ?? 0;
              return `Qtd: ${qty}`;
            }
          }
        }
      }
    }
  }));
}

