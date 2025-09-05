// js/pages/stat.js
import {api} from '../api.js';
import {showNotif} from '../util.js';

// State tampilan: 'mess' | 'rooms' | 'guests'
let view = {level: 'mess'};
// Cache ringan untuk KPI dashboard agar tidak flicker tiap back
let kpiCache = null;

export async function showStat() {
  try {
    if (view.level === 'mess') await renderMessCards();
    else if (view.level === 'rooms') await renderRoomCards(view.mess);
    else if (view.level === 'guests') await renderGuestList(view.mess, view.room);
  } catch (e) {
    showNotif('Gagal memuat statistik: ' + e.message, false);
  }
}

/* ===== KPI STRIP ===== */
async function renderKPI(container) {
  if (!kpiCache) {
    kpiCache = await api('stats.dashboard', {});
  }
  const d = kpiCache || {};

  const col = document.createElement('div');
  col.className = 'col-12';
  col.innerHTML = `
    <div class="row g-3">
      <div class="col-sm-6 col-lg-3">
        <div class="card kpi-card shadow-sm h-100">
          <div class="card-body">
            <div class="kpi-label">Total tamu aktif</div>
            <div class="kpi-value">${d.total_active||0}</div>
            <div class="kpi-note text-muted">Live (sedang menginap)</div>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-lg-3">
        <div class="card kpi-card shadow-sm h-100">
          <div class="card-body">
            <div class="kpi-label">Rata‑rata LOS</div>
            <div class="kpi-value">${(d.avg_los_days||0)}<span class="kpi-unit"> hari</span></div>
            <div class="kpi-note text-muted">30 hari terakhir</div>
          </div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="card kpi-card shadow-sm h-100">
          <div class="card-body">
            <div class="kpi-label">Top 3 kamar tersibuk</div>
            ${Array.isArray(d.top_rooms_active) && d.top_rooms_active.length>0 ? `
              <ol class="mb-0 ps-3">
                ${d.top_rooms_active.map(r=>`
                  <li class="small">${esc(r.mess)} – <b>${esc(r.room)}</b> <span class="badge text-bg-danger ms-1">${r.active} aktif</span></li>
                `).join('')}
              </ol>
            ` : `<div class="text-muted small">Belum ada data.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(col);

  return d; // kembalikan data agar dipakai Mess grid
}

/* ===== Level 1: Kartu Mess (jumlah tamu aktif + occupancy) ===== */
async function renderMessCards() {
  const host = document.getElementById('stat-box');
  host.innerHTML = '';

  // KPI strip di paling atas
  const kpiData = await renderKPI(host);

  // Ambil daftar mess
  const mres = await api('mess.list', {});
  const messRows = mres.rows || [];
  const perMess = (kpiData && kpiData.per_mess) || [];

  // bikin map occupancy/active/capacity
  const mapPer = Object.create(null);
  perMess.forEach(x => {
    mapPer[x.mess] = x;
  });

  if (messRows.length === 0) {
    host.innerHTML += `<div class="col-12"><div class="alert alert-info mt-3 mb-0">Belum ada data Mess.</div></div>`;
    return;
  }

  // Judul grid
  const h = document.createElement('div');
  h.className = 'col-12 mt-2';
  h.innerHTML = `<h5 class="mb-2">Mess</h5>`;
  host.appendChild(h);

  const frag = document.createDocumentFragment();
  messRows.forEach(m => {
    const stat = mapPer[m.name] || {
      active: 0,
      capacity: 0,
      occupancy: null
    };
    const occPct = (stat.occupancy == null) ? '-' : Math.round(stat.occupancy * 100) + '%';

    const div = document.createElement('div');
    div.className = 'col-sm-6 col-md-4 col-lg-3';
    div.innerHTML = `
      <div class="card stat-card shadow-sm h-100">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="card-title mb-1">${esc(m.name)}</h5>
            <span class="badge ${stat.active>0?'text-bg-danger':'text-bg-success'}">${stat.active} tamu</span>
          </div>
          <div class="text-muted small mb-1">${esc(m.location||'')}</div>
          <div class="small">Kapasitas: <b>${stat.capacity}</b></div>
          <div class="small">Occupancy: <b>${occPct}</b></div>
          <div class="mt-auto text-end">
            <button class="btn btn-outline-primary btn-sm">Lihat Kamar</button>
          </div>
        </div>
      </div>`;
    div.querySelector('button').addEventListener('click', () => {
      view = {
        level: 'rooms',
        mess: m.name
      };
      showStat();
    });
    frag.appendChild(div);
  });

  host.appendChild(frag);
}

/* ===== Level 2: Kartu Kamar per Mess ===== */
async function renderRoomCards(messName) {
  const host = document.getElementById('stat-box');
  host.innerHTML = '';

  const r = await api('rooms.list', { mess_name: messName });
  const rooms = r.rows || [];

  // Header + Back
  const header = document.createElement('div');
  header.className = 'col-12 d-flex align-items-center justify-content-between';
  header.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <button class="btn btn-light btn-sm" id="btn-back-mess"><i class="bi bi-arrow-left"></i> Kembali</button>
      <h5 class="mb-0">Mess: ${esc(messName)}</h5>
    </div>`;
  host.appendChild(header);
  header.querySelector('#btn-back-mess').addEventListener('click', () => {
    view = { level: 'mess' };
    showStat();
  });

  if (rooms.length === 0) {
    host.innerHTML += `<div class="col-12"><div class="alert alert-info mt-3">Belum ada kamar untuk mess ini.</div></div>`;
    return;
  }

  function toNum(n){ n = Number(n); return isNaN(n) ? 0 : n; }

  rooms.forEach(room => {
    const cap = toNum(room.capacity);
    // Ambil pemakaian dari used_total → used → used_active
    const used = toNum(room.used_total ?? room.used ?? room.used_active ?? 0);
    // Sisa dari field 'remaining' jika ada, fallback ke cap-used
    const remaining = ('remaining' in room) ? toNum(room.remaining) : Math.max(0, cap - used);

    // Pakai status dari server bila ada; jika tidak, hitung lokal
    let status = (room.status || '').toLowerCase();
    if (!status) {
      if (cap > 0 && used >= cap) status = 'penuh';
      else if (used > 0)          status = 'terisi';
      else                        status = 'tersedia';
    }

    // Warna solid: tersedia=putih, terisi=kuning lembut, penuh=merah lembut
    let cardClass = 'bg-available';
    if (status === 'terisi') cardClass = 'bg-occupied';
    if (status === 'penuh')  cardClass = 'bg-full';

    const div = document.createElement('div');
    div.className = 'col-sm-6 col-md-4 col-lg-3';
    div.innerHTML = `
      <div class="card stat-card shadow-sm h-100 ${cardClass}">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start">
            <h6 class="card-title mb-1">${esc(room.room_name)}</h6>
            <span class="badge ${status==='tersedia'?'text-bg-success':(status==='terisi'?'text-bg-warning':'text-bg-danger')}">${status}</span>
          </div>
          <div class="small text-muted">Gol: ${esc(room.grade||'-')}</div>
          <div class="mt-1">
            Terpakai: <b>${used}</b> / <b>${cap}</b>
            ${ (cap>0 && remaining>0 && used>0) ? `<span class="text-muted"> — Sisa ${remaining}</span>` : '' }
          </div>
          <div class="mt-auto d-flex justify-content-end gap-2">
            ${status==='tersedia' ? `<button class="btn btn-primary btn-sm btn-pesan">Pesan</button>` : ''}
            ${status!=='tersedia' ? `<button class="btn btn-outline-dark btn-sm btn-detail">Detail Tamu</button>` : ''}
          </div>
        </div>
      </div>`;

    const btnPesan = div.querySelector('.btn-pesan');
    if (btnPesan) {
      btnPesan.addEventListener('click', () => {
        try {
          document.getElementById('rsv-mess').value = room.mess_name || messName;
          localStorage.setItem('preferred_room', room.room_name);
          showNotif(`Kamar dipilih: ${(room.mess_name||messName)} - ${room.room_name}`);
          import('../util.js').then(({ go }) => go('page-reservasi'));
        } catch (e) {
          showNotif('Tidak dapat mengarahkan ke Reservasi', false);
        }
      });
    }

    const btnDetail = div.querySelector('.btn-detail');
    if (btnDetail) {
      btnDetail.addEventListener('click', () => {
        view = { level: 'guests', mess: (room.mess_name||messName), room: room.room_name };
        showStat();
      });
    }

    host.appendChild(div);
  });
}


// --- helpers aman untuk HTML + format tanggal/jam (WIB) ---
function esc(v){
  const s = String(v ?? '');
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '/':'&#x2F;', '`':'&#x60;', '=':'&#x3D;' };
  return s.replace(/[&<>"'`=\/]/g, ch => map[ch] || ch);
}

// Format tanggal: terima ISO / Date / string dd/MM/yyyy -> kembalikan dd/MM/yyyy (WIB)
function fmtDateID(val){
  if(!val) return '-';
  const s = String(val).trim();
  // jika sudah dd/MM/yyyy, langsung kembalikan
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // coba parse sebagai Date/ISO
  const d = new Date(s);
  if(!isNaN(d)) {
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'Asia/Jakarta' });
  }
  // fallback
  return s || '-';
}

// Format jam: terima ISO / Date / "H:MM" / "HH:MM(:SS)" -> kembalikan HH:MM (WIB, 24 jam)
function fmtTimeID(val){
  if(!val) return '-';
  const s = String(val).trim();
  // sudah HH:MM?
  if(/^\d{2}:\d{2}$/.test(s)) return s;
  // pola H:MM atau HH:MM(:SS)
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if(m){
    const hh = String(m[1]).padStart(2,'0');
    const mm = m[2];
    return `${hh}:${mm}`;
  }
  // coba parse ISO/Date
  const d = new Date(s);
  if(!isNaN(d)){
    return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Jakarta' });
  }
  // fallback
  return s || '-';
}

/* ===== Level 3: Daftar Tamu aktif pada kamar ===== */
async function renderGuestList(messName, roomName) {
  const host = document.getElementById('stat-box');
  host.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'col-12 d-flex align-items-center justify-content-between';
  header.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <button class="btn btn-light btn-sm" id="btn-back-rooms"><i class="bi bi-arrow-left"></i> Kembali</button>
      <h5 class="mb-0">Mess: ${esc(messName)} &nbsp; / &nbsp; Kamar: ${esc(roomName)}</h5>
    </div>`;
  host.appendChild(header);
  header.querySelector('#btn-back-rooms').addEventListener('click', () => {
    view = { level: 'rooms', mess: messName };
    showStat();
  });

  const r = await api('stays.active', { mess_name: messName, room_name: roomName });
  const rows = r.rows || [];

  if (rows.length === 0) {
    host.innerHTML += `<div class="col-12"><div class="alert alert-info mt-3">Tidak ada tamu aktif pada kamar ini.</div></div>`;
    return;
  }

  const list = document.createElement('div');
  list.className = 'col-12';
  list.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>No.</th><th>Nama</th><th>Unit</th><th>Jabatan</th><th>Agenda</th>
                <th>Check-in</th><th>Jam</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((g,i)=>{
                const tgl = fmtDateID(g.checkin_date);
                const jam = fmtTimeID(g.checkin_time);
                return `
                  <tr>
                    <td>${i+1}</td>
                    <td>${esc(g.name||'-')}</td>
                    <td>${esc(g.unit||'-')}</td>
                    <td>${esc(g.title||'-')}</td>
                    <td>${esc(g.agenda||'-')}</td>
                    <td>${tgl}</td>
                    <td>${jam}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  host.appendChild(list);
}
