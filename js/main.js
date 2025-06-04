// js/main.js

document.addEventListener("DOMContentLoaded", () => {
  // Cek session user
  const user = JSON.parse(sessionStorage.getItem("user"));
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  // Tampilkan username di navbar
  document.getElementById("displayUsername").textContent = user.username;

  // Jika role=admin, tampilkan menu admin
  if (user.role === "admin") {
    document.getElementById("navManagement").style.display = "";
    document.getElementById("navRoomsAdmin").style.display = "";
    document.getElementById("navUsers").style.display = "";
    document.getElementById("navJournal").style.display = "";
    document.getElementById("navLogs").style.display = "";
  }

  // Set default tab ke “Reservasi”
  showTab("Reservations");

  // Event listener untuk klik tab
  document.getElementById("tabReservations").addEventListener("click", () => showTab("Reservations"));
  document.getElementById("tabRooms").addEventListener("click", () => showTab("Rooms"));
  if (user.role === "admin") {
    document.getElementById("tabManagement").addEventListener("click", () => showTab("Management"));
    document.getElementById("tabRoomsAdmin").addEventListener("click", () => showTab("RoomsAdmin"));
    document.getElementById("tabUsers").addEventListener("click", () => showTab("Users"));
    document.getElementById("tabJournal").addEventListener("click", () => showTab("Journal"));
    document.getElementById("tabLogs").addEventListener("click", () => showTab("Logs"));
  }
  document.getElementById("tabProfile").addEventListener("click", () => showTab("Profile"));

  // Logout
  document.getElementById("btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
  });
});

function showTab(tabName) {
  const allTabs = ["Reservations", "Rooms", "Management", "RoomsAdmin", "Users", "Journal", "Logs", "Profile"];
  allTabs.forEach((t) => {
    document.getElementById("content" + t).style.display = "none";
    const link = document.getElementById("tab" + t);
    if (link) link.classList.remove("active");
  });

  document.getElementById("content" + tabName).style.display = "block";
  const activeLink = document.getElementById("tab" + tabName);
  if (activeLink) activeLink.classList.add("active");

  // Panggil fungsi load untuk setiap tab
  switch (tabName) {
    case "Reservations":
      loadReservationForm();
      break;
    case "Rooms":
      loadRooms();
      break;
    case "Management":
      loadManagement();
      break;
    case "RoomsAdmin":
      loadRoomsAdmin();
      break;
    case "Users":
      loadUsers();
      break;
    case "Journal":
      loadJournal();
      break;
    case "Logs":
      loadLogs();
      break;
    case "Profile":
      loadProfile();
      break;
  }
}