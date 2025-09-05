import { showNotif } from '../util.js';
import { api, state } from '../api.js';

let selectedIn = new Set();   // id tamu yang dicentang untuk Check-In
let selectedOut = new Set();  // id tamu yang dicentang untuk Check-Out

export function initMess(){
  const btnRefresh = document.getElementById('btn-mess-refresh');
  const selMess    = document.getElementById('mess-choose');

  if(btnRefresh) btnRefresh.addEventListener('click', loadMessQueue);
  if(selMess)    selMess.addEventListener('change', loadMessQueue);

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

  const rows = (res.rows||[]).map((g,i)=>{
    const isApproved  = (g.status === 'approved');
    const isCheckedIn = (g.status === 'checkedin');

    // checkbox di kolom paling kiri: tergantung status baris
    const chkCell = isApproved
      ? `<input class="form-check-input chk-in" type="checkbox" data-id="${g.id}" aria-label="Pilih untuk Check-In">`
      : `<input class="form-check-input chk-out" type="checkbox" data-id="${g.id}" aria-label="Pilih untuk Check-Out">`;

    // *** SATU tombol saja di kolom Aksi ***
    const btnSingle = isApproved
      ? `<button class="btn btn-success btn-sm btn-act" data-mode="in" data-id="${g.id}">Check-In</button>`
      : `<button class="btn btn-secondary btn-sm btn-act" data-mode="out" data-id="${g.id}">Check-Out</button>`;

    return `
      <tr data-id="${g.id}" data-status="${g.status}">
        <td class="text-center" style="width:42px">${chkCell}</td>
        <td>${i+1}</td>
        <td>${g.name}</td>
        <td>${g.unit||''}</td>
        <td>${g.title||''}</td>
        <td>${g.gender||''}</td>
        <td>${g.room_alloc||''}</td>
        <td class="text-end">${btnSingle}</td>
      </tr>`;
  }).join('');

  host.innerHTML = `
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

  // Delegasi event
  host.addEventListener('change', onCheckboxChange);
  host.addEventListener('click', onClickActions);
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

  // Single action (SATU tombol)
  if(btn.classList.contains('btn-act')){
    const id   = btn.getAttribute('data-id');
    const mode = btn.getAttribute('data-mode'); // 'in' atau 'out'
    if(mode === 'in'){
      await doSingleCheckIn(id, btn);
    }else if(mode === 'out'){
      await doSingleCheckOut(id, btn);
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
      showNotif('Check-in tercatat');
      const tr = btn.closest('tr');
      markRowCheckedIn(tr); // ubah tombol jadi Check-Out dan atur checkbox
    }
  }catch(e){
    btn.disabled = false;
  }
}

async function doSingleCheckOut(guestId, btn){
  btn.disabled = true;
  try{
    const r = await api('guest.checkout', {guest_id: guestId});
    if(r.ok){
      showNotif('Check-out tercatat');
      const tr = btn.closest('tr');
      tr?.remove();               // hilangkan baris
      selectedOut.delete(guestId);
      updateBulkBar();
    }
  }catch(e){
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
// - Tombol Aksi: berubah dari Check-In (hijau) -> Check-Out (abu-abu, 1 tombol saja)
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

  // Tombol aksi: ganti label & gaya, tetap SATU tombol
  const tdAct = tr.lastElementChild;
  let btn = tdAct.querySelector('.btn-act');
  if(!btn){
    btn = document.createElement('button');
    tdAct.appendChild(btn);
  }
  btn.className = 'btn btn-secondary btn-sm btn-act';
  btn.setAttribute('data-mode','out');
  btn.textContent = 'Check-Out';

  // pastikan set batch diperbarui
  selectedIn.delete(id);
}
