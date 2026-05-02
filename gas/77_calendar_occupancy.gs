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
  var afterLast = new Date(y, m, 1, 12, 0, 0);
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

  var guestMap = {};
  for(var gm=1; gm<guestVals.length; gm++){
    var gmv = guestVals[gm];
    var gidm = String(gmv[0] || '').trim();
    if(!gidm) continue;
    var ridm = String(gmv[1] || '').trim();
    var resm = resMap[ridm] || [];
    guestMap[gidm] = {
      guest_id: gidm,
      reservation_id: ridm,
      name: String(gmv[2] || '').trim(),
      unit: String(gmv[3] || '').trim(),
      title: String(gmv[4] || '').trim(),
      gender: String(gmv[5] || '').trim(),
      mess_alloc: String(gmv[6] || resm[5] || '').trim(),
      room_alloc: String(gmv[7] || '').trim(),
      status: calNormalizeGuestStatus_(gmv[8]),
      agenda: String(resm[4] || '').trim(),
      plan_checkin: toWibDateString_(resm[6]),
      plan_checkout: toWibDateString_(resm[7])
    };
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
      checkin_details: [],
      checkout_details: [],
      room_usage: {}
    };
    rooms.forEach(function(room){
      dayMap[ymd].room_usage[room.key] = { mess: room.mess, room: room.room, capacity: room.capacity, used: 0, guests: [], agendas: {}, guestKeys: {} };
    });
  }

  var checkinsToday = [];
  var checkoutsToday = [];
  var pendingUnallocated = [];

  function dateInMonth_(d){ return d && d.getTime() >= first.getTime() && d.getTime() <= last.getTime(); }
  function addAgenda_(ymd, agenda, cinDmy, coutDmy, source){
    if(!agenda || !dayMap[ymd]) return;
    var arr = dayMap[ymd].agendas;
    var exists = false;
    for(var i=0; i<arr.length; i++){
      if(arr[i].agenda === agenda && arr[i].checkin_plan === cinDmy && arr[i].checkout_plan === coutDmy){ exists = true; break; }
    }
    if(!exists) arr.push({agenda:agenda, checkin_plan:cinDmy, checkout_plan:coutDmy, source:source || 'plan'});
  }
  function addOccupancyRange_(guest, messName, roomName, cinDmy, coutDmy, source){
    var cin = calDmyToDate_(cinDmy);
    var cout = calDmyToDate_(coutDmy);
    if(!cin || !cout) return;
    var key = String(messName || '').trim() + '||' + String(roomName || '').trim();
    if(!roomByKey[key]) return;

    // Okupansi mengikuti malam menginap: tanggal check-in masuk, tanggal check-out tidak dihitung sebagai malam menginap.
    for(var dd=new Date(cin); dd.getTime()<cout.getTime(); dd.setDate(dd.getDate()+1)){
      if(dd.getTime() < first.getTime() || dd.getTime() > last.getTime()) continue;
      var ymd2 = calDateToYmd_(dd);
      var day = dayMap[ymd2];
      if(!day || !day.room_usage[key]) continue;
      var uniqueKey = (guest.guest_id || guest.name || '') + '||' + source;
      if(day.room_usage[key].guestKeys[uniqueKey]) continue;
      day.room_usage[key].guestKeys[uniqueKey] = true;
      day.room_usage[key].used += 1;
      day.room_usage[key].guests.push({
        guest_id: guest.guest_id || '',
        name: guest.name || '',
        unit: guest.unit || '',
        title: guest.title || '',
        gender: guest.gender || '',
        agenda: guest.agenda || '',
        checkin_plan: guest.plan_checkin || cinDmy,
        checkout_plan: guest.plan_checkout || coutDmy,
        checkin_actual: source === 'actual' ? cinDmy : '',
        checkout_actual: source === 'actual' ? coutDmy : '',
        status: guest.status || '',
        source: source || 'plan'
      });
      if(guest.agenda) day.room_usage[key].agendas[guest.agenda] = true;
    }

    // Agenda tetap ditampilkan sampai tanggal checkout agar admin tahu ada jadwal keluar pada hari itu.
    for(var ad=new Date(cin); ad.getTime()<=cout.getTime(); ad.setDate(ad.getDate()+1)){
      if(ad.getTime() < first.getTime() || ad.getTime() > last.getTime()) continue;
      addAgenda_(calDateToYmd_(ad), guest.agenda, cinDmy, coutDmy, source);
    }
  }
  function addDayEvent_(ymd, field, guest, messName, roomName, source){
    if(!dayMap[ymd]) return;
    dayMap[ymd][field] = Number(dayMap[ymd][field] || 0) + 1;
    var arrName = field === 'checkins' ? 'checkin_details' : 'checkout_details';
    dayMap[ymd][arrName].push({
      guest_id: guest.guest_id || '',
      name: guest.name || '',
      unit: guest.unit || '',
      title: guest.title || '',
      agenda: guest.agenda || '',
      mess: messName || guest.mess_alloc || '',
      room: roomName || guest.room_alloc || '',
      source: source || 'plan',
      status: guest.status || ''
    });
  }
  function pushToday_(list, guest, messName, roomName, statusOverride){
    list.push({
      guest_id: guest.guest_id || '',
      name: guest.name || '',
      unit: guest.unit || '',
      title: guest.title || '',
      agenda: guest.agenda || '',
      mess: messName || guest.mess_alloc || '',
      room: roomName || guest.room_alloc || '',
      status: statusOverride || guest.status || ''
    });
  }

  var actualStayGuestIds = {};

  // 1) Rencana/okupansi aktif dari Reservations + Guests.
  //    Tamu checkedout tidak dihitung sebagai rencana aktif. Nanti tetap dimasukkan sebagai histori
  //    dari Stays atau fallback dari Guests + Reservations jika Stays belum lengkap.
  Object.keys(guestMap).forEach(function(gid){
    var guest = guestMap[gid];
    if(guest.status === 'deleted' || guest.status === 'rejected' || guest.status === 'checkedout') return;
    if(messFilter && guest.mess_alloc && guest.mess_alloc !== messFilter) return;

    var ciYmd = calDmyToYmd_(guest.plan_checkin);
    var coYmd = calDmyToYmd_(guest.plan_checkout);
    if(ciYmd) addDayEvent_(ciYmd, 'checkins', guest, guest.mess_alloc, guest.room_alloc, 'plan');
    if(coYmd) addDayEvent_(coYmd, 'checkouts', guest, guest.mess_alloc, guest.room_alloc, 'plan');
    if(ciYmd === todayYmd) pushToday_(checkinsToday, guest, guest.mess_alloc, guest.room_alloc, guest.status);
    if(coYmd === todayYmd) pushToday_(checkoutsToday, guest, guest.mess_alloc, guest.room_alloc, guest.status);

    if(!guest.mess_alloc || !guest.room_alloc){
      if(guest.status === 'pending' || guest.status === 'submitted'){
        pendingUnallocated.push({guest_id:guest.guest_id, name:guest.name, agenda:guest.agenda, checkin_plan:guest.plan_checkin, checkout_plan:guest.plan_checkout});
      }
      return;
    }
    addOccupancyRange_(guest, guest.mess_alloc, guest.room_alloc, guest.plan_checkin, guest.plan_checkout, 'plan');
  });

  // 2) Histori/realisasi menginap dari sheet Stays.
  //    Ini membuat tanggal yang sudah lewat tetap menampilkan siapa saja yang benar-benar pernah menginap.
  for(var st=1; st<stayVals.length; st++){
    var sv = stayVals[st];
    var stayGuestId = String(sv[1] || '').trim();
    var guest = guestMap[stayGuestId] || {guest_id:stayGuestId, name:'', unit:'', title:'', gender:'', status:'', agenda:''};
    if(guest.status === 'deleted' || guest.status === 'rejected') continue;

    var stayMess = String(sv[2] || guest.mess_alloc || '').trim();
    var stayRoom = String(sv[3] || guest.room_alloc || '').trim();
    if(messFilter && stayMess !== messFilter) continue;
    if(!stayMess || !stayRoom) continue;

    var actualIn = toWibDateString_(sv[4]);
    var actualOut = toWibDateString_(sv[6]);
    var actualInDate = calDmyToDate_(actualIn);
    var actualOutDate = calDmyToDate_(actualOut);

    // Stay yang belum checkout dibiarkan dihitung dari rencana aktif agar tidak dobel.
    // Jika tidak ada checkout namun rencana checkout sudah tersedia, rencana aktif di atas tetap menutup kebutuhan tampilan hari berjalan.
    if(!actualInDate) continue;
    if(!actualOutDate) continue;

    actualStayGuestIds[stayGuestId] = true;

    var actualInYmd = calDmyToYmd_(actualIn);
    var actualOutYmd = calDmyToYmd_(actualOut);
    addDayEvent_(actualInYmd, 'checkins', guest, stayMess, stayRoom, 'actual');
    addDayEvent_(actualOutYmd, 'checkouts', guest, stayMess, stayRoom, 'actual');
    if(actualInYmd === todayYmd) pushToday_(checkinsToday, guest, stayMess, stayRoom, 'checkedin');
    if(actualOutYmd === todayYmd) pushToday_(checkoutsToday, guest, stayMess, stayRoom, 'checkedout');

    addOccupancyRange_(guest, stayMess, stayRoom, actualIn, actualOut, 'actual');
  }

  // 3) Fallback histori dari sheet Guests + Reservations.
  //    Penting untuk data lama: beberapa tamu sudah berstatus checkedout di Guests,
  //    tetapi tidak memiliki baris Stays yang lengkap. Jika tidak dimasukkan dari sini,
  //    kalender tanggal yang sudah lewat akan terlihat kosong.
  Object.keys(guestMap).forEach(function(gid){
    var guest = guestMap[gid];
    if(guest.status !== 'checkedout') return;
    if(actualStayGuestIds[gid]) return;
    if(guest.status === 'deleted' || guest.status === 'rejected') return;
    if(messFilter && guest.mess_alloc && guest.mess_alloc !== messFilter) return;
    if(!guest.mess_alloc || !guest.room_alloc) return;
    if(!guest.plan_checkin || !guest.plan_checkout) return;

    var ciYmd2 = calDmyToYmd_(guest.plan_checkin);
    var coYmd2 = calDmyToYmd_(guest.plan_checkout);
    addDayEvent_(ciYmd2, 'checkins', guest, guest.mess_alloc, guest.room_alloc, 'actual');
    addDayEvent_(coYmd2, 'checkouts', guest, guest.mess_alloc, guest.room_alloc, 'actual');
    if(ciYmd2 === todayYmd) pushToday_(checkinsToday, guest, guest.mess_alloc, guest.room_alloc, 'checkedout');
    if(coYmd2 === todayYmd) pushToday_(checkoutsToday, guest, guest.mess_alloc, guest.room_alloc, 'checkedout');

    addOccupancyRange_(guest, guest.mess_alloc, guest.room_alloc, guest.plan_checkin, guest.plan_checkout, 'actual');
  });

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
      delete u.guestKeys;
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
    day.occupancy_rate = day.total_capacity > 0 ? Math.round((usedCapacity / day.total_capacity) * 100) : 0;
    if(day.occupancy_rate > peakRate) peakRate = day.occupancy_rate;
    if(day.full_rooms > 0) fullDayCount++;
    day.agendas.sort(function(a,b){ return String(a.agenda).localeCompare(String(b.agenda), 'id'); });
  });

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
    delete d.room_usage;
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

function calNormalizeGuestStatus_(v){
  var s = String(v || '').trim().toLowerCase();
  var compact = s.replace(/[\s_\-]+/g, '');
  if(compact === 'checkout' || compact === 'checkedout' || compact === 'sudahcheckout') return 'checkedout';
  if(compact === 'checkin' || compact === 'checkedin' || compact === 'sudahcheckin') return 'checkedin';
  return compact || s;
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
