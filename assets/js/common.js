// Handy Toolx — shared JS utilities (loaded by every tool page)
const HandyToolx = {
  initTabs(sidebarId, storageKey) {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) return;

    // Restore last active tab
    const lastTab = localStorage.getItem(storageKey);
    if (lastTab) {
      const btn = sidebar.querySelector(`[data-tool="${lastTab}"]`);
      if (btn) btn.click();
    } else {
      // Click first tab by default
      const firstBtn = sidebar.querySelector('.tool-btn');
      if (firstBtn) firstBtn.click();
    }

    sidebar.addEventListener('click', e => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;

      // Deactivate all
      sidebar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      // Activate this one
      btn.classList.add('active');

      // Switch panel
      const tool = btn.dataset.tool;
      document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(tool + '-panel') || document.querySelector(`.tool-panel[data-tool="${tool}"]`);
      if (panel) panel.classList.add('active');

      localStorage.setItem(storageKey, tool);
    });
  },

  flashCopied(btn) {
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1800);
  },

  copyText(text, btn = null) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (btn) this.flashCopied(btn);
      });
    } else {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (btn) this.flashCopied(btn);
    }
  }
};

// Auto-init dark mode from localStorage
if (localStorage.getItem('handytoolx-theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}
