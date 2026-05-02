import { api, state } from '../api.js';
import { showNotif } from '../util.js';
import { fmtDateStr, todayStr } from '../core/date.js';

let inited = false;
let lastKey = '';
let lastCalendarData = null;

const DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ymNow(){ return todayStr().slice(0,7); }
function ymShift(ym, delta){
  const [y,m] = String(ym || ymNow()).split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function ymdToDate(ymd){
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 12, 0, 0);
}
function formatDayTitle(ymd){
  const [y,m,d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${String(d).padStart(2,'0')} ${MONTH_NAMES[m-1]} ${y}`;
}
function shortDate(ymd){
  const [y,m,d] = String(ymd).split('-');
  return `${d}/${m}`;
}
function setDefaultFilters(){
  const month = document.getElementById('cal-month');
  if(month && !month.value) month.value = ymNow();
  const mess = document.getElementById('cal-mess');
  if(mess && !mess.dataset.ready){
    const opts = (state.cacheMess || []).map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    mess.innerHTML = `<option value="">Semua Mess</option>${opts}`;
    if(state.user?.role === 'mess' && state.user?.mess){
      mess.value = state.user.mess;
      mess.disabled = true;
    }
    mess.dataset.ready = '1';
  }
}
function ensureDetailModal(){
  let modal = document.getElementById('cal-day-modal');
  if(modal) return modal;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" id="cal-day-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content cal-detail-modal">
          <div class="modal-header">
            <div>
              <h5 class="modal-title mb-0" id="cal-day-modal-title">Detail Okupansi</h5>
              <div class="small text-muted" id="cal-day-modal-subtitle"></div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="cal-day-modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Tutup</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);
  return document.getElementById('cal-day-modal');
}

export function initKalender(){
  if(inited) return;
  inited = true;
  const month = document.getElementById('cal-month');
  const mess = document.getElementById('cal-mess');
  document.getElementById('btn-cal-show')?.addEventListener('click', ()=>loadKalender(true));
  document.getElementById('btn-cal-today')?.addEventListener('click', ()=>{ if(month) month.value = ymNow(); loadKalender(true); });
  document.getElementById('btn-cal-prev')?.addEventListener('click', ()=>{ if(month) month.value = ymShift(month.value, -1); loadKalender(true); });
  document.getElementById('btn-cal-next')?.addEventListener('click', ()=>{ if(month) month.value = ymShift(month.value, 1); loadKalender(true); });
  month?.addEventListener('change', ()=>loadKalender(true));
  mess?.addEventListener('change', ()=>loadKalender(true));
  document.getElementById('cal-grid')?.addEventListener('click', (e)=>{
    const card = e.target.closest('.cal-day[data-date]');
    if(!card) return;
    openDayDetail(card.dataset.date);
  });
}

export async function loadKalender(force=false){
  setDefaultFilters();
  const month = document.getElementById('cal-month')?.value || ymNow();
  const mess = document.getElementById('cal-mess')?.value || '';
  const key = `${month}|${mess}`;
  if(!force && key === lastKey && document.getElementById('cal-grid')?.innerHTML) return;
  lastKey = key;

  const r = await api('calendar.overview', { month, mess_name: mess });
  if(!r.ok){ showNotif('Gagal memuat kalender: ' + (r.error || 'server error'), false); return; }
  lastCalendarData = r;
  renderKalender(r);
}

function renderKalender(data){
  const s = data.summary || {};
  const title = `${MONTH_NAMES[(Number((data.month||'').slice(5,7))||1)-1] || ''} ${(data.month||'').slice(0,4)}${s.mess_name ? ' • ' + s.mess_name : ' • Semua Mess'}`;
  const titleEl = document.getElementById('cal-title');
  if(titleEl) titleEl.textContent = title;
  renderKpi(s);
  renderTodayList('cal-checkins', data.today_checkins || [], 'Belum ada tamu yang dijadwalkan check-in hari ini.', 'checkin');
  renderTodayList('cal-checkouts', data.today_checkouts || [], 'Belum ada tamu yang dijadwalkan check-out hari ini.', 'checkout');
  renderGrid(data.days || []);
  renderRoomTable(data.days || []);
  renderConflicts(data.conflicts || []);
}

function renderKpi(s){
  const host = document.getElementById('cal-kpi');
  if(!host) return;
  const cards = [
    ['Total Kamar', s.total_rooms || 0, 'door-open', 'Jumlah kamar master aktif'],
    ['Total Kapasitas', s.total_capacity || 0, 'people', 'Jumlah bed/kapasitas'],
    ['Okupansi Puncak', (s.peak_occupancy_rate || 0) + '%', 'graph-up-arrow', 'Persentase tertinggi bulan ini'],
    ['Hari Penuh', s.full_day_count || 0, 'calendar-x', 'Hari dengan minimal satu kamar penuh'],
    ['Potensi Bentrok', s.conflict_count || 0, 'exclamation-triangle', 'Over kapasitas pada kamar tertentu']
  ];
  host.innerHTML = cards.map(c => `
    <div class="col-6 col-lg">
      <div class="card kpi-card h-100">
        <div class="card-body py-3">
          <div class="d-flex justify-content-between gap-2">
            <div>
              <div class="kpi-label">${esc(c[0])}</div>
              <div class="kpi-value cal-kpi-value">${esc(c[1])}</div>
              <div class="kpi-note">${esc(c[3])}</div>
            </div>
            <i class="bi bi-${c[2]} cal-kpi-icon"></i>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderTodayList(id, rows, emptyText, type){
  const host = document.getElementById(id);
  if(!host) return;
  if(!rows.length){ host.innerHTML = `<div class="text-muted small">${esc(emptyText)}</div>`; return; }
  host.innerHTML = rows.map(r => `
    <div class="cal-list-item ${type}">
      <div class="fw-bold text-truncate">${esc(r.name)}</div>
      <div class="small text-muted text-truncate">${esc(r.agenda || '-')}</div>
      <div class="small"><span class="badge text-bg-light border">${esc(r.mess || '-')}</span> <span class="badge text-bg-primary">Kamar ${esc(r.room || '-')}</span></div>
    </div>`).join('');
}

function renderGrid(days){
  const host = document.getElementById('cal-grid');
  if(!host) return;
  if(!days.length){ host.innerHTML = '<div class="text-muted">Data kalender kosong.</div>'; return; }
  const [y,m] = days[0].date.split('-').map(Number);
  const firstDay = new Date(y, m-1, 1).getDay();
  const blanks = Array.from({length:firstDay}, () => '<div class="cal-day blank"></div>').join('');
  const today = todayStr();
  host.innerHTML = `<div class="cal-week-head">${DAY_NAMES.map(d=>`<div>${d}</div>`).join('')}</div><div class="cal-month-grid">${blanks}${days.map(dayCard(today)).join('')}</div>`;
}

function dayCard(today){
  return function(d){
    const baseCls = d.conflict_count ? 'bentrok' : (d.full_rooms ? 'penuh' : (d.used_capacity ? 'terisi' : 'kosong'));
    const timeCls = d.date === today ? 'today active-today' : (d.date < today ? 'past' : 'future');
    const agendas = (d.agendas || []).slice(0,3).map(a => `<div class="cal-agenda text-truncate" title="${esc(a.agenda)}">${esc(a.agenda)}</div>`).join('');
    const more = (d.agendas || []).length > 3 ? `<div class="small text-muted">+${(d.agendas||[]).length - 3} agenda lain</div>` : '';
    const emptyRooms = (d.empty_rooms || []).slice(0,3).join(', ');
    return `
      <button type="button" class="cal-day ${baseCls} ${timeCls}" data-date="${esc(d.date)}" title="Klik untuk melihat detail ${esc(formatDayTitle(d.date))}">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="cal-date">${Number(d.date.slice(8,10))}</div>
            ${d.date === today ? '<div class="cal-today-label">Hari ini</div>' : (d.date < today ? '<div class="cal-past-label">Sudah lewat</div>' : '')}
          </div>
          <span class="badge ${d.conflict_count?'text-bg-danger':(d.date===today?'text-bg-success':(d.full_rooms?'text-bg-warning':'text-bg-light border'))}">${esc(d.occupancy_rate || 0)}%</span>
        </div>
        <div class="cal-day-stats">Terisi ${esc(d.used_capacity || 0)}/${esc(d.total_capacity || 0)} • Kosong ${esc(d.empty_rooms_count || 0)}</div>
        ${agendas || '<div class="cal-agenda muted">Tidak ada agenda</div>'}
        ${more}
        ${emptyRooms ? `<div class="cal-empty-room text-truncate">Kosong: ${esc(emptyRooms)}</div>` : ''}
        <div class="cal-click-hint"><i class="bi bi-search"></i> Detail</div>
      </button>`;
  };
}

function renderRoomTable(days){
  const host = document.getElementById('cal-room-table');
  if(!host) return;
  const important = days.filter(d => d.used_capacity || d.full_rooms || d.conflict_count || d.checkins || d.checkouts || d.date < todayStr());
  if(!important.length){ host.innerHTML = '<div class="text-muted small">Belum ada okupansi pada bulan ini.</div>'; return; }
  host.innerHTML = `<table class="table table-sm table-hover align-middle">
    <thead><tr><th>Tanggal</th><th>Status</th><th>Terisi</th><th>Kamar Penuh</th><th>Kamar Kosong</th><th>Check-in</th><th>Check-out</th></tr></thead>
    <tbody>${important.map(d => `
      <tr class="${d.date < todayStr() ? 'cal-row-past' : (d.date === todayStr() ? 'cal-row-today' : '')}">
        <td><button type="button" class="btn btn-link btn-sm p-0 fw-bold cal-table-date" data-date="${esc(d.date)}">${esc(shortDate(d.date))}</button><div class="small text-muted">${esc(formatDayTitle(d.date).split(',')[0])}</div></td>
        <td>${d.date === todayStr() ? '<span class="badge text-bg-success">Hari ini</span>' : (d.date < todayStr() ? '<span class="badge text-bg-secondary">History</span>' : '<span class="badge text-bg-light border">Rencana</span>')}</td>
        <td>${esc(d.used_capacity || 0)} / ${esc(d.total_capacity || 0)} <span class="badge text-bg-light border">${esc(d.occupancy_rate || 0)}%</span></td>
        <td>${(d.full_room_names||[]).length ? (d.full_room_names||[]).map(x=>`<span class="badge text-bg-warning me-1">${esc(x)}</span>`).join('') : '<span class="text-muted">-</span>'}</td>
        <td>${(d.empty_rooms||[]).slice(0,6).map(x=>`<span class="badge text-bg-light border me-1">${esc(x)}</span>`).join('') || '<span class="text-muted">-</span>'}${(d.empty_rooms||[]).length>6 ? `<span class="small text-muted">+${d.empty_rooms.length-6}</span>` : ''}</td>
        <td>${esc(d.checkins || 0)}</td>
        <td>${esc(d.checkouts || 0)}</td>
      </tr>`).join('')}</tbody></table>`;
  host.querySelectorAll('.cal-table-date').forEach(btn => btn.addEventListener('click', ()=>openDayDetail(btn.dataset.date)));
}

function renderConflicts(rows){
  const host = document.getElementById('cal-conflicts');
  if(!host) return;
  if(!rows.length){ host.innerHTML = '<div class="text-muted small">Tidak ada potensi bentrok / over kapasitas pada periode ini.</div>'; return; }
  host.innerHTML = rows.map(c => {
    const guestNames = (c.guests || []).map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
    return `
    <div class="cal-list-item conflict">
      <div class="d-flex justify-content-between gap-2"><b>${esc(fmtDateStr(c.date) || c.date)}</b><span class="badge text-bg-danger">${esc(c.used)} / ${esc(c.capacity)}</span></div>
      <div class="small"><b>${esc(c.mess)}</b> • Kamar ${esc(c.room)}</div>
      <div class="small text-muted">${esc(guestNames.slice(0,4).join(', '))}${guestNames.length>4 ? ' +' + (guestNames.length-4) : ''}</div>
    </div>`;
  }).join('');
}

function openDayDetail(ymd){
  const day = (lastCalendarData?.days || []).find(d => d.date === ymd);
  if(!day){ showNotif('Detail tanggal tidak ditemukan. Silakan refresh kalender.', false); return; }
  const modal = ensureDetailModal();
  document.getElementById('cal-day-modal-title').textContent = `Detail Okupansi • ${formatDayTitle(ymd)}`;
  const t = todayStr();
  const statusText = ymd === t ? 'Hari ini / aktif' : (ymd < t ? 'History okupansi tanggal sudah lewat' : 'Rencana okupansi mendatang');
  document.getElementById('cal-day-modal-subtitle').textContent = statusText;
  document.getElementById('cal-day-modal-body').innerHTML = renderDayDetailBody(day, ymd, t);
  const bs = window.bootstrap?.Modal?.getOrCreateInstance(modal);
  if(bs) bs.show();
  else modal.classList.add('show');
}

function renderDayDetailBody(day, ymd, today){
  const rooms = (day.room_details || []).slice().sort((a,b)=>{
    const aUsed = Number(a.used || 0), bUsed = Number(b.used || 0);
    if((bUsed>0) !== (aUsed>0)) return (bUsed>0) - (aUsed>0);
    const x = String(a.mess).localeCompare(String(b.mess), 'id', {numeric:true, sensitivity:'base'});
    if(x) return x;
    return String(a.room).localeCompare(String(b.room), 'id', {numeric:true, sensitivity:'base'});
  });
  const occupied = rooms.filter(r => Number(r.used || 0) > 0);
  const empty = rooms.filter(r => Number(r.used || 0) <= 0);
  const agendaHtml = (day.agendas || []).length
    ? (day.agendas || []).map(a => `<span class="badge text-bg-primary me-1 mb-1">${esc(a.agenda)}</span>`).join('')
    : '<span class="text-muted">Tidak ada agenda berjalan.</span>';

  return `
    <div class="cal-detail-status ${ymd === today ? 'today' : (ymd < today ? 'past' : 'future')}">
      <div>
        <div class="small text-muted">Status Tanggal</div>
        <div class="fw-bold">${ymd === today ? 'Hari ini sedang aktif' : (ymd < today ? 'Tanggal sudah lewat / history' : 'Tanggal rencana mendatang')}</div>
      </div>
      <div class="text-end">
        <div class="small text-muted">Okupansi</div>
        <div class="cal-detail-rate">${esc(day.occupancy_rate || 0)}%</div>
      </div>
    </div>

    <div class="row g-2 mb-3">
      ${detailMiniCard('Total Kapasitas', `${day.used_capacity || 0} / ${day.total_capacity || 0}`, 'people')}
      ${detailMiniCard('Kamar Kosong', day.empty_rooms_count || 0, 'door-open')}
      ${detailMiniCard('Kamar Penuh', day.full_rooms || 0, 'house-check')}
      ${detailMiniCard('Potensi Bentrok', day.conflict_count || 0, 'exclamation-triangle')}
      ${detailMiniCard('Check-in', day.checkins || 0, 'box-arrow-in-right')}
      ${detailMiniCard('Check-out', day.checkouts || 0, 'box-arrow-right')}
    </div>

    <div class="mb-3">
      <div class="fw-bold mb-2">Agenda Berjalan</div>
      <div>${agendaHtml}</div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <div class="fw-bold">Detail Kamar Terisi</div>
      <div class="small text-muted">${occupied.length} kamar terisi • ${empty.length} kamar kosong</div>
    </div>
    <div class="cal-detail-room-grid mb-3">
      ${occupied.length ? occupied.map(roomDetailCard).join('') : '<div class="text-muted small">Tidak ada kamar yang terisi pada tanggal ini.</div>'}
    </div>

    <div class="accordion" id="cal-empty-rooms-accordion">
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#cal-empty-rooms-collapse">
            Daftar Kamar Kosong (${empty.length})
          </button>
        </h2>
        <div id="cal-empty-rooms-collapse" class="accordion-collapse collapse" data-bs-parent="#cal-empty-rooms-accordion">
          <div class="accordion-body">
            ${empty.length ? `<div class="cal-empty-badges">${empty.map(r => `<span class="badge text-bg-light border">${esc(r.mess)} / ${esc(r.room)}</span>`).join('')}</div>` : '<span class="text-muted">Tidak ada kamar kosong.</span>'}
          </div>
        </div>
      </div>
    </div>`;
}

function detailMiniCard(label, value, icon){
  return `<div class="col-6 col-md-4 col-xl-2"><div class="cal-detail-mini"><i class="bi bi-${icon}"></i><div><div class="small text-muted">${esc(label)}</div><div class="fw-bold">${esc(value)}</div></div></div></div>`;
}

function roomDetailCard(r){
  const used = Number(r.used || 0);
  const cap = Number(r.capacity || 0);
  const cls = cap > 0 && used > cap ? 'conflict' : (cap > 0 && used >= cap ? 'full' : 'occupied');
  const agendaBadges = Object.keys(r.agendas || {}).map(a => `<span class="badge text-bg-light border me-1 mb-1">${esc(a)}</span>`).join('');
  const guests = (r.guests || []).map((g, idx) => `
    <li>
      <span class="guest-name text-truncate">${idx+1}. ${esc(g.name || g)}</span>
      <span class="guest-unit text-truncate">${esc(g.unit || g.title || '')}</span>
    </li>`).join('');
  return `
    <div class="cal-detail-room ${cls}">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div class="small text-muted">${esc(r.mess || '-')}</div>
          <div class="cal-detail-room-title">Kamar ${esc(r.room || '-')}</div>
        </div>
        <span class="badge ${cls==='conflict'?'text-bg-danger':(cls==='full'?'text-bg-warning':'text-bg-primary')}">${used}/${cap || '-'}</span>
      </div>
      <div class="mb-2">${agendaBadges || '<span class="text-muted small">Tanpa agenda</span>'}</div>
      <ul class="cal-detail-guest-list">${guests || '<li><span class="text-muted">Tidak ada tamu</span></li>'}</ul>
    </div>`;
}
