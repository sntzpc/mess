/*************** KALENDER OKUPANSI MESS & KAMAR ***************/
function calendarOverview_(user, body){
  body = body || {};
  var month = String(body.month || '').trim(); // YYYY-MM
  var messFilter = String(body.mess_name || '').trim();
  if(user.role === 'mess') messFilter = String(user.mess || '').trim();
  if(!month){ month = Utilities.formatDate(new Date(), WIB_TZ, 'yyyy-MM'); }
  if(!/^\d{4}-\d{2}$/.test(month)) return json_({ok:false, error:'bad_month'});

  var parts = month.split('-');
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var first = new Date(y, m-1, 1, 12, 0, 0);
  var last = new Date(y, m, 0, 12, 0, 0);
  var todayDmy = nowWibDate_();
  var todayYmd = calDmyToYmd_(todayDmy);

  var roomVals = sheet('Rooms').getDataRange().getValues();
  var resVals = sheet('Reservations').getDataRange().getValues();
  var guestVals = sheet('Guests').getDataRange().getValues();
  var stayVals = sheet('Stays').getDataRange().getValues();

  var rooms = [];
  var roomByKey = {};
  for(var i=1;i<roomVals.length;i++){
    var rr = roomVals[i];
    var isActive = rr.length < 8 ? 1 : rr[7];
    if(isActive === 0 || String(isActive).toLowerCase() === 'false') continue;
    var mess = String(rr[1] || '').trim();
    var room = String(rr[2] || '').trim();
    if(!mess || !room) continue;
    if(messFilter && mess !== messFilter) continue;
    var obj = { mess: mess, room: room, capacity: Number(rr[3] || 0), grade: String(rr[4] || '').trim() };
    obj.key = mess + '||' + room;
    rooms.push(obj);
    roomByKey[obj.key] = obj;
  }
  rooms.sort(function(a,b){
    var x = String(a.mess).localeCompare(String(b.mess), 'id', {numeric:true, sensitivity:'base'});
    if(x) return x;
    return String(a.room).localeCompare(String(b.room), 'id', {numeric:true, sensitivity:'base'});
  });

  var resMap = {};
  for(var r=1;r<resVals.length;r++){
    resMap[String(resVals[r][0] || '')] = resVals[r];
  }

  var stayByGuest = {};
  for(var st=1;st<stayVals.length;st++){
    var sv = stayVals[st];
    var gid = String(sv[1] || '').trim();
    if(!gid) continue;
    if(!stayByGuest[gid]) stayByGuest[gid] = [];
    stayByGuest[gid].push(sv);
  }

  var dayMap = {};
  for(var d=new Date(first); d.getTime()<=last.getTime(); d.setDate(d.getDate()+1)){
    var ymd = calDateToYmd_(d);
    dayMap[ymd] = {
      date: ymd,
      total_rooms: rooms.length,
      total_capacity: calTotalCapacity_(rooms),
      used_capacity: 0,
      occupancy_rate: 0,
      full_rooms: 0,
      full_room_names: [],
      empty_rooms: [],
      empty_rooms_count: 0,
      conflict_count: 0,
      agendas: [],
      checkins: 0,
      checkouts: 0,
      room_usage: {}
    };
    rooms.forEach(function(room){
      dayMap[ymd].room_usage[room.key] = { mess: room.mess, room: room.room, capacity: room.capacity, used: 0, guests: [], agendas: {} };
    });
  }

  var checkinsToday = [];
  var checkoutsToday = [];
  var pendingUnallocated = [];

  for(var g=1;g<guestVals.length;g++){
    var gv = guestVals[g];
    var guestId = String(gv[0] || '').trim();
    var rid = String(gv[1] || '').trim();
    var name = String(gv[2] || '').trim();
    var unit = String(gv[3] || '').trim();
    var title = String(gv[4] || '').trim();
    var messAlloc = String(gv[6] || '').trim();
    var roomAlloc = String(gv[7] || '').trim();
    var status = String(gv[8] || '').trim().toLowerCase();
    if(status === 'deleted' || status === 'rejected' || status === 'checkedout') continue;
    if(messFilter && messAlloc && messAlloc !== messFilter) continue;

    var res = resMap[rid];
    if(!res) continue;
    var agenda = String(res[4] || '').trim();
    var resMess = String(res[5] || '').trim();
    if(!messAlloc) messAlloc = resMess;
    if(messFilter && messAlloc !== messFilter) continue;
    var cinDmy = toWibDateString_(res[6]);
    var coutDmy = toWibDateString_(res[7]);
    var cin = calDmyToDate_(cinDmy);
    var cout = calDmyToDate_(coutDmy);
    if(!cin || !cout) continue;

    if(calDmyToYmd_(cinDmy) === todayYmd){
      checkinsToday.push({guest_id:guestId, name:name, unit:unit, title:title, agenda:agenda, mess:messAlloc, room:roomAlloc, status:status});
    }
    if(calDmyToYmd_(coutDmy) === todayYmd){
      checkoutsToday.push({guest_id:guestId, name:name, unit:unit, title:title, agenda:agenda, mess:messAlloc, room:roomAlloc, status:status});
    }

    if(!messAlloc || !roomAlloc){
      if(status === 'pending' || status === 'submitted'){
        pendingUnallocated.push({guest_id:guestId, name:name, agenda:agenda, checkin_plan:cinDmy, checkout_plan:coutDmy});
      }
      continue;
    }

    var key = messAlloc + '||' + roomAlloc;
    if(!roomByKey[key]) continue;

    // Hitung okupansi kamar berdasarkan malam menginap: check-in termasuk, check-out tidak termasuk.
    for(var dd=new Date(cin); dd.getTime()<cout.getTime(); dd.setDate(dd.getDate()+1)){
      if(dd.getTime() < first.getTime() || dd.getTime() > last.getTime()) continue;
      var ymd2 = calDateToYmd_(dd);
      var day = dayMap[ymd2];
      if(!day || !day.room_usage[key]) continue;
      day.room_usage[key].used += 1;
      day.room_usage[key].guests.push({name:name, unit:unit, title:title, agenda:agenda, checkin_plan:cinDmy, checkout_plan:coutDmy, status:status});
      if(agenda) day.room_usage[key].agendas[agenda] = true;
    }

    // Agenda berjalan ditampilkan sampai tanggal checkout agar admin ingat jadwal keluar.
    for(var ad=new Date(cin); ad.getTime()<=cout.getTime(); ad.setDate(ad.getDate()+1)){
      if(ad.getTime() < first.getTime() || ad.getTime() > last.getTime()) continue;
      var ymdA = calDateToYmd_(ad);
      var dayA = dayMap[ymdA];
      if(dayA){
        var exists = false;
        for(var ea=0; ea<dayA.agendas.length; ea++) if(dayA.agendas[ea].agenda === agenda) exists = true;
        if(!exists) dayA.agendas.push({agenda:agenda, checkin_plan:cinDmy, checkout_plan:coutDmy});
      }
    }
  }

  var conflicts = [];
  var peakRate = 0;
  var fullDayCount = 0;
  Object.keys(dayMap).sort().forEach(function(ymd){
    var day = dayMap[ymd];
    var usedCapacity = 0;
    var fullRooms = [];
    var emptyRooms = [];
    Object.keys(day.room_usage).forEach(function(key){
      var u = day.room_usage[key];
      usedCapacity += u.used;
      if(u.used <= 0) emptyRooms.push(u.mess + ' / ' + u.room);
      if(u.capacity > 0 && u.used >= u.capacity) fullRooms.push(u.mess + ' / ' + u.room);
      if(u.capacity > 0 && u.used > u.capacity){
        day.conflict_count += 1;
        conflicts.push({
          date: calYmdToDmy_(ymd),
          ymd: ymd,
          mess: u.mess,
          room: u.room,
          capacity: u.capacity,
          used: u.used,
          guests: u.guests.map(function(g){ return g && g.name ? g.name : String(g || ''); })
        });
      }
    });
    day.used_capacity = usedCapacity;
    day.empty_rooms = emptyRooms;
    day.empty_rooms_count = emptyRooms.length;
    day.full_rooms = fullRooms.length;
    day.full_room_names = fullRooms;
    day.checkins = checkinsToday.filter(function(x){ return x && false; }).length; // diisi ulang di bawah agar tetap cepat dibaca struktur lama
    day.checkouts = checkoutsToday.filter(function(x){ return x && false; }).length;
    day.occupancy_rate = day.total_capacity > 0 ? Math.round((usedCapacity / day.total_capacity) * 100) : 0;
    if(day.occupancy_rate > peakRate) peakRate = day.occupancy_rate;
    if(day.full_rooms > 0) fullDayCount++;
    day.agendas.sort(function(a,b){ return String(a.agenda).localeCompare(String(b.agenda), 'id'); });
  });

  // Isi jumlah check-in/check-out per hari berdasarkan tanggal rencana.
  for(var gg=1; gg<guestVals.length; gg++){
    var gv2 = guestVals[gg];
    var stat2 = String(gv2[8] || '').trim().toLowerCase();
    if(stat2 === 'deleted' || stat2 === 'rejected' || stat2 === 'checkedout') continue;
    var rid2 = String(gv2[1] || '').trim();
    var res2 = resMap[rid2];
    if(!res2) continue;
    var m2 = String(gv2[6] || res2[5] || '').trim();
    if(messFilter && m2 !== messFilter) continue;
    var ciYmd = calDmyToYmd_(toWibDateString_(res2[6]));
    var coYmd = calDmyToYmd_(toWibDateString_(res2[7]));
    if(dayMap[ciYmd]) dayMap[ciYmd].checkins += 1;
    if(dayMap[coYmd]) dayMap[coYmd].checkouts += 1;
  }

  var days = Object.keys(dayMap).sort().map(function(k){
    var d = dayMap[k];
    d.room_details = Object.keys(d.room_usage).map(function(key){
      var u = d.room_usage[key];
      return {
        mess: u.mess,
        room: u.room,
        capacity: u.capacity,
        used: u.used,
        guests: u.guests,
        agendas: u.agendas
      };
    });
    delete d.room_usage; // struktur internal tidak perlu dikirim lagi
    return d;
  });

  return json_({
    ok:true,
    month: month,
    days: days,
    today: todayDmy,
    today_checkins: checkinsToday,
    today_checkouts: checkoutsToday,
    conflicts: conflicts,
    pending_unallocated: pendingUnallocated,
    summary: {
      mess_name: messFilter,
      total_rooms: rooms.length,
      total_capacity: calTotalCapacity_(rooms),
      peak_occupancy_rate: peakRate,
      full_day_count: fullDayCount,
      conflict_count: conflicts.length,
      pending_unallocated_count: pendingUnallocated.length
    }
  });
}

function calTotalCapacity_(rooms){
  var t = 0;
  rooms.forEach(function(r){ t += Number(r.capacity || 0); });
  return t;
}
function calDateToYmd_(d){
  // Gunakan komponen tanggal lokal dari Date yang memang dibuat sebagai tanggal murni,
  // bukan konversi ISO/UTC, supaya tidak bergeser hari.
  return d.getFullYear() + '-' + ('0' + (d.getMonth()+1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function calYmdToDmy_(ymd){
  var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return toWibDateString_(ymd);
  return m[3] + '/' + m[2] + '/' + m[1];
}
function calDmyToYmd_(dmy){
  var d = toWibDateString_(dmy);
  var m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return '';
  return m[3] + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[1]).slice(-2);
}
function calDmyToDate_(dmy){
  var d = toWibDateString_(dmy);
  var m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), 12, 0, 0);
}
