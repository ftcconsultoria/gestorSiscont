import { supabase } from '../api/supabaseClient.js';

function getUserSession(){
  try{ return JSON.parse(localStorage.getItem('appUser')||'null'); }catch{ return null; }
}

export async function initAuth(onLoggedIn){
  // Se não logado, redireciona para a página de login
  try{
    const saved = getUserSession();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = saved || sessionData?.session?.user || null;
    if (!user){
      window.location.href = 'index.html';
      return;
    }
    onLoggedIn(user);
  }catch(_){
    window.location.href = 'index.html';
  }
}

export function signOut(){
  try{ localStorage.removeItem('appUser'); }catch{}
  try{ localStorage.removeItem('empresaAtual'); }catch{}
  try{ supabase.auth.signOut(); }catch{}
  window.location.href = 'index.html';
}
