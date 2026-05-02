import { showNotif, block } from './util.js';
import { APP_CONFIG } from './config.js';

export const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  config: { gas_url: APP_CONFIG.GAS_URL },
  cacheMess: [],
  commonReady: false,
};

export function setLogin(token, user){
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  const who = document.getElementById('whoami');
  if(who) who.textContent = `${user.username} (${user.role})`;
}

export function logout(){
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
}

export async function api(action, payload = {}){
  const url = APP_CONFIG.GAS_URL;
  if(!url){
    showNotif('GAS URL belum dipasang di js/config.js', false);
    throw new Error('no_gas_url');
  }

  const body = JSON.stringify({ ...payload, action, token: state.token });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);

  block(true);
  try{
    // Tanpa custom headers agar tetap simple request dan menghindari preflight CORS.
    const res = await fetch(url, { method:'POST', body, signal: controller.signal });
    const json = await res.json().catch(() => ({ ok:false, error:'bad_json' }));
    return json;
  }catch(err){
    const msg = err?.name === 'AbortError'
      ? 'Koneksi ke server terlalu lama. Coba ulangi atau cek deployment GAS.'
      : (err?.message || String(err));
    return { ok:false, error: msg };
  }finally{
    window.clearTimeout(timer);
    block(false);
  }
}

export async function initCommonData(){
  const r = await api('mess.list');
  if(r.ok){
    state.cacheMess = r.rows || [];
    fillMessSelects();
  }
  const cfg = await api('config.get');
  if(cfg.ok){
    state.config = { ...state.config, ...(cfg.config || {}) };
  }
}

export function fillMessSelects(){
  const opts = state.cacheMess.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
  ['rsv-mess','kamar-mess','kk-mess','mess-choose'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = `<option value="">- pilih mess -</option>${opts}`;
  });
}
