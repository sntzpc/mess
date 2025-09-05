import { showNotif } from '../util.js';
import { api, state } from '../api.js';

function norm(s){ return (s||'').toString().trim(); }

// --- helper: format ISO/UTC -> dd/MM/yyyy tanpa bergantung zona waktu browser ---
function toDmy(val){
  if(!val) return '';
  const s = String(val).trim();

  // jika sudah dd/MM/yyyy, langsung kembalikan
  const mDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\b|$)/);
  if(mDMY){
    const d = mDMY[1].padStart(2,'0');
    const m = mDMY[2].padStart(2,'0');
    const y = mDMY[3];
    return `${d}/${m}/${y}`;
  }

  // pola ISO: YYYY-MM-DD atau YYYY-MM-DDT...Z
  const mISO = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*Z)?$/);
  if(mISO){
    const y = mISO[1], m = mISO[2], d = mISO[3];
    return `${d}/${m}/${y}`; // ambil tanggal sesuai bagian ISO-nya (tanpa konversi zona)
  }

  // kalau ada 'Z', pakai komponen UTC agar tidak geser hari
  if(s.includes('Z')){
    const d = new Date(s);
    if(!isNaN(d)){
      const dd = String(d.getUTCDate()).padStart(2,'0');
      const mm = String(d.getUTCMonth()+1).padStart(2,'0');
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  }

  // fallback: coba parse biasa (lokal)
  const d = new Date(s);
  if(!isNaN(d)){
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  // jika semua gagal, tampilkan apa adanya
  return s;
}


// cache kamar per mess agar hemat request
const roomsCache = new Map(); // key: messName -> [{room_name, status, ...}]

export function showApproval(){
  loadApproval();
}

async function loadApproval(){
  const r = await api('reserve.list', {});
  const wrap = document.getElementById('approval-list'); wrap.innerHTML='';
  (r.rows||[]).forEach(res=>{
    const card = document.createElement('div'); card.className='card mb-3 shadow-sm';
    const guestsRows = res.guests.map(g=>{
      const messOptions = ['',
        ...state.cacheMess.map(m=>m.name)
      ].map(m=>`<option value="${m}" ${ (g.mess_alloc===m)?'selected':'' }>${m||'-'}</option>`).join('');
      // room dropdown akan diisi dinamis saat render (setelah DOM siap)
      return `
      <tr data-guest="${g.id}">
        <td>${g.name}</td><td>${g.unit}</td><td>${g.title}</td><td>${g.gender}</td>
        <td>
          <select class="form-select form-select-sm sel-mess" data-id="${g.id}">
            ${messOptions}
          </select>
        </td>
        <td>
          <select class="form-select form-select-sm sel-room" data-id="${g.id}">
            <option value="">- pilih kamar -</option>
          </select>
        </td>
        <td class="text-end">
          <button class="btn btn-success btn-sm btn-approve" data-id="${g.id}" title="Approve satu tamu"><i class="bi bi-check-circle"></i></button>
          <button class="btn btn-outline-danger btn-sm btn-del" data-id="${g.id}" title="Hapus tamu"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <b>${res.orderer_name}</b> | ${res.orderer_unit} | ${res.orderer_title}<br/>
            Agenda: ${res.agenda}<br/>
            Rencana: ${toDmy(res.checkin_plan)} ➜ ${toDmy(res.checkout_plan)}
          </div>
          <div class="text-end d-flex flex-wrap gap-2">
            <button class="btn btn-primary btn-sm btn-approve-all" title="Approve semua tamu">
              <i class="bi bi-check2-all"></i> Approve Semua
            </button>
            <button class="btn btn-outline-secondary btn-sm btn-view">View</button>
            <button class="btn btn-outline-danger btn-sm btn-reject">Reject</button>
          </div>
        </div>
        <div class="mt-2 table-responsive" style="display:none">
          <table class="table table-sm mb-0"><thead><tr>
            <th>Nama</th><th>Unit</th><th>Jabatan</th><th>Gender</th><th>Mess</th><th>No Kamar</th><th class="text-end">Aksi</th>
          </tr></thead><tbody>${guestsRows}</tbody></table>
        </div>
      </div>`;

    wrap.appendChild(card);

    // wiring tombol header
    const tbody = card.querySelector('tbody');
    card.querySelector('.btn-view').addEventListener('click', ()=>{
      const tbl=card.querySelector('.table-responsive');
      tbl.style.display = (tbl.style.display==='none')?'block':'none';
      // saat pertama kali dibuka, isi semua dropdown kamar
      if(tbl.style.display==='block') initRoomsForAllRows(tbody, res);
    });

    card.querySelector('.btn-reject').addEventListener('click', async ()=>{
      const reason = prompt('Alasan reject?'); if(reason===null) return;
      const rj = await api('approve.reject', {reservation_id: res.id, reason});
      if(rj.ok){ showNotif('Reservasi di-reject'); card.remove(); }
    });

    // Approve semua tamu (validasi kamar harus terisi)
    card.querySelector('.btn-approve-all').addEventListener('click', async ()=>{
      // pastikan tabel terlihat dulu agar dropdown sudah ter-inisialisasi
      const tbl=card.querySelector('.table-responsive');
      if(tbl.style.display==='none'){ tbl.style.display='block'; await initRoomsForAllRows(tbody, res); }
      const rows = Array.from(tbody.querySelectorAll('tr'));
      // validasi semua punya kamar
      let okAll = true;
      for(const tr of rows){
        const selRoom = tr.querySelector('.sel-room');
        const val = selRoom.value.trim();
        if(!val){
          selRoom.classList.add('is-invalid');
          okAll = false;
        }else{
          selRoom.classList.remove('is-invalid');
        }
      }
      if(!okAll){ showNotif('Masih ada tamu yang belum dipilih No Kamarnya', false); return; }

      // simpan alokasi (mess & room) lalu approve satu per satu
      try{
        for(const tr of rows){
          const gid = tr.getAttribute('data-guest');
          const selMess = tr.querySelector('.sel-mess');
          const selRoom = tr.querySelector('.sel-room');
          const mess_alloc = selMess.value.trim();
          const room_alloc = selRoom.value.trim();

          // simpan alokasi (idempoten)
          await api('approve.alloc', {guest_id: gid, mess_alloc, room_alloc});
        }
        // approve semua
        for(const tr of rows){
          const gid = tr.getAttribute('data-guest');
          await api('guest.approve', {guest_id: gid});
        }
        showNotif('Semua tamu di-approve');
        // hilangkan kartu dari list
        card.remove();
      }catch(e){
        showNotif('Gagal Approve Semua: '+e.message, false);
      }
    });

    // wiring per-baris
    tbody.querySelectorAll('.sel-mess').forEach(sel=>{
      sel.addEventListener('change', async (e)=>{
        const tr = e.target.closest('tr');
        const guest_id = sel.getAttribute('data-id');
        const mess_alloc = sel.value;
        // update rooms dropdown untuk baris ini
        await populateRoomsSelect(tr.querySelector('.sel-room'), mess_alloc, res.checkin_plan, res.checkout_plan, /*preselect*/ '');
        // simpan alokasi mess
        await api('approve.alloc', {guest_id, mess_alloc});
        showNotif('Mess dialokasikan');
      });
    });

    tbody.querySelectorAll('.sel-room').forEach(sel=>{
      sel.addEventListener('change', async (e)=>{
        const guest_id = sel.getAttribute('data-id');
        const room_alloc = sel.value.trim();
        // jika kosong, tandai invalid
        if(!room_alloc){ sel.classList.add('is-invalid'); return; }
        sel.classList.remove('is-invalid');
        await api('approve.alloc', {guest_id, room_alloc});
        showNotif('Kamar dialokasikan');
      });
    });

    tbody.querySelectorAll('.btn-approve').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const tr = btn.closest('tr');
        const gid = btn.getAttribute('data-id');
        const selRoom = tr.querySelector('.sel-room');
        if(!selRoom.value.trim()){
          selRoom.classList.add('is-invalid');
          showNotif('Pilih No Kamar dulu', false);
          return;
        }
        const ok = await api('guest.approve', {guest_id: gid});
        if(ok.ok){ showNotif('Approved'); loadApproval(); }
      });
    });

    tbody.querySelectorAll('.btn-del').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const guest_id = btn.getAttribute('data-id');
        const reason = prompt('Alasan hapus?'); if(reason===null) return;
        const del = await api('guest.delete', {guest_id, reason});
        if(del.ok){ showNotif('Guest dihapus'); loadApproval(); }
      });
    });
  });
}

/* ========= Helpers ========= */

// Saat pertama kali membuka detail pemesan, kita isi semua dropdown kamar sesuai mess default/terpilih
async function initRoomsForAllRows(tbody, res){
  const tasks = [];
  const rows = Array.from(tbody.querySelectorAll('tr'));
  for(const tr of rows){
    const gMessSel = tr.querySelector('.sel-mess');
    const gRoomSel = tr.querySelector('.sel-room');
    // pakai mess dari select (kalau kosong fallback ke reservasi)
    const messName = norm(gMessSel.value || res.mess_selected || '');
    const guest = res.guests.find(x=>x.id===tr.getAttribute('data-guest'));
    const pre = guest?.room_alloc || '';
    tasks.push(populateRoomsSelect(gRoomSel, messName, res.checkin_plan, res.checkout_plan, pre));
  }
  await Promise.all(tasks);
}

// Isi dropdown kamar sesuai mess; gunakan cache agar hemat request
async function populateRoomsSelect(selectEl, messName, dateFrom, dateTo, preselect=''){
  selectEl.innerHTML = `<option value="">- pilih kamar -</option>`;

  const rawMess = norm(messName);
  if(!rawMess){ return; }

  // 1) isi normal
  let ok = await fillRoomsOnce(selectEl, rawMess, dateFrom, dateTo, preselect);

  // 2) retry jika ada spasi/kapitalisasi aneh
  if(!ok && rawMess){
    ok = await fillRoomsOnce(selectEl, norm(rawMess), dateFrom, dateTo, preselect);
  }

  // 3) placeholder jika kosong
  if(!ok){
    selectEl.insertAdjacentHTML('beforeend',
      `<option value="" disabled>(kamar tidak ditemukan untuk mess "${rawMess}")</option>`);
  }

  // Auto re-populate ketika fokus dan masih kosong
  selectEl.addEventListener('focus', async ()=>{
    if(selectEl.options.length <= 1){
      const tr = selectEl.closest('tr');
      const m  = norm(tr.querySelector('.sel-mess').value);
      await fillRoomsOnce(selectEl, m, dateFrom, dateTo, '');
    }
  });

  if(preselect){ selectEl.classList.remove('is-invalid'); }
}
async function getRoomsForMess(messName, dateFrom, dateTo) {
  const m = norm(messName);
  const dFrom = norm(dateFrom);
  const dTo   = norm(dateTo);
  const cacheKey = `${m}|${dFrom}|${dTo}`.toLowerCase(); // hanya key yang lower untuk konsistensi
  if (!m) return [];
  if (roomsCache.has(cacheKey)) return roomsCache.get(cacheKey);

  // PENTING: kirim mess_name apa adanya (JANGAN di-lowercase)
  const r = await api('rooms.list', { mess_name: m, date_from: dFrom, date_to: dTo });
  const rooms = r.ok ? (r.rows || []) : [];
  roomsCache.set(cacheKey, rooms);
  return rooms;
}

async function fillRoomsOnce(selectEl, messName, dateFrom, dateTo, preselect){
  const rooms = await getRoomsForMess(messName, dateFrom, dateTo);
  const options = rooms.map(room=>{
    const remaining = Number(room.remaining ?? (room.capacity - (room.used_total ?? room.used ?? 0)));
    const cap       = Number(room.capacity || 0);
    const usedTot   = Number(room.used_total ?? room.used ?? 0);
    const gradeStr  = room.grade ? `, ${room.grade}` : '';
    const tagSisa   = isFinite(remaining) ? `, sisa ${remaining}` : '';
    const penuh     = (cap > 0 && remaining <= 0);

    const label = `${room.room_name} (kap ${cap}${gradeStr}${tagSisa})${penuh ? ' [penuh]' : ''}`;

    return `<option value="${room.room_name}" ${penuh?'disabled':''} ${preselect===room.room_name?'selected':''}>${label}</option>`;
  }).join('');

  if(options){
    selectEl.insertAdjacentHTML('beforeend', options);
    return true;
  }
  return false;
}
