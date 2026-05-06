/***** ====== CONFIG ====== *****/
const SPREADSHEET_ID = '1_H4y8P165FV9kTS75K132Wu1fsVYzUEIVU-IPLh5Ia8';
const TOKEN_SECRET = '4f2a8b9c1d3e6f7a8b9c1d3e6f7a8b9c'; // untuk HMAC token
const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari
const WIB_TZ = 'Asia/Jakarta';
const DATE_FMT = 'dd/MM/yyyy';
const TIME_FMT = 'HH:mm:ss';
const DATETIME_FMT = 'dd/MM/yyyy HH:mm:ss';
/***** ===================== *****/

function getDb() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sheet(name){ const ss=getDb(); const sh=ss.getSheetByName(name); if(!sh) return ss.insertSheet(name); return sh;}
function headers(sh, arr){ if(sh.getLastRow()===0){ sh.appendRow(arr); } }
function initOnce_(){
  headers(sheet('Users'), ['id','username','password_hash','role','mess_name','telegram_id','created_at']);
  headers(sheet('Mess'),  ['id','name','location','notes','created_at','is_active']);
  headers(sheet('Rooms'), ['id','mess_name','room_name','capacity','grade','status','created_at','is_active']);
  headers(sheet('Reservations'), ['id','orderer_name','orderer_unit','orderer_title','agenda','mess_selected','checkin_plan','checkout_plan','status','created_at']);
  headers(sheet('Guests'), ['id','reservation_id','name','unit','title','gender','mess_alloc','room_alloc','status']); // status: pending/approved/checkedin/checkedout/deleted/rejected
  headers(sheet('Stays'), ['id','guest_id','mess','room','checkin_date','checkin_time','checkout_date','checkout_time']);
  headers(sheet('NoShows'), ['id','guest_id','mess','room','noshow_date','noshow_time','reason','marked_by']);
  headers(sheet('Config'), ['key','value']); // telegram_bot_token, telegram_admin_id, gas_url
  // seed admin if not exists
  const u = sheet('Users'); const data = u.getDataRange().getValues();
  if(!data.some((r,i)=>i>0 && r[1]==='admin')){
    const now = nowWibDateTime_();
    u.appendRow([genId_(), 'admin', hash_('admin'), 'admin','', '', now]);
  }
}
function genId_(){ return Utilities.getUuid(); }
function hash_(plain){ const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8); return Utilities.base64Encode(raw); }

function pad2(n){return (n<10?'0':'')+n;}
function fmtDate_(d){ return Utilities.formatDate((d || new Date()), WIB_TZ, DATE_FMT); }
function fmtTime_(d){ return Utilities.formatDate((d || new Date()), WIB_TZ, TIME_FMT); }
function nowWibDate_(){ return fmtDate_(new Date()); }
function nowWibTime_(){ return fmtTime_(new Date()); }
function nowWibDateTime_(){ return Utilities.formatDate(new Date(), WIB_TZ, DATETIME_FMT); }
function toWibDateString_(v){
  if(!v) return '';
  // Jika berasal dari cell tanggal Google Sheets, nilainya Date object.
  // Format langsung ke WIB agar tidak turun 1 hari saat dikirim JSON.
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())){
    return Utilities.formatDate(v, WIB_TZ, DATE_FMT);
  }
  var s = String(v).trim();
  if(!s) return '';

  // Sudah DD/MM/YYYY.
  var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(dmy) return ('0'+dmy[1]).slice(-2)+'/'+('0'+dmy[2]).slice(-2)+'/'+dmy[3];

  // Plain date dari HTML input: YYYY-MM-DD, jangan diparse timezone.
  var plainYmd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(plainYmd) return plainYmd[3]+'/'+plainYmd[2]+'/'+plainYmd[1];

  // ISO datetime dari GAS/Sheets, contoh 2026-05-02T17:00:00.000Z.
  // Ini mewakili 03/05/2026 00:00 WIB, jadi harus diformat kembali ke WIB.
  var dt = new Date(s);
  if(!isNaN(dt.getTime())) return Utilities.formatDate(dt, WIB_TZ, DATE_FMT);

  // Fallback ISO-like tanpa timezone.
  var ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(ymd) return ymd[3]+'/'+ymd[2]+'/'+ymd[1];
  return s;
}
function toWibTimeString_(v){
  if(v === null || v === undefined || v === '') return '';
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, WIB_TZ, TIME_FMT);
  var s = String(v).trim();
  if(!s) return '';
  var hm = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if(hm) return ('0'+hm[1]).slice(-2)+':'+('0'+hm[2]).slice(-2)+':'+('0'+(hm[3]||'00')).slice(-2);
  var dt = new Date(s);
  return isNaN(dt.getTime()) ? s : Utilities.formatDate(dt, WIB_TZ, TIME_FMT);
}
function toWibDateTimeString_(v){
  if(!v) return '';
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, WIB_TZ, DATETIME_FMT);
  var s = String(v).trim();
  if(!s) return '';
  if(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?$/.test(s)){
    return s.length === 16 ? s + ':00' : s;
  }
  var dt = new Date(s);
  return isNaN(dt.getTime()) ? s : Utilities.formatDate(dt, WIB_TZ, DATETIME_FMT);
}

function signToken_(payloadObj){
  const payload = JSON.stringify(payloadObj);
  const sigBytes = Utilities.computeHmacSha256Signature(payload, TOKEN_SECRET);
  const sig = Utilities.base64Encode(sigBytes);
  return Utilities.base64EncodeWebSafe(payload)+'~'+sig;
}
function verifyToken_(token){
  try{
    const [p64,sig] = token.split('~');
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(p64)).getDataAsString();
    const calc = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload, TOKEN_SECRET));
    if(calc!==sig) return {ok:false, reason:'bad-sign'};
    const obj = JSON.parse(payload);
    if(Date.now()>obj.exp) return {ok:false, reason:'expired'};
    return {ok:true, payload:obj};
  }catch(e){ return {ok:false, reason:'invalid'}; }
}

function syncAdminTelegramToUsers_(teleId){
  const sh = sheet('Users');
  const vals = sh.getDataRange().getValues();
  for (var i=1; i<vals.length; i++){
    var role = vals[i][3];
    if(role === 'admin'){
      sh.getRange(i+1, 6).setValue(teleId || '');
    }
  }
}

function getConfig_(key){
  const sh = sheet('Config'); const map = Object.fromEntries(sh.getDataRange().getValues().slice(1).map(r=>[r[0], r[1]]));
  return map[key] || '';
}
function setConfig_(key, value){
  const sh = sheet('Config'); const vals = sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][0]===key){ sh.getRange(i+1,2).setValue(value); return; } }
  sh.appendRow([key, value]);
}


/*************** CONFIG SET/GET ***************/
function configSet_(body){
  // needs admin token
  const {token, key, value} = body;
  if(!token) return json_({ok:false, error:'unauthorized'});
  const ver=verifyToken_(token); if(!ver.ok || ver.payload.role!=='admin') return json_({ok:false, error:'forbidden'});
  if(!key) return json_({ok:false, error:'key_required'});

  setConfig_(key, value||'');

  // Propagasi dua arah: kalau admin ID di-config berubah, update semua admin di Users
  if(key === 'telegram_admin_id'){
    syncAdminTelegramToUsers_(String(value||'').trim());
  }

  return json_({ok:true});
}
function configGet_(){
  const map = {};
  const vals = sheet('Config').getDataRange().getValues().slice(1);
  vals.forEach(r => { map[r[0]] = r[1]; });
  return json_({ok:true, config: map});
}

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, output){
  var txt = '{}';
  try{
    txt = output && output.getContent ? output.getContent() : JSON.stringify(output || {});
  }catch(e){
    txt = JSON.stringify({ok:false, error:String(e)});
  }
  callback = String(callback || '').replace(/[^a-zA-Z0-9_$\.]/g, '');
  if(!callback) callback = 'callback';
  return ContentService
    .createTextOutput(callback + '(' + txt + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function parseBody_(e){
  var p = (e && e.parameter) || {};
  if(p.payload){
    try{ return JSON.parse(p.payload); }catch(err){ return { action:p.action || '', parse_error:String(err) }; }
  }
  if(e && e.postData && e.postData.contents){
    try{ return JSON.parse(e.postData.contents); }catch(err2){ return { action:p.action || '', parse_error:String(err2) }; }
  }
  var body = {};
  Object.keys(p).forEach(function(k){ if(k !== 'callback' && k !== '_' && k !== '_t') body[k] = p[k]; });
  return body;
}

function doGet(e){
  var out = handleRequest_(e);
  var cb = e && e.parameter && e.parameter.callback;
  return cb ? jsonp_(cb, out) : out;
}

function doPost(e){
  return handleRequest_(e);
}

function handleRequest_(e){
  initOnce_();
  try{
    const body = parseBody_(e);
    if(body.parse_error) return json_({ok:false, error:'bad_json', detail:body.parse_error});
    const action = body.action || '';

    // actions tanpa token:
    if(action==='login')          return login_(body);
    if(action==='auth.register')  return authRegisterPublic_(body);
    if(action==='config.set')     return configSet_(body);
    if(action==='config.get')     return configGet_();
    if(action==='qr.lookup')      return qrLookupPublic_(body);
    if(action==='qr.action')      return qrActionPublic_(body);
    // verifikasi token
    const token = ((e && e.parameter && e.parameter.token) || body.token || ((e && e.parameter && e.parameter.Authorization) || ''));
    const ver = verifyToken_(token);
    if(!ver.ok) return json_({ok:false, error:'unauthorized', reason:ver.reason});
    const user = ver.payload;

    switch(action){
      case 'me':               return json_({ok:true, user});
      case 'users.list':       return usersList_(user);
      case 'users.add':        return usersAdd_(user, body);
      case 'users.del':        return usersDel_(user, body);
      case 'users.pass':       return usersPass_(user, body);

      case 'mess.list':        return messList_();
      case 'mess.add':         return messAdd_(user, body);
      case 'mess.update':      return messUpdate_(user, body);
      case 'mess.del':         return messDel_(user, body);

      case 'rooms.list':       return roomsList_(user, body);
      case 'rooms.save':       return roomsSave_(user, body);
      case 'rooms.del':        return roomsDel_(user, body);

      case 'reserve.create':   return reserveCreate_(user, body);
      case 'reserve.list':     return reserveList_(user, body);
      case 'approve.alloc':    return approveAlloc_(user, body);
      case 'approve.reject':   return approveReject_(user, body);
      case 'guest.approve':    return guestApprove_(user, body);
      case 'guest.delete':     return guestDelete_(user, body);

      case 'mess.queue':       return messQueue_(user, body);
      case 'guest.checkin':    return guestCheckin_(user, body);
      case 'guest.checkout':   return guestCheckout_(user, body);
      case 'guest.noshow':     return guestNoShow_(user, body);

      case 'journal.list':     return journalList_(user, body);
      case 'journal.noshow.list': return journalNoShowList_(user, body);
      case 'stats.overview':   return statsOverview_(user, body);
      case 'stats.dashboard':  return statsDashboard_(user, body);
      case 'label.agendas':    return labelAgendas_(user, body);
      case 'label.list':       return labelList_(user, body);
      case 'qr.agendas':       return qrAgendas_(user, body);
      case 'qr.list':          return qrList_(user, body);
      case 'calendar.overview': return calendarOverview_(user, body);
      case 'conflict.check':   return conflictCheck_(user, body);


      case 'notify.test':     return notifyTest_(user, body);
      case 'stays.active':     return staysActive_(user, body);

      default:                 return json_({ok:false, error:'unknown_action'});
    }
  } catch(err){
    return json_({ok:false, error:String(err)});
  }
}


