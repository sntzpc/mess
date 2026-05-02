import { $, $$ } from './dom.js';

let __blockCount = 0;

export function showNotif(msg, ok = true){
  const notifEl = $('#notif');
  if(!notifEl) return;
  notifEl.innerText = msg;
  notifEl.classList.toggle('err', !ok);
  notifEl.style.display = 'block';
  window.clearTimeout(showNotif.__timer);
  showNotif.__timer = window.setTimeout(()=>{ notifEl.style.display='none'; }, 2800);
}

export function block(on = true){
  const spl = $('#spl');
  if(!spl) return;
  __blockCount += on ? 1 : -1;
  if(__blockCount < 0) __blockCount = 0;
  spl.style.display = __blockCount > 0 ? 'flex' : 'none';
}

export function hideAllPages(){
  $$('.page').forEach(p => p.style.display = 'none');
}

export function go(pageId){
  hideAllPages();
  const el = document.getElementById(pageId);
  if(el) el.style.display = 'block';
  closeMobileNavbar();
}

export function closeMobileNavbar(){
  const toggler = $('.navbar-toggler');
  const nav = $('#nav');
  if(!toggler || !nav) return;
  if(getComputedStyle(toggler).display !== 'none' && nav.classList.contains('show')){
    toggler.click();
  }
}
