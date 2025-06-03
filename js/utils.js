// js/utils.js

/**
 * fetchJSON: kirim POST JSON ke script URL, kembalikan hasil JSON
 */
function jsonpRequest(url, params, callbackName, onSuccess, onError) {
  params.callback = callbackName;
  const query = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  const fullUrl = url + '?' + query;

  const script = document.createElement('script');
  script.src = fullUrl;
  script.async = true;

  let didCall = false;
  script.onerror = function() {
    if (!didCall) {
      didCall = true;
      onError && onError(new Error('JSONP request failed: ' + fullUrl));
      cleanup();
    }
  };

  const timeoutId = setTimeout(() => {
    if (!didCall) {
      didCall = true;
      onError && onError(new Error('JSONP request timeout'));
      cleanup();
    }
  }, 8000);

  function cleanup() {
    clearTimeout(timeoutId);
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }

  window[callbackName] = function(response) {
    if (!didCall) {
      didCall = true;
      onSuccess && onSuccess(response);
      cleanup();
    }
  };

  document.head.appendChild(script);
}

/**
 * formatDate: format YYYY-MM-DD → DD/MM/YYYY (opsional, jika perlu)
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/**
 * Helper untuk buat elemen HTML:
 */
function createElementFromHTML(htmlString) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}
