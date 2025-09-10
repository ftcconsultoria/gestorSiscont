// Serviço utilitário para criação/gerência de gráficos Chart.js
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm';
Chart.register(...registerables);

const charts = {};
export function destroyAllCharts(){
  Object.values(charts).forEach(c => c?.destroy?.());
  for (const k of Object.keys(charts)) delete charts[k];
}
export function setChart(key, instance){ charts[key] = instance; }
export function getCharts(){ return charts; }

export function getBaseOpts(){
  const p = getPalette();
  const toRgba = (rgb, a) => `rgba(${rgb}, ${a})`;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { labels: { color: p.text } },
      tooltip: { titleColor: p.text, bodyColor: p.text, backgroundColor: toRgba(p.cardRgb, 0.95) }
    },
    scales: {
      x: { ticks: { color: p.muted }, grid: { color: toRgba(p.borderRgb, .4) } },
      y: { ticks: { color: p.muted, callback: (v) => shortCurrencyBR(v) }, grid: { color: toRgba(p.borderRgb, .4) } }
    }
  };
}

function getCSSVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function getPalette(){
  // Bootstrap design tokens
  const primary = getCSSVar('--bs-primary') || '#2c7be5';
  const text = getCSSVar('--bs-body-color') || '#344050';
  const muted = getCSSVar('--bs-secondary-color') || '#748194';
  const border = getCSSVar('--bs-border-color') || '#e3e6ed';
  const card = getCSSVar('--bs-card-bg') || '#ffffff';
  const primaryRgb = getCSSVar('--bs-primary-rgb') || '44,123,229';
  const borderRgb = getCSSVar('--bs-border-color-rgb') || '227,230,237';
  const cardRgb = getCSSVar('--bs-card-bg-rgb') || '255,255,255';
  return { primary, text, muted, border, card, primaryRgb, borderRgb, cardRgb };
}

export function shortCurrencyBR(value){
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const fmt = (v, suf) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v) + suf;
  if (abs >= 1_000_000_000) return 'R$ ' + fmt(n/1_000_000_000, 'B');
  if (abs >= 1_000_000) return 'R$ ' + fmt(n/1_000_000, 'M');
  if (abs >= 1_000) return 'R$ ' + fmt(n/1_000, 'K');
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

// Exporta Chart para uso pelos módulos específicos
export { Chart };
