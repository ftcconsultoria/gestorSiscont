import { getBaseOpts, setChart, Chart, getPalette } from './chartService.js';

export function renderMonthlyBarChart(ctx, labels, actualData, projData){
  const pal = getPalette();
  const opts = getBaseOpts();
  opts.scales.y.beginAtZero = true;
  // Tooltip com BRL
  opts.plugins = {
    ...opts.plugins,
    tooltip: {
      ...opts.plugins.tooltip,
      callbacks: {
        label: (ctx) => {
          const v = ctx.parsed?.y ?? ctx.raw ?? 0;
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        }
      }
    }
  };

  setChart('bar-monthly', new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Projeção',
          data: projData,
          backgroundColor: `rgba(${pal.borderRgb}, .6)`,
          borderColor: `rgba(${pal.borderRgb}, .8)`,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 28,
          order: 1
        },
        {
          label: 'Atual',
          data: actualData,
          backgroundColor: pal.primary,
          borderColor: pal.primary,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 22,
          order: 0
        }
      ]
    },
    options: opts
  }));
}
