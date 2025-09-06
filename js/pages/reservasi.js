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
  try{
    const orderer = { name: $('#rsv-name').value.trim(), unit: $('#rsv-unit').value.trim(), title: $('#rsv-title').value.trim() };
    if(!orderer.name){ showNotif('Nama pemesan wajib', false); return; }
    const mess = $('#rsv-mess').value; if(!mess){ showNotif('Pilih mess', false); return; }
    const agenda = $('#rsv-agenda').value.trim();
    const inD = $('#rsv-in').value; const outD = $('#rsv-out').value;
    if(!inD || !outD){ showNotif('Tanggal check-in/out wajib', false); return; }

    let guests=[];
    if(uploadedGuests && uploadedGuests.length){ guests = uploadedGuests; }
    else{
      const n = +$('#rsv-qty').value;
      const names = document.querySelectorAll('.guest-name'),
            units = document.querySelectorAll('.guest-unit'),
            titles= document.querySelectorAll('.guest-title'),
            genders=document.querySelectorAll('.guest-gender');
      for(let i=0;i<n;i++){
        guests.push({name:names[i].value.trim(), unit:units[i].value.trim(), title:titles[i].value.trim(), gender:genders[i].value.trim().toUpperCase()});
      }
    }

    saveIdentLocal(orderer);
    const { fmtDateStr } = await import('../util.js');
    const res = await api('reserve.create', { orderer, agenda, mess_selected: mess, checkin_plan: fmtDateStr(inD), checkout_plan: fmtDateStr(outD), guests });
    if(res.ok){ showNotif('Reservasi terkirim'); uploadedGuests=null; renderGuestInputs(1); document.getElementById('rsv-qty').value='1'; }
    else showNotif('Gagal reservasi', false);
  }catch(e){ showNotif('Error reservasi: '+e.message, false); }
}
