export const $ = (q) => document.querySelector(q);
export const $$ = (q) => Array.from(document.querySelectorAll(q));

const notifEl = document.getElementById('notif');
const spl = document.getElementById('spl');

export function showNotif(msg, ok=true){
  notifEl.innerText = msg;
  notifEl.classList.toggle('err', !ok);
  notifEl.style.display = 'block';
  setTimeout(()=>{ notifEl.style.display='none'; }, 2500);
}
let __blockCount = 0;
export function block(on = true) {
  __blockCount += on ? 1 : -1;
  if (__blockCount < 0) __blockCount = 0;
  spl.style.display = __blockCount > 0 ? 'flex' : 'none';
}

export function hideAllPages(){ $$('.page').forEach(p=>p.style.display='none'); }
export function go(pageId){
  hideAllPages(); const el=document.getElementById(pageId); if(el) el.style.display='block';
  // auto close mobile navbar
  const toggler = document.querySelector('.navbar-toggler'); const nav=document.getElementById('nav');
  if(getComputedStyle(toggler).display!=='none' && nav.classList.contains('show')) toggler.click();
}

export function todayStr(){ const d=new Date(); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${yyyy}-${mm}-${dd}`; }
export function fmtDateStr(d){ if(!d) return ''; const [y,m,da]=d.split('-'); return `${da}/${m}/${y}`; }
export function monthName(m){ return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][+m-1]; }

// ===== DEBUG LOGGER =====
export function dbg(...args){
  try{
    const on = (localStorage.getItem('debug')==='1') || (new URLSearchParams(location.search).get('debug')==='1');
    if(!on) return;
    const msg = `[${new Date().toISOString()}] ` + args.map(x=>{
      try{ return typeof x==='string' ? x : JSON.stringify(x); }catch{ return String(x); }
    }).join(' ');
    (window.__DBG_LOGS ||= []).push(msg);
    if(window.__DBG_LOGS.length>2000) window.__DBG_LOGS.shift();
    const pre = document.getElementById('dbg-log'); if(pre){ pre.textContent += msg + '\n'; pre.scrollTop = pre.scrollHeight; }
    // console juga
    console.log('[DBG]', ...args);
  }catch(e){ /* ignore */ }
}

