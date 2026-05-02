// Backward-compatible facade.
// Modul lama tetap bisa import dari util.js, tetapi implementasi dipisah di js/core/*.
export { $, $$, byId } from './core/dom.js';
export { showNotif, block, hideAllPages, go, closeMobileNavbar } from './core/ui.js';
export { todayStr, fmtDateStr, fmtTimeWib, fmtDateTimeWib, monthName } from './core/date.js';
export { dbg } from './core/debug.js';
