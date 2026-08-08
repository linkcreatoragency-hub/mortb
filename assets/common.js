/* Shared helpers for every page on مُرتَّب */
(function () {
  "use strict";

  /* ---- mobile nav ---- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest(".nav-toggle");
    if (!t) { return; }
    var nav = document.getElementById("mainnav");
    var open = nav.classList.toggle("open");
    t.setAttribute("aria-expanded", open ? "true" : "false");
    t.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
  });

  var AR_MONTHS_G = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                     "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* Arabic-Indic digits are NOT used — Saudi users overwhelmingly read Western digits
     on the web, and mixing them breaks tabular alignment. */
  function n(v, dp) {
    if (v === null || v === undefined || isNaN(v)) { return "—"; }
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: dp || 0, maximumFractionDigits: dp === undefined ? 0 : dp
    });
  }

  /* Arabic plural rules for counting things: 0 / 1 / 2 / 3-10 / 11+ */
  function plural(count, forms) {
    /* forms = [zero, one, two, few, many] e.g. ["يوم","يوم","يومان","أيام","يوماً"] */
    var c = Math.abs(count) % 100;
    if (count === 0) { return forms[0]; }
    if (count === 1) { return forms[1]; }
    if (count === 2) { return forms[2]; }
    if (c >= 3 && c <= 10) { return forms[3]; }
    return forms[4];
  }
  var DAY_F = ["يوم", "يوم واحد", "يومان", "أيام", "يوماً"];
  var YEAR_F = ["سنة", "سنة واحدة", "سنتان", "سنوات", "سنة"];
  var MONTH_F = ["شهر", "شهر واحد", "شهران", "أشهر", "شهراً"];

  function countText(v, forms) {
    if (v === 2) { return plural(v, forms); }
    if (v === 1) { return plural(v, forms); }
    if (v === 0) { return "0 " + forms[0]; }
    return n(v) + " " + plural(v, forms);
  }

  /* Riyadh wall clock (UTC+3, no DST) independent of the visitor's device timezone */
  function riyadhNow() {
    var d = new Date();
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 3 * 3600000);
  }
  function riyadhMidnightUTC(y, m, d) {
    /* ms epoch for 00:00 Riyadh on the given Gregorian date */
    return Date.UTC(y, m - 1, d, 0, 0, 0) - 3 * 3600000;
  }

  function fmtDateG(o) { return o ? o.d + " " + AR_MONTHS_G[o.m - 1] + " " + o.y + " م" : "—"; }

  /* ---- generic live countdown ---- */
  function startCountdown(el, targetMs, doneHtml) {
    if (!el) { return; }
    var cells = el.querySelectorAll("[data-cd]");
    function tick() {
      var diff = targetMs - Date.now();
      if (diff <= 0) {
        el.innerHTML = '<p class="cd-done">' + (doneHtml || "🎉 حلّ الموعد!") + "</p>";
        clearInterval(t);
        return;
      }
      var s = Math.floor(diff / 1000);
      var vals = {
        days: Math.floor(s / 86400),
        hours: Math.floor(s / 3600) % 24,
        minutes: Math.floor(s / 60) % 60,
        seconds: s % 60
      };
      cells.forEach(function (c) {
        var k = c.getAttribute("data-cd");
        c.textContent = vals[k] === undefined ? "—" : (k === "days" ? n(vals[k]) : String(vals[k]).padStart(2, "0"));
      });
    }
    tick();
    var t = setInterval(tick, 1000);
    return t;
  }

  /* ---- tool page filter (used on /tools and category pages) ---- */
  function initFilters() {
    var box = $(".filters");
    if (!box) { return; }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-filter]");
      if (!b) { return; }
      var f = b.getAttribute("data-filter");
      $$("button[data-filter]", box).forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      $$("[data-cat]").forEach(function (card) {
        card.style.display = (f === "all" || card.getAttribute("data-cat") === f) ? "" : "none";
      });
      $$(".cat-section").forEach(function (sec) {
        var vis = sec.querySelectorAll('[data-cat]:not([style*="none"])').length;
        sec.style.display = vis ? "" : "none";
      });
    });
  }

  /* ---- localStorage that never throws (private mode, blocked cookies) ---- */
  var store = {
    get: function (k) { try { return localStorage.getItem("mortb:" + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("mortb:" + k, v); } catch (e) { /* ignore */ } }
  };

  window.M = {
    $: $, $$: $$, n: n, plural: plural, countText: countText,
    DAY_F: DAY_F, YEAR_F: YEAR_F, MONTH_F: MONTH_F,
    AR_MONTHS_G: AR_MONTHS_G, AR_DAYS: AR_DAYS,
    riyadhNow: riyadhNow, riyadhMidnightUTC: riyadhMidnightUTC,
    fmtDateG: fmtDateG, startCountdown: startCountdown, store: store
  };

  document.addEventListener("DOMContentLoaded", initFilters);
})();
