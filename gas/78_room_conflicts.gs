/*************** DETEKSI BENTROK KAMAR OTOMATIS ***************/
function conflictCheck_(user, body){
  body = body || {};
  var data = conflictCheckData_(user, body);
  return json_(data);
}

function conflictCheckData_(user, body){
  body = body || {};
  var guestId = String(body.guest_id || '').trim();
  var targetMess = String(body.mess_alloc || body.mess || '').trim();
  var targetRoom = String(body.room_alloc || body.room || '').trim();

  if(!guestId) return {ok:false, error:'guest_id_required'};

  var guestVals = sheet('Guests').getDataRange().getValues();
  var resVals = sheet('Reservations').getDataRange().getValues();
  var roomVals = sheet('Rooms').getDataRange().getValues();
  var stayVals = sheet('Stays').getDataRange().getValues();

  var resMap = {};
  for(var r=1; r<resVals.length; r++){
    resMap[String(resVals[r][0] || '').trim()] = resVals[r];
  }

  var target = null;
  for(var i=1; i<guestVals.length; i++){
    if(String(guestVals[i][0] || '').trim() === guestId){ target = guestVals[i]; break; }
  }
  if(!target) return {ok:false, error:'guest_not_found'};

  var targetRes = resMap[String(target[1] || '').trim()] || [];
  targetMess = targetMess || String(target[6] || targetRes[5] || '').trim();
  targetRoom = targetRoom || String(target[7] || '').trim();

  if(user && user.role === 'mess'){
    var myMess = String(user.mess || '').trim();
    if(myMess && targetMess && targetMess !== myMess) return {ok:false, error:'forbidden_mess'};
  }

  var targetInDmy = toWibDateString_(targetRes[6]);
  var targetOutDmy = toWibDateString_(targetRes[7]);
  var targetIn = conflictDmyToDate_(targetInDmy);
  var targetOut = conflictDmyToDate_(targetOutDmy);

  var warnings = [];
  var dangers = [];
  var occupants = [];
  var sameGuestActive = [];
  var agendaConflicts = [];
  var roomCapacity = conflictFindRoomCapacity_(roomVals, targetMess, targetRoom);

  if(!targetMess) warnings.push('Mess belum dipilih.');
  if(!targetRoom) warnings.push('Nomor kamar belum dipilih.');
  if(!targetIn || !targetOut) warnings.push('Tanggal rencana check-in/check-out belum valid.');
  if(targetIn && targetOut && targetOut.getTime() <= targetIn.getTime()) dangers.push('Tanggal checkout harus lebih besar dari tanggal check-in.');

  if(!targetMess || !targetRoom || !targetIn || !targetOut){
    return conflictBuildResult_(warnings, dangers, occupants, sameGuestActive, agendaConflicts, roomCapacity, targetInDmy, targetOutDmy);
  }

  if(roomCapacity <= 0){
    warnings.push('Kapasitas kamar belum diisi atau bernilai 0 pada master kamar.');
  }

  var targetNameKey = conflictNormName_(target[2]);
  var targetUnitKey = conflictNormText_(target[3]);
  var targetAgenda = String(targetRes[4] || '').trim();
  var targetRid = String(target[1] || '').trim();

  // 1) Cek data tamu lain pada sheet Guests + Reservations.
  for(var g=1; g<guestVals.length; g++){
    var row = guestVals[g];
    var otherGuestId = String(row[0] || '').trim();
    if(!otherGuestId || otherGuestId === guestId) continue;

    var status = conflictNormalizeStatus_(row[8]);
    // Tamu yang sudah checkout hanya menjadi histori, bukan occupant aktif/rencana.
    // Jangan dihitung sebagai bentrok kapasitas untuk approval berikutnya.
    if(status === 'deleted' || status === 'rejected' || status === 'checkedout' || status === 'noshow') continue;

    var rid = String(row[1] || '').trim();
    var res = resMap[rid] || [];
    var oMess = String(row[6] || res[5] || '').trim();
    var oRoom = String(row[7] || '').trim();
    var oAgenda = String(res[4] || '').trim();
    var oInDmy = toWibDateString_(res[6]);
    var oOutDmy = toWibDateString_(res[7]);
    var oIn = conflictDmyToDate_(oInDmy);
    var oOut = conflictDmyToDate_(oOutDmy);
    if(!oIn || !oOut) continue;
    if(!conflictOverlapNights_(targetIn, targetOut, oIn, oOut)) continue;

    // Tamu sama punya reservasi aktif lain pada tanggal overlap.
    var sameName = targetNameKey && conflictNormName_(row[2]) === targetNameKey;
    var sameUnit = !targetUnitKey || !conflictNormText_(row[3]) || conflictNormText_(row[3]) === targetUnitKey;
    var activeLike = (status === 'pending' || status === 'submitted' || status === 'approved' || status === 'partiallyapproved' || status === 'checkedin');
    if(sameName && sameUnit && activeLike){
      sameGuestActive.push({
        guest_id: otherGuestId,
        name: String(row[2] || '').trim(),
        unit: String(row[3] || '').trim(),
        title: String(row[4] || '').trim(),
        agenda: oAgenda,
        mess: oMess,
        room: oRoom,
        checkin_plan: oInDmy,
        checkout_plan: oOutDmy,
        status: status
      });
    }

    // Room occupancy pada kamar yang sama.
    if(oMess === targetMess && oRoom === targetRoom){
      occupants.push({
        source: status === 'checkedout' ? 'history' : 'plan',
        guest_id: otherGuestId,
        name: String(row[2] || '').trim(),
        unit: String(row[3] || '').trim(),
        title: String(row[4] || '').trim(),
        agenda: oAgenda,
        mess: oMess,
        room: oRoom,
        checkin_plan: oInDmy,
        checkout_plan: oOutDmy,
        status: status
      });
      if(oAgenda && targetAgenda && oAgenda !== targetAgenda){
        agendaConflicts.push({agenda:oAgenda, name:String(row[2] || '').trim(), checkin_plan:oInDmy, checkout_plan:oOutDmy});
      }
    }
  }

  // 2) Cek Stays aktif yang belum checkout, untuk menjaga kondisi real-time.
  for(var s=1; s<stayVals.length; s++){
    var st = stayVals[s];
    var stGuestId = String(st[1] || '').trim();
    if(!stGuestId || stGuestId === guestId) continue;
    var stMess = String(st[2] || '').trim();
    var stRoom = String(st[3] || '').trim();
    if(stMess !== targetMess || stRoom !== targetRoom) continue;

    var stInDmy = toWibDateString_(st[4]);
    var stOutDmy = toWibDateString_(st[6]);
    var stIn = conflictDmyToDate_(stInDmy);
    var stOut = stOutDmy ? conflictDmyToDate_(stOutDmy) : targetOut;
    if(!stIn || !stOut) continue;
    if(!conflictOverlapNights_(targetIn, targetOut, stIn, stOut)) continue;

    // Jika tamu ini sudah tercatat dari Guests, jangan dobel.
    var exists = occupants.some(function(o){ return o.guest_id === stGuestId; });
    if(exists) continue;

    var gm = conflictFindGuest_(guestVals, stGuestId);
    var gmStatus = gm ? conflictNormalizeStatus_(gm[8]) : '';
    // Pengaman tambahan: jika status Guests sudah checkedout/noshow tetapi baris Stays lama belum sempat
    // terisi checkout_date, tetap jangan dihitung sebagai okupansi aktif.
    if(gmStatus === 'checkedout' || gmStatus === 'noshow' || gmStatus === 'deleted' || gmStatus === 'rejected') continue;

    var gmRes = gm ? (resMap[String(gm[1] || '').trim()] || []) : [];
    occupants.push({
      source: 'actual',
      guest_id: stGuestId,
      name: gm ? String(gm[2] || '').trim() : '',
      unit: gm ? String(gm[3] || '').trim() : '',
      title: gm ? String(gm[4] || '').trim() : '',
      agenda: String(gmRes[4] || '').trim(),
      mess: stMess,
      room: stRoom,
      checkin_plan: toWibDateString_(gmRes[6]) || stInDmy,
      checkout_plan: toWibDateString_(gmRes[7]) || stOutDmy,
      checkin_actual: stInDmy,
      checkout_actual: stOutDmy,
      status: 'checkedin'
    });
  }

  var projectedUsed = occupants.length + 1;

  // KEBIJAKAN KONFLIK KAMAR BERBASIS KAPASITAS:
  // - Kamar boleh dipakai bersama selama jumlah tamu pada rentang tanggal belum melebihi kapasitas.
  // - Tamu yang sudah checkedout/noshow sudah dikeluarkan dari occupants di atas, sehingga tidak lagi
  //   mengunci kamar walaupun rencana checkout awalnya masih lama.
  // - Perbedaan agenda pada kamar yang sama hanya menjadi informasi detail, BUKAN konflik, selama kapasitas cukup.
  // - Konflik/danger baru muncul ketika projectedUsed > roomCapacity.
  if(roomCapacity > 0 && projectedUsed > roomCapacity){
    dangers.push('Kapasitas kamar penuh/terlampaui. Kapasitas '+roomCapacity+', sudah terpakai '+occupants.length+', jika ditambahkan menjadi '+projectedUsed+'. Silakan tambah kapasitas kamar di halaman Pengaturan/Master Kamar jika tetap ingin menambah tamu pada kamar ini.');
  }
  if(sameGuestActive.length > 0){
    dangers.push('Tamu yang sama sudah memiliki reservasi aktif pada tanggal yang bertabrakan.');
  }

  return conflictBuildResult_(warnings, dangers, occupants, sameGuestActive, agendaConflicts, roomCapacity, targetInDmy, targetOutDmy);
}

function conflictBuildResult_(warnings, dangers, occupants, sameGuestActive, agendaConflicts, capacity, checkinDmy, checkoutDmy){
  warnings = warnings || [];
  dangers = dangers || [];
  return {
    ok: true,
    has_conflict: warnings.length > 0 || dangers.length > 0,
    severity: dangers.length > 0 ? 'danger' : (warnings.length > 0 ? 'warning' : 'safe'),
    can_continue: dangers.length === 0,
    warnings: warnings,
    dangers: dangers,
    room_capacity: Number(capacity || 0),
    occupied_count: occupants.length,
    projected_used: occupants.length + 1,
    checkin_plan: checkinDmy || '',
    checkout_plan: checkoutDmy || '',
    occupants: occupants,
    same_guest_active: sameGuestActive,
    agenda_conflicts: agendaConflicts
  };
}

function conflictFindRoomCapacity_(roomVals, mess, room){
  mess = String(mess || '').trim();
  room = String(room || '').trim();
  for(var i=1; i<roomVals.length; i++){
    var rMess = String(roomVals[i][1] || '').trim();
    var rRoom = String(roomVals[i][2] || '').trim();
    if(rMess === mess && rRoom === room) return Number(roomVals[i][3] || 0);
  }
  return 0;
}
function conflictFindGuest_(guestVals, guestId){
  for(var i=1; i<guestVals.length; i++){
    if(String(guestVals[i][0] || '').trim() === String(guestId || '').trim()) return guestVals[i];
  }
  return null;
}
function conflictNormalizeStatus_(v){
  var s = String(v || '').trim().toLowerCase();
  var compact = s.replace(/[\s_\-]+/g, '');
  if(compact === 'partiallyapproved') return 'partiallyapproved';
  if(compact === 'checkedout' || compact === 'checkout' || compact === 'sudahcheckout') return 'checkedout';
  if(compact === 'noshow' || compact === 'no_show' || compact === 'tidakhadir' || compact === 'batalmenginap') return 'noshow';
  if(compact === 'checkedin' || compact === 'checkin' || compact === 'sudahcheckin') return 'checkedin';
  return compact || s;
}
function conflictNormName_(v){ return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function conflictNormText_(v){ return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function conflictDmyToDate_(dmy){
  var d = toWibDateString_(dmy);
  var m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), 12, 0, 0);
}
function conflictOverlapNights_(startA, endA, startB, endB){
  if(!startA || !endA || !startB || !endB) return false;
  // Model hotel: checkout tidak dihitung sebagai malam menginap.
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}
