// js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.style.display = "none";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      loginError.textContent = "Username dan Password wajib diisi.";
      loginError.style.display = "";
      return;
    }

    // Siapkan callback global unik
    const callbackName = "jsonpLoginCallback_" + Date.now();

    // Parameter untuk JSONP
    const params = {
      action: "login",
      username: username,
      password: password
    };

    jsonpRequest(
      SCRIPT_URL,
      params,
      callbackName,
      (result) => {
        if (result.success) {
          const userObj = { username: result.username, role: result.role };
          sessionStorage.setItem("user", JSON.stringify(userObj));
          window.location.href = "main.html";
        } else {
          loginError.textContent = result.message || "Login gagal.";
          loginError.style.display = "";
        }
      },
      (err) => {
        console.error("Login JSONP error:", err);
        loginError.textContent = "Kesalahan jaringan / timeout. Coba lagi.";
        loginError.style.display = "";
      }
    );
  });
});

