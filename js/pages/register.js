// js/pages/register.js
import { api } from '../api.js';
import { go, showNotif } from '../util.js';

function slugifyUsername(s){
  return (s||'')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w.\-]+/g, '')   // a-z0-9_ . -
    .replace(/_{2,}/g, '_')      // rapikan _
    .replace(/^\.+|\.+$/g, '');  // trim titik di tepi
}

export function showRegister(){
  const f = document.getElementById('frm-register');
  const inpFull = document.getElementById('reg-fullname');
  const inpUser = document.getElementById('reg-username');
  const inpPass = document.getElementById('reg-password');
  const btnBack = document.getElementById('btn-reg-back');
  const btnSubm = document.getElementById('btn-reg-submit');

  if(!f) return;

  // reset ringan
  // (jaga bila user kembali lagi)
  if(!inpPass.value) inpPass.value = 'user123';

  // autosuggest username dari nama depan (huruf kecil)
  if (inpFull && inpUser){
    let touchedUser = false;
    inpUser.addEventListener('input', ()=>{ touchedUser = true; inpUser.value = slugifyUsername(inpUser.value); });
    inpFull.addEventListener('input', ()=>{
      if (touchedUser) return;
      const first = String(inpFull.value||'').trim().split(/\s+/)[0] || '';
      inpUser.value = slugifyUsername(first);
    });
  }

  btnBack?.addEventListener('click', ()=> go('page-login'));

  f.onsubmit = async (e)=>{
    e.preventDefault();
    const fullname = (inpFull?.value||'').trim();
    const username = slugifyUsername(inpUser?.value||'');
    const password = (inpPass?.value||'').trim();

    if(!fullname){ showNotif('Nama lengkap wajib diisi.', false); return; }
    if(!username){ showNotif('Username wajib diisi.', false); return; }
    if(!password){ showNotif('Password wajib diisi.', false); return; }

    btnSubm?.setAttribute('disabled','disabled');
    try{
      const r = await api('auth.register', { fullname, username, password });
      if(!r || !r.ok){
        showNotif(r?.error || 'Pendaftaran gagal.', false);
        return;
      }
      showNotif('Pendaftaran berhasil. Silakan login.');
      // Prefill username di form login
      go('page-login');
      const u = document.getElementById('login-username');
      if(u) u.value = username;
    }catch(err){
      showNotif('Gagal menghubungi server: ' + err.message, false);
    }finally{
      btnSubm?.removeAttribute('disabled');
    }
  };
}
