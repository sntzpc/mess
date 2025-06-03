// js/telegram.js

/**
 * Mengirim pesan ke Telegram (opsional, karena GAS sudah mengirim notifikasi server-side)
 */
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TOKEN_TELEGRAM}/sendMessage`;
  const payload = { chat_id: TELEGRAM_ID, text };
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Gagal kirim Telegram:", err);
  }
}
