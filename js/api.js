import {CONFIG} from './config.js';
const TOKEN_KEY='lot.sys.token';
export function captureSession() {
  const hash=new URLSearchParams(location.hash.slice(1));
  const token=hash.get('t');
  if (token) {
    history.replaceState(null,'',location.pathname+location.search);
    try { sessionStorage.setItem(TOKEN_KEY,token); } catch { throw new Error('Habilita el almacenamiento de sesión para ingresar.'); }
  }
}
export function clearSession() { try { sessionStorage.removeItem(TOKEN_KEY); } catch {} }
export function login(partida) {
  if (!CONFIG.liveEnabled) throw new Error('La conexión a partidas reales está en preparación.');
  const back=new URL(location.origin+location.pathname); if(partida)back.searchParams.set('partida',partida);
  const url=new URL(CONFIG.authUrl); url.searchParams.set('app','LOT'); url.searchParams.set('returnUrl',back.href);
  location.assign(url.href);
}
async function request(path, signal, {ticket='',body}={}) {
  if (!CONFIG.liveEnabled) throw new Error('La conexión a partidas reales está en preparación.');
  let token=''; try { token=sessionStorage.getItem(TOKEN_KEY)||''; } catch {}
  if (!token) { const error=new Error('Inicia sesión para entrar a la partida.'); error.auth=true; throw error; }
  const headers={Accept:'application/json',Authorization:'Bearer '+token};
  if(ticket)headers['X-LOT-Carton']=ticket;
  if(body)headers['Content-Type']='application/json';
  const response=await fetch(CONFIG.apiBase+path,{signal,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,headers,cache:'no-store',credentials:'omit'});
  if (response.status===401) { clearSession(); const e=new Error('Tu sesión terminó. Vuelve a ingresar.'); e.auth=true; throw e; }
  const result=await response.json();
  if (!response.ok || result.ok!==true) {const error=new Error(result.mensaje||'No se pudo actualizar la partida.');error.code=result.codigo;throw error;}
  return result.data;
}
export const getContext=signal=>request('/lotSalaContexto',signal);
export const enterGame=(id,signal)=>request('/lotSalaEntrada',signal,{body:{partida:id}});
export const getState=(id,ticket,signal,presencia=false)=>request('/lotSalaEstado?partida='+encodeURIComponent(id)+(presencia?'&presencia=1':''),signal,{ticket});

export const exitGame=(id,signal)=>request('/lotSalaSalida',signal,{body:{partida:id}});

export const getGames=signal=>request('/lotSalaPartidas',signal);
export function hasSession(){try{return !!sessionStorage.getItem(TOKEN_KEY);}catch{return false;}}
