(function () {
  "use strict";

  var data = window.THEME_BRIEF_DATA || null;
  var state = {
    view: "home",
    objectId: null,
    entryDate: null,
    entrySlot: null,
    slotKey: "",
    query: ""
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(date) {
    var parts = date.split("-");
    return parts[0] + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function formatDateShort(date) {
    var parts = date.split("-");
    return Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function slotLabel(date, slot) {
    return formatDate(date) + " " + slot + "（上海时间）";
  }

  function entryHref(objectId, date, slot) {
    return (
      "#object/" +
      encodeURIComponent(objectId) +
      "/" +
      date +
      "/" +
      encodeURIComponent(slot)
    );
  }

  function entryKey(date, slot) {
    return date + " " + slot;
  }

  function allSlots() {
    var list = [];
    data.days.forEach(function (day) {
      (day.slots || []).forEach(function (slot) {
        list.push({
          date: day.date,
          slot: slot.slot,
          title: slot.title || "",
          lead: slot.lead || "",
          closing_note: slot.closing_note || "",
          key: day.date + " " + slot.slot
        });
      });
    });
    return list;
  }

  function latestSlot() {
    var slots = allSlots();
    return slots.length ? slots[slots.length - 1] : null;
  }

  function selectedSlot() {
    var slots = allSlots();
    if (!state.slotKey) return latestSlot();
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].key === state.slotKey) return slots[i];
    }
    return latestSlot();
  }

  function objectById(id) {
    for (var i = 0; i < data.objects.length; i++) {
      if (data.objects[i].id === id) return data.objects[i];
    }
    return null;
  }

  function entriesForObject(id) {
    var out = [];
    data.days.forEach(function (day) {
      var file = day.files[id];
      if (!file) return;
      file.entries.forEach(function (entry) {
        out.push({
          id: id,
          date: day.date,
          slot: entry.slot,
          important: entry.important,
          headline: entry.headline,
          x_circulation: entry.x_circulation,
          public_record: entry.public_record,
          sources: entry.sources || [],
          still_unseen: entry.still_unseen || [],
          important_points: entry.important_points || []
        });
      });
    });
    return out;
  }

  function findEntry(entries, date, slot) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === date && entries[i].slot === slot) return entries[i];
    }
    return null;
  }

  function entriesForSlot(date, slot) {
    var day = null;
    for (var i = 0; i < data.days.length; i++) {
      if (data.days[i].date === date) day = data.days[i];
    }
    if (!day) return [];
    var out = [];
    data.objects.forEach(function (obj) {
      var file = day.files[obj.id];
      if (!file) return;
      file.entries.forEach(function (entry) {
        if (entry.slot === slot) {
          out.push({
            id: obj.id,
            title_zh: obj.title_zh,
            category: obj.category,
            status: obj.status,
            date: date,
            slot: entry.slot,
            important: entry.important,
            headline: entry.headline
          });
        }
      });
    });
    return out;
  }

  function objectIdsUpdatedInSlot(date, slot) {
    var set = {};
    entriesForSlot(date, slot).forEach(function (entry) {
      set[entry.id] = true;
    });
    return set;
  }

  function matchesQuery(obj, query) {
    if (!query) return true;
    var hay = [obj.title_zh, obj.summary, obj.category, obj.id].join("\n");
    entriesForObject(obj.id).forEach(function (entry) {
      hay +=
        "\n" +
        entry.headline +
        "\n" +
        entry.x_circulation +
        "\n" +
        entry.public_record +
        "\n" +
        entry.sources.join("\n") +
        "\n" +
        entry.still_unseen.join("\n") +
        "\n" +
        entry.important_points.join("\n");
    });
    return hay.toLowerCase().indexOf(query) !== -1;
  }

  function renderMarkdown(text) {
    var escaped = escapeHtml(text || "");
    escaped = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      function (_, label, url) {
        return (
          '<a href="' +
          url +
          '" target="_blank" rel="noopener noreferrer">' +
          label +
          "</a>"
        );
      }
    );
    var paragraphs = escaped.split(/\n\n+/);
    return paragraphs
      .map(function (part) {
        return "<p>" + part.replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }

  function renderList(items) {
    if (!items || !items.length) return "";
    return (
      "<ul>" +
      items
        .map(function (item) {
          return "<li>" + escapeHtml(item) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderSidebar() {
    var slot = selectedSlot();
    var updated = slot ? objectIdsUpdatedInSlot(slot.date, slot.slot) : {};
    var query = (state.query || "").trim().toLowerCase();
    var groups = [];
    var seen = {};
    data.objects.forEach(function (obj) {
      if (!seen[obj.category]) {
        seen[obj.category] = [];
        groups.push(obj.category);
      }
      seen[obj.category].push(obj);
    });

    var html = "";
    groups.forEach(function (category) {
      var items = seen[category].filter(function (obj) {
        return matchesQuery(obj, query);
      });
      if (!items.length) return;
      html +=
        '<section class="category"><h2>' +
        escapeHtml(category) +
        "</h2><ul class='object-list'>";
      items.forEach(function (obj) {
        var current =
          state.view === "object" && state.objectId === obj.id
            ? ' aria-current="page"'
            : "";
        var retired = obj.status === "retired" ? " retired" : "";
        var dot = updated[obj.id] ? " updated-dot" : "";
        html +=
          '<li class="' +
          retired +
          dot +
          '"><a href="#object/' +
          encodeURIComponent(obj.id) +
          '"' +
          current +
          ">" +
          escapeHtml(obj.title_zh) +
          "</a></li>";
      });
      html += "</ul></section>";
    });
    if (!html && query) {
      html = '<p class="empty-state">没有找到匹配的对象。</p>';
    }
    $("object-nav").innerHTML = html;

    var homeLink = $("nav-home");
    if (state.view === "home") homeLink.setAttribute("aria-current", "page");
    else homeLink.removeAttribute("aria-current");
  }

  function fillSlotFilter() {
    var select = $("slot-filter");
    var slots = allSlots();
    var latest = latestSlot();
    var html = "";
    slots
      .slice()
      .reverse()
      .forEach(function (slot, index) {
        var suffix = index === 0 && latest && slot.key === latest.key ? " · 最新档" : "";
        html +=
          '<option value="' +
          escapeHtml(slot.key) +
          '">' +
          escapeHtml(slotLabel(slot.date, slot.slot) + suffix) +
          "</option>";
      });
    select.innerHTML = html;
    if (state.slotKey && Array.prototype.some.call(select.options, function (option) {
      return option.value === state.slotKey;
    })) {
      select.value = state.slotKey;
    } else if (latest) {
      select.value = latest.key;
      state.slotKey = latest.key;
    }
  }

  function renderHome() {
    var slot = selectedSlot();
    if (!slot) {
      $("reader").innerHTML = "<p>还没有简报档。</p>";
      return;
    }
    var latest = latestSlot();
    var isLatest = latest && slot.key === latest.key;
    var kicker = isLatest ? "最新档" : "历史档";
    var entries = entriesForSlot(slot.date, slot.slot);
    var cards = entries
      .map(function (entry) {
        var cls = entry.important ? " headline important" : " headline";
        return (
          "<li><a href='" +
          entryHref(entry.id, entry.date, entry.slot) +
          "'><span class='obj-name'>" +
          escapeHtml(entry.title_zh) +
          "</span><span class='" +
          cls +
          "'>" +
          escapeHtml(entry.headline) +
          "</span></a></li>"
        );
      })
      .join("");

    var closing = slot.closing_note
      ? '<p class="closing-note">' + escapeHtml(slot.closing_note) + "</p>"
      : "";

    $("reader").innerHTML =
      '<p class="kicker">' +
      escapeHtml(kicker) +
      "</p><h1 class='page-title'>" +
      escapeHtml(slot.title || "主题简报") +
      "</h1><p class='kicker' style='margin-top:-0.5rem;margin-bottom:1rem'>" +
      escapeHtml(slotLabel(slot.date, slot.slot)) +
      '</p><p class="lead">' +
      escapeHtml(slot.lead) +
      "</p>" +
      closing +
      '<h2 class="section-label">本档更新的对象</h2><ul class="update-list">' +
      cards +
      "</ul>";
  }

  function renderEntryDetail(entry) {
    var titleClass = entry.important ? " important" : "";
    var mark = entry.important ? "重要 · " : "";
    var xBlock = entry.x_circulation
      ? '<div class="block"><h3>网上流传</h3>' +
        renderMarkdown(entry.x_circulation) +
        "</div>"
      : '<div class="block"><h3>网上流传</h3><p class="muted-empty">本档没有单独写到 X 上的讨论。</p></div>';
    var points = entry.important_points.length
      ? '<div class="block"><h3>要点</h3><ul class="important-points">' +
        entry.important_points
          .map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
          })
          .join("") +
        "</ul></div>"
      : "";
    var sources = entry.sources.length
      ? '<div class="block"><h3>来源</h3>' + renderList(entry.sources) + "</div>"
      : "";
    var unseen = entry.still_unseen.length
      ? '<div class="block"><h3>本档仍未见</h3>' +
        renderList(entry.still_unseen) +
        "</div>"
      : "";
    return (
      '<article class="entry"><p class="entry-meta">' +
      escapeHtml(slotLabel(entry.date, entry.slot)) +
      '</p><h2 class="' +
      titleClass +
      '">' +
      escapeHtml(mark + entry.headline) +
      "</h2>" +
      points +
      xBlock +
      '<div class="block"><h3>公开记录</h3>' +
      renderMarkdown(entry.public_record) +
      "</div>" +
      sources +
      unseen +
      "</article>"
    );
  }

  function renderTimeChart(objectId, entries, selectedKey) {
    var nodes = entries
      .map(function (entry) {
        var current = entryKey(entry.date, entry.slot) === selectedKey;
        var cls = "chart-node" + (entry.important ? " important" : "");
        return (
          "<li><a class='" +
          cls +
          "' href='" +
          entryHref(objectId, entry.date, entry.slot) +
          "'" +
          (current ? ' aria-current="true"' : "") +
          " title='" +
          escapeHtml(slotLabel(entry.date, entry.slot) + " " + entry.headline) +
          "'><span class='chart-dot' aria-hidden='true'></span><span class='chart-date'>" +
          escapeHtml(formatDateShort(entry.date) + " " + entry.slot) +
          "</span><span class='chart-head'>" +
          escapeHtml(entry.headline) +
          "</span></a></li>"
        );
      })
      .join("");
    return (
      '<section class="time-chart" aria-label="时间线">' +
      '<p class="chart-hint">下面是这个对象的时间线。先看发展脉络，点击节点后，才打开该时点的详细记录。</p>' +
      '<div class="chart-scroll"><ol class="chart-line">' +
      nodes +
      "</ol></div></section>"
    );
  }

  function renderObject(id) {
    var obj = objectById(id);
    if (!obj) {
      $("reader").innerHTML = "<p>没有找到这个对象。</p>";
      return;
    }
    var entries = entriesForObject(id);
    if (!entries.length) {
      $("reader").innerHTML =
        "<h1 class='page-title'>" +
        escapeHtml(obj.title_zh) +
        "</h1><p>还没有条目。</p>";
      return;
    }

    var selected = null;
    if (state.entryDate && state.entrySlot) {
      selected = findEntry(entries, state.entryDate, state.entrySlot);
    }
    var selectedKey = selected ? entryKey(selected.date, selected.slot) : "";

    var detail = selected
      ? '<div class="entry-detail">' + renderEntryDetail(selected) + "</div>"
      : '<p class="detail-placeholder">尚未选择时点。请点击时间线上的节点，查看该时点的详细记录。</p>';

    $("reader").innerHTML =
      '<p class="kicker">' +
      escapeHtml(obj.category) +
      "</p><h1 class='page-title'>" +
      escapeHtml(obj.title_zh) +
      "</h1><p class='retired-note'>" +
      escapeHtml(obj.summary) +
      "</p>" +
      renderTimeChart(id, entries, selectedKey) +
      detail;
  }

  function render() {
    if (!data) {
      $("reader").innerHTML =
        "<p>没有读到简报数据。请先在仓库根目录运行 <code>python3 tools/build.py</code>，再打开 index.html。</p>";
      return;
    }
    renderSidebar();
    if (state.view === "object" && state.objectId) renderObject(state.objectId);
    else renderHome();
  }

  function parseHash() {
    var hash = (location.hash || "").replace(/^#/, "");
    state.entryDate = null;
    state.entrySlot = null;
    if (!hash || hash === "home") {
      state.view = "home";
      state.objectId = null;
      return;
    }
    var parts = hash.split("/");
    if (parts[0] === "object" && parts[1]) {
      state.view = "object";
      state.objectId = decodeURIComponent(parts[1]);
      if (parts[2] && parts[3]) {
        state.entryDate = parts[2];
        state.entrySlot = decodeURIComponent(parts.slice(3).join("/"));
      }
      return;
    }
    state.view = "home";
    state.objectId = null;
  }

  function boot() {
    if (!data) {
      render();
      return;
    }
    fillSlotFilter();
    parseHash();
    render();

    $("slot-filter").addEventListener("change", function (event) {
      state.slotKey = event.target.value;
      if (state.view === "home") {
        location.hash = "home";
      }
      render();
    });
    $("search").addEventListener("input", function (event) {
      state.query = event.target.value;
      renderSidebar();
    });
    $("menu-toggle").addEventListener("click", function () {
      $("sidebar").classList.toggle("open");
    });
    window.addEventListener("hashchange", function () {
      parseHash();
      $("sidebar").classList.remove("open");
      window.scrollTo(0, 0);
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
