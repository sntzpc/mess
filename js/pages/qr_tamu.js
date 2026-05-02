import { api, state } from '../api.js';
import { showNotif, go } from '../util.js';
import { fmtDateStr } from '../core/date.js';
import { APP_CONFIG } from '../config.js';

let agendaLoaded = false;
let lastRows = [];
let publicBusy = false;

function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function norm(v){ return String(v || '').trim(); }
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }

function getQrParam(){
  try{
    if(window.__MESS_QR_TOKEN__) return String(window.__MESS_QR_TOKEN__ || '').trim();
    const url = new URL(window.location.href);
    const q = url.searchParams.get('qr') || url.searchParams.get('guest_qr') || url.searchParams.get('qr_token');
    if(q) return q;

    // Mendukung beberapa bentuk URL hasil scan QR:
    // 1) https://sntzpc.github.io/mess/?qr=TOKEN
    // 2) https://sntzpc.github.io/mess?qr=TOKEN
    // 3) https://sntzpc.github.io/mess#qr=TOKEN
    // 4) https://sntzpc.github.io/mess#/qr/TOKEN atau #/?qr=TOKEN
    const hash = String(url.hash || '');
    const m1 = hash.match(/[?#&](?:qr|guest_qr|qr_token)=([^&]+)/i) || hash.match(/(?:^#|[\/?#&])(?:qr|guest_qr|qr_token)=([^&]+)/i);
    if(m1) return decodeURIComponent(m1[1]);
    const m2 = hash.match(/\/qr\/([^/?#&]+)/i);
    if(m2) return decodeURIComponent(m2[1]);

    const href = String(window.location.href || '');
    const m3 = href.match(/[?&#](?:qr|guest_qr|qr_token)=([^&]+)/i);
    return m3 ? decodeURIComponent(m3[1]) : '';
  }catch(_){ return ''; }
}

function activateQrPublicMode(){
  document.documentElement.classList.add('qr-public-boot');
  document.body.classList.add('qr-public-mode');

  // Pastikan portal login/menu benar-benar tidak terlihat untuk tamu QR.
  document.querySelector('.navbar')?.setAttribute('style','display:none!important');
  document.querySelectorAll('.page').forEach(p=>{ p.style.display = 'none'; });
  const publicPage = document.getElementById('page-qr-public');
  if(publicPage) publicPage.style.display = 'block';

  // Bersihkan title supaya jelas ini halaman mandiri.
  try{ document.title = 'QR Check-in / Check-out - Mess SNTZ'; }catch(_){}
}

function appBaseUrl(){
  // QR harus selalu mengarah ke alamat produksi GitHub Pages agar dapat discan tamu dari HP.
  // Fallback tetap memakai lokasi saat ini jika PUBLIC_APP_URL belum diisi.
  const fixed = String(APP_CONFIG.PUBLIC_APP_URL || '').trim();
  if(fixed) return fixed.replace(/\/+$/, '') + '/';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

function qrLink(token){
  const url = new URL(appBaseUrl());
  url.searchParams.set('qr', token);
  return url.toString();
}

export function initQrTamu(){
  const btnRefresh = document.getElementById('btn-qr-refresh');
  const btnShow = document.getElementById('btn-qr-show');
  const btnPrint = document.getElementById('btn-qr-print');
  const selAgenda = document.getElementById('qr-agenda');
  const selMess = document.getElementById('qr-mess');
  const selSize = document.getElementById('qr-size');

  btnRefresh?.addEventListener('click', async()=>{ agendaLoaded=false; await loadQrAgendas(true); });
  btnShow?.addEventListener('click', loadQrRows);
  btnPrint?.addEventListener('click', ()=>{
    if(!lastRows.length){ showNotif('Tampilkan QR terlebih dahulu', false); return; }
    document.body.classList.add('printing-qr');
    window.print();
    setTimeout(()=>document.body.classList.remove('printing-qr'), 700);
  });
  selAgenda?.addEventListener('change', loadQrRows);
  selMess?.addEventListener('change', loadQrRows);
  selSize?.addEventListener('change', ()=>renderQrCards(lastRows));
}

export function initQrPublicFromUrl(){
  const token = getQrParam();
  if(!token) return false;

  // Mode publik QR harus dijalankan sebelum login/router/auth.
  activateQrPublicMode();
  loadQrPublic(token);
  return true;
}

export async function loadQrAgendas(force=false){
  if(agendaLoaded && !force) return;
  const selAgenda = document.getElementById('qr-agenda');
  const selMess = document.getElementById('qr-mess');
  if(!selAgenda || !selMess) return;

  selAgenda.innerHTML = '<option value="">Memuat agenda...</option>';
  selMess.innerHTML = '<option value="">Semua Mess</option>';

  const r = await api('qr.agendas', {});
  if(!r.ok){
    selAgenda.innerHTML = '<option value="">Gagal memuat agenda</option>';
    showNotif('Gagal memuat agenda QR: '+(r.error||''), false);
    return;
  }

  const agendas = r.agendas || [];
  if(!agendas.length){
    selAgenda.innerHTML = '<option value="">Belum ada agenda yang sudah disetujui</option>';
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

async function loadQrRows(){
  const agenda = norm(document.getElementById('qr-agenda')?.value);
  const mess = norm(document.getElementById('qr-mess')?.value);
  if(!agenda){
    lastRows = [];
    renderQrCards([]);
    return;
  }
  const r = await api('qr.list', { agenda, mess_name: mess, app_url: appBaseUrl() });
  if(!r.ok){
    showNotif('Gagal mengambil data QR: '+(r.error||''), false);
    return;
  }
  lastRows = r.rows || [];
  renderQrCards(lastRows, r.summary || null);
}

function roomSort(a,b){
  const m = String(a.mess||'').localeCompare(String(b.mess||''), 'id', {numeric:true, sensitivity:'base'});
  if(m) return m;
  const r = String(a.room||'').localeCompare(String(b.room||''), 'id', {numeric:true, sensitivity:'base'});
  if(r) return r;
  return String(a.name||'').localeCompare(String(b.name||''), 'id', {numeric:true, sensitivity:'base'});
}

function getNameClass(name){
  const len = norm(name).length;
  if(len >= 42) return 'qr-name-xs';
  if(len >= 34) return 'qr-name-sm';
  return '';
}

function renderQrCards(rows, summary=null){
  const host = document.getElementById('qr-print-area');
  const info = document.getElementById('qr-summary');
  const size = document.getElementById('qr-size')?.value || 'normal';
  if(!host) return;

  if(!rows.length){
    host.innerHTML = '<div class="card"><div class="card-body text-center text-muted">Pilih agenda, lalu klik Tampilkan untuk membuat QR Code.</div></div>';
    if(info){ info.classList.add('d-none'); info.textContent=''; }
    return;
  }

  const sorted = [...rows].sort(roomSort);
  if(info){
    info.classList.remove('d-none');
    info.textContent = `Siap cetak: ${sorted.length} QR tamu. Setelah discan, tamu dapat check-in/check-out tanpa login.`;
  }

  host.className = `qr-print-area mt-3 qr-size-${size}`;
  host.innerHTML = sorted.map((g, idx)=>{
    const link = g.qr_url || qrLink(g.qr_token || '');
    const uid = `qr-box-${idx}`;
    return `
      <section class="qr-guest-card">
        <div class="qr-guest-main">
          <div class="qr-guest-data">
            <div class="qr-card-caption">QR Check-in / Check-out</div>
            <div class="qr-card-name ${getNameClass(g.name)}" title="${esc(g.name)}">${esc(g.name || '-')}</div>
            <div class="qr-card-line"><b>Agenda:</b> ${esc(g.agenda || '-')}</div>
            <div class="qr-card-line"><b>Tanggal Rencana:</b> ${esc(fmtDateStr(g.checkin_plan))} ➜ ${esc(fmtDateStr(g.checkout_plan))}</div>
            <div class="qr-card-line"><b>Lama Menginap:</b> ${esc(g.lama_menginap || '-')}</div>
            <div class="qr-card-room"><span>${esc(g.mess || '-')}</span><b>Kamar ${esc(g.room || '-')}</b></div>
          </div>
          <div class="qr-code-box" id="${uid}" data-qr="${esc(link)}"></div>
        </div>
        <div class="qr-card-foot">Scan QR ini untuk check-in atau check-out mandiri. Seriang Training Center.</div>
      </section>`;
  }).join('');
  renderQrImages(host);
}

function renderQrImages(host){
  const boxes = host.querySelectorAll('.qr-code-box');
  boxes.forEach(box=>{
    const text = box.getAttribute('data-qr') || '';
    box.innerHTML = '';
    if(window.QRCode){
      new window.QRCode(box, { text, width: 128, height: 128, correctLevel: window.QRCode.CorrectLevel.M });
    }else{
      box.innerHTML = '<div class="small text-danger text-center">Library QR belum termuat</div>';
    }
  });
}

async function loadQrPublic(token){
  const host = document.getElementById('qr-public-content');
  if(!host) return;
  host.innerHTML = '<div class="text-center text-muted py-4"><div class="spinner-border text-primary mb-3"></div><br>Memuat data tamu...</div>';
  const r = await api('qr.lookup', { qr_token: token });
  if(!r.ok){
    host.innerHTML = `<div class="alert alert-danger">QR tidak valid atau data tamu tidak ditemukan.<br><small>${esc(r.error || '')}</small></div>`;
    return;
  }
  renderQrPublic(r.guest, token);
}

function statusText(status){
  const s = norm(status).toLowerCase();
  if(s === 'approved') return 'Belum Check-in';
  if(s === 'checkedin') return 'Sedang Menginap';
  if(s === 'checkedout') return 'Sudah Check-out';
  return status || '-';
}

function renderQrPublic(g, token){
  const host = document.getElementById('qr-public-content');
  if(!host) return;
  const status = norm(g.status).toLowerCase();
  const checkedOutMsg = status === 'checkedout'
    ? `<div class="alert alert-success mt-3">
        <div class="fw-bold mb-1"><i class="bi bi-check-circle"></i> Tamu sudah Check-out</div>
        <div>Check-out pada: <b>${esc(g.checkout_date || '-')} ${esc(g.checkout_time || '')}</b></div>
        <hr>
        <div>Terima kasih telah menjaga fasilitas <b>Seriang Training Center</b> dengan baik.</div>
      </div>` : '';
  const actionBtn = status === 'approved'
    ? `<button id="btn-public-checkin" class="btn btn-success btn-lg w-100"><i class="bi bi-box-arrow-in-right"></i> Check-in Sekarang</button>`
    : status === 'checkedin'
      ? `<button id="btn-public-checkout" class="btn btn-primary btn-lg w-100"><i class="bi bi-box-arrow-right"></i> Check-out Sekarang</button>`
      : '';

  host.innerHTML = `
    <div class="qr-public-detail">
      <div class="qr-public-status ${esc(status)}">${esc(statusText(g.status))}</div>
      <div class="qr-public-name">${esc(g.name || '-')}</div>
      <div class="qr-public-sub">${esc(g.unit || '')} ${g.title ? ' | '+esc(g.title) : ''}</div>
      <div class="qr-public-info mt-3">
        <div><span>Agenda</span><b>${esc(g.agenda || '-')}</b></div>
        <div><span>Tanggal Rencana</span><b>${esc(fmtDateStr(g.checkin_plan))} ➜ ${esc(fmtDateStr(g.checkout_plan))}</b></div>
        <div><span>Lama Menginap</span><b>${esc(g.lama_menginap || '-')}</b></div>
        <div><span>Alokasi Kamar</span><b>${esc(g.mess || '-')} / Kamar ${esc(g.room || '-')}</b></div>
      </div>
      ${g.checkin_date ? `<div class="small text-muted mt-2">Check-in: ${esc(g.checkin_date)} ${esc(g.checkin_time || '')}</div>` : ''}
      ${checkedOutMsg}
      ${actionBtn ? `<div class="mt-4">${actionBtn}</div>` : ''}
      ${status !== 'approved' && status !== 'checkedin' && status !== 'checkedout' ? `<div class="alert alert-warning mt-3">Status tamu belum dapat diproses melalui QR ini.</div>` : ''}
    </div>`;

  document.getElementById('btn-public-checkin')?.addEventListener('click', ()=>submitQrAction(token, 'checkin'));
  document.getElementById('btn-public-checkout')?.addEventListener('click', ()=>submitQrAction(token, 'checkout'));
}

async function submitQrAction(token, mode){
  if(publicBusy) return;
  const label = mode === 'checkin' ? 'Check-in' : 'Check-out';
  if(!confirm(`${label} sekarang?`)) return;
  publicBusy = true;
  try{
    const r = await api('qr.action', { qr_token: token, mode });
    if(!r.ok){
      showNotif(`${label} gagal: ${r.error || ''}`, false);
      await loadQrPublic(token);
      return;
    }
    showNotif(`${label} berhasil`);
    renderQrPublic(r.guest, token);
  }finally{
    publicBusy = false;
  }
}
