import { $, showNotif } from '../util.js';
import { api, state } from '../api.js';

export function initReservasi(){
  // guest inputs initial
  renderGuestInputs(+$('#rsv-qty').value);
  // events
  $('#rsv-qty').addEventListener('change', (e)=> renderGuestInputs(+e.target.value));
  $('#btn-download-template').addEventListener('click', downloadTemplate);
  $('#upload-xlsx').addEventListener('change', handleUpload);
  $('#btn-rsv-submit').addEventListener('click', submitReservasi);
  // sync identitas local ke form
  $('#rsv-name').value = localStorage.getItem('id_name')||'';
  $('#rsv-unit').value = localStorage.getItem('id_unit')||'';
  $('#rsv-title').value = localStorage.getItem('id_title')||'';

  // show/hide Unit & Jabatan
  wireRsvIdentityToggle();
}

// === SHOW/HIDE Unit & Jabatan pada form Reservasi ===
function wireRsvIdentityToggle(){
  const btn     = document.getElementById('btn-toggle-identity');
  const grpUnit = document.getElementById('grp-rsv-unit');
  const grpTit  = document.getElementById('grp-rsv-title');
  if(!btn || !grpUnit || !grpTit) return;

  // Preferensi disimpan agar konsisten
  let show = (localStorage.getItem('rsvShowDetails') === '1');

  function apply(){
    grpUnit.classList.toggle('d-none', !show);
    grpTit.classList.toggle('d-none', !show);
    btn.textContent = show ? 'Sembunyikan Unit & Jabatan' : 'Tampilkan Unit & Jabatan';
  }
  apply();

  btn.addEventListener('click', ()=>{
    show = !show;
    localStorage.setItem('rsvShowDetails', show ? '1' : '0');
    apply();
  });
}


let uploadedGuests = null;

function renderGuestInputs(n){
  const host = $('#guest-list'); host.innerHTML='';
  const box = document.createElement('div'); box.className='accordion'; box.id='guest-acc';
  for(let i=1;i<=n;i++){
    const item = document.createElement('div'); item.className='accordion-item';
    item.innerHTML = `
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#g${i}">Tamu ${i}</button>
      </h2>
      <div id="g${i}" class="accordion-collapse collapse">
        <div class="accordion-body">
          <div class="row g-2">
            <div class="col-md-4"><input placeholder="Nama" class="form-control guest-name"/></div>
            <div class="col-md-3"><input placeholder="Unit" class="form-control guest-unit"/></div>
            <div class="col-md-3"><input placeholder="Jabatan" class="form-control guest-title"/></div>
            <div class="col-md-2">
              <select class="form-select guest-gender"><option value="">-</option><option value="L">L</option><option value="P">P</option></select>
            </div>
          </div>
        </div>
      </div>`;
    box.appendChild(item);
  }
  host.appendChild(box);
}

function downloadTemplate(){
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Nama','Unit','Jabatan','Gender (L/P)']]);
  XLSX.utils.book_append_sheet(wb, ws, 'DataTamu');
  XLSX.writeFile(wb, 'Template_Data_Tamu.xlsx');
}

async function handleUpload(e){
  const f = e.target.files[0]; if(!f) return;
  const data = await f.arrayBuffer();
  const wb = XLSX.read(data, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json(ws, {header:1});
  const rows = arr.slice(1).filter(r=>r.length).map(r=>({name:r[0]||'', unit:r[1]||'', title:r[2]||'', gender:(r[3]||'').toUpperCase()}));
  uploadedGuests = rows.slice(0,200);
  document.getElementById('rsv-qty').value = String(Math.min(uploadedGuests.length||1, 10));
  renderGuestInputs(+document.getElementById('rsv-qty').value);

  // preview isi 10 pertama
  const names = document.querySelectorAll('.guest-name'),
        units = document.querySelectorAll('.guest-unit'),
        titles= document.querySelectorAll('.guest-title'),
        genders=document.querySelectorAll('.guest-gender');
  uploadedGuests.slice(0,10).forEach((g,i)=>{ names[i].value=g.name; units[i].value=g.unit; titles[i].value=g.title; genders[i].value=(g.gender||''); });
  showNotif('Upload tamu OK: '+uploadedGuests.length+' data');
}

function saveIdentLocal(orderer){
  localStorage.setItem('id_name', orderer.name||'');
  localStorage.setItem('id_unit', orderer.unit||'');
  localStorage.setItem('id_title', orderer.title||'');
}

async function submitReservasi(){
  // helper untuk penandaan invalid
  const clearInvalid = (selector) => {
    document.querySelectorAll(selector).forEach(el => el.classList.remove('is-invalid'));
  };
  const markInvalid = (el, msg) => {
    try { el.classList.add('is-invalid'); } catch {}
    // tampilkan hanya error pertama agar tidak membingungkan user
    if (!window.__RSV__ERR_SHOWN) {
      window.__RSV__ERR_SHOWN = true;
      showNotif(msg, false);
      // auto-clear border merah agar tidak menetap
      setTimeout(()=> clearInvalid('.is-invalid'), 3000);
      // scroll ke field error
      try { el.scrollIntoView({behavior:'smooth', block:'center'}); } catch {}
    }
  };

  // reset flag error
  window.__RSV__ERR_SHOWN = false;
  clearInvalid('#rsv-name, #rsv-mess, #rsv-in, #rsv-out, #rsv-agenda, .guest-name, .guest-gender');

  try{
    // --- Ambil nilai form dasar
    const orderer = {
      name : (document.querySelector('#rsv-name')?.value || '').trim(),
      unit : (document.querySelector('#rsv-unit')?.value || '').trim(),
      title: (document.querySelector('#rsv-title')?.value || '').trim()
    };
    const elMess   = document.querySelector('#rsv-mess');
    const elIn     = document.querySelector('#rsv-in');
    const elOut    = document.querySelector('#rsv-out');
    const elAgenda = document.querySelector('#rsv-agenda');
    const elQty    = document.querySelector('#rsv-qty');

    const mess   = (elMess?.value || '').trim();
    const inStr  = (elIn?.value || '').trim();   // format: YYYY-MM-DD
    const outStr = (elOut?.value || '').trim();
    const agenda = (elAgenda?.value || '').trim();
    const qty    = Math.max(1, Math.min(10, parseInt((elQty?.value||'1'), 10) || 1));

    // --- Validasi wajib isi (tingkat pemesan)
    if (!orderer.name) { markInvalid(document.querySelector('#rsv-name'), 'Nama pemesan wajib diisi.'); return; }
    if (!mess)         { markInvalid(elMess, 'Silakan pilih mess.'); return; }
    if (!inStr)        { markInvalid(elIn, 'Tanggal check-in wajib diisi.'); return; }
    if (!outStr)       { markInvalid(elOut, 'Tanggal check-out wajib diisi.'); return; }
    if (!agenda)       { markInvalid(elAgenda, 'Agenda wajib diisi.'); return; }

    // --- Validasi tanggal (format & urutan)
    const inD  = new Date(inStr + 'T00:00:00');
    const outD = new Date(outStr + 'T00:00:00');
    if (isNaN(+inD))  { markInvalid(elIn, 'Tanggal check-in tidak valid.'); return; }
    if (isNaN(+outD)) { markInvalid(elOut, 'Tanggal check-out tidak valid.'); return; }
    if (outD <= inD)  { markInvalid(elOut, 'Check-out harus setelah check-in.'); return; }

    // --- Ambil & validasi data tamu
    let guests = [];
    if (uploadedGuests && uploadedGuests.length) {
      // jika user upload xlsx, pakai baris pertama s.d. qty
      guests = uploadedGuests.slice(0, qty).map((g, i) => {
        const name   = String(g.name||'').trim();
        const unit   = String(g.unit||'').trim();
        const title  = String(g.title||'').trim();
        const gender = String(g.gender||'').trim().toUpperCase(); // L / P
        if (!name)   { markInvalid(document.querySelectorAll('.guest-name')[i], `Nama Tamu ${i+1} wajib diisi.`); }
        if (!gender) { markInvalid(document.querySelectorAll('.guest-gender')[i], `Jenis kelamin Tamu ${i+1} wajib dipilih.`); }
        if (gender && !['L','P'].includes(gender)) {
          markInvalid(document.querySelectorAll('.guest-gender')[i], `Jenis kelamin Tamu ${i+1} harus L atau P.`);
        }
        return { name, unit, title, gender };
      });
    } else {
      // manual input
      const names   = Array.from(document.querySelectorAll('.guest-name'));
      const units   = Array.from(document.querySelectorAll('.guest-unit'));
      const titles  = Array.from(document.querySelectorAll('.guest-title'));
      const genders = Array.from(document.querySelectorAll('.guest-gender'));
      for (let i = 0; i < qty; i++) {
        const nameEl   = names[i],   unitEl = units[i],  titleEl = titles[i], genderEl = genders[i];
        const name     = (nameEl?.value||'').trim();
        const unit     = (unitEl?.value||'').trim();
        const title    = (titleEl?.value||'').trim();
        const gender   = (genderEl?.value||'').trim().toUpperCase();
        if (!name)   { markInvalid(nameEl, `Nama Tamu ${i+1} wajib diisi.`); return; }
        if (!gender) { markInvalid(genderEl, `Jenis kelamin Tamu ${i+1} wajib dipilih.`); return; }
        if (!['L','P'].includes(gender)) {
          markInvalid(genderEl, `Jenis kelamin Tamu ${i+1} harus L atau P.`); return;
        }
        guests.push({ name, unit, title, gender });
      }
    }

    // kalau ada error yang sudah ditampilkan di atas, hentikan
    if (window.__RSV__ERR_SHOWN) return;

    // --- Payload & kirim
    // simpan identitas pemesan ke localStorage
    saveIdentLocal(orderer);

    const { fmtDateStr } = await import('../util.js');
    const payload = {
      orderer,
      agenda,
      mess,
      checkin_plan : fmtDateStr(inStr),   // ke DD/MM/YYYY
      checkout_plan: fmtDateStr(outStr),
      guests
    };

    // guard tombol agar tidak double submit
    const btn = document.querySelector('#btn-rsv-submit');
    btn?.setAttribute('disabled', 'disabled');
    try{
      const res = await api('reserve.create', payload);
      if (res?.ok) {
        showNotif('Reservasi terkirim');
        // reset form minimal (jumlah tamu & daftar tamu)
        uploadedGuests = null;
        renderGuestInputs(1);
        const qtyEl = document.getElementById('rsv-qty'); if (qtyEl) qtyEl.value = '1';
      } else {
        showNotif(res?.error || 'Gagal reservasi', false);
      }
    }catch(err){
      showNotif('Error reservasi: ' + err.message, false);
    }finally{
      btn?.removeAttribute('disabled');
    }

  }catch(e){
    showNotif('Error reservasi: ' + e.message, false);
  }
}

