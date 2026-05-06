import { showNotif, monthName, fmtTimeWib, fmtDateTimeWib } from '../util.js';
import { api } from '../api.js';

let journalCache = [];
let journalType = 'stay';

// helper: YYYY-MM-DD -> dd/MM/yyyy (tanpa timezone)
function ymdToDmy(s){
  if(!s) return '';
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return s;
  const [_, y, mm, d] = m;
  return `${d}/${mm}/${y}`;
}

export function initJurnal(){
  document.getElementById('btn-jr-show').addEventListener('click', showJurnal);
  document.getElementById('btn-jr-xlsx').addEventListener('click', exportXLSX);
  document.getElementById('btn-jr-pdf').addEventListener('click', exportPDF);
  document.getElementById('jr-type')?.addEventListener('change', showJurnal);
}

async function showJurnal(){
  const fromYmd = document.getElementById('jr-from').value; // YYYY-MM-DD
  const toYmd   = document.getElementById('jr-to').value;   // YYYY-MM-DD
  if(!fromYmd || !toYmd){ showNotif('Isi periode', false); return; }

  journalType = document.getElementById('jr-type')?.value || 'stay';
  const from = ymdToDmy(fromYmd);
  const to   = ymdToDmy(toYmd);

  const action = journalType === 'noshow' ? 'journal.noshow.list' : 'journal.list';
  const res = await api(action, {date_from: from, date_to: to});
  if(!res || res.ok === false){
    showNotif(res?.error || 'Gagal memuat jurnal', false);
    journalCache = [];
    renderJournal([]);
    return;
  }

  journalCache = res.rows || [];
  renderJournal(journalCache);
}

function renderJournal(data = []){
  const host = document.getElementById('jr-table');

  const emptyAlert = (!data || data.length===0)
    ? `<div class="alert alert-info py-2 mb-2">Tidak ada data pada periode ini.</div>`
    : '';

  if(journalType === 'noshow'){
    const rows = (data||[]).map((r,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${r.name||''}</td>
        <td>${r.unit||''}</td>
        <td>${r.title||''}</td>
        <td>${r.agenda||''}</td>
        <td>${r.mess||''}</td>
        <td>${r.room||''}</td>
        <td>${r.noshow_date||''}</td>
        <td>${fmtTimeWib(r.noshow_time)||''}</td>
        <td>${r.reason||''}</td>
        <td>${r.marked_by||''}</td>
      </tr>
    `).join('');

    host.innerHTML = `
      ${emptyAlert}
      <div class="alert alert-warning py-2 mb-2"><strong>Jurnal No Show</strong> berisi tamu yang sudah dialokasikan kamar tetapi tidak datang/batal menginap.</div>
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead>
            <tr>
              <th>No.</th><th>Nama</th><th>Unit</th><th>Jabatan</th><th>Agenda</th>
              <th>Mess</th><th>No Kamar</th><th>Tgl No Show</th><th>Jam No Show</th><th>Keterangan</th><th>Ditandai Oleh</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    return;
  }

  const rows = (data||[]).map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${r.name||''}</td>
      <td>${r.unit||''}</td>
      <td>${r.title||''}</td>
      <td>${r.agenda||''}</td>
      <td>${r.mess||''}</td>
      <td>${r.room||''}</td>
      <td>${r.tgl_masuk||''}</td>
      <td>${fmtTimeWib(r.jam_masuk)||''}</td>
      <td>${r.tgl_keluar||''}</td>
      <td>${fmtTimeWib(r.jam_keluar)||''}</td>
    </tr>
  `).join('');

  host.innerHTML = `
    ${emptyAlert}
    <div class="table-responsive">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th>No.</th><th>Nama</th><th>Unit</th><th>Jabatan</th><th>Agenda</th>
            <th>Mess</th><th>No Kamar</th><th>Tgl Masuk</th><th>Jam Masuk</th><th>Tgl Keluar</th><th>Jam Keluar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function exportXLSX(){
  if(journalType === 'noshow'){
    const head = [['No.','Nama','Unit','Jabatan','Agenda','Mess','No Kamar','Tgl No Show','Jam No Show','Keterangan','Ditandai Oleh']];
    const body = journalCache.map((r,i)=>[
      i+1,r.name||'',r.unit||'',r.title||'',r.agenda||'',r.mess||'',r.room||'',
      r.noshow_date||'',fmtTimeWib(r.noshow_time)||'',r.reason||'',r.marked_by||''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...head, ...body]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Jurnal No Show');
    XLSX.writeFile(wb, 'Jurnal_No_Show.xlsx');
    return;
  }

  const head = [['No.','Nama','Unit','Jabatan','Agenda','Mess','No Kamar','Tgl Masuk','Jam Masuk','Tgl Keluar','Jam Keluar']];
  const body = journalCache.map((r,i)=>[
    i+1,r.name||'',r.unit||'',r.title||'',r.agenda||'',r.mess||'',r.room||'',
    r.tgl_masuk||'',fmtTimeWib(r.jam_masuk)||'',r.tgl_keluar||'',fmtTimeWib(r.jam_keluar)||''
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...head, ...body]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
  XLSX.writeFile(wb, 'Jurnal_Tamu.xlsx');
}

function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});

  const fromYmd = document.getElementById('jr-from').value;
  const toYmd   = document.getElementById('jr-to').value;
  const [fy,fm,fd] = fromYmd.split('-');
  const [ty,tm,td] = toYmd.split('-');
  const titlePrefix = journalType === 'noshow' ? 'JURNAL NO SHOW' : 'JURNAL TAMU';
  const title = `${titlePrefix} PERIODE ${fd}/${fm}/${fy} - ${td}/${tm}/${ty}`;

  doc.text(title, 14, 12);

  const head = journalType === 'noshow'
    ? [['No.','Nama','Unit','Jabatan','Agenda','Mess','No Kamar','Tgl No Show','Jam No Show','Keterangan','Ditandai Oleh']]
    : [['No.','Nama','Unit','Jabatan','Agenda','Mess','No Kamar','Tgl Masuk','Jam Masuk','Tgl Keluar','Jam Keluar']];

  const body = journalType === 'noshow'
    ? journalCache.map((r,i)=>[
        i+1,r.name||'',r.unit||'',r.title||'',r.agenda||'',r.mess||'',r.room||'',
        r.noshow_date||'',fmtTimeWib(r.noshow_time)||'',r.reason||'',r.marked_by||''
      ])
    : journalCache.map((r,i)=>[
        i+1,r.name||'',r.unit||'',r.title||'',r.agenda||'',r.mess||'',r.room||'',
        r.tgl_masuk||'',fmtTimeWib(r.jam_masuk)||'',r.tgl_keluar||'',fmtTimeWib(r.jam_keluar)||''
      ]);

  doc.autoTable({
    head, body, startY: 16, styles: { fontSize:8 }, headStyles: { fillColor: [200,200,200] },
    didDrawPage: (data)=>{
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Halaman ${doc.internal.getCurrentPageInfo().pageNumber} dari ${pageCount}`, doc.internal.pageSize.width-40, 8);
      if(data.pageNumber===pageCount){
        const stamp = fmtDateTimeWib();
        const [tgl, jam] = stamp.split(' ');
        const [d, m, y] = tgl.split('/');
        doc.text(`${titlePrefix} dicetak tanggal ${d} ${monthName(m)} ${y} - ${jam} WIB`, 14, doc.internal.pageSize.height-6);
      }
    }
  });
  doc.save(journalType === 'noshow' ? 'Jurnal_No_Show.pdf' : 'Jurnal_Tamu.pdf');
}
