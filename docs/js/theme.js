// Dark/light theme toggle with OS preference detection and localStorage persistence
const Theme = (() => {
  const STORAGE_KEY = 'theme';

  // Apply immediately on parse to prevent flash of wrong theme
  const stored = localStorage.getItem(STORAGE_KEY);
  const preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', preferred);

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
    updateIcon();
  }

  function updateIcon() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = current() === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Wissel naar licht thema' : 'Wissel naar donker thema');
    btn.querySelector('.icon-moon').classList.toggle('hidden', isDark);
    btn.querySelector('.icon-sun').classList.toggle('hidden', !isDark);
  }

  function init() {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
      updateIcon();
    }

    // Listen for OS theme changes (only if user hasn't manually chosen)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        apply(e.matches ? 'dark' : 'light');
        updateIcon();
      }
    });
  }

  return { init, current, toggle };
})();
