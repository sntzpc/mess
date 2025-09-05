import { go } from './util.js';

export function wireMenu(onShow){
  // Main nav: JANGAN ikutkan .dropdown-toggle supaya dropdown bisa terbuka normal
  document.querySelectorAll('#menu a.nav-link:not(.dropdown-toggle)').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const pid = a.getAttribute('data-page');
      if(!pid) return;              // safety guard
      go(pid);
      onShow?.(pid);
    });
  });

  // Item di dalam dropdown (subpage)
  document.querySelectorAll('#menu .dropdown-menu .dropdown-item.subpage').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const pid = a.getAttribute('data-page');
      if(!pid) return;
      go(pid);
      onShow?.(pid);
    });
  });
}
