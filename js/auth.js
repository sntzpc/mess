import { api, setLogin, initCommonData, state, logout } from './api.js';
import { showNotif, go } from './util.js';

function hasPublicQrParam(){
  try{
    const href = String(window.location.href || '');
    if(/[?&#](qr|guest_qr)=/i.test(href)) return true;
    const url = new URL(window.location.href);
    return !!(url.searchParams.get('qr') || url.searchParams.get('guest_qr') || url.hash.match(/(?:qr|guest_qr)=([^&]+)/i) || url.hash.match(/\/qr\//i));
  }catch(_){ return false; }
}

export function wireAuth(updateRoleUI, onReady){
  document.getElementById('btn-login').addEventListener('click', async ()=>{
  try{
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    // Tidak lagi membaca/menyimpan cfg-gas — GAS sudah ditanam di api.js
    const res = await api('login', {username, password});
    if(res.ok){
      setLogin(res.token, res.user);
      showNotif('Login sukses');
      await ensureCommonData();
      updateRoleUI();
      onReady?.();
    }else{
      showNotif('Login gagal', false);
    }
  }catch(e){
    showNotif('Gagal login: '+e.message, false);
  }
});

  document.getElementById('btn-logout').addEventListener('click', logout);

    // Link ke halaman daftar
  const lnkReg = document.getElementById('lnk-register');
  if (lnkReg) {
    lnkReg.addEventListener('click', (e)=>{
      e.preventDefault();
      go('page-register');
      // muat modul register saat dibuka
      import('./pages/register.js').then(m => m.showRegister());
    });
  }

  // auto restore session
  (async ()=>{
    if(hasPublicQrParam()){
      go('page-qr-public');
      return;
    }
    if(state.token && state.user){
      try{
        const me = await api('me',{});
        if(me.ok){ setLogin(state.token, state.user); await ensureCommonData(); updateRoleUI(); onReady?.(); }
        else { go('page-login'); }
      }catch{ go('page-login'); }
    }else{
      go('page-login');
    }
  })();
}

export function applyRoleUI(){
  const role = state.user?.role || '';
  document.getElementById('whoami').textContent = state.user ? `${state.user.username} (${role})` : '';

  const show = new Set();
  if(role==='admin'){ ['page-reservasi','page-kamar','page-kalender','page-approval','page-mess','page-jurnal','page-label-tamu','page-qr-tamu','page-identitas','page-kelola-mess','page-kelola-kamar','page-kelola-user','page-config','page-stat'].forEach(x=>show.add(x)); }
  else if(role==='user'){ ['page-reservasi','page-kamar','page-identitas'].forEach(x=>show.add(x)); }
  else if(role==='mess'){ ['page-mess','page-kalender','page-label-tamu','page-qr-tamu'].forEach(x=>show.add(x)); }

  document.querySelectorAll('#menu a.nav-link, .dropdown-menu .dropdown-item').forEach(a=>{
    const pid = a.getAttribute('data-page'); if(!pid) return;
    a.parentElement.style.display = show.has(pid) ? '' : 'none';
  });

  if(role==='admin'){ 
    document.getElementById('mess-choose').style.display='inline-block'; 
    // mendarat ke Statistik
    import('./pages/stat.js').then(mod=>{
      mod.invalidateStatKPI?.(); // optional
      mod.showStat();
    });
    go('page-stat');
  } else if(role==='user'){ 
    go('page-reservasi'); 
  } else if(role==='mess'){ 
    go('page-mess'); 
  } else { 
    go('page-login'); 
  }
}

let __commonInited = false;
async function ensureCommonData(){
  if (__commonInited) return;
  __commonInited = true;

  // Muat seluruh master/config ringan yang sebelumnya dilakukan initCommonData()
  await initCommonData();

  // Tandai & beri sinyal ke app.js (onReady) bahwa data siap
  state.commonReady = true;
  document.dispatchEvent(new CustomEvent('commonDataReady'));
}

