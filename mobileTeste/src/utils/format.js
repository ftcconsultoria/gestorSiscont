// Utilitários de formatação e conversão
export const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0);

export function toBRDate(d){
  if (!d) return '';
  try{
    const s = String(d).slice(0,10);
    // Prefer parsing string 'YYYY-MM-DD' sem timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y}`;
    }
    const dt = new Date(d);
    if (!isNaN(dt)){
      const dd = String(dt.getDate()).padStart(2,'0');
      const mm = String(dt.getMonth()+1).padStart(2,'0');
      const yyyy = String(dt.getFullYear());
      return `${dd}/${mm}/${yyyy}`;
    }
    return s;
  }catch{ return String(d); }
}

export function toBRDateShort(d){
  if (!d) return '';
  try{
    const s = String(d).slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y.slice(-2)}`;
    }
    const dt = new Date(d);
    if (!isNaN(dt)){
      const dd = String(dt.getDate()).padStart(2,'0');
      const mm = String(dt.getMonth()+1).padStart(2,'0');
      const yy = String(dt.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
    return s;
  }catch{ return String(d); }
}

// Evita timezone: usa strings YYYY-MM-DD e HH:MM:SS
export function toMillisFromDateTimeStrings(dateStr, timeStr){
  const d = String(dateStr || '').slice(0, 10);
  const h = String(timeStr || '').slice(0, 8) || '00:00:00';
  if (!d) return 0;
  const [Y,M,D] = d.split('-').map(n => parseInt(n,10));
  const [HH,MM,SS] = h.split(':').map(n => parseInt(n || '0',10));
  return new Date(Y, (M||1)-1, D||1, HH||0, MM||0, SS||0).getTime();
}

// Converte dd/mm/yy(yy) para yyyy-mm-dd. Retorna '' se invlido.
export function brShortToISO(v){
  if (!v) return '';
  const s = String(v).trim();
  // Aceita j ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return '';
  let [_, dd, mm, yy] = m;
  const D = parseInt(dd,10), M = parseInt(mm,10);
  let Y = parseInt(yy,10);
  if (yy.length === 2) Y = 2000 + Y; // assume ssculo atual
  if (D<1 || D>31 || M<1 || M>12 || Y<1900 || Y>2100) return '';
  const iso = `${String(Y).padStart(4,'0')}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
  return iso;
}
