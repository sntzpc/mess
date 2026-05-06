/*************** ROOMS (dinamis dari Stays) ***************/
function roomsList_(user, body){
  var messFilter = (body && body.mess_name ? String(body.mess_name).trim() : '');
  var messFilterLc = messFilter.toLowerCase();
  var dateFromStr = (body && body.date_from ? String(body.date_from).trim() : '');
  var dateToStr   = (body && body.date_to   ? String(body.date_to).trim()   : '');

  // --- helper parse tanggal ---
  function parseDMY_(s){
    var m = toWibDateString_(s);
    if(!m) return null;
    // dd/MM/yyyy
    var md = String(m).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(md){
      return new Date(Number(md[3]), Number(md[2])-1, Number(md[1]));
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

      // skip status yang tidak relevan untuk kapasitas kamar.
      // PENTING: tamu yang sudah checkout tidak boleh lagi menahan kapasitas kamar.
      // Sebelumnya status checkedout masih ikut dihitung pada occPlanned sehingga
      // dropdown "Pilih No Kamar" tetap disable/penuh walaupun tamu sudah checkout.
      if(gStat==='deleted' || gStat==='rejected' || gStat==='checkedout' || gStat==='checkout' || gStat==='noshow' || gStat==='no_show') continue;

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
    sh.appendRow([genId_(), mess_name, room_name, capacity||0, grade||'', status, nowWibDateTime_(), is_active?1:0]);
    return json_({ok:true});
  }
}
function roomsDel_(user, body){ assertAdmin_(user);
  const sh=sheet('Rooms'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][0]===body.id){ sh.deleteRow(i+1); return json_({ok:true}); } }
  return json_({ok:false, error:'not_found'});
}

