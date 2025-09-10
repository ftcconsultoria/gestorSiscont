import { getBaseOpts, setChart, Chart, getPalette } from './chartService.js';

function hexWithAlpha(hex, aHex){
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)){
    return hex + aHex; // CSS #RRGGBBAA
  }
  return hex;
}

export function renderLineChart(ctx, labels, data){
  const pal = getPalette();
  const baseOpts = getBaseOpts();
  // Área preenchida (estilo "Falcon")
  setChart('line', new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total por Data',
        data,
        tension: 0.35,
        pointRadius: 2.5,
        fill: true,
        borderWidth: 2,
        borderColor: pal.primary,
        backgroundColor: `rgba(${pal.primaryRgb}, 0.2)`
      }]
    },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
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
