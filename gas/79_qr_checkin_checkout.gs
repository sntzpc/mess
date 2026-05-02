/*************** QR CHECK-IN / CHECK-OUT MANDIRI ***************/
function qrStatus_(v){
  return String(v || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
}
function qrIsPrintableStatus_(s){
  s = qrStatus_(s);
  return s === 'approved' || s === 'checkedin' || s === 'checkedout';
}
function qrIsActivePrintStatus_(s){
  s = qrStatus_(s);
  return s === 'approved' || s === 'checkedin';
}
function qrMakeToken_(guestId){
  return signToken_({ type:'guest_qr', guest_id:String(guestId || ''), exp: Date.now() + (3650 * 24 * 60 * 60 * 1000) });
}
function qrVerifyToken_(token){
  var ver = verifyToken_(String(token || ''));
  if(!ver.ok) return {ok:false, error:'qr_invalid', reason:ver.reason};
  if(ver.payload.type !== 'guest_qr' || !ver.payload.guest_id) return {ok:false, error:'qr_invalid_type'};
  return {ok:true, guest_id:ver.payload.guest_id};
}
function qrDmyToDate_(s){
  s = toWibDateString_(s);
  var m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return new Date(0);
  return new Date(+m[3], +m[2]-1, +m[1]);
}
function qrNightsText_(cin, cout){
  var a = qrDmyToDate_(cin);
  var b = qrDmyToDate_(cout);
  if(isNaN(a.getTime()) || isNaN(b.getTime())) return '';
  var nights = Math.round((b.getTime() - a.getTime()) / (24*60*60*1000));
  if(nights < 0) nights = 0;
  return nights + ' malam';
}
function qrFindReservation_(reservationId){
  var vals = sheet('Reservations').getDataRange().getValues();
  for(var i=1;i<vals.length;i++){
    if(vals[i][0] === reservationId) return vals[i];
  }
  return null;
}
function qrFindGuestRow_(guestId){
  var sh = sheet('Guests');
  var vals = sh.getDataRange().getValues();
  for(var i=1;i<vals.length;i++){
    if(vals[i][0] === guestId) return { sheet:sh, rowIndex:i+1, row:vals[i] };
  }
  return null;
}
function qrLatestStay_(guestId){
  var vals = sheet('Stays').getDataRange().getValues();
  var latest = null;
  for(var i=1;i<vals.length;i++){
    if(vals[i][1] === guestId){ latest = vals[i]; }
  }
  if(!latest) return null;
  return {
    id: latest[0], guest_id: latest[1], mess: latest[2], room: latest[3],
    checkin_date: toWibDateString_(latest[4]), checkin_time: toWibTimeString_(latest[5]),
    checkout_date: toWibDateString_(latest[6]), checkout_time: toWibTimeString_(latest[7])
  };
}
function qrBuildGuestDetail_(guestRow){
  var g = guestRow;
  var res = qrFindReservation_(g[1]);
  var stay = qrLatestStay_(g[0]);
  var cin = res ? toWibDateString_(res[6]) : '';
  var cout = res ? toWibDateString_(res[7]) : '';
  var mess = String(g[6] || (res ? res[5] : '') || '').trim();
  var room = String(g[7] || '').trim();
  return {
    id: g[0], reservation_id: g[1],
    name: String(g[2] || '').trim(), unit: String(g[3] || '').trim(), title: String(g[4] || '').trim(), gender: String(g[5] || '').trim(),
    mess: mess, room: room, status: qrStatus_(g[8]),
    agenda: res ? String(res[4] || '').trim() : '',
    checkin_plan: cin, checkout_plan: cout, lama_menginap: qrNightsText_(cin, cout),
    checkin_date: stay ? stay.checkin_date : '', checkin_time: stay ? stay.checkin_time : '',
    checkout_date: stay ? stay.checkout_date : '', checkout_time: stay ? stay.checkout_time : ''
  };
}
function qrCanAccessMess_(user, mess){
  if(user.role === 'admin') return true;
  if(user.role === 'mess') return String(user.mess || '').trim() === String(mess || '').trim();
  return false;
}

function qrAgendas_(user, body){
  if(user.role !== 'admin' && user.role !== 'mess') return json_({ok:false, error:'forbidden'});
  var rvals = sheet('Reservations').getDataRange().getValues().slice(1);
  var gvals = sheet('Guests').getDataRange().getValues().slice(1);
  var rmap = {};
  rvals.forEach(function(r){ rmap[r[0]] = r; });
  var map = {};
  var messSet = {};

  for(var i=0;i<gvals.length;i++){
    var g = gvals[i];
    if(!qrIsActivePrintStatus_(g[8])) continue;
    var res = rmap[g[1]];
    if(!res) continue;
    var mess = String(g[6] || res[5] || '').trim();
    var room = String(g[7] || '').trim();
    if(!mess || !room) continue;
    if(!qrCanAccessMess_(user, mess)) continue;
    var agenda = String(res[4] || '').trim();
    if(!agenda) continue;
    var cin = toWibDateString_(res[6]);
    var cout = toWibDateString_(res[7]);
    if(!map[agenda]) map[agenda] = { agenda:agenda, checkin_plan:cin, checkout_plan:cout, period:cin+' ➜ '+cout, count:0, rooms:{}, mess:{} };
    map[agenda].count++;
    map[agenda].rooms[mess+'|'+room] = true;
    map[agenda].mess[mess] = true;
    messSet[mess] = true;
  }
  var agendas = Object.keys(map).map(function(k){
    var x = map[k];
    return { agenda:x.agenda, checkin_plan:x.checkin_plan, checkout_plan:x.checkout_plan, period:x.period, count:x.count, room_count:Object.keys(x.rooms).length, mess_count:Object.keys(x.mess).length };
  }).sort(function(a,b){
    return qrDmyToDate_(b.checkin_plan) - qrDmyToDate_(a.checkin_plan) || String(a.agenda).localeCompare(String(b.agenda), 'id');
  });
  return json_({ok:true, agendas:agendas, mess:Object.keys(messSet).sort()});
}

function qrList_(user, body){
  if(user.role !== 'admin' && user.role !== 'mess') return json_({ok:false, error:'forbidden'});
  var agendaFilter = String(body.agenda || '').trim();
  var messFilter = String(body.mess_name || '').trim();
  var appUrl = String(body.app_url || '').trim();
  if(!agendaFilter) return json_({ok:false, error:'agenda_required'});
  if(user.role === 'mess') messFilter = String(user.mess || '').trim();

  var rvals = sheet('Reservations').getDataRange().getValues().slice(1);
  var gvals = sheet('Guests').getDataRange().getValues().slice(1);
  var rmap = {};
  rvals.forEach(function(r){ rmap[r[0]] = r; });
  var rows = [];

  for(var i=0;i<gvals.length;i++){
    var g = gvals[i];
    if(!qrIsActivePrintStatus_(g[8])) continue;
    var res = rmap[g[1]];
    if(!res) continue;
    var agenda = String(res[4] || '').trim();
    if(agenda !== agendaFilter) continue;
    var mess = String(g[6] || res[5] || '').trim();
    var room = String(g[7] || '').trim();
    if(!mess || !room) continue;
    if(messFilter && mess !== messFilter) continue;
    if(!qrCanAccessMess_(user, mess)) continue;
    var token = qrMakeToken_(g[0]);
    var cin = toWibDateString_(res[6]);
    var cout = toWibDateString_(res[7]);
    var url = appUrl ? (appUrl + (appUrl.indexOf('?') >= 0 ? '&' : '?') + 'qr=' + encodeURIComponent(token)) : '';
    rows.push({
      id:g[0], name:String(g[2] || '').trim(), unit:String(g[3] || '').trim(), title:String(g[4] || '').trim(), gender:String(g[5] || '').trim(),
      mess:mess, room:room, status:qrStatus_(g[8]), agenda:agenda,
      checkin_plan:cin, checkout_plan:cout, lama_menginap:qrNightsText_(cin, cout),
      qr_token:token, qr_url:url
    });
  }
  rows.sort(function(a,b){
    var m = String(a.mess).localeCompare(String(b.mess), 'id', {numeric:true, sensitivity:'base'}); if(m) return m;
    var r = String(a.room).localeCompare(String(b.room), 'id', {numeric:true, sensitivity:'base'}); if(r) return r;
    return String(a.name).localeCompare(String(b.name), 'id', {sensitivity:'base'});
  });
  return json_({ok:true, rows:rows, summary:{agenda:agendaFilter, mess:messFilter, guest_count:rows.length}});
}

function qrLookupPublic_(body){
  var chk = qrVerifyToken_(body.qr_token || body.token || '');
  if(!chk.ok) return json_({ok:false, error:chk.error, reason:chk.reason || ''});
  var found = qrFindGuestRow_(chk.guest_id);
  if(!found) return json_({ok:false, error:'guest_not_found'});
  var detail = qrBuildGuestDetail_(found.row);
  if(!qrIsPrintableStatus_(detail.status)) return json_({ok:false, error:'guest_status_not_allowed', status:detail.status});
  return json_({ok:true, guest:detail});
}

function qrActionPublic_(body){
  var mode = qrStatus_(body.mode || '');
  if(mode !== 'checkin' && mode !== 'checkout') return json_({ok:false, error:'mode_invalid'});
  var chk = qrVerifyToken_(body.qr_token || body.token || '');
  if(!chk.ok) return json_({ok:false, error:chk.error, reason:chk.reason || ''});

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    var found = qrFindGuestRow_(chk.guest_id);
    if(!found) return json_({ok:false, error:'guest_not_found'});
    var g = found.row;
    var status = qrStatus_(g[8]);
    var now = new Date();

    if(mode === 'checkin'){
      if(status === 'checkedin') return json_({ok:true, already:true, guest:qrBuildGuestDetail_(g)});
      if(status === 'checkedout') return json_({ok:false, error:'already_checkedout', guest:qrBuildGuestDetail_(g)});
      if(status !== 'approved') return json_({ok:false, error:'not_approved', status:status});
      found.sheet.getRange(found.rowIndex, 9).setValue('checkedin');
      sheet('Stays').appendRow([genId_(), g[0], g[6], g[7], fmtDate_(now), fmtTime_(now), '', '']);
      g[8] = 'checkedin';
      if(tgEnabled_()){
        var gi = { name:g[2], unit:g[3], title:g[4], gender:g[5], mess_alloc:g[6], room_alloc:g[7] };
        var msgIn = '🟢 *QR Check-In Mandiri*\n' + fmtGuestLine_(gi) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
        tgBroadcast_(tgAdmins_(), msgIn); tgBroadcast_(tgUsers_(), msgIn); tgBroadcast_(getTgIdsByMess_(g[6]), msgIn);
      }
      return json_({ok:true, guest:qrBuildGuestDetail_(g)});
    }

    if(mode === 'checkout'){
      if(status === 'checkedout') return json_({ok:true, already:true, guest:qrBuildGuestDetail_(g)});
      if(status !== 'checkedin') return json_({ok:false, error:'not_checkedin', status:status});
      found.sheet.getRange(found.rowIndex, 9).setValue('checkedout');
      var ssh = sheet('Stays');
      var svals = ssh.getDataRange().getValues();
      var updated = false;
      for(var i=svals.length-1; i>=1; i--){
        if(svals[i][1] === g[0] && !svals[i][6]){
          ssh.getRange(i+1, 7).setValue(fmtDate_(now));
          ssh.getRange(i+1, 8).setValue(fmtTime_(now));
          updated = true;
          break;
        }
      }
      if(!updated){
        ssh.appendRow([genId_(), g[0], g[6], g[7], '', '', fmtDate_(now), fmtTime_(now)]);
      }
      g[8] = 'checkedout';
      if(tgEnabled_()){
        var go = { name:g[2], unit:g[3], title:g[4], gender:g[5], mess_alloc:g[6], room_alloc:g[7] };
        var msgOut = '🔵 *QR Check-Out Mandiri*\n' + fmtGuestLine_(go) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
        tgBroadcast_(tgAdmins_(), msgOut); tgBroadcast_(tgUsers_(), msgOut); tgBroadcast_(getTgIdsByMess_(g[6]), msgOut);
      }
      return json_({ok:true, guest:qrBuildGuestDetail_(g)});
    }
  }finally{
    lock.releaseLock();
  }
}
