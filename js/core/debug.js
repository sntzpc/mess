import { fmtDateTimeWib } from './date.js';

export function dbg(...args){
  try{
    const on = (localStorage.getItem('debug')==='1') || (new URLSearchParams(location.search).get('debug')==='1');
    if(!on) return;
    const msg = `[${fmtDateTimeWib()} WIB] ` + args.map(x=>{
      try{ return typeof x==='string' ? x : JSON.stringify(x); }catch{ return String(x); }
    }).join(' ');
    (window.__DBG_LOGS ||= []).push(msg);
    if(window.__DBG_LOGS.length > 2000) window.__DBG_LOGS.shift();
    const pre = document.getElementById('dbg-log');
    if(pre){ pre.textContent += msg + '\n'; pre.scrollTop = pre.scrollHeight; }
    console.log('[DBG]', ...args);
  }catch(e){ /* ignore */ }
}
