import { getBaseOpts, setChart, Chart, getPalette } from './chartService.js';

export function renderEmpresaBarChart(ctx, labels, data){
  const pal = getPalette();
  const opts = getBaseOpts();
  opts.scales.y.beginAtZero = true;
  setChart('bar', new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Total por Empresa', data, backgroundColor: pal.primary, borderColor: pal.primary }] },
    options: {
      ...opts,
      plugins: {
        ...opts.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed?.y ?? ctx.raw ?? 0;
              return `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)}`;
            }
          }
        }
      }
    }
  }));
}
