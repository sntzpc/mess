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

function apiJsonp(action, payload = {}){
  const url = APP_CONFIG.GAS_URL;
  const body = { ...payload, action, token: state.token };
  const callback = '__mess_sntz_jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const script = document.createElement('script');
  const sep = url.includes('?') ? '&' : '?';
  const qs = new URLSearchParams({
    callback,
    payload: JSON.stringify(body),
    _t: String(Date.now())
  });

  return new Promise((resolve)=>{
    let done = false;
    const cleanup = ()=>{
      try{ delete window[callback]; }catch(_){ window[callback] = undefined; }
      script.remove();
    };
    const timer = window.setTimeout(()=>{
      if(done) return;
      done = true;
      cleanup();
      resolve({ ok:false, error:'jsonp_timeout' });
    }, APP_CONFIG.REQUEST_TIMEOUT_MS || 45000);

    window[callback] = (json)=>{
      if(done) return;
      done = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(json || {ok:false, error:'empty_jsonp'});
    };
    script.onerror = ()=>{
      if(done) return;
      done = true;
      window.clearTimeout(timer);
      cleanup();
      resolve({ ok:false, error:'jsonp_load_failed' });
    };
    script.src = url + sep + qs.toString();
    document.head.appendChild(script);
  });
}

function shouldUseJsonpFirst(action){
  // QR publik harus aman dibuka dari GitHub Pages tanpa login dan tanpa CORS fetch.
  return action === 'qr.lookup' || action === 'qr.action';
}

export async function api(action, payload = {}){
  const url = APP_CONFIG.GAS_URL;
  if(!url){
    showNotif('GAS URL belum dipasang di js/config.js', false);
    throw new Error('no_gas_url');
  }

  block(true);
  try{
    if(shouldUseJsonpFirst(action)){
      return await apiJsonp(action, payload);
    }

    const body = JSON.stringify({ ...payload, action, token: state.token });
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);
    try{
      // Tanpa custom headers agar tetap simple request dan menghindari preflight.
      // Jika browser tetap memblokir CORS pada Apps Script, fallback otomatis ke JSONP.
      const res = await fetch(url, { method:'POST', body, signal: controller.signal });
      const json = await res.json().catch(() => ({ ok:false, error:'bad_json' }));
      return json;
    }catch(err){
      const msg = err?.name === 'AbortError'
        ? 'Koneksi ke server terlalu lama. Coba ulangi atau cek deployment GAS.'
        : (err?.message || String(err));
      const fallback = await apiJsonp(action, payload);
      if(fallback && fallback.ok !== false) return fallback;
      return fallback?.error ? fallback : { ok:false, error: msg };
    }finally{
      window.clearTimeout(timer);
    }
  }finally{
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
  ['rsv-mess','kamar-mess','kk-mess','mess-choose','cal-mess'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = `<option value="">- pilih mess -</option>${opts}`;
  });
}
