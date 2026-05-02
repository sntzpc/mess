const WIB_TZ = 'Asia/Jakarta';

function wibParts(date = new Date()){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((a,p)=>{ a[p.type]=p.value; return a; }, {});
  return parts;
}

export function todayStr(){
  const p = wibParts();
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Format tanggal aman WIB.
 * - Input <input type="date">: YYYY-MM-DD -> DD/MM/YYYY tanpa konversi timezone.
 * - Input dari GAS/Sheets Date yang menjadi ISO: 2026-05-02T17:00:00.000Z -> 03/05/2026 (WIB).
 * - Input DD/MM/YYYY -> dinormalisasi saja.
 */
export function fmtDateStr(d){
  if(!d) return '';
  if(d instanceof Date && !isNaN(d.getTime())){
    const p = wibParts(d);
    return `${p.day}/${p.month}/${p.year}`;
  }
  const s = String(d).trim();
  if(!s) return '';

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\b|$)/);
  if(dmy) return `${dmy[1].padStart(2,'0')}/${dmy[2].padStart(2,'0')}/${dmy[3]}`;

  // Plain date dari input HTML: jangan diparse sebagai UTC/lokal agar tidak geser hari.
  const plainYmd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(plainYmd) return `${plainYmd[3]}/${plainYmd[2]}/${plainYmd[1]}`;

  // ISO datetime dari Apps Script/Google Sheets: parse sebagai instant, lalu tampilkan dalam WIB.
  const isoDt = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s].*/);
  if(isoDt){
    const dt = new Date(s);
    if(!isNaN(dt.getTime())){
      const p = wibParts(dt);
      return `${p.day}/${p.month}/${p.year}`;
    }
    return `${isoDt[3]}/${isoDt[2]}/${isoDt[1]}`;
  }

  const dt = new Date(s);
  if(!isNaN(dt.getTime())){
    const p = wibParts(dt);
    return `${p.day}/${p.month}/${p.year}`;
  }
  return s;
}

export function fmtTimeWib(v){
  if(v === null || v === undefined || v === '') return '';
  if(v instanceof Date && !isNaN(v.getTime())){
    const p = wibParts(v);
    return `${p.hour}:${p.minute}:${p.second}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if(m) return `${m[1].padStart(2,'0')}:${m[2].padStart(2,'0')}:${(m[3]||'00').padStart(2,'0')}`;
  const dt = new Date(s);
  if(!isNaN(dt.getTime())){
    const p = wibParts(dt);
    return `${p.hour}:${p.minute}:${p.second}`;
  }
  return s;
}

export function fmtDateTimeWib(v = new Date()){
  const dt = (v instanceof Date) ? v : new Date(v);
  if(isNaN(dt.getTime())) return String(v || '');
  const p = wibParts(dt);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export function monthName(m){
  return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][+m-1] || '';
}
