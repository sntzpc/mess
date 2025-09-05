/***** ====== CONFIG ====== *****/
const SPREADSHEET_ID = '1_H4y8P165FV9kTS75K132Wu1fsVYzUEIVU-IPLh5Ia8';
const TOKEN_SECRET = '4f2a8b9c1d3e6f7a8b9c1d3e6f7a8b9c'; // untuk HMAC token
const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari
const DATE_FMT = 'dd/MM/yyyy';
const TIME_FMT = 'HH:mm';
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
  headers(sheet('Config'), ['key','value']); // telegram_bot_token, telegram_admin_id, gas_url
  // seed admin if not exists
  const u = sheet('Users'); const data = u.getDataRange().getValues();
  if(!data.some((r,i)=>i>0 && r[1]==='admin')){
    const now = new Date();
    u.appendRow([genId_(), 'admin', hash_('admin'), 'admin','', '', now]);
  }
}
function genId_(){ return Utilities.getUuid(); }
function hash_(plain){ const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8); return Utilities.base64Encode(raw); }

function pad2(n){return (n<10?'0':'')+n;}
function fmtDate_(d){ return Utilities.formatDate(d, Session.getScriptTimeZone(), DATE_FMT); }
function fmtTime_(d){ return Utilities.formatDate(d, Session.getScriptTimeZone(), TIME_FMT); }

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

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){ return doPost(e); } // optional: GET diarahkan ke doPost

function doPost(e){
  initOnce_();
  try{
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action || '';

    // actions tanpa token:
    if(action==='login') return login_(body);
    if(action==='config.set') return configSet_(body);
    if(action==='config.get') return configGet_();

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

    // verifikasi token
    const token = (e.parameter.token) || (body.token) || (e.parameter.Authorization) || '';
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

      case 'journal.list':     return journalList_(user, body);
      case 'stats.overview':   return statsOverview_(user, body);
      case 'stats.dashboard':  return statsDashboard_(user, body);


      case 'notify.test':     return notifyTest_(user, body);
      case 'stays.active':     return staysActive_(user, body);

      default:                 return json_({ok:false, error:'unknown_action'});
    }
  } catch(err){
    return json_({ok:false, error:String(err)});
  }
}


/*************** AUTH ***************/
function login_(body){
  const {username, password} = body;
  const u = sheet('Users'); const vals = u.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    const [id, un, ph, role, messName, teleId] = vals[i];
    if(un===username && ph===hash_(password)){
      const payload = { uid:id, username:un, role, mess: messName || '', exp: Date.now()+TOKEN_TTL_MS };
      return json_({ok:true, token:signToken_(payload), user:payload});
    }
  }
  return json_({ok:false, error:'invalid_credentials'});
}
function assertAdmin_(user){ if(user.role!=='admin') throw new Error('forbidden'); }

/*************** USERS ***************/
function usersList_(user){
  assertAdmin_(user);
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues().slice(1);
  const rows = vals.map(r=>({id:r[0], username:r[1], role:r[3], mess_name:r[4]||'', telegram_id:r[5]||''}));
  return json_({ok:true, rows});
}
function usersAdd_(user, body){
  assertAdmin_(user);
  const {username, password, role, mess_name, telegram_id} = body;
  if(!username || !role) return json_({ok:false, error:'missing_fields'});

  const sh = sheet('Users');
  const vals = sh.getDataRange().getValues();

  // cari user existing
  let foundRow = -1;
  for(let i=1;i<vals.length;i++){
    if(vals[i][1] === username){
      foundRow = i+1; break;
    }
  }

  if(foundRow > 0){
    // UPDATE
    if(password){ sh.getRange(foundRow, 3).setValue(hash_(password)); }          // password_hash
    sh.getRange(foundRow, 4).setValue(role);                                     // role
    sh.getRange(foundRow, 5).setValue(mess_name || '');                          // mess_name
    sh.getRange(foundRow, 6).setValue(telegram_id || '');                        // telegram_id
  }else{
    // INSERT
    const row = [genId_(), username, password ? hash_(password) : hash_(''), role, mess_name||'', telegram_id||'', new Date()];
    sh.appendRow(row);
  }

  // Sinkronisasi 2 arah: jika admin punya telegram_id, set juga di Config
  if(role === 'admin'){
    setConfig_('telegram_admin_id', String(telegram_id||'').trim());
  }

  return json_({ok:true, updated:(foundRow>0)});
}

function usersDel_(user, body){
  assertAdmin_(user);
  if(body.username==='admin') return json_({ok:false, error:'cannot_delete_admin'});
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][1]===body.username){ sh.deleteRow(i+1); return json_({ok:true}); } }
  return json_({ok:false, error:'not_found'});
}
function usersPass_(user, body){
  // admin can change anyone, user can change self
  const {username, newpass} = body;
  const target = username || user.username;
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][1]===target){
      sh.getRange(i+1,3).setValue(hash_(newpass));
      return json_({ok:true});
    }
  }
  return json_({ok:false, error:'user_not_found'});
}

/*************** MESS ***************/
function messList_(){
  const sh = sheet('Mess'); const vals=sh.getDataRange().getValues().slice(1);
  return json_({ok:true, rows: vals.filter(r=>r[5]!=='0').map(r=>({id:r[0], name:r[1], location:r[2]||'', notes:r[3]||'', is_active:(r[5]!=='0')}))});
}
function messAdd_(user, body){ assertAdmin_(user);
  const {name, location, notes} = body; if(!name) return json_({ok:false, error:'name_required'});
  sheet('Mess').appendRow([genId_(), name, location||'', notes||'', new Date(), 1]); return json_({ok:true});
}
function messUpdate_(user, body){ assertAdmin_(user);
  const {id, name, location, notes, is_active=1} = body;
  const sh=sheet('Mess'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][0]===id){
    if(name!==undefined) sh.getRange(i+1,2).setValue(name);
    if(location!==undefined) sh.getRange(i+1,3).setValue(location);
    if(notes!==undefined) sh.getRange(i+1,4).setValue(notes);
    sh.getRange(i+1,6).setValue(is_active?1:0);
    return json_({ok:true});
  }}
  return json_({ok:false, error:'not_found'});
}
function messDel_(user, body){ assertAdmin_(user);
  const sh=sheet('Mess'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][0]===body.id){ sh.deleteRow(i+1); return json_({ok:true}); } }
  return json_({ok:false, error:'not_found'});
}

/*************** ROOMS (dinamis dari Stays) ***************/
function roomsList_(user, body){
  var messFilter = (body && body.mess_name ? String(body.mess_name).trim() : '');
  var messFilterLc = messFilter.toLowerCase();
  var dateFromStr = (body && body.date_from ? String(body.date_from).trim() : '');
  var dateToStr   = (body && body.date_to   ? String(body.date_to).trim()   : '');

  // --- helper parse tanggal ---
  function parseDMY_(s){
    var m = String(s||'').trim();
    if(!m) return null;
    // dd/MM/yyyy
    var md = m.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(md){
      return new Date(Number(md[3]), Number(md[2])-1, Number(md[1]));
    }
    // yyyy-MM-dd atau ISO-like → ambil 10 char pertama
    var my = m.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(my){
      return new Date(Number(my[1]), Number(my[2])-1, Number(my[3]));
    }
    return null;
  }

  // Range rencana (opsional). Jika kosong, kita tetap hitung hanya tamu aktif.
  var dFrom = parseDMY_(dateFromStr);
  var dTo   = parseDMY_(dateToStr);

  // Sheets
  var Rsh = sheet('Rooms').getDataRange().getValues();   // id, mess_name, room_name, capacity, grade, status, created_at, is_active
  var Ssh = sheet('Stays').getDataRange().getValues();   // id, guest_id, mess, room, checkin_date, checkin_time, checkout_date, checkout_time
  var Gsh = sheet('Guests').getDataRange().getValues();  // id, reservation_id, name, unit, title, gender, mess_alloc, room_alloc, status
  var Res = sheet('Reservations').getDataRange().getValues(); // id, orderer_name, orderer_unit, orderer_title, agenda, mess_selected, checkin_plan, checkout_plan, status, created_at

  // Index bantuan untuk Reservation by id
  var resIdx = {};
  for(var i=1;i<Res.length;i++){
    var rid = Res[i][0];
    resIdx[rid] = Res[i];
  }

  // ---- 1) OCCUPANCY AKTIF (tamu yang sedang menginap) ----
  var occActive = {};          // key: "mess||room" -> count
  var activeGuestIds = {};     // set guest_id yang sedang aktif
  for(var i=1;i<Ssh.length;i++){
    var s = Ssh[i];
    var mess = (s[2]||'').toString().trim();
    var room = (s[3]||'').toString().trim();
    var chkout = s[6]; // checkout_date

    if(messFilter && mess.toLowerCase() !== messFilterLc) continue;

    // hanya yang belum checkout
    if(chkout) continue;

    var key = mess + '||' + room;
    occActive[key] = (occActive[key]||0) + 1;
    activeGuestIds[ String(s[1]||'') ] = true; // guest_id
  }

  // ---- 2) OCCUPANCY RENCANA (alokasi kamar di Guests yg overlap rentang) ----
  var occPlanned = {}; // key: "mess||room" -> count
  if(dFrom && dTo){
    for(var j=1;j<Gsh.length;j++){
      var g = Gsh[j];
      var gId   = (g[0]||'').toString().trim();
      var rId   = (g[1]||'').toString().trim();
      var gMess = (g[6]||'').toString().trim();
      var gRoom = (g[7]||'').toString().trim();
      var gStat = (g[8]||'').toString().trim().toLowerCase();

      // skip kalau belum dialokasikan kamar
      if(!gMess || !gRoom) continue;
      if(messFilter && gMess.toLowerCase() !== messFilterLc) continue;

      // skip status yang tidak relevan
      if(gStat==='deleted' || gStat==='rejected') continue;

      // hindari double-count dengan tamu aktif
      if(activeGuestIds[gId]) continue;

      // cek overlap tanggal reservasi
      var r = resIdx[rId];
      if(!r) continue;
      var rIn  = r[6]; // checkin_plan (bisa dd/MM/yyyy atau yyyy-MM-dd)
      var rOut = r[7]; // checkout_plan

      var rin  = parseDMY_(rIn);
      var rout = parseDMY_(rOut);
      if(!rin || !rout) continue;

      // Overlap jika: (rin <= dTo) && (rout >= dFrom)
      if(rin.getTime() <= dTo.getTime() && rout.getTime() >= dFrom.getTime()){
        var key2 = gMess + '||' + gRoom;
        occPlanned[key2] = (occPlanned[key2]||0) + 1;
      }
    }
  }

  // ---- 3) BANGUN RESPON PER ROOM ----
  var rows = [];
  for(var k=1;k<Rsh.length;k++){
    var r = Rsh[k];
    var id    = r[0];
    var mess  = (r[1]||'').toString().trim();
    var room  = (r[2]||'').toString().trim();
    var cap   = Number(r[3]||0);
    var grade = (r[4]||'').toString().trim();

    if(messFilter && mess.toLowerCase() !== messFilterLc) continue;

    var key  = mess + '||' + room;
    var usedActive  = occActive[key]  || 0;
    var usedPlan    = occPlanned[key] || 0;
    var usedTotal   = usedActive + usedPlan;

    var computed = 'tersedia';
    if(cap > 0 && usedTotal >= cap) computed = 'penuh';
    else if(usedTotal > 0)          computed = 'terisi';

    var remaining = (cap>0) ? Math.max(0, cap - usedTotal) : 0;

    rows.push({
      id: id,
      mess_name: mess,
      room_name: room,
      capacity: cap,
      grade: grade,
      used_active: usedActive,
      used_planned: usedPlan,
      used_total: usedTotal,
      remaining: remaining,
      status: computed
    });
  }

  return json_({ ok:true, rows: rows });
}

function roomsSave_(user, body){
  assertAdmin_(user);
  const sh=sheet('Rooms');
  const {id, mess_name, room_name, capacity, grade, status='tersedia', is_active=1} = body;
  if(id){ // update
    const vals=sh.getDataRange().getValues();
    for(let i=1;i<vals.length;i++){ if(vals[i][0]===id){
      if(mess_name!==undefined) sh.getRange(i+1,2).setValue(mess_name);
      if(room_name!==undefined) sh.getRange(i+1,3).setValue(room_name);
      if(capacity!==undefined) sh.getRange(i+1,4).setValue(capacity);
      if(grade!==undefined) sh.getRange(i+1,5).setValue(grade);
      if(status!==undefined) sh.getRange(i+1,6).setValue(status);
      if(is_active!==undefined) sh.getRange(i+1,8).setValue(is_active?1:0);
      return json_({ok:true});
    }}
    return json_({ok:false, error:'not_found'});
  }else{ // insert
    if(!mess_name || !room_name) return json_({ok:false, error:'missing_fields'});
    sh.appendRow([genId_(), mess_name, room_name, capacity||0, grade||'', status, new Date(), is_active?1:0]);
    return json_({ok:true});
  }
}
function roomsDel_(user, body){ assertAdmin_(user);
  const sh=sheet('Rooms'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][0]===body.id){ sh.deleteRow(i+1); return json_({ok:true}); } }
  return json_({ok:false, error:'not_found'});
}

/*************** RESERVATION & APPROVAL ***************/
function reserveCreate_(user, body){
  // body: orderer {name,unit,title}, agenda, mess_selected, checkin_plan, checkout_plan, guests:[{name,unit,title,gender}]
  const {orderer, agenda, mess_selected, checkin_plan, checkout_plan, guests=[]} = body;
  const rid = genId_();
  sheet('Reservations').appendRow([rid, orderer.name||'', orderer.unit||'', orderer.title||'', agenda||'', mess_selected||'', checkin_plan||'', checkout_plan||'', 'submitted', new Date()]);
  const gsh = sheet('Guests');
  guests.slice(0,200).forEach(g=>{
    gsh.appendRow([genId_(), rid, g.name||'', g.unit||'', g.title||'', g.gender||'', mess_selected||'', '', 'pending']);
  });

  // === Telegram: ke semua admin ===
  if(tgEnabled_()){
    const lines = [
      '📝 *Reservasi Baru*',
      'Pemesan: *'+(orderer.name||'-')+'* ('+(orderer.unit||'-')+')',
      'Agenda : '+(agenda||'-'),
      'Mess   : '+(mess_selected||'-'),
      'Periode: '+(checkin_plan||'-')+' → '+(checkout_plan||'-'),
      'Tamu   : '+guests.length+' orang'
    ];
    tgBroadcast_(tgAdmins_(), lines.join('\n'));
  }

  return json_({ok:true, reservation_id: rid});
}
function reserveList_(user, body){
  // admin can see all; mess user sees only their mess approvals
  const shR = sheet('Reservations').getDataRange().getValues();
  const shG = sheet('Guests').getDataRange().getValues();
  const res = [];
  for(let i=1;i<shR.length;i++){
    const r = shR[i];
    if(r[8]==='submitted' || r[8]==='partially_approved'){ // show pending
      const rid=r[0];
      // filter by mess for mess-role
      if(user.role==='mess' && user.mess && r[5]!==user.mess) continue;
      const guests = shG.slice(1).filter(g=>g[1]===rid && g[8]!=='deleted' && g[8]!=='rejected').map(g=>({
        id:g[0], name:g[2], unit:g[3], title:g[4], gender:g[5], mess_alloc:g[6]||r[5], room_alloc:g[7]||'', status:g[8]
      }));
      res.push({
        id: rid, orderer_name:r[1], orderer_unit:r[2], orderer_title:r[3], agenda:r[4], mess_selected:r[5],
        checkin_plan:r[6], checkout_plan:r[7], status:r[8], guests
      });
    }
  }
  return json_({ok:true, rows:res});
}
function approveAlloc_(user, body){
  // update guest row allocation (mess/room) before approve; admin only
  assertAdmin_(user);
  const {guest_id, mess_alloc, room_alloc} = body;
  const sh=sheet('Guests'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      if(mess_alloc!==undefined) sh.getRange(i+1,7).setValue(mess_alloc);
      if(room_alloc!==undefined) sh.getRange(i+1,8).setValue(room_alloc);
      return json_({ok:true});
    }
  }
  return json_({ok:false, error:'guest_not_found'});
}
function guestApprove_(user, body){
  assertAdmin_(user);
  const {guest_id} = body;
  const gsh=sheet('Guests'); const vals=gsh.getDataRange().getValues();
  let rid = null, row = null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      gsh.getRange(i+1,9).setValue('approved');
      rid = vals[i][1]; row = vals[i]; break;
    }
  }
  if(!rid) return json_({ok:false, error:'guest_not_found'});

  // update reservation status if all guests approved
  const all = gsh.getDataRange().getValues().slice(1).filter(r=>r[1]===rid && r[8]!=='deleted' && r[8]!=='rejected');
  const approved = all.every(r=>r[8]==='approved');
  const partial = all.some(r=>r[8]==='approved');
  const rsh=sheet('Reservations'); const rvals=rsh.getDataRange().getValues();
  for(let i=1;i<rvals.length;i++){ if(rvals[i][0]===rid){
    rsh.getRange(i+1,9).setValue(approved?'approved':'partially_approved');
    break;
  }}

  // === Telegram ===
  if(tgEnabled_() && row){
    const g = { name: row[2], unit: row[3], title: row[4], gender: row[5], mess_alloc: row[6], room_alloc: row[7] };
    const msg = '✅ *Approval Tamu*\n' + fmtGuestLine_(g);
    // Admin (opsional, tapi sesuai requirement: admin menerima Approval)
    tgBroadcast_(tgAdmins_(), msg);
    // Semua User
    tgBroadcast_(tgUsers_(), msg);
    // Mess terkait saja
    tgBroadcast_(getTgIdsByMess_(g.mess_alloc), msg);
  }

  return json_({ok:true});
}
function guestDelete_(user, body){
  assertAdmin_(user);
  const {guest_id, reason=''} = body;
  const sh=sheet('Guests'); const vals=sh.getDataRange().getValues();
  let row=null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      sh.getRange(i+1,9).setValue('deleted');
      row = vals[i];
      break;
    }
  }
  if(!row) return json_({ok:false, error:'guest_not_found'});

  // === Telegram ===
  if(tgEnabled_()){
    const g = { name: row[2], unit: row[3], title: row[4], gender: row[5], mess_alloc: row[6], room_alloc: row[7] };
    const msg = '🗑️ *Guest Dihapus*\n' + fmtGuestLine_(g) + (reason?('\nAlasan: '+reason):'');
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
  }

  return json_({ok:true});
}
function approveReject_(user, body){
  assertAdmin_(user);
  const {reservation_id, reason=''} = body;
  const rsh=sheet('Reservations'); const vals=rsh.getDataRange().getValues();
  let any=false, row=null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===reservation_id){
      rsh.getRange(i+1,9).setValue('rejected'); any=true; row=vals[i]; break;
    }
  }
  if(!any) return json_({ok:false, error:'reservation_not_found'});

  const gsh=sheet('Guests'); const gvals=gsh.getDataRange().getValues();
  for(let i=1;i<gvals.length;i++){
    if(gvals[i][1]===reservation_id){ gsh.getRange(i+1,9).setValue('rejected'); }
  }

  // === Telegram ===
  if(tgEnabled_()){
    const msg = '⛔️ *Reservasi DITOLAK*\n' +
      'Agenda: ' + (row ? (row[4]||'-') : '-') + '\n' +
      'Mess  : ' + (row ? (row[5]||'-') : '-') + '\n' +
      (reason?('Alasan: '+reason+'\n'):'') +
      'ID: ' + reservation_id.substring(0,8);
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
  }

  return json_({ok:true});
}

/*************** MESS QUEUE & STAY ***************/
function messQueue_(user, body){
  // role mess: hanya mess miliknya; admin bisa pilih mess via body.mess_name
  let messName = user.role==='mess' ? (user.mess||'') : (body.mess_name||'');
  if(!messName) return json_({ok:false, error:'mess_required'});

  const gvals = sheet('Guests').getDataRange().getValues().slice(1);
  // ambil tamu yang dialokasikan ke mess ini dan statusnya approved ATAU checkedin
  const rows = gvals
    .filter(g => g[6] === messName && (g[8] === 'approved' || g[8] === 'checkedin'))
    .map(g => ({
      id: g[0], name: g[2], unit: g[3], title: g[4], gender: g[5], mess_alloc: g[6], room_alloc: g[7], status: g[8] // 'approved' atau 'checkedin'
    }));

  return json_({ok:true, rows});
}

function guestCheckin_(user, body){
  const {guest_id} = body;
  const gsh=sheet('Guests'); const vals=gsh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id && (user.role==='admin' || vals[i][6]===user.mess)){
      const now=new Date();
      gsh.getRange(i+1,9).setValue('checkedin');
      sheet('Stays').appendRow([genId_(), guest_id, vals[i][6], vals[i][7], fmtDate_(now), fmtTime_(now), '', '']);

      // === Telegram ===
      if(tgEnabled_()){
        const g = { name: vals[i][2], unit: vals[i][3], title: vals[i][4], gender: vals[i][5], mess_alloc: vals[i][6], room_alloc: vals[i][7] };
        const msg = '🟢 *Check-In*\n' + fmtGuestLine_(g) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
        tgBroadcast_(tgAdmins_(), msg);
        tgBroadcast_(tgUsers_(), msg);
        tgBroadcast_(getTgIdsByMess_(g.mess_alloc), msg);
      }

      return json_({ok:true, ts_date:fmtDate_(now), ts_time:fmtTime_(now)});
    }
  }
  return json_({ok:false, error:'guest_not_found_or_forbidden'});
}
function guestCheckout_(user, body){
  const {guest_id} = body;
  const gsh=sheet('Guests'); const gvals=gsh.getDataRange().getValues();
  let gRow=-1; let g=null;
  for(let i=1;i<gvals.length;i++){
    if(gvals[i][0]===guest_id){ gRow=i+1; g=gvals[i]; break; }
  }
  if(gRow<0) return json_({ok:false, error:'guest_not_found'});
  if(!(user.role==='admin' || g[6]===user.mess)) return json_({ok:false, error:'forbidden'});

  const now=new Date();
  gsh.getRange(gRow,9).setValue('checkedout');
  const ssh=sheet('Stays'); const svals=ssh.getDataRange().getValues();
  for(let i=1;i<svals.length;i++){
    if(svals[i][1]===guest_id && !svals[i][6]){
      ssh.getRange(i+1,7).setValue(fmtDate_(now));
      ssh.getRange(i+1,8).setValue(fmtTime_(now));
      break;
    }
  }

  // === Telegram ===
  if(tgEnabled_()){
    const gg = { name: g[2], unit: g[3], title: g[4], gender: g[5], mess_alloc: g[6], room_alloc: g[7] };
    const msg = '🔵 *Check-Out*\n' + fmtGuestLine_(gg) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
    tgBroadcast_(getTgIdsByMess_(gg.mess_alloc), msg);
  }

  return json_({ok:true, ts_date:fmtDate_(now), ts_time:fmtTime_(now)});
}


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
      return Utilities.formatDate(v, 'Asia/Jakarta', 'HH:mm');
    }
    const s = String(v).trim();
    if (!s) return '';
    if (/^\d{2}:\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm');
    }
    const m = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (m) {
      return pad2(m[1]) + ':' + pad2(m[2]);
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
    return Utilities.formatDate(v, 'Asia/Jakarta', 'HH:mm');
  }

  const s = String(v).trim();
  if (!s) return '';

  // Kalau sudah "HH:mm" kembalikan apa adanya
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  // ISO string -> parse
  // contoh: 1899-12-30T02:03:48.000Z atau 2025-08-14T17:00:00.000Z
  var dt = new Date(s);
  if (!isNaN(dt.getTime())){
    return Utilities.formatDate(dt, 'Asia/Jakarta', 'HH:mm');
  }

  // Format lain (misal "2:3" atau "02:03:48") -> coba normalize
  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (m){
    const hh = ('0' + m[1]).slice(-2);
    const mm = ('0' + m[2]).slice(-2);
    return hh + ':' + mm;
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


/*************** CONFIG / TELEGRAM (baruu) ***************/
/* Prinsip:
   - Admin  : terima Reservasi, Approval, Check-In, Check-Out, Reject, Hapus
   - User   : terima Approval, Check-In, Check-Out, Reject, Hapus (broadcast ke semua role 'user')
   - Mess   : terima Approval, Check-In, Check-Out yang sesuai mess-nya saja
*/

function tgGetBotToken_(){ return getConfig_('telegram_bot_token'); }
function tgEnabled_(){ return !!tgGetBotToken_(); }

function tgSendTo_(chatId, text){
  try{
    const token = tgGetBotToken_();
    if(!token || !chatId) return;
    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    const payload = { chat_id: String(chatId), text, parse_mode: 'Markdown' };
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  }catch(e){}
}

function tgBroadcast_(chatIds, text){
  if(!chatIds || chatIds.length===0) return;
  chatIds.forEach(id => tgSendTo_(id, text));
}

/* Ambil seluruh user dari sheet Users (return array of objects) */
function getAllUsers_(){
  const vals = sheet('Users').getDataRange().getValues();
  const rows = [];
  for(let i=1;i<vals.length;i++){
    const [id, username, passhash, role, mess_name, telegram_id] = vals[i];
    rows.push({
      id, username, role: String(role||'').trim(), mess_name: String(mess_name||'').trim(),
      telegram_id: String(telegram_id||'').trim()
    });
  }
  return rows;
}

/* Kumpulan chat id menurut role */
function getTgIdsByRole_(role){
  return getAllUsers_()
    .filter(u => u.role === role && u.telegram_id)
    .map(u => u.telegram_id);
}

/* Kumpulan chat id untuk semua user role 'mess' pada mess tertentu */
function getTgIdsByMess_(messName){
  const target = String(messName||'').trim();
  if(!target) return [];
  return getAllUsers_()
    .filter(u => u.role === 'mess' && u.mess_name === target && u.telegram_id)
    .map(u => u.telegram_id);
}

/* Alias cepat untuk admin & user */
function tgAdmins_(){ return getTgIdsByRole_('admin'); }
function tgUsers_(){ return getTgIdsByRole_('user'); }

/* Format baris tamu singkat */
function fmtGuestLine_(g){ // g: object {name, unit, title, gender, mess_alloc, room_alloc}
  return [
    '👤 *'+(g.name||'-')+'*',
    (g.unit?(' • '+g.unit):'') + (g.title?(' • '+g.title):''),
    '\n🏠 '+(g.mess_alloc||'-') + (g.room_alloc?(' • '+g.room_alloc):'')
  ].join('');
}

function notifyTest_(user, body){
  // hanya admin yang boleh test
  assertAdmin_(user);

  if(!tgEnabled_()){
    return json_({ok:false, error:'telegram_not_configured', hint:'Isi Telegram Bot Token di Config'});
  }

  const now = new Date();
  const when = fmtDate_(now) + ' ' + fmtTime_(now);

  // optional: batasi ke mess tertentu
  const messName = (body && body.mess_name) ? String(body.mess_name).trim() : '';

  // kumpulkan target
  const adminIds = tgAdmins_();               // semua role=admin yang punya telegram_id
  const userIds  = tgUsers_();                // semua role=user  yang punya telegram_id
  const messIds  = messName ? getTgIdsByMess_(messName) : []; // semua role=mess untuk mess tsb

  // gabungkan & de-dupe
  const targets = Array.from(new Set([ ...adminIds, ...userIds, ...messIds ]));

  // pesan uji
  const title = '🔔 *Tes Notifikasi*';
  const lines = [
    title,
    'Sumber : Aplikasi Mess Kebun',
    'Waktu  : ' + when
  ];
  if(messName){ lines.push('Mess   : ' + messName + ' (khusus role mess terkait)'); }

  const msg = lines.join('\n');

  // kirim
  targets.forEach(id => tgSendTo_(id, msg));

  return json_({
    ok: true,
    sent_count: targets.length,
    recipients: {
      admins: adminIds,
      users: userIds,
      mess: { mess_name: messName, ids: messIds }
    }
  });
}


