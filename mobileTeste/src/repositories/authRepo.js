import { supabase } from '../api/supabaseClient.js';

const USERS_TABLE = 'dash_login_usuario'; // id, login_email, login_senha
const USER_EMPRESA_TABLE = 'dash_usuario_empresa'; // usuario_id, CEMP_PK

export async function loginComTabela(email, senha){
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('login_email', email)
    .eq('login_senha', senha)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchEmpresasDoUsuario({ usuarioId, email }){
  // Tenta por usuario_id na tabela de mapeamento
  if (usuarioId !== undefined && usuarioId !== null){
    const { data, error } = await supabase
      .from(USER_EMPRESA_TABLE)
      .select('CEMP_PK')
      .eq('usuario_id', usuarioId);
    if (!error && Array.isArray(data)) return data;
  }
  // Fallback: tenta por email se houver coluna login_email
  if (email){
    const { data, error } = await supabase
      .from(USER_EMPRESA_TABLE)
      .select('CEMP_PK')
      .eq('login_email', email);
    if (!error && Array.isArray(data)) return data;
  }
  // Se no houver tabela, retorna vazio
  return [];
}

