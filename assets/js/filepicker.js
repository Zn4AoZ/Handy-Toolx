/* Handy Toolx — shared "accumulating" file picker.
   Wraps a normal <input type="file"> so that:
   - Clicking "Choose Files" repeatedly ADDS to the selection instead of
     replacing it (so you can pick one PDF, then click again and pick
     another).
   - Each picked file gets a chip with its name + an "x" to remove it.
   - Once there are more chips than comfortably fit, they collapse into
     a single "N files" pill with a dropdown to review/remove any of
     the selected items (or clear everything).
   - input.files is kept in sync (via DataTransfer) so existing code
     that reads `someInput.files` keeps working unchanged. */
(function () {
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  function fileKey(f) { return f.name + "_" + f.size + "_" + f.lastModified; }

  function attach(input, opts) {
    opts = opts || {};
    var collapseAt = opts.collapseAt || 4;     // chips shown before collapsing
    var onChange = opts.onChange || function () {};

    var files = [];
    var wrap = document.createElement("div");
    wrap.className = "ht-file-chips";
    input.insertAdjacentElement("afterend", wrap);

    function sync() {
      // Rebuild input.files so existing `input.files` reads keep working.
      try {
        var dt = new DataTransfer();
        files.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
      } catch (e) { /* DataTransfer unsupported — chips still work for our own render */ }
      render();
      onChange(files.slice());
    }

    function removeAt(idx) {
      files.splice(idx, 1);
      sync();
    }

    function clearAll() {
      files = [];
      sync();
    }

    function closeDropdown() {
      var dd = wrap.querySelector(".ht-file-dropdown");
      if (dd) dd.remove();
      document.removeEventListener("click", outsideClick, true);
    }
    function outsideClick(e) {
      if (!wrap.contains(e.target)) closeDropdown();
    }

    function renderDropdown(pill) {
      closeDropdown();
      var dd = document.createElement("div");
      dd.className = "ht-file-dropdown";
      files.forEach(function (f, idx) {
        var row = document.createElement("div");
        row.className = "ht-file-dropdown-row";
        var name = document.createElement("span");
        name.className = "ht-file-dropdown-name";
        name.textContent = f.name;
        name.title = f.name + " · " + fmtSize(f.size);
        var size = document.createElement("span");
        size.className = "ht-file-dropdown-size";
        size.textContent = fmtSize(f.size);
        var x = document.createElement("button");
        x.type = "button";
        x.className = "ht-chip-x";
        x.setAttribute("aria-label", "Remove " + f.name);
        x.textContent = "×";
        x.addEventListener("click", function (e) {
          e.stopPropagation();
          removeAt(idx);
          if (files.length) renderDropdown(pill); else closeDropdown();
        });
        row.appendChild(name); row.appendChild(size); row.appendChild(x);
        dd.appendChild(row);
      });
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "ht-file-dropdown-clear";
      clear.textContent = "Clear all";
      clear.addEventListener("click", function (e) {
        e.stopPropagation();
        clearAll();
        closeDropdown();
      });
      dd.appendChild(clear);
      wrap.appendChild(dd);
      setTimeout(function () { document.addEventListener("click", outsideClick, true); }, 0);
    }

    function render() {
      closeDropdown();
      wrap.innerHTML = "";
      if (!files.length) return;

      if (files.length > collapseAt) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "ht-file-pill";
        pill.textContent = files.length + " files selected ▾";
        pill.addEventListener("click", function (e) {
          e.stopPropagation();
          var existing = wrap.querySelector(".ht-file-dropdown");
          if (existing) { closeDropdown(); } else { renderDropdown(pill); }
        });
        var clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "ht-chip-x ht-file-pill-clear";
        clearBtn.setAttribute("aria-label", "Clear all files");
        clearBtn.title = "Clear all";
        clearBtn.textContent = "×";
        clearBtn.addEventListener("click", function (e) { e.stopPropagation(); clearAll(); });
        wrap.appendChild(pill);
        wrap.appendChild(clearBtn);
      } else {
        files.forEach(function (f, idx) {
          var chip = document.createElement("span");
          chip.className = "ht-chip";
          var label = document.createElement("span");
          label.className = "ht-chip-label";
          label.textContent = f.name;
          label.title = f.name + " · " + fmtSize(f.size);
          var x = document.createElement("button");
          x.type = "button";
          x.className = "ht-chip-x";
          x.setAttribute("aria-label", "Remove " + f.name);
          x.textContent = "×";
          x.addEventListener("click", function () { removeAt(idx); });
          chip.appendChild(label);
          chip.appendChild(x);
          wrap.appendChild(chip);
        });
      }
    }

    input.addEventListener("click", function () {
      // Let the same button add more files instead of only ever
      // reflecting the last pick.
      input.value = "";
    });

    input.addEventListener("change", function () {
      var picked = Array.prototype.slice.call(input.files || []);
      if (!picked.length) return;
      if (!input.multiple) {
        files = picked.slice(0, 1);
      } else {
        var seen = {};
        files.forEach(function (f) { seen[fileKey(f)] = true; });
        picked.forEach(function (f) {
          if (!seen[fileKey(f)]) { files.push(f); seen[fileKey(f)] = true; }
        });
      }
      sync();
    });

    return {
      getFiles: function () { return files.slice(); },
      clear: clearAll,
      removeAt: removeAt
    };
  }

  window.HandyToolxFilePicker = { attach: attach };
})();
