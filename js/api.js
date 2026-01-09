import { showNotif, block } from './util.js';

export const state = {
  token: localStorage.getItem('token')||'',
  user: JSON.parse(localStorage.getItem('user')||'null'),
  config: {},   // tidak lagi mengambil gas_url dari localStorage
  cacheMess: []
};

// === Hardcode GAS Web App URL di sini ===
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQVSCYUGWqvo4tbIVsMGcmBSlgzSnxXY-IQnQdZgcJc1pPJNT9qNezl_5coxTByK_piA/exec';

// sinkronkan ke state untuk dipakai bagian lain bila perlu
state.config.gas_url = GAS_URL;

export function setLogin(token, user){
  state.token = token; state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  document.getElementById('whoami').textContent = `${user.username} (${user.role})`;
}
export function logout(){
  localStorage.removeItem('token'); localStorage.removeItem('user'); location.reload();
}


export async function api(action, payload={}){
  const url = GAS_URL; // selalu pakai konstanta yang ditanam
  if(!url){ showNotif('GAS URL tidak terpasang', false); throw new Error('no gas url'); }

  const body = JSON.stringify({...payload, action, token: state.token});
  block(true);
  try{
    // Tanpa headers -> simple request (menghindari preflight)
    const res = await fetch(url, { method:'POST', body });
    const json = await res.json().catch(()=>({ok:false,error:'bad_json'}));
    return json;
  }finally{ block(false); }
}


export async function initCommonData(){
  const r = await api('mess.list'); if(r.ok){ state.cacheMess = r.rows; fillMessSelects(); }
  const cfg = await api('config.get'); if(cfg.ok){ state.config = {...state.config, ...(cfg.config||{})}; }
}
export function fillMessSelects(){
  const opts = state.cacheMess.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  const selIds = ['rsv-mess','kamar-mess','kk-mess','mess-choose'];
  selIds.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = `<option value="">- pilih mess -</option>${opts}`;
  });
}
