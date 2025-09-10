// Pequeno test harness em browser (ESM)
let results = [];
let passed = 0;
let failed = 0;

export function test(name, fn){
  try{
    const r = fn();
    if (r instanceof Promise){
      return r.then(() => ok(name)).catch(err => errFn(name, err));
    }
    ok(name);
  }catch(err){
    errFn(name, err);
  }
}

function ok(name){
  results.push({ name, status: 'ok' });
  passed++;
  console.log(`✔ ${name}`);
}
function errFn(name, err){
  results.push({ name, status: 'fail', error: err });
  failed++;
  console.error(`✖ ${name}`, err);
}

export function expect(received){
  return {
    toBe(expected){ if (received !== expected) throw new Error(`Expected ${repr(expected)} but got ${repr(received)}`); },
    toEqual(expected){ if (!deepEqual(received, expected)) throw new Error(`Expected deepEqual ${repr(expected)} but got ${repr(received)}`); },
    toBeCloseTo(expected, precision = 2){
      const diff = Math.abs(Number(received) - Number(expected));
      const tol = Math.pow(10, -precision) / 2;
      if (!(diff <= tol)) throw new Error(`Expected ${received} ≈ ${expected} (±${tol})`);
    },
    toContain(item){
      if (!Array.isArray(received) || !received.some(v => deepEqual(v, item))) {
        throw new Error(`Expected array to contain ${repr(item)} but it did not`);
      }
    }
  };
}

function repr(v){
  try{ return JSON.stringify(v); }catch{ return String(v); }
}

function deepEqual(a,b){
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object'){
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)){
      if (a.length !== b.length) return false;
      for (let i=0;i<a.length;i++){ if (!deepEqual(a[i], b[i])) return false; }
      return true;
    }
    const ak = Object.keys(a); const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    ak.sort(); bk.sort();
    for (let i=0;i<ak.length;i++){ if (ak[i] !== bk[i]) return false; }
    for (const k of ak){ if (!deepEqual(a[k], b[k])) return false; }
    return true;
  }
  return false;
}

export function report(){
  const root = document.getElementById('test-root') || document.body;
  const el = document.createElement('div');
  el.style.cssText = 'font-family: system-ui, sans-serif; padding:12px;';
  el.innerHTML = `<h2>Testes</h2><p>Passou: ${passed} • Falhou: ${failed}</p>`;
  const ul = document.createElement('ul');
  for (const r of results){
    const li = document.createElement('li');
    li.textContent = `${r.status === 'ok' ? '✔' : '✖'} ${r.name}`;
    li.style.color = r.status === 'ok' ? 'green' : 'crimson';
    ul.appendChild(li);
  }
  el.appendChild(ul);
  root.appendChild(el);
}
