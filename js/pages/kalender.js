import { api, state } from '../api.js';
import { showNotif } from '../util.js';
import { fmtDateStr, todayStr } from '../core/date.js';

let inited = false;
let lastKey = '';

const DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function esc(s){
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function ymNow(){ return todayStr().slice(0,7); }
function ymShift(ym, delta){
  const [y,m] = String(ym || ymNow()).split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function dmyToYmd(s){
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m) return '';
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
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
    const cls = d.conflict_count ? 'bentrok' : (d.full_rooms ? 'penuh' : (d.used_capacity ? 'terisi' : 'kosong'));
    const agendas = (d.agendas || []).slice(0,3).map(a => `<div class="cal-agenda text-truncate" title="${esc(a.agenda)}">${esc(a.agenda)}</div>`).join('');
    const more = (d.agendas || []).length > 3 ? `<div class="small text-muted">+${(d.agendas||[]).length - 3} agenda lain</div>` : '';
    const emptyRooms = (d.empty_rooms || []).slice(0,3).join(', ');
    return `
      <div class="cal-day ${cls} ${d.date===today?'today':''}" title="${esc(formatDayTitle(d.date))}">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="cal-date">${Number(d.date.slice(8,10))}</div>
          <span class="badge ${d.conflict_count?'text-bg-danger':(d.full_rooms?'text-bg-warning':'text-bg-light border')}">${esc(d.occupancy_rate || 0)}%</span>
        </div>
        <div class="cal-day-stats">Terisi ${esc(d.used_capacity || 0)}/${esc(d.total_capacity || 0)} • Kosong ${esc(d.empty_rooms_count || 0)}</div>
        ${agendas || '<div class="cal-agenda muted">Tidak ada agenda</div>'}
        ${more}
        ${emptyRooms ? `<div class="cal-empty-room text-truncate">Kosong: ${esc(emptyRooms)}</div>` : ''}
      </div>`;
  };
}

function renderRoomTable(days){
  const host = document.getElementById('cal-room-table');
  if(!host) return;
  const important = days.filter(d => d.used_capacity || d.full_rooms || d.conflict_count || d.checkins || d.checkouts);
  if(!important.length){ host.innerHTML = '<div class="text-muted small">Belum ada okupansi pada bulan ini.</div>'; return; }
  host.innerHTML = `<table class="table table-sm table-hover align-middle">
    <thead><tr><th>Tanggal</th><th>Terisi</th><th>Kamar Penuh</th><th>Kamar Kosong</th><th>Check-in</th><th>Check-out</th></tr></thead>
    <tbody>${important.map(d => `
      <tr>
        <td><b>${esc(shortDate(d.date))}</b><div class="small text-muted">${esc(formatDayTitle(d.date).split(',')[0])}</div></td>
        <td>${esc(d.used_capacity || 0)} / ${esc(d.total_capacity || 0)} <span class="badge text-bg-light border">${esc(d.occupancy_rate || 0)}%</span></td>
        <td>${(d.full_room_names||[]).length ? (d.full_room_names||[]).map(x=>`<span class="badge text-bg-warning me-1">${esc(x)}</span>`).join('') : '<span class="text-muted">-</span>'}</td>
        <td>${(d.empty_rooms||[]).slice(0,6).map(x=>`<span class="badge text-bg-light border me-1">${esc(x)}</span>`).join('') || '<span class="text-muted">-</span>'}${(d.empty_rooms||[]).length>6 ? `<span class="small text-muted">+${d.empty_rooms.length-6}</span>` : ''}</td>
        <td>${esc(d.checkins || 0)}</td>
        <td>${esc(d.checkouts || 0)}</td>
      </tr>`).join('')}</tbody></table>`;
}

function renderConflicts(rows){
  const host = document.getElementById('cal-conflicts');
  if(!host) return;
  if(!rows.length){ host.innerHTML = '<div class="text-muted small">Tidak ada potensi bentrok / over kapasitas pada periode ini.</div>'; return; }
  host.innerHTML = rows.map(c => `
    <div class="cal-list-item conflict">
      <div class="d-flex justify-content-between gap-2"><b>${esc(fmtDateStr(c.date) || c.date)}</b><span class="badge text-bg-danger">${esc(c.used)} / ${esc(c.capacity)}</span></div>
      <div class="small"><b>${esc(c.mess)}</b> • Kamar ${esc(c.room)}</div>
      <div class="small text-muted">${esc((c.guests || []).slice(0,4).join(', '))}${(c.guests||[]).length>4 ? ' +' + ((c.guests||[]).length-4) : ''}</div>
    </div>`).join('');
}
