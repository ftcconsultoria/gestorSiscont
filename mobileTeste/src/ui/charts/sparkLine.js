import { Chart } from './chartService.js';
import { getPalette } from './chartService.js';

export function renderSparkLine(ctx, data){
  const pal = getPalette();
  try{ Chart.getChart(ctx)?.destroy(); }catch(_){ }
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((_,i)=>i+1),
      datasets: [{
        data,
        borderColor: pal.primary,
        backgroundColor: pal.primary,
        pointRadius: 0,
        tension: 0.35,
        borderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false, grid: { display: false }, ticks: { display: false } },
        y: { display: false, grid: { display: false }, ticks: { display: false } }
      }
    }
  });
}

