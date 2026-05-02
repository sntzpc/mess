/*************** CETAK LABEL NAMA TAMU ***************/
function labelAgendas_(user, body){
  var rvals = sheet('Reservations').getDataRange().getValues().slice(1);
  var gvals = sheet('Guests').getDataRange().getValues().slice(1);
  var map = {}; // agenda -> summary
  var messSet = {};

  for(var i=0;i<gvals.length;i++){
    var g = gvals[i];
    var status = String(g[8] || '').trim();
    if(status !== 'approved' && status !== 'checkedin') continue;
    var mess = String(g[6] || '').trim();
    var room = String(g[7] || '').trim();
    if(!mess || !room) continue;
    if(user.role === 'mess' && user.mess && mess !== String(user.mess).trim()) continue;

    var res = null;
    for(var j=0;j<rvals.length;j++){
      if(rvals[j][0] === g[1]){ res = rvals[j]; break; }
    }
    if(!res) continue;
    var agenda = String(res[4] || '').trim();
    if(!agenda) continue;

    var cin = toWibDateString_(res[6]);
    var cout = toWibDateString_(res[7]);
    var key = agenda;
    if(!map[key]){
      map[key] = { agenda: agenda, checkin_plan: cin, checkout_plan: cout, period: cin + ' ➜ ' + cout, count: 0, rooms: {}, mess: {} };
    }
    map[key].count++;
    map[key].rooms[mess + '|' + room] = true;
    map[key].mess[mess] = true;
    messSet[mess] = true;
  }

  var agendas = Object.keys(map).map(function(k){
    var x = map[k];
    return {
      agenda: x.agenda,
      checkin_plan: x.checkin_plan,
      checkout_plan: x.checkout_plan,
      period: x.period,
      count: x.count,
      room_count: Object.keys(x.rooms).length,
      mess_count: Object.keys(x.mess).length
    };
  }).sort(function(a,b){
    var da = labelDmyToDate_(a.checkin_plan);
    var db = labelDmyToDate_(b.checkin_plan);
    return db - da || String(a.agenda).localeCompare(String(b.agenda), 'id');
  });

  return json_({ ok:true, agendas: agendas, mess: Object.keys(messSet).sort() });
}

function labelList_(user, body){
  var agendaFilter = String(body.agenda || '').trim();
  var messFilter = String(body.mess_name || '').trim();
  if(!agendaFilter) return json_({ok:false, error:'agenda_required'});
  if(user.role === 'mess') messFilter = String(user.mess || '').trim();

  var rvals = sheet('Reservations').getDataRange().getValues().slice(1);
  var gvals = sheet('Guests').getDataRange().getValues().slice(1);
  var rmap = {};
  rvals.forEach(function(r){ rmap[r[0]] = r; });

  var groups = {};
  for(var i=0;i<gvals.length;i++){
    var g = gvals[i];
    var status = String(g[8] || '').trim();
    if(status !== 'approved' && status !== 'checkedin') continue;

    var rid = g[1];
    var res = rmap[rid];
    if(!res) continue;
    var agenda = String(res[4] || '').trim();
    if(agenda !== agendaFilter) continue;

    var mess = String(g[6] || res[5] || '').trim();
    var room = String(g[7] || '').trim();
    if(!mess || !room) continue;
    if(messFilter && mess !== messFilter) continue;
    if(user.role === 'mess' && user.mess && mess !== String(user.mess).trim()) continue;

    var cin = toWibDateString_(res[6]);
    var cout = toWibDateString_(res[7]);
    var key = [agenda, mess, room, cin, cout].join('|');
    if(!groups[key]){
      groups[key] = {
        agenda: agenda,
        mess: mess,
        room: room,
        checkin_plan: cin,
        checkout_plan: cout,
        lama_menginap: labelNightsText_(cin, cout),
        guests: []
      };
    }
    groups[key].guests.push({
      id: g[0],
      name: String(g[2] || '').trim(),
      unit: String(g[3] || '').trim(),
      title: String(g[4] || '').trim(),
      gender: String(g[5] || '').trim(),
      status: status
    });
  }

  var rows = Object.keys(groups).map(function(k){
    groups[k].guests.sort(function(a,b){ return String(a.name).localeCompare(String(b.name), 'id', {sensitivity:'base'}); });
    return groups[k];
  }).sort(function(a,b){
    var m = String(a.mess).localeCompare(String(b.mess), 'id', {numeric:true, sensitivity:'base'});
    if(m) return m;
    return String(a.room).localeCompare(String(b.room), 'id', {numeric:true, sensitivity:'base'});
  });

  return json_({
    ok:true,
    rows: rows,
    summary: {
      agenda: agendaFilter,
      mess: messFilter,
      label_count: rows.length,
      guest_count: rows.reduce(function(sum,r){ return sum + r.guests.length; }, 0)
    }
  });
}

function labelDmyToDate_(s){
  s = toWibDateString_(s);
  var m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return new Date(0);
  return new Date(+m[3], +m[2]-1, +m[1]);
}
function labelNightsText_(cin, cout){
  var a = labelDmyToDate_(cin);
  var b = labelDmyToDate_(cout);
  if(isNaN(a.getTime()) || isNaN(b.getTime())) return '';
  var nights = Math.round((b.getTime() - a.getTime()) / (24*60*60*1000));
  if(nights < 0) nights = 0;
  return nights + ' malam';
}
