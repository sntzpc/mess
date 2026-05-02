import { api, state } from '../api.js';
import { showNotif } from '../util.js';
import { fmtDateStr } from '../core/date.js';

let agendaLoaded = false;
let lastRows = [];

function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function norm(v){ return String(v || '').trim(); }
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }

export function initLabelTamu(){
  const btnRefresh = document.getElementById('btn-label-refresh');
  const btnShow = document.getElementById('btn-label-show');
  const btnPrint = document.getElementById('btn-label-print');
  const selAgenda = document.getElementById('label-agenda');
  const selMess = document.getElementById('label-mess');
  const selSize = document.getElementById('label-size');

  btnRefresh?.addEventListener('click', async()=>{ agendaLoaded=false; await loadLabelAgendas(true); });
  btnShow?.addEventListener('click', loadLabelRows);
  btnPrint?.addEventListener('click', ()=>{
    if(!lastRows.length){ showNotif('Tampilkan label terlebih dahulu', false); return; }
    document.body.classList.add('printing-labels');
    window.print();
    setTimeout(()=>document.body.classList.remove('printing-labels'), 700);
  });
  selAgenda?.addEventListener('change', loadLabelRows);
  selMess?.addEventListener('change', loadLabelRows);
  selSize?.addEventListener('change', ()=>renderLabels(lastRows));
}

export async function loadLabelAgendas(force=false){
  if(agendaLoaded && !force) return;
  const selAgenda = document.getElementById('label-agenda');
  const selMess = document.getElementById('label-mess');
  if(!selAgenda || !selMess) return;

  selAgenda.innerHTML = '<option value="">Memuat agenda...</option>';
  selMess.innerHTML = '<option value="">Semua Mess</option>';

  const r = await api('label.agendas', {});
  if(!r.ok){
    selAgenda.innerHTML = '<option value="">Gagal memuat agenda</option>';
    showNotif('Gagal memuat agenda label: '+(r.error||''), false);
    return;
  }

  const agendas = r.agendas || [];
  if(!agendas.length){
    selAgenda.innerHTML = '<option value="">Belum ada agenda yang sudah dialokasi/approve</option>';
  }else{
    selAgenda.innerHTML = '<option value="">- pilih agenda -</option>' + agendas.map(a=>{
      const label = `${a.agenda} | ${a.period || '-'} | ${a.count || 0} tamu`;
      return `<option value="${esc(a.agenda)}">${esc(label)}</option>`;
    }).join('');
  }

  let messOptions = [];
  if(state.user?.role === 'mess'){
    messOptions = unique([state.user.mess]);
    selMess.disabled = true;
  }else{
    messOptions = unique([...(r.mess || []), ...state.cacheMess.map(m=>m.name)]);
    selMess.disabled = false;
  }
  selMess.innerHTML = '<option value="">Semua Mess</option>' + messOptions.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  if(state.user?.role === 'mess') selMess.value = state.user.mess || '';

  agendaLoaded = true;
}

async function loadLabelRows(){
  const agenda = norm(document.getElementById('label-agenda')?.value);
  const mess = norm(document.getElementById('label-mess')?.value);
  if(!agenda){
    lastRows = [];
    renderLabels([]);
    return;
  }
  const r = await api('label.list', { agenda, mess_name: mess });
  if(!r.ok){
    showNotif('Gagal mengambil data label: '+(r.error||''), false);
    return;
  }
  lastRows = r.rows || [];
  renderLabels(lastRows, r.summary || null);
}

function roomSort(a,b){
  return String(a.room||'').localeCompare(String(b.room||''), 'id', {numeric:true, sensitivity:'base'});
}

function getNameFontSize(guests){
  const maxLen = Math.max(0, ...guests.map(g => norm(g.name).length));
  if(maxLen >= 42) return '10.5pt';
  if(maxLen >= 34) return '11.2pt';
  if(maxLen >= 28) return '12pt';
  return '12.8pt';
}

function renderLabels(rows, summary=null){
  const host = document.getElementById('label-print-area');
  const info = document.getElementById('label-summary');
  const size = document.getElementById('label-size')?.value || 'normal';
  if(!host) return;

  if(!rows.length){
    host.innerHTML = '<div class="card"><div class="card-body text-center text-muted">Pilih agenda, lalu klik Tampilkan untuk membuat label.</div></div>';
    if(info){ info.classList.add('d-none'); info.textContent=''; }
    return;
  }

  const sorted = [...rows].sort(roomSort);
  const totalGuests = sorted.reduce((sum,r)=>sum+(r.guests?.length||0),0);
  if(info){
    info.classList.remove('d-none');
    info.textContent = `Siap cetak: ${sorted.length} label kamar, ${totalGuests} peserta.`;
  }

  host.className = `label-print-area mt-3 label-size-${size}`;
  host.innerHTML = sorted.map(group=>{
    const guests = group.guests || [];
    const nameFont = getNameFontSize(guests);
    const guestRows = guests.map((g,i)=>`
      <div class="label-guest-row" style="--name-font:${nameFont}">
        <span class="label-guest-no">${i+1}.</span>
        <span class="label-guest-name" title="${esc(g.name)}">${esc(g.name)}</span>
        <span class="label-guest-unit">${esc(g.unit || '')}</span>
      </div>`).join('');
    return `
      <section class="guest-label-card">
        <div class="guest-label-head">
          <div>
            <div class="guest-label-caption">Nomor Kamar</div>
            <div class="guest-label-room">${esc(group.room || '-')}</div>
          </div>
          <div class="guest-label-mess">${esc(group.mess || '')}</div>
        </div>
        <div class="guest-label-meta">
          <div class="guest-label-agenda"><b>Agenda:</b> ${esc(group.agenda || '-')}</div>
          <div><b>Tanggal Rencana:</b> ${esc(fmtDateStr(group.checkin_plan))} ➜ ${esc(fmtDateStr(group.checkout_plan))}</div>
          <div><b>Lama Menginap:</b> ${esc(group.lama_menginap || '-')}</div>
        </div>
        <div class="guest-label-list">
          ${guestRows || '<div class="text-muted">Belum ada peserta.</div>'}
        </div>
      </section>`;
  }).join('');
}
