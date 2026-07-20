/* Handy Toolx — shared theme handling.
   Theme choice lives in sessionStorage so it "sticks" for the current
   browser session as the user moves between the main page and tool
   pages, but resets on a fresh session (matches the "stays for the
   session" request rather than a permanent, forever setting). */
(function () {
  var KEY = "handytoolx-theme";

  function getTheme() {
    try { return sessionStorage.getItem(KEY) || "light"; }
    catch (e) { return "light"; }
  }
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { sessionStorage.setItem(KEY, theme); } catch (e) {}
    var btn = document.getElementById("themeToggle");
    if (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
    var label = document.getElementById("themeToggleLabel");
    if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
  }

  // Apply as early as possible (before paint) to avoid a flash of the
  // wrong theme. This file is loaded with a plain <script> tag placed
  // in <head>, so this runs before body renders.
  setTheme(getTheme());

  window.HandyToolxTheme = {
    get: getTheme,
    set: setTheme,
    toggle: function () { setTheme(getTheme() === "dark" ? "light" : "dark"); }
  };

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    setTheme(getTheme());
    btn.addEventListener("click", function () { window.HandyToolxTheme.toggle(); });
  });
})();
