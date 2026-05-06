/*************** JOURNAL & STATS ***************/
function journalList_(user, body) {
  // Helper lokal
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function toDmyString_(v) {
    if (!v) return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (isNaN(v.getTime())) return '';
      return pad2(v.getDate()) + '/' + pad2(v.getMonth() + 1) + '/' + v.getFullYear();
    }
    const s = String(v).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s; // sudah dd/MM/yyyy
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
    }
    return '';
  }
  function isValidDmy_(s) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(s);
  }
  function lt_(d1, d2) { // d1<d2
    const [a,b,c] = d1.split('/').map(Number);
    const [d,e,f] = d2.split('/').map(Number);
    return new Date(c, b-1, a) < new Date(f, e-1, d);
  }
  function gt_(d1, d2) { // d1>d2
    const [a,b,c] = d1.split('/').map(Number);
    const [d,e,f] = d2.split('/').map(Number);
    return new Date(c, b-1, a) > new Date(f, e-1, d);
  }
  function toHmString_(v) {
    if (v === null || v === undefined || v === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (isNaN(v.getTime())) return '';
      return Utilities.formatDate(v, WIB_TZ, TIME_FMT);
    }
    const s = String(v).trim();
    if (!s) return '';
    if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, WIB_TZ, TIME_FMT);
    }
    const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
      return pad2(Number(m[1])) + ':' + pad2(Number(m[2])) + ':' + pad2(Number(m[3] || 0));
    }
    return '';
  }

  // Ambil & normalisasi parameter
  let { date_from, date_to } = body;
  date_from = toDmyString_(date_from);
  date_to   = toDmyString_(date_to);

  if (date_from && date_to && gt_(date_from, date_to)) {
    var tmp = date_from; date_from = date_to; date_to = tmp;
  }

  const svals = sheet('Stays').getDataRange().getValues().slice(1);
  const rows = [];

  for (var i=0; i<svals.length; i++) {
    const [id, guest_id, mess, room, dInRaw, tInRaw, dOutRaw, tOutRaw] = svals[i];
    const dIn  = toDmyString_(dInRaw);
    const dOut = toDmyString_(dOutRaw);
    if (!dIn || !isValidDmy_(dIn)) continue;
    if (date_from && lt_(dIn, date_from)) continue;
    if (date_to && gt_(dIn, date_to)) continue;

    if (user.role === 'mess' && user.mess && String(mess||'').trim() !== String(user.mess||'').trim()) {
      continue;
    }

    const tIn  = toHmString_(tInRaw);
    const tOut = toHmString_(tOutRaw);

    const g = findGuest_(guest_id);
    if (!g) continue;

    rows.push({
      name: g.name,
      unit: g.unit,
      title: g.title,
      agenda: g.agenda,
      mess,
      room,
      tgl_masuk: dIn,
      jam_masuk: tIn || '',
      tgl_keluar: dOut || '',
      jam_keluar: tOut || ''
    });
  }

  return json_({ ok: true, rows });
}

function lt_(d1, d2){ // true jika d1 < d2
  const A = dmyToDate_(d1);
  const B = dmyToDate_(d2);
  return A < B;
}
function gt_(d1, d2){ // true jika d1 > d2
  const A = dmyToDate_(d1);
  const B = dmyToDate_(d2);
  return A > B;
}
function toHmString_(v){
  // kosong?
  if (v === null || v === undefined || v === '') return '';

  // Jika Date object
  if (Object.prototype.toString.call(v) === '[object Date]'){
    if (isNaN(v.getTime())) return '';
    // paksa WIB agar konsisten
    return Utilities.formatDate(v, WIB_TZ, TIME_FMT);
  }

  const s = String(v).trim();
  if (!s) return '';

  // Kalau sudah "HH:mm" kembalikan apa adanya
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;

  // ISO string -> parse
  // contoh: 1899-12-30T02:03:48.000Z atau 2025-08-14T17:00:00.000Z
  var dt = new Date(s);
  if (!isNaN(dt.getTime())){
    return Utilities.formatDate(dt, WIB_TZ, TIME_FMT);
  }

  // Format lain (misal "2:3" atau "02:03:48") -> coba normalize
  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m){
    const hh = ('0' + m[1]).slice(-2);
    const mm = ('0' + m[2]).slice(-2);
    return hh + ':' + mm + ':' + ('0' + (m[3] || '00')).slice(-2);
  }

  // Gagal parse → kosongkan agar tidak menampilkan ISO aneh
  return '';
}
function isValidDmy_(s){
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return false;
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(y, mo-1, d);
  return dt.getFullYear()===y && (dt.getMonth()+1)===mo && dt.getDate()===d;
}

function dmyToDate_(s){
  // Terima dd/MM/yyyy atau Date
  if (Object.prototype.toString.call(s) === '[object Date]'){
    return s;
  }
  const str = toDmyString_(s);
  const m = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m){
    // fallback: now (agar tidak crash), tapi sebaiknya sudah di-validate dulu
    return new Date(NaN);
  }
  const d = +m[1], mo = +m[2], y = +m[3];
  return new Date(y, mo-1, d);
}

function pad2(n){ return (n<10?'0':'')+n; }

function findGuest_(gid){
  const gvals=sheet('Guests').getDataRange().getValues().slice(1);
  const r = gvals.find(x=>x[0]===gid);
  if(!r) return null;
  // find reservation to get agenda
  const rvals=sheet('Reservations').getDataRange().getValues().slice(1);
  const res = rvals.find(y=>y[0]===r[1]);
  return {name:r[2], unit:r[3], title:r[4], agenda:res?res[4]:''};
}
function staysActive_(user, body){
  // Optional filter
  var messFilter = body && body.mess_name ? String(body.mess_name).trim() : '';
  var roomFilter = body && body.room_name ? String(body.room_name).trim() : '';

  // Stays: id, guest_id, mess, room, checkin_date, checkin_time, checkout_date, checkout_time
  var svals = sheet('Stays').getDataRange().getValues().slice(1);
  var rows = [];

  for(var i=0;i<svals.length;i++){
    var s = svals[i];
    var mess = (s[2]||'').toString().trim();
    var room = (s[3]||'').toString().trim();
    var dOut = s[6];

    if(messFilter && mess !== messFilter) continue;
    if(roomFilter && room !== roomFilter) continue;

    // hanya yang masih menginap (checkout_date kosong)
    if(dOut) continue;

    var guestId = s[1];
    var g = findGuest_(guestId);
    if(!g) continue;

    // Batasan role mess: hanya boleh lihat mess sendiri
    if(user.role==='mess' && user.mess && mess !== user.mess) continue;

    rows.push({guest_id: guestId, name: g.name, unit: g.unit, title: g.title, agenda: g.agenda, mess: mess,
      room: room,
      checkin_date: s[4] || '',
      checkin_time: s[5] || ''
    });
  }

  return json_({ ok:true, rows: rows });
}
function statsDashboard_(user, body){
  // Helper
  function toNum(n){ n = Number(n); return isNaN(n)?0:n; }
  function isOpenStay_(row){ return !row[6]; } // checkout_date kosong
  function dmyToDate_(s){
    if(!s) return null;
    var m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!m) return null;
    return new Date(+m[3], +m[2]-1, +m[1]);
  }

  var now = new Date();
  var dayMs = 24*60*60*1000;
  var cutoff = new Date(now.getTime() - 30*dayMs); // 30 hari terakhir, untuk LOS

  // ====== Ambil data ======
  var roomsVals = sheet('Rooms').getDataRange().getValues(); // [id,mess,room,cap,grade,status,created,is_active]
  var staysVals = sheet('Stays').getDataRange().getValues(); // [id,guest_id,mess,room,dIn,tIn,dOut,tOut]

  if(roomsVals.length<2) roomsVals = [roomsVals[0]]; // header only guard
  if(staysVals.length<2) staysVals = [staysVals[0]];

  var rooms = roomsVals.slice(1);
  var stays = staysVals.slice(1);

  // ====== Kapasitas total per mess ======
  var capacityByMess = {}; // mess -> total capacity (kamar aktif)
  rooms.forEach(function(r){
    var mess = (r[1]||'').toString().trim();
    var cap  = toNum(r[3]);
    var isAct = (r[7]===1 || r[7]==='1'); // kolom is_active
    if(!mess) return;
    if(!isAct) return; // hanya kamar aktif
    capacityByMess[mess] = (capacityByMess[mess]||0) + cap;
  });

  // ====== Hitung tamu aktif per mess + per (mess,room) ======
  var activeByMess = {};               // mess -> jumlah tamu aktif
  var activeByRoomKey = {};            // "mess||room" -> jumlah tamu aktif

  stays.forEach(function(s){
    var mess = (s[2]||'').toString().trim();
    var room = (s[3]||'').toString().trim();
    var dOut = s[6]; // checkout_date
    if(!mess || !room) return;

    // role mess: batasi hanya mess miliknya
    // NOTE: stats.dashboard dipakai admin default; kalau pun mess-role akses, tetap aman
    if(user.role==='mess' && user.mess && mess!==user.mess) return;

    if(!dOut){ // masih menginap
      activeByMess[mess] = (activeByMess[mess]||0) + 1;
      var key = mess+'||'+room;
      activeByRoomKey[key] = (activeByRoomKey[key]||0) + 1;
    }
  });

  // **Total tamu aktif**
  var totalActive = Object.values(activeByMess).reduce((a,b)=>a+b, 0);

  // **Per mess (occupancy)**
  var perMess = [];
  Object.keys(capacityByMess).forEach(function(mess){
    var cap = capacityByMess[mess] || 0;
    var act = activeByMess[mess] || 0;
    var occ = (cap>0) ? (act/cap) : null; // 0..1 atau null jika kapasitas 0
    perMess.push({ mess: mess, active: act, capacity: cap, occupancy: occ });
  });
  // sertakan mess yang mungkin tidak punya kamar aktif (jarang, tapi jaga2)
  Object.keys(activeByMess).forEach(function(mess){
    if(!capacityByMess.hasOwnProperty(mess)){
      perMess.push({ mess: mess, active: activeByMess[mess], capacity: 0, occupancy: null });
    }
  });

  // **Top 3 kamar tersibuk (berdasarkan tamu aktif saat ini)**
  var topRoomsActive = Object.keys(activeByRoomKey)
    .map(function(k){
      var parts = k.split('||');
      return { mess: parts[0]||'', room: parts[1]||'', active: activeByRoomKey[k]||0 };
    })
    .sort((a,b)=>b.active-a.active)
    .slice(0,3);

  // **Rata‑rata lama menginap (LOS) 30 hari terakhir**
  // dihitung dari stay yang sudah checkout, dengan checkout_date berada dalam 30 hari terakhir
  var totalDays = 0, countDays = 0;
  stays.forEach(function(s){
    var dIn  = dmyToDate_(s[4]);
    var dOut = dmyToDate_(s[6]);
    if(!dIn || !dOut) return;
    if(dOut < cutoff) return;   // hanya 30 hari terakhir berdasarkan tanggal checkout
    // beda hari (dibulatkan ke atas minimum 1 jika menginap lintas hari)
    var diff = Math.max(1, Math.round((dOut - dIn)/dayMs));
    totalDays += diff;
    countDays += 1;
  });
  var avgLosDays = countDays>0 ? +(totalDays / countDays).toFixed(1) : 0;

  return json_({
    ok: true,
    total_active: totalActive,
    per_mess: perMess,
    top_rooms_active: topRoomsActive,
    avg_los_days: avgLosDays
  });
}

function statsOverview_(user, body){
  const svals = sheet('Stays').getDataRange().getValues().slice(1);
  const total = svals.length;
  const byMess = {};
  svals.forEach(s=>{
    const mess = (s[2]||'').toString().trim();
    byMess[mess] = (byMess[mess]||0) + 1;
  });

  // PERBAIKAN: musti return { by_mess: byMess } (bukan 'by_mess' tanpa variabel)
  return json_({ok:true, total_stay: total, by_mess: byMess});
}


function normStr_(s){ return (s||'').toString().trim(); }
function toLower_(s){ return normStr_(s).toLowerCase(); }

// Jalankan sekali dari editor: normalizeRooms_(); normalizeResvGuests_();
function normalizeRooms_(){
  const sh = sheet('Rooms');
  const vals = sh.getDataRange().getValues();
  // header: id, mess_name, room_name, capacity, grade, status, created_at, is_active
  for(let i=1;i<vals.length;i++){
    const row = vals[i];
    const mess = normStr_(row[1]);
    const room = normStr_(row[2]);
    let status = toLower_(row[5]);
    if(['penuh','occupied','booked'].includes(status)) status = 'penuh';
    else status = 'tersedia'; // fallback default
    sh.getRange(i+1,2).setValue(mess);
    sh.getRange(i+1,3).setValue(room);
    sh.getRange(i+1,6).setValue(status);
  }
}

function normalizeResvGuests_(){
  // Reservations.mess_selected & Guests.mess_alloc dibersihkan trim
  const rsh = sheet('Reservations');
  const rvals = rsh.getDataRange().getValues();
  for(let i=1;i<rvals.length;i++){
    const v = rvals[i];
    rsh.getRange(i+1,6).setValue(normStr_(v[5])); // mess_selected (col F)
  }
  const gsh = sheet('Guests');
  const gvals = gsh.getDataRange().getValues();
  for(let i=1;i<gvals.length;i++){
    const v = gvals[i];
    gsh.getRange(i+1,7).setValue(normStr_(v[6])); // mess_alloc (col G)
    gsh.getRange(i+1,8).setValue(normStr_(v[7])); // room_alloc (col H)
  }
}



function journalNoShowList_(user, body){
  function toDmyLocal_(v){
    if(!v) return '';
    if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, WIB_TZ, DATE_FMT);
    var s = String(v).trim();
    if(!s) return '';
    var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(dmy) return ('0'+dmy[1]).slice(-2)+'/'+('0'+dmy[2]).slice(-2)+'/'+dmy[3];
    var ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(ymd) return ymd[3]+'/'+ymd[2]+'/'+ymd[1];
    var dt = new Date(s);
    return isNaN(dt.getTime()) ? '' : Utilities.formatDate(dt, WIB_TZ, DATE_FMT);
  }
  function toTimeLocal_(v){
    if(v === null || v === undefined || v === '') return '';
    if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, WIB_TZ, TIME_FMT);
    var s = String(v).trim();
    if(!s) return '';
    var m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if(m) return ('0'+m[1]).slice(-2)+':'+('0'+m[2]).slice(-2)+':'+('0'+(m[3]||'00')).slice(-2);
    var dt = new Date(s);
    return isNaN(dt.getTime()) ? s : Utilities.formatDate(dt, WIB_TZ, TIME_FMT);
  }
  function asDate_(dmy){
    var m = String(dmy||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!m) return new Date(NaN);
    return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  }

  var date_from = toDmyLocal_(body.date_from);
  var date_to = toDmyLocal_(body.date_to);
  if(date_from && date_to && asDate_(date_from) > asDate_(date_to)){
    var tmp = date_from; date_from = date_to; date_to = tmp;
  }
  var fromDt = date_from ? asDate_(date_from) : null;
  var toDt = date_to ? asDate_(date_to) : null;

  var rows = [];
  var vals = sheet('NoShows').getDataRange().getValues().slice(1);
  for(var i=0;i<vals.length;i++){
    var n = vals[i];
    var guestId = n[1];
    var mess = String(n[2] || '').trim();
    var room = String(n[3] || '').trim();
    var d = toDmyLocal_(n[4]);
    var t = toTimeLocal_(n[5]);
    var reason = String(n[6] || '').trim();
    var markedBy = String(n[7] || '').trim();
    if(!d) continue;
    var dd = asDate_(d);
    if(fromDt && dd < fromDt) continue;
    if(toDt && dd > toDt) continue;
    if(user.role === 'mess' && user.mess && mess !== String(user.mess||'').trim()) continue;

    var g = findGuest_(guestId) || {};
    rows.push({
      name: g.name || '',
      unit: g.unit || '',
      title: g.title || '',
      agenda: g.agenda || '',
      mess: mess,
      room: room,
      noshow_date: d,
      noshow_time: t,
      reason: reason,
      marked_by: markedBy
    });
  }
  return json_({ok:true, rows: rows});
}
