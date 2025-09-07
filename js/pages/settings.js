import { $, showNotif } from '../util.js';
import { api, state, initCommonData, fillMessSelects } from '../api.js';

/* IDENTITAS + CONFIG */
export function initSettings(){
  // ======================
  // IDENTITAS (Local only)
  // ======================
  $('#id-name').value  = localStorage.getItem('id_name')  || '';
  $('#id-unit').value  = localStorage.getItem('id_unit')  || '';
  $('#id-title').value = localStorage.getItem('id_title') || '';

  $('#btn-id-save').addEventListener('click', ()=>{
    localStorage.setItem('id_name',  $('#id-name').value.trim());
    localStorage.setItem('id_unit',  $('#id-unit').value.trim());
    localStorage.setItem('id_title', $('#id-title').value.trim());
    showNotif('Identitas tersimpan');

    // sinkron ke form Reservasi (kalau ada di DOM)
    const n=$('#id-name').value, u=$('#id-unit').value, t=$('#id-title').value;
    const rn=document.getElementById('rsv-name'), ru=document.getElementById('rsv-unit'), rt=document.getElementById('rsv-title');
    if(rn){ rn.value=n; } if(ru){ ru.value=u; } if(rt){ rt.value=t; }
  });

  // === ADD: sisipkan info Notifikasi Telegram di bawah input Identitas ===
(function addTelegramNote(){
  // cari baris input (Nama/Unit/Jabatan) lalu sisipkan setelahnya
  const rowInputs = document.querySelector('#page-identitas .row.g-2');
  if (!rowInputs) return;

  // hindari duplikasi jika fungsi ini terpanggil lebih dari sekali
  if (document.getElementById('id-telegram-note')) return;

  rowInputs.insertAdjacentHTML('afterend', `
    <div id="id-telegram-note" class="mt-2">
      <hr />
      <small class="text-muted">
        Notifikasi Via Telegram
        <a style="text-decoration: underline; color:#020202;" href="http://t.me/mess_sntzBot">Mess SNTZ</a>
      </small>
    </div>
  `);
})();

  // ======================
  // CONFIG TELEGRAM (Admin)
  // ======================
  const saveBtn = $('#cfg-save');
  const testBtn = $('#cfg-test-tg');

  // helper load config dari server (Config sheet)
  async function loadServerConfig(){
    if(state.user?.role !== 'admin') return;
    try{
      const r = await api('config.get', {});
      const cfg = r?.config || {};
      if($('#cfg-bot'))   $('#cfg-bot').value   = cfg.telegram_bot_token || '';
      if($('#cfg-admin')) $('#cfg-admin').value = cfg.telegram_admin_id  || '';
    }catch(e){
      // diamkan agar tidak mengganggu UI
    }
  }

  // saat halaman Settings diinisialisasi & user admin, prefill dari server
  if(state.user?.role === 'admin'){ loadServerConfig(); }

  // Simpan ke Config sheet (bukan localStorage!)
  if(saveBtn){
  saveBtn.addEventListener('click', async ()=>{
    if(state.user?.role !== 'admin'){
      showNotif('Hanya admin yang dapat menyimpan konfigurasi Telegram', false);
      return;
    }
    const bot   = $('#cfg-bot')   ? $('#cfg-bot').value.trim()   : '';
    const admin = $('#cfg-admin') ? $('#cfg-admin').value.trim() : '';

    if(bot){   await api('config.set', {key:'telegram_bot_token', value: bot}); }
    if(admin){ await api('config.set', {key:'telegram_admin_id',  value: admin}); }

    showNotif('Config Telegram disimpan');

    // refresh kolom Telegram ID admin di Kelola User agar terlihat sinkron
    try{ await renderUserList(); }catch(_){}
  });

  // Test Telegram (kirim pesan uji lewat API notify.test) — tetap seperti sebelumnya
  const testBtn = $('#cfg-test-tg');
  if(testBtn){
    testBtn.addEventListener('click', async ()=>{
      const log = (obj)=> {
        try{
          const el = $('#cfg-tg-log');
          const now = new Date();
          const ts  = now.toLocaleString('id-ID');
          const line = typeof obj==='string' ? obj : JSON.stringify(obj, null, 2);
          if(el){
            el.textContent = `[${ts}] ${line}\n\n` + el.textContent;
          }
          console.debug('[CFG][notify.test]', obj);
        }catch(e){}
      };

      testBtn.disabled = true;
      testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengirim...';

      try{
        log('request: notify.test {}');
        const res = await api('notify.test', {});
        log({ response: res });

        if(res && res.ok){
          showNotif('Pesan uji Telegram terkirim ✅');
        }else{
          showNotif('Gagal kirim pesan uji: '+(res?.error||'unknown'), false);
        }
      }catch(err){
        log({ error: String(err) });
        showNotif('Error: '+ String(err), false);
      }finally{
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="bi bi-send"></i> Test Telegram';
        const det = document.getElementById('cfg-tg-cctv');
        if(det && !det.open) det.open = true;
      }
    });
  }

  // prefilling untuk admin (ambil dari server)
  if(state.user?.role === 'admin'){
    api('config.get', {}).then(r=>{
      const cfg = r?.config || {};
      if($('#cfg-bot'))   $('#cfg-bot').value   = cfg.telegram_bot_token || '';
      if($('#cfg-admin')) $('#cfg-admin').value = cfg.telegram_admin_id  || '';
    }).catch(()=>{ /* abaikan */ });
  }
}

  // ======================
  // KELOLA Mess/Kamar/User
  // ======================
  $('#km-add').addEventListener('click', addMess);
  $('#kk-add').addEventListener('click', addRoom);
  $('#ku-add').addEventListener('click', addUser);
  $('#ku-newpass-btn').addEventListener('click', changePass);
}

export async function onPageShown(pid){
  if (pid === 'page-kelola-mess') {
    const rows = await renderMessList();     // kembalikan rows dari render
    // update cache & select berdasarkan hasil yang SAMA (tanpa hit lagi)
    state.cacheMess = rows || [];
    fillMessSelects();
  }
  if (pid === 'page-kelola-kamar') { await renderKamarList(); }
  if (pid === 'page-kelola-user')  { await renderUserList(); }
  if (pid === 'page-config') {
    if (state.user?.role === 'admin') {
      try{
        const r = await api('config.get', {});
        const cfg = r?.config || {};
        if ($('#cfg-bot'))   $('#cfg-bot').value   = cfg.telegram_bot_token || '';
        if ($('#cfg-admin')) $('#cfg-admin').value = cfg.telegram_admin_id  || '';
      }catch{}
    }
  }
}


/* KELOLA MESS */
async function renderMessList(){
  const r = await api('mess.list', {});
  const rows = (r.rows || []);
  const htmlRows = rows.map((m,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${m.name}</td>
      <td>${m.location||''}</td>
      <td>${m.notes||''}</td>
      <td><span class="badge ${m.is_active?'text-bg-success':'text-bg-secondary'}">
        ${m.is_active?'Aktif':'Nonaktif'}</span>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger del" data-id="${m.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`).join('');

  $('#km-list').innerHTML = `
    <table class="table table-sm">
      <thead><tr>
        <th>No.</th><th>Nama</th><th>Lokasi</th><th>Catatan</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>`;

  // Handler hapus → render ulang SEKALI lalu sinkronkan select Mess TANPA initCommonData()
  $('#km-list').querySelectorAll('.del').forEach(b => b.addEventListener('click', async ()=>{
    if(!confirm('Hapus mess ini?')) return;
    const ok = await api('mess.del', { id: b.getAttribute('data-id') });
    if (ok?.ok) {
      showNotif('Mess dihapus');
      const updated = await renderMessList();
      state.cacheMess = updated || [];
      fillMessSelects();
    }
  }));

  // KEMBALIKAN data ke pemanggil agar bisa dipakai lagi (hindari hit dobel)
  return rows;
}
async function addMess(){
  const name = $('#km-name').value.trim(); if(!name){ showNotif('Nama mess wajib', false); return; }
  const location = $('#km-loc').value.trim();
  const notes = $('#km-notes').value.trim();

  const ok = await api('mess.add', { name, location, notes });
  if (ok?.ok) {
    showNotif('Mess ditambahkan');
    $('#km-name').value = ''; $('#km-loc').value = ''; $('#km-notes').value = '';
    const rows = await renderMessList();
    state.cacheMess = rows || [];
    fillMessSelects();
  }
}

/* KELOLA KAMAR */
async function renderKamarList(){
  const r = await api('rooms.list', {});
  const rows = (r.rows||[]).map((k,i)=>`
    <tr><td>${i+1}</td><td>${k.mess_name}</td><td>${k.room_name}</td><td>${k.capacity}</td><td>${k.grade||''}</td><td>${k.status}</td>
    <td class="text-end"><button class="btn btn-sm btn-outline-danger del" data-id="${k.id}"><i class="bi bi-trash"></i></button></td></tr>`).join('');
  $('#kk-list').innerHTML = `<table class="table table-sm"><thead><tr><th>No.</th><th>Mess</th><th>Nama Kamar</th><th>Kapasitas</th><th>Gol</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('#kk-list').querySelectorAll('.del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Hapus kamar ini?')) return;
    const ok=await api('rooms.del', {id:b.getAttribute('data-id')}); if(ok.ok){ showNotif('Kamar dihapus'); renderKamarList(); }
  }));
  fillMessSelects();
}
async function addRoom(){
  const mess=$('#kk-mess').value; const room=$('#kk-room').value.trim(); const cap=+($('#kk-cap').value||0); const grade=$('#kk-grade').value.trim();
  if(!mess || !room){ showNotif('Mess & nama kamar wajib', false); return; }
  const ok = await api('rooms.save', {mess_name: mess, room_name: room, capacity: cap, grade});
  if(ok.ok){ showNotif('Kamar disimpan'); $('#kk-room').value=''; $('#kk-cap').value=''; $('#kk-grade').value=''; renderKamarList(); }
}

/* KELOLA USER */
async function renderUserList(){
  const r = await api('users.list', {});
  const rows = (r.rows||[]).map((u,i)=>`
    <tr><td>${i+1}</td><td>${u.username}</td><td>${u.role}</td><td>${u.mess_name||''}</td><td>${u.telegram_id||''}</td>
    <td class="text-end">${u.username!=='admin'?`<button class="btn btn-sm btn-outline-danger del" data-user="${u.username}"><i class="bi bi-trash"></i></button>`:''}</td></tr>`).join('');
  $('#ku-list').innerHTML = `<table class="table table-sm"><thead><tr><th>No.</th><th>Username</th><th>Role</th><th>Mess</th><th>Telegram ID</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('#ku-list').querySelectorAll('.del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Hapus user ini?')) return;
    const ok = await api('users.del', {username:b.getAttribute('data-user')}); if(ok.ok){ showNotif('User dihapus'); renderUserList(); }
  }));
}
async function addUser(){
  const username=$('#ku-user').value.trim(), password=$('#ku-pass').value, role=$('#ku-role').value, mess_name=$('#ku-mess').value.trim(),
        telegram_id=$('#ku-tele').value.trim();

  if(!username || (!password && role!=='admin')){ // admin boleh update tanpa ganti password
    showNotif('Username & password wajib (kecuali update admin tanpa ubah password)', false);
    return;
  }

  const ok = await api('users.add', {username,password,role,mess_name,telegram_id});
  if(ok.ok){
    showNotif('User disimpan');
    $('#ku-user').value=''; $('#ku-pass').value=''; $('#ku-mess').value=''; $('#ku-tele').value='';
    await renderUserList();

    // Jika admin & isi telegram_id, sinkronkan ke input Config agar terlihat langsung
    if(role==='admin' && telegram_id && document.getElementById('cfg-admin')){
      document.getElementById('cfg-admin').value = telegram_id;
    }
  }
}
async function changePass(){
  const user=$('#ku-newpass-user').value.trim(); const pass=$('#ku-newpass-val').value;
  if(!user || !pass){ showNotif('Isi username & password baru', false); return; }
  const r=await api('users.pass', {username:user, newpass:pass}); if(r.ok){ showNotif('Password diubah'); $('#ku-newpass-user').value=''; $('#ku-newpass-val').value=''; }
}
