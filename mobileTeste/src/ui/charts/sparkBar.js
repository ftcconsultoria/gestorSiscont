import { Chart } from './chartService.js';
import { getPalette } from './chartService.js';

// Renders a compact bar sparkline with optional labels and currency tooltip
export function renderSparkBar(ctx, data, labels = [], { currency = false } = {}){
  const pal = getPalette();
  // destroy previous chart if exists
  try{ Chart.getChart(ctx)?.destroy(); }catch(_){}
  const lbls = (labels && labels.length) ? labels : data.map((_,i)=>i+1);
  const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lbls,
      datasets: [{
        data,
        backgroundColor: pal.primary,
        borderColor: pal.primary,
        borderRadius: 4,
        maxBarThickness: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => items?.[0]?.label || '',
            label: (ctx) => {
              const v = ctx.parsed?.y ?? ctx.raw ?? 0;
              return currency ? fmtCurrency(v) : String(v);
            }
          }
        }
      },
      scales: {
        x: { display: false, grid: { display: false }, ticks: { display: false } },
        y: { display: false, grid: { display: false }, ticks: { display: false } }
      }
    }
  });
}
