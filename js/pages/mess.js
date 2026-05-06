import { showNotif } from '../util.js';
import { api, state } from '../api.js';

let selectedIn = new Set();   // id tamu yang dicentang untuk Check-In
let selectedOut = new Set();  // id tamu yang dicentang untuk Check-Out
let messEventsWired = false;

export function initMess(){
  const btnRefresh = document.getElementById('btn-mess-refresh');
  const selMess    = document.getElementById('mess-choose');
  const host       = document.getElementById('mess-queue');

  if(btnRefresh) btnRefresh.addEventListener('click', loadMessQueue);
  if(selMess)    selMess.addEventListener('change', loadMessQueue);

  // Event delegasi cukup dipasang 1x agar tidak double action saat halaman di-refresh berkali-kali.
  if(host && !messEventsWired){
    host.addEventListener('change', onCheckboxChange);
    host.addEventListener('click', onClickActions);
    messEventsWired = true;
  }

  loadMessQueue();
}

export async function loadMessQueue(){
  // reset pilihan batch
  selectedIn.clear();
  selectedOut.clear();
  updateBulkBar();

  let mess = state.user?.mess || '';
  if(state.user?.role==='admin'){
    mess = (document.getElementById('mess-choose')?.value || mess || '').trim();
  }
  if(!mess){ showNotif('Pilih mess', false); return; }

  const res = await api('mess.queue', {mess_name: mess});
  const host = document.getElementById('mess-queue');
  if(!host) return;

  if(!res || res.ok === false){
    showNotif(res?.error || 'Gagal memuat data mess', false);
    host.innerHTML = `<div class="alert alert-danger py-2">Gagal memuat data mess.</div>`;
    return;
  }

  const rows = (res.rows||[]).map((g,i)=>{
    const isApproved  = (g.status === 'approved');

    // checkbox di kolom paling kiri: tergantung status baris
    const chkCell = isApproved
      ? `<input class="form-check-input chk-in" type="checkbox" data-id="${g.id}" aria-label="Pilih untuk Check-In">`
      : `<input class="form-check-input chk-out" type="checkbox" data-id="${g.id}" aria-label="Pilih untuk Check-Out">`;

    // Tombol aksi:
    // approved  : Check-In + No Show
    // checkedin : Check-Out
    const btnActions = isApproved
      ? `<div class="d-inline-flex gap-1 flex-nowrap">
           <button class="btn btn-success btn-sm btn-act" data-mode="in" data-id="${g.id}">Check-In</button>
           <button class="btn btn-warning btn-sm btn-act" data-mode="noshow" data-id="${g.id}" title="Tamu tidak datang / batal menginap">No Show</button>
         </div>`
      : `<button class="btn btn-secondary btn-sm btn-act" data-mode="out" data-id="${g.id}">Check-Out</button>`;

    return `
      <tr data-id="${g.id}" data-status="${g.status}">
        <td class="text-center" style="width:42px">${chkCell}</td>
        <td>${i+1}</td>
        <td>${g.name||''}</td>
        <td>${g.unit||''}</td>
        <td>${g.title||''}</td>
        <td>${g.gender||''}</td>
        <td>${g.room_alloc||''}</td>
        <td class="text-end">${btnActions}</td>
      </tr>`;
  }).join('');

  const empty = !(res.rows||[]).length
    ? `<div class="alert alert-info py-2 mb-2">Tidak ada tamu yang menunggu Check-In atau sedang Check-In pada mess ini.</div>`
    : '';

  host.innerHTML = `
    ${empty}
    <div class="d-flex flex-wrap gap-2 mb-2" id="bulk-bar" style="display:none">
      <button class="btn btn-success btn-sm" id="btn-in-selected">
        <i class="bi bi-box-arrow-in-right"></i> Check-In Selected
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-out-selected">
        <i class="bi bi-box-arrow-right"></i> Check-Out Selected
      </button>
    </div>
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0">
        <thead><tr>
          <th class="text-center" style="width:42px"></th>
          <th style="width:56px">No.</th>
          <th>Nama</th><th>Unit</th><th>Jabatan</th><th>Gender</th><th>No Kamar</th>
          <th class="text-end">Aksi</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function onCheckboxChange(ev){
  const el = ev.target;
  if(el.classList.contains('chk-in')){
    const id = el.getAttribute('data-id');
    if(el.checked) selectedIn.add(id); else selectedIn.delete(id);
    updateBulkBar();
  }
  if(el.classList.contains('chk-out')){
    const id = el.getAttribute('data-id');
    if(el.checked) selectedOut.add(id); else selectedOut.delete(id);
    updateBulkBar();
  }
}

async function onClickActions(ev){
  const btn = ev.target.closest('button');
  if(!btn) return;

  // Single action
  if(btn.classList.contains('btn-act')){
    const id   = btn.getAttribute('data-id');
    const mode = btn.getAttribute('data-mode'); // 'in', 'out', atau 'noshow'
    if(mode === 'in'){
      await doSingleCheckIn(id, btn);
    }else if(mode === 'out'){
      await doSingleCheckOut(id, btn);
    }else if(mode === 'noshow'){
      await doSingleNoShow(id, btn);
    }
    return;
  }

  // Batch
  if(btn.id === 'btn-in-selected'){
    await doBatchCheckIn();
  }
  if(btn.id === 'btn-out-selected'){
    await doBatchCheckOut();
  }
}

function updateBulkBar(){
  const bulkBar = document.querySelector('#mess-queue #bulk-bar');
  if(!bulkBar) return;
  const btnIn  = bulkBar.querySelector('#btn-in-selected');
  const btnOut = bulkBar.querySelector('#btn-out-selected');

  const hasIn  = selectedIn.size  > 0;
  const hasOut = selectedOut.size > 0;

  bulkBar.style.display = (hasIn || hasOut) ? 'flex' : 'none';
  if(btnIn)  btnIn.disabled  = !hasIn;
  if(btnOut) btnOut.disabled = !hasOut;
}

/* ==================== Single Actions ==================== */

async function doSingleCheckIn(guestId, btn){
  btn.disabled = true;
  try{
    const r = await api('guest.checkin', {guest_id: guestId});
    if(r.ok){
      showNotif(r.already ? 'Tamu sudah Check-In' : 'Check-in tercatat');
      const tr = btn.closest('tr');
      markRowCheckedIn(tr); // ubah tombol jadi Check-Out dan atur checkbox
    }else{
      showNotif(r.error || 'Check-in gagal', false);
      btn.disabled = false;
    }
  }catch(e){
    showNotif(e.message || 'Check-in gagal', false);
    btn.disabled = false;
  }
}

async function doSingleCheckOut(guestId, btn){
  btn.disabled = true;
  try{
    const r = await api('guest.checkout', {guest_id: guestId});
    if(r.ok){
      showNotif(r.already ? 'Tamu sudah Check-Out' : 'Check-out tercatat');
      const tr = btn.closest('tr');
      tr?.remove();               // hilangkan baris
      selectedOut.delete(guestId);
      updateBulkBar();
    }else{
      showNotif(r.error || 'Check-out gagal', false);
      btn.disabled = false;
    }
  }catch(e){
    showNotif(e.message || 'Check-out gagal', false);
    btn.disabled = false;
  }
}

async function doSingleNoShow(guestId, btn){
  const ok = confirm('Tandai tamu ini sebagai No Show?\n\nArtinya tamu batal/tidak datang, tidak jadi Check-In, kamar dilepas kembali, dan data masuk ke Jurnal No Show.');
  if(!ok) return;

  btn.disabled = true;
  try{
    const r = await api('guest.noshow', {guest_id: guestId, reason: 'Tamu tidak datang / batal menginap'});
    if(r.ok){
      showNotif(r.already ? 'Tamu sudah berstatus No Show' : 'No Show tercatat');
      const tr = btn.closest('tr');
      tr?.remove();
      selectedIn.delete(guestId);
      updateBulkBar();
    }else{
      showNotif(r.error || 'No Show gagal', false);
      btn.disabled = false;
    }
  }catch(e){
    showNotif(e.message || 'No Show gagal', false);
    btn.disabled = false;
  }
}

/* ==================== Batch Actions ==================== */

async function doBatchCheckIn(){
  if(selectedIn.size === 0) return;
  for(const id of Array.from(selectedIn)){
    try{
      const r = await api('guest.checkin', {guest_id: id});
      if(r.ok){
        const tr = document.querySelector(`tr[data-id="${id}"]`);
        markRowCheckedIn(tr);
      }
    }catch(e){}
  }
  showNotif('Check-In Selected selesai');
  selectedIn.clear();
  updateBulkBar();
}

async function doBatchCheckOut(){
  if(selectedOut.size === 0) return;
  for(const id of Array.from(selectedOut)){
    try{
      const r = await api('guest.checkout', {guest_id: id});
      if(r.ok){
        const tr = document.querySelector(`tr[data-id="${id}"]`);
        tr?.remove();
      }
    }catch(e){}
  }
  showNotif('Check-Out Selected selesai');
  selectedOut.clear();
  updateBulkBar();
}

/* ==================== UI Helpers ==================== */

// Setelah Check-In:
// - Checkbox IN: tetap tercentang & disabled (abu-abu) + tambahkan checkbox OUT aktif
// - Tombol Aksi: berubah dari Check-In/No Show -> Check-Out
function markRowCheckedIn(tr){
  if(!tr) return;
  tr.setAttribute('data-status','checkedin');

  // Kolom checkbox
  const tdChk = tr.children[0];
  const inChk = tdChk.querySelector('.chk-in');
  const id    = tr.getAttribute('data-id');

  if(inChk){
    inChk.checked = true;
    inChk.disabled = true;
    inChk.classList.add('opacity-75');

    // Tambah checkbox OUT untuk keperluan batch checkout
    let out = tdChk.querySelector('.chk-out');
    if(!out){
      out = document.createElement('input');
      out.type = 'checkbox';
      out.className = 'form-check-input chk-out ms-2';
      out.setAttribute('data-id', id);
      tdChk.appendChild(out);
    }
  }

  // Tombol aksi: ganti label & gaya menjadi Check-Out saja
  const tdAct = tr.lastElementChild;
  tdAct.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm btn-act';
  btn.setAttribute('data-mode','out');
  btn.setAttribute('data-id', id);
  btn.textContent = 'Check-Out';
  tdAct.appendChild(btn);

  // pastikan set batch diperbarui
  selectedIn.delete(id);
}
