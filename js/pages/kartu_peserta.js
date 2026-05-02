import { api, state } from '../api.js';
import { showNotif } from '../util.js';
import { APP_CONFIG } from '../config.js';

let agendaLoaded = false;
let lastRows = [];
const LOGO_KEY = 'mess_sntz_participant_card_logo_v1';

function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function norm(v){ return String(v || '').trim(); }
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
function $(id){ return document.getElementById(id); }

function appBaseUrl(){
  const fixed = String(APP_CONFIG.PUBLIC_APP_URL || '').trim();
  if(fixed) return fixed.replace(/\/+$/, '') + '/';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

function qrLink(token){
  const url = new URL(appBaseUrl());
  url.searchParams.set('qr', token || '');
  return url.toString();
}

function defaultTitleFromAgenda(){
  const sel = $('card-agenda');
  const agenda = norm(sel?.value);
  if(agenda && !$('card-title')?.value) $('card-title').value = agenda;
}

function readLogo(){
  try{ return localStorage.getItem(LOGO_KEY) || ''; }catch(_){ return ''; }
}

function saveLogoFromInput(){
  const input = $('card-logo-file');
  const file = input?.files?.[0];
  if(!file){ showNotif('Pilih file logo terlebih dahulu.', false); return; }
  if(!/^image\//i.test(file.type || '')){ showNotif('File logo harus berupa gambar.', false); return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      localStorage.setItem(LOGO_KEY, String(reader.result || ''));
      showNotif('Logo berhasil disimpan lokal di browser ini.');
      renderCards(lastRows);
    }catch(e){
      showNotif('Gagal menyimpan logo lokal. Ukuran file mungkin terlalu besar.', false);
    }
  };
  reader.readAsDataURL(file);
}

function getCardOptions(){
  return {
    title: norm($('card-title')?.value) || 'PRE KLP1 AGRO 16/2024',
    location: norm($('card-location')?.value) || 'SERIANG TRAINING CENTER',
    dateText: norm($('card-date-text')?.value),
    orientation: $('card-orientation')?.value || 'landscape',
    qrPosition: $('card-qr-position')?.value || 'left',
    logoSize: Number($('card-logo-size')?.value || 14),
    qrSize: Number($('card-qr-size')?.value || 30),
    nameSize: Number($('card-name-size')?.value || 12),
    titleSize: Number($('card-title-size')?.value || 5.4),
    nameTop: Number($('card-name-top')?.value || 0),
    cutStyle: $('card-cut-style')?.value || 'guide',
    logo: readLogo()
  };
}

function syncRangeLabels(){
  const map = [
    ['card-logo-size', 'card-logo-size-val'],
    ['card-qr-size', 'card-qr-size-val'],
    ['card-name-size', 'card-name-size-val'],
    ['card-title-size', 'card-title-size-val'],
    ['card-name-top', 'card-name-top-val'],
  ];
  map.forEach(([inp, out])=>{ const a=$(inp), b=$(out); if(a && b) b.textContent = a.value; });
}

export function initKartuPeserta(){
  $('btn-card-refresh')?.addEventListener('click', async()=>{ agendaLoaded=false; await loadCardAgendas(true); });
  $('btn-card-show')?.addEventListener('click', loadCardRows);
  $('btn-card-save-logo')?.addEventListener('click', saveLogoFromInput);
  $('btn-card-print')?.addEventListener('click', ()=>{
    if(!lastRows.length){ showNotif('Tampilkan kartu peserta terlebih dahulu.', false); return; }
    document.body.classList.add('printing-card');
    window.print();
    setTimeout(()=>document.body.classList.remove('printing-card'), 700);
  });
  $('card-agenda')?.addEventListener('change', ()=>{ defaultTitleFromAgenda(); loadCardRows(); });
  $('card-mess')?.addEventListener('change', loadCardRows);
  ['card-title','card-location','card-date-text','card-orientation','card-qr-position','card-cut-style'].forEach(id=>{
    $(id)?.addEventListener('input', ()=>renderCards(lastRows));
    $(id)?.addEventListener('change', ()=>renderCards(lastRows));
  });
  ['card-logo-size','card-qr-size','card-name-size','card-title-size','card-name-top'].forEach(id=>{
    $(id)?.addEventListener('input', ()=>{ syncRangeLabels(); renderCards(lastRows); });
  });
  syncRangeLabels();
}

export async function loadCardAgendas(force=false){
  if(agendaLoaded && !force) return;
  const selAgenda = $('card-agenda');
  const selMess = $('card-mess');
  if(!selAgenda || !selMess) return;

  selAgenda.innerHTML = '<option value="">Memuat agenda...</option>';
  selMess.innerHTML = '<option value="">Semua Mess</option>';

  const r = await api('qr.agendas', {});
  if(!r.ok){
    selAgenda.innerHTML = '<option value="">Gagal memuat agenda</option>';
    showNotif('Gagal memuat agenda kartu: '+(r.error||''), false);
    return;
  }

  const agendas = r.agendas || [];
  if(!agendas.length){
    selAgenda.innerHTML = '<option value="">Belum ada agenda yang sudah disetujui</option>';
  }else{
    selAgenda.innerHTML = '<option value="">- pilih agenda -</option>' + agendas.map(a=>{
      const label = `${a.agenda} | ${a.period || '-'} | ${a.count || 0} peserta`;
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

async function loadCardRows(){
  const agenda = norm($('card-agenda')?.value);
  const mess = norm($('card-mess')?.value);
  if(!agenda){ lastRows = []; renderCards([]); return; }
  defaultTitleFromAgenda();
  const r = await api('qr.list', { agenda, mess_name: mess, app_url: appBaseUrl() });
  if(!r.ok){ showNotif('Gagal mengambil data peserta: '+(r.error||''), false); return; }
  lastRows = r.rows || [];
  renderCards(lastRows, r.summary || null);
}

function roomSort(a,b){
  const m = String(a.mess||'').localeCompare(String(b.mess||''), 'id', {numeric:true, sensitivity:'base'});
  if(m) return m;
  const r = String(a.room||'').localeCompare(String(b.room||''), 'id', {numeric:true, sensitivity:'base'});
  if(r) return r;
  return String(a.name||'').localeCompare(String(b.name||''), 'id', {numeric:true, sensitivity:'base'});
}

function splitName(name){
  const words = norm(name).split(/\s+/).filter(Boolean);
  if(words.length <= 2) return esc(name);
  const mid = Math.ceil(words.length / 2);
  return `${esc(words.slice(0, mid).join(' '))}<br>${esc(words.slice(mid).join(' '))}`;
}

function chunkArray(arr, size){
  const out = [];
  for(let i=0; i<arr.length; i+=size) out.push(arr.slice(i, i+size));
  return out;
}

function renderCards(rows, summary=null){
  const host = $('card-print-area');
  const info = $('card-summary');
  if(!host) return;
  syncRangeLabels();
  const opt = getCardOptions();
  if(!rows.length){
    host.className = 'participant-card-sheet mt-3';
    host.innerHTML = '<div class="card"><div class="card-body text-center text-muted">Pilih agenda, lalu klik Tampilkan untuk membuat kartu peserta.</div></div>';
    if(info){ info.classList.add('d-none'); info.textContent = ''; }
    return;
  }
  const sorted = [...rows].sort(roomSort);
  if(info){
    info.classList.remove('d-none');
    const perPage = opt.orientation === 'portrait' ? 9 : 8;
    const pageCount = Math.ceil(sorted.length / perPage);
    info.textContent = `Siap cetak: ${sorted.length} kartu peserta. Ukuran kartu ${opt.orientation === 'portrait' ? '58 x 92 mm' : '92 x 58 mm'} pada kertas A4. Layout aman potong: ${perPage} kartu/lembar, total ${pageCount} lembar A4.`;
  }

  host.className = `participant-card-sheet mt-3 card-${opt.orientation} cut-${opt.cutStyle}`;
  host.style.setProperty('--card-logo-size', opt.logoSize + 'mm');
  host.style.setProperty('--card-qr-size', opt.qrSize + 'mm');
  host.style.setProperty('--card-name-size', opt.nameSize + 'mm');
  host.style.setProperty('--card-title-size', opt.titleSize + 'mm');
  host.style.setProperty('--card-name-top', opt.nameTop + 'mm');

  const perPage = opt.orientation === 'portrait' ? 9 : 8;
  const pages = chunkArray(sorted, perPage);

  host.innerHTML = pages.map((pageRows, pageIdx)=>{
    const cards = pageRows.map((g, rowIdx)=>{
      const idx = (pageIdx * perPage) + rowIdx;
      const link = g.qr_url || qrLink(g.qr_token || '');
      const uid = `participant-card-qr-${idx}`;
      const logo = opt.logo ? `<img class="participant-logo" src="${esc(opt.logo)}" alt="Logo" />` : '<div class="participant-logo-placeholder">LOGO</div>';
      const qr = `<div class="participant-card-qr" id="${uid}" data-qr="${esc(link)}"></div>`;
      const sideA = opt.qrPosition === 'left' ? qr : '';
      const sideB = opt.qrPosition === 'right' ? qr : '';
      const dateLine = opt.dateText ? `<div class="participant-date">${esc(opt.dateText)}</div>` : '';
      return `<section class="participant-card qr-${opt.qrPosition}">
        <div class="participant-header">
          ${logo}
          <div class="participant-training">
            <div class="participant-title">${esc(opt.title)}</div>
            <div class="participant-location">${esc(opt.location)}</div>
            ${dateLine}
          </div>
        </div>
        <div class="participant-body">
          ${sideA}
          <div class="participant-name-wrap">
            <div class="participant-name">${splitName(g.name || '-')}</div>
            <div class="participant-meta">${esc(g.mess || '-')} &bull; ${esc(g.room || '-')}</div>
          </div>
          ${sideB}
        </div>
      </section>`;
    }).join('');
    return `<div class="participant-card-page" data-page="${pageIdx + 1}">${cards}</div>`;
  }).join('');
  renderQrImages(host, opt.qrSize);
}

function renderQrImages(host, mmSize){
  const px = Math.max(80, Math.round(Number(mmSize || 30) * 3.78));
  host.querySelectorAll('.participant-card-qr').forEach(box=>{
    const text = box.getAttribute('data-qr') || '';
    box.innerHTML = '';
    if(window.QRCode){
      new window.QRCode(box, { text, width: px, height: px, correctLevel: window.QRCode.CorrectLevel.M });
    }else{
      box.innerHTML = '<div class="small text-danger text-center">Library QR belum termuat</div>';
    }
  });
}
