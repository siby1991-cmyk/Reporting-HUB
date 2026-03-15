/* ── theme.js — Light / Dark toggle ────────────────────────────────────────── */
(function () {
  const THEME_KEY = 'rh_theme';
  const btn = document.getElementById('theme-toggle-btn');

  function getTheme()    { return localStorage.getItem(THEME_KEY) || 'light'; }
  function applyTheme(t) {
    document.body.dataset.theme = t;
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, t);
  }

  // Apply immediately on load (before paint)
  applyTheme(getTheme());

  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // Expose globally so app.js can read current theme
  window.getTheme = getTheme;
})();
