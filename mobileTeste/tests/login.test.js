import { test, expect, report } from './lib/testHarness.js';
import { loginComTabela } from '../src/repositories/authRepo.js';

// Mock mínimo do cliente supabase
function makeMock(rows){
  return {
    from(){
      return {
        select(){ return this; },
        ilike(_, email){ this._email = email; return this; },
        limit(){ return this; },
        maybeSingle: async () => {
          const row = rows.find(r => String(r.login_email).toLowerCase() === String(this._email).toLowerCase());
          return { data: row || null, error: null };
        }
      };
    }
  };
}

const DB_ROWS = [
  { id: 1, login_email: 'patrickspereira95@gmail.com', login_senha: 'patrick123' },
  { id: 2, login_email: 'USER@EXAMPLE.COM', login_senha: ' pass ' },
  { id: 3, login_email: 'trailingspace@example.com   ', login_senha: 'abc' },
];

test('Login com e-mail case-insensitive funciona', async () => {
  const mock = makeMock(DB_ROWS);
  const user = await loginComTabela('USER@example.com', ' pass ', mock);
  expect(!!user).toBe(true);
  expect(user.id).toBe(2);
});

test('Login do Patrick funciona com senha exata', async () => {
  const mock = makeMock(DB_ROWS);
  const user = await loginComTabela('patrickspereira95@gmail.com', 'patrick123', mock);
  expect(!!user).toBe(true);
  expect(user.id).toBe(1);
});

test('Senha errada retorna null', async () => {
  const mock = makeMock(DB_ROWS);
  const user = await loginComTabela('patrickspereira95@gmail.com', 'errada', mock);
  expect(user).toBe(null);
});

test('Login com e-mail salvo com espaços à direita funciona', async () => {
  const mock = makeMock(DB_ROWS);
  const user = await loginComTabela('trailingspace@example.com', 'abc', mock);
  expect(!!user).toBe(true);
  expect(user.id).toBe(3);
});

test('Bypass admin/admin funciona (explicitamente habilitado no teste)', async () => {
  const mock = makeMock(DB_ROWS);
  // Habilita bypass para o teste
  window.__ALLOW_ADMIN_BYPASS__ = true;
  const user = await loginComTabela('admin', 'admin', mock);
  expect(!!user).toBe(true);
  expect(user.is_admin).toBe(true);
  expect(user.id).toBe(-1);
  delete window.__ALLOW_ADMIN_BYPASS__;
});

report();
