// Handy Toolx — shared JS utilities (fixed version)
const HandyToolx = {
  // ----- Tab switching (fixed to match panel IDs) -----
  initTabs(sidebarId, storageKey) {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) return;

    // Restore last active tab
    const lastTab = localStorage.getItem(storageKey);
    if (lastTab) {
      const btn = sidebar.querySelector(`[data-tool="${lastTab}"]`);
      if (btn) btn.click();
    } else {
      const firstBtn = sidebar.querySelector('.tool-btn');
      if (firstBtn) firstBtn.click();
    }

    sidebar.addEventListener('click', e => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;

      // Deactivate all buttons
      sidebar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch panel – use correct ID format: panel-{tool}
      const tool = btn.dataset.tool;
      document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${tool}`);
      if (panel) panel.classList.add('active');

      localStorage.setItem(storageKey, tool);
    });
  },

  // ----- Status messages -----
  // Supports both legacy PDF tools (id, msg, type) and simple (msg, isError)
  setStatus(idOrMsg, msgOrIsError, type) {
    let el, msg, isError;
    if (typeof idOrMsg === 'string' && document.getElementById(idOrMsg)) {
      // PDF-style: setStatus("mergeStatus", "message", "err")
      el = document.getElementById(idOrMsg);
      msg = msgOrIsError;
      isError = type === 'err';
    } else {
      // Simple style: setStatus("message", true)
      el = document.getElementById('status') || document.querySelector('.status');
      msg = idOrMsg;
      isError = msgOrIsError === true || msgOrIsError === 'err';
    }
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#B5392A' : '#1a1a1a';
      if (isError) el.classList.add('err'); else el.classList.remove('err');
      if (!isError && el.classList.contains('status')) el.classList.add('ok');
    }
  },

  // ----- File size formatting -----
  fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  },

  // ----- Enhanced file result (supports image previews + append) -----
  addFileResult(containerOrId, blobOrFilename, filenameOrOpts, opts) {
    let container, blob, filename;
    if (typeof containerOrId === 'string') {
      container = document.getElementById(containerOrId);
      blob = blobOrFilename;
      filename = filenameOrOpts;
    } else {
      container = containerOrId;
      blob = blobOrFilename;
      filename = filenameOrOpts;
      opts = filenameOrOpts; // shift for old calls
    }
    if (!container || !blob) return;

    opts = opts || {};
    const item = document.createElement('div');
    item.className = 'result-item';
    item.style.marginBottom = '0.75rem';

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || 'download';
    link.textContent = filename || 'file';
    link.style.color = 'var(--rust)';
    item.appendChild(link);

    if (opts.isImage) {
      const thumb = document.createElement('img');
      thumb.src = URL.createObjectURL(blob);
      thumb.style.maxWidth = '180px';
      thumb.style.maxHeight = '120px';
      thumb.style.border = '1px solid var(--ink)';
      thumb.style.marginTop = '0.4rem';
      thumb.style.display = 'block';
      item.appendChild(thumb);
    }

    if (opts.append !== true) {
      container.innerHTML = '';
    }
    container.appendChild(item);
  },

  // ----- Download blob as file -----
  downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ----- Copy to clipboard (with fallback) -----
  copyText(text, btn = null) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (btn) this.flashCopied(btn);
      }).catch(() => {
        this.legacyCopy(text, btn);
      });
    } else {
      this.legacyCopy(text, btn);
    }
  },

  legacyCopy(text, btn = null) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (btn) this.flashCopied(btn);
    } catch (e) {
      // ignore
    }
    document.body.removeChild(ta);
  },

  copyEl(el, btn = null) {
    const text = el?.textContent || el?.value || '';
    this.copyText(text, btn);
  },

  flashCopied(btn) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1800);
  }
};

// Auto-init dark mode
if (localStorage.getItem('handytoolx-theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}
