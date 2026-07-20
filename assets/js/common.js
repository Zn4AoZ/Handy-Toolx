/* Handy Toolx — shared helpers used across tool pages. */
(function () {
  function setStatus(id, msg, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = "status" + (type ? " " + type : "");
  }

  function flashCopied(btn, label) {
    if (!btn) return;
    clearTimeout(btn._copyTimer);
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = label || "Copied!";
    btn.classList.add("copied");
    btn._copyTimer = setTimeout(function () {
      btn.textContent = btn.dataset.label;
      btn.classList.remove("copied");
    }, 1300);
  }

  function legacyCopy(el, btn) {
    el.select ? el.select() : window.getSelection().selectAllChildren(el);
    if (document.execCommand("copy")) flashCopied(btn);
  }

  function copyEl(id, btn) {
    var el = document.getElementById(id);
    var text = el.value !== undefined ? el.value : el.textContent;
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashCopied(btn); }).catch(function () { legacyCopy(el, btn); });
    } else {
      legacyCopy(el, btn);
    }
  }

  function copyText(text, btn) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashCopied(btn); }).catch(function () {});
    }
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    // Give the download a tick to start before revoking.
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function copyImageBlob(blob, btn) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      setStatus(btn && btn.dataset.statusId, "Copy to clipboard isn't supported in this browser.", "err");
      return;
    }
    var type = blob.type && blob.type.indexOf("image/") === 0 ? blob.type : "image/png";
    var doCopy = function (b) {
      navigator.clipboard.write([new ClipboardItem({ [type]: b })])
        .then(function () { flashCopied(btn, "Copied!"); })
        .catch(function () {
          // Some browsers only accept image/png via the Clipboard API.
          if (type !== "image/png") convertAndCopyPng(blob, btn);
        });
    };
    doCopy(blob);
  }

  function convertAndCopyPng(blob, btn) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob(function (pngBlob) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })])
          .then(function () { flashCopied(btn, "Copied!"); })
          .catch(function () { flashCopied(btn, "Copy failed"); });
      }, "image/png");
    };
    img.src = URL.createObjectURL(blob);
  }

  /* Builds a "file result" row: filename + size, a View button (opens
     the blob in a new tab so PDFs/images can be inspected without
     downloading first) and a Download button. For images, also adds a
     Copy-to-clipboard button. Rows accumulate in the container so
     batch operations show one row per output file. */
  function addFileResult(container, blob, filename, opts) {
    if (typeof container === "string") container = document.getElementById(container);
    if (!container) return;
    opts = opts || {};
    container.style.display = "flex";
    if (!container.classList.contains("file-result-list")) {
      // single-result container: clear previous row unless batching
      if (!opts.append) container.innerHTML = "";
    }
    var url = URL.createObjectURL(blob);
    var row = document.createElement("div");
    row.className = "file-result";

    if (opts.isImage) {
      var thumb = document.createElement("img");
      thumb.src = url;
      thumb.alt = filename;
      thumb.style.cssText = "width:36px;height:36px;object-fit:cover;border:2px solid var(--ink);flex-shrink:0;";
      row.appendChild(thumb);
    }

    var name = document.createElement("span");
    name.className = "fr-name";
    name.textContent = filename;
    var meta = document.createElement("span");
    meta.className = "fr-meta";
    meta.textContent = fmtSize(blob.size);
    row.appendChild(name);
    row.appendChild(meta);

    var viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "action secondary";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", function () { window.open(url, "_blank", "noopener"); });
    row.appendChild(viewBtn);

    var dlBtn = document.createElement("button");
    dlBtn.type = "button";
    dlBtn.className = "action secondary";
    dlBtn.textContent = "Download";
    dlBtn.addEventListener("click", function () {
      var a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
    });
    row.appendChild(dlBtn);

    if (opts.isImage) {
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "action secondary";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", function () { copyImageBlob(blob, copyBtn); });
      row.appendChild(copyBtn);
    }

    container.appendChild(row);
  }

  window.HandyToolx = {
    setStatus: setStatus,
    flashCopied: flashCopied,
    legacyCopy: legacyCopy,
    copyEl: copyEl,
    copyText: copyText,
    downloadBlob: downloadBlob,
    fmtSize: fmtSize,
    copyImageBlob: copyImageBlob,
    addFileResult: addFileResult
  };
})();
