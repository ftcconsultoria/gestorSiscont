// Inicialização simples para páginas secundárias

document.addEventListener('DOMContentLoaded', () => {
  try {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  } catch (_) {
    /* ignore */
  }
});
