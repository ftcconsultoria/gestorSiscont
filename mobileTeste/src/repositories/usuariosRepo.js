import { supabase } from '../api/supabaseClient.js';

const USERS_TABLE = 'CADE_USUARIO';
const USER_PK_FIELD = 'CCOT_VEND_PK';
const USER_NAME_FIELD = 'CUSU_USUARIO';

export async function fetchUsuariosByIds(ids){
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(`${USER_PK_FIELD}, ${USER_NAME_FIELD}`)
    .in(USER_PK_FIELD, ids);
  if (error) throw error;
  return data || [];
}
