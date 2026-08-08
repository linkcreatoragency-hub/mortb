/* Tool logic for مُرتَّب. One dispatcher, one init function per tool slug.
   Every calculation runs locally in the browser; nothing is uploaded. */
(function () {
  "use strict";

  var H = window.Hijri, M = window.M;
  var TOOLS = {};

  function ready(fn) {
    if (document.readyState !== "loading") { fn(); } else { document.addEventListener("DOMContentLoaded", fn); }
  }

  function $(s, r) { return (r || document).querySelector(s); }
  function val(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }
  function ival(id) { var e = document.getElementById(id); return e ? parseInt(e.value, 10) : NaN; }
  function sval(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function txt(id, v) { var e = document.getElementById(id); if (e) { e.textContent = v; } }
  function html(id, v) { var e = document.getElementById(id); if (e) { e.innerHTML = v; } }
  function show(id, on) {
    var e = document.getElementById(id);
    if (e) { e.classList.toggle("hide", !on); }
  }
  function n(v, dp) { return M.n(v, dp); }

  /* two mutually exclusive tab buttons driving two boxes */
  function tabs(aId, bId, aBox, bBox, onChange) {
    var a = document.getElementById(aId), b = document.getElementById(bId);
    if (!a || !b) { return; }
    function set(which) {
      a.setAttribute("aria-pressed", which === "a" ? "true" : "false");
      b.setAttribute("aria-pressed", which === "b" ? "true" : "false");
      var ea = document.getElementById(aBox), eb = document.getElementById(bBox);
      if (ea) { ea.hidden = which !== "a"; }
      if (eb) { eb.hidden = which !== "b"; }
      if (onChange) { onChange(which); }
    }
    a.addEventListener("click", function () { set("a"); });
    b.addEventListener("click", function () { set("b"); });
  }

  function gDaysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function clampDay(y, m, d, hijri) {
    var max = hijri ? H.monthLength(y, m) : gDaysInMonth(y, m);
    return Math.min(d, max);
  }

  function seasonOf(ord) {
    /* returns {key, name, emoji, startOrd, endOrd} for the season containing ord */
    var g = H.ordToG(ord), y = g.y;
    var defs = [["winter", "الشتاء", "❄️", 12, 21], ["spring", "الربيع", "🌸", 3, 20],
                ["summer", "الصيف", "☀️", 6, 21], ["autumn", "الخريف", "🍂", 9, 22]];
    var starts = [];
    [y - 1, y, y + 1].forEach(function (yy) {
      defs.forEach(function (d) { starts.push({ key: d[0], name: d[1], emoji: d[2], o: H.gToOrd(yy, d[3], d[4]) }); });
    });
    starts.sort(function (a, b) { return a.o - b.o; });
    for (var i = starts.length - 1; i >= 0; i--) {
      if (starts[i].o <= ord) {
        return { key: starts[i].key, name: starts[i].name, emoji: starts[i].emoji,
                 startOrd: starts[i].o, endOrd: (starts[i + 1] ? starts[i + 1].o : starts[i].o + 90) - 1,
                 next: starts[i + 1] || null };
      }
    }
    return null;
  }

  /* ISO 8601 week number for a Gregorian date */
  function isoWeek(y, m, d) {
    var o = H.gToOrd(y, m, d);
    var dow = (o % 7 + 7) % 7;           /* 0 = Sunday */
    var isoDow = dow === 0 ? 7 : dow;    /* 1 = Monday .. 7 = Sunday */
    var thursday = o + (4 - isoDow);     /* the Thursday of this ISO week */
    var ty = H.ordToG(thursday).y;
    var jan1 = H.gToOrd(ty, 1, 1);
    return { week: Math.floor((thursday - jan1) / 7) + 1, year: ty,
             monday: o - (isoDow - 1), sunday: o + (7 - isoDow) };
  }
  function isoWeeksInYear(y) { return isoWeek(y, 12, 28).week; }

  /* ================================================================= today */
  TOOLS.today = function () {
    function paint() {
      var now = M.riyadhNow();
      var o = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
      var h = H.ordToH(o), g = H.ordToG(o);
      txt("today-day", "اليوم " + H.daysAr[H.weekday(o)]);
      txt("today-h", h ? H.fmtH(h) : "خارج النطاق المدعوم");
      txt("today-g", H.fmtG(g));
      var pad = function (x) { return String(x).padStart(2, "0"); };
      var hr = now.getHours(), ampm = hr < 12 ? "صباحاً" : "مساءً";
      var h12 = hr % 12 === 0 ? 12 : hr % 12;
      txt("today-clock", h12 + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds()) + " " + ampm + " — بتوقيت الرياض");

      var jan1 = H.gToOrd(g.y, 1, 1), dec31 = H.gToOrd(g.y, 12, 31);
      txt("today-dayno", n(o - jan1 + 1));
      txt("today-week", n(isoWeek(g.y, g.m, g.d).week));
      txt("today-left", n(dec31 - o));
      var s = seasonOf(o);
      txt("today-season", s ? s.emoji + " " + s.name : "—");
    }
    paint();
    setInterval(paint, 1000);
  };

  /* ================================================================= hijri converter */
  TOOLS.hijri = function () {
    var mode = "h2g";
    tabs("conv-h2g", "conv-g2h", "conv-hbox", "conv-gbox", function (w) {
      mode = w === "a" ? "h2g" : "g2h";
      show("conv-out", false);
    });

    function go() {
      var out = document.getElementById("conv-out");
      out.classList.remove("hide");
      var todayOrd = (function () { var t = M.riyadhNow(); return H.gToOrd(t.getFullYear(), t.getMonth() + 1, t.getDate()); })();
      var o, srcTxt, resTxt;

      if (mode === "h2g") {
        var hy = ival("ch-y"), hm = ival("ch-m"), hd = clampDay(hy, hm, ival("ch-d"), true);
        if (!H.inRange(hy)) { txt("conv-res", "خارج النطاق المدعوم"); txt("conv-day", ""); txt("conv-src", "النطاق المدعوم: 1370هـ إلى 1500هـ"); txt("conv-diff", ""); return; }
        o = H.hToOrd(hy, hm, hd);
        srcTxt = "التاريخ الهجري: " + H.fmtH({ y: hy, m: hm, d: hd });
        resTxt = H.fmtG(H.ordToG(o));
      } else {
        var gy = ival("cg-y"), gm = ival("cg-m"), gd = clampDay(gy, gm, ival("cg-d"), false);
        o = H.gToOrd(gy, gm, gd);
        var h = H.ordToH(o);
        if (!h) { txt("conv-res", "خارج النطاق المدعوم"); txt("conv-day", ""); txt("conv-src", "النطاق المدعوم: 1950م إلى 2077م"); txt("conv-diff", ""); return; }
        srcTxt = "التاريخ الميلادي: " + H.fmtG({ y: gy, m: gm, d: gd });
        resTxt = H.fmtH(h);
      }
      txt("conv-day", "يوم " + H.daysAr[H.weekday(o)]);
      txt("conv-res", resTxt);
      txt("conv-src", srcTxt);
      var diff = o - todayOrd;
      txt("conv-diff", diff === 0 ? "هذا هو تاريخ اليوم"
        : diff > 0 ? "بعد " + M.countText(diff, M.DAY_F) + " من اليوم"
                   : "قبل " + M.countText(-diff, M.DAY_F) + " من اليوم");
    }

    var b = document.getElementById("conv-go");
    if (b) { b.addEventListener("click", go); }
    var t = document.getElementById("conv-today");
    if (t) {
      t.addEventListener("click", function () {
        var now = M.riyadhNow(), o = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
        var h = H.ordToH(o), g = H.ordToG(o);
        if (mode === "h2g" && h) {
          document.getElementById("ch-y").value = h.y;
          document.getElementById("ch-m").value = h.m;
          document.getElementById("ch-d").value = h.d;
        } else {
          document.getElementById("cg-y").value = g.y;
          document.getElementById("cg-m").value = g.m;
          document.getElementById("cg-d").value = g.d;
        }
        go();
      });
    }
  };

  /* ================================================================= age */
  function ymdBetween(o1, o2, hijri) {
    /* completed years / months / days between two ordinals (o1 <= o2) */
    var a = hijri ? H.ordToH(o1) : H.ordToG(o1);
    var b = hijri ? H.ordToH(o2) : H.ordToG(o2);
    if (!a || !b) { return null; }
    var y = b.y - a.y, m = b.m - a.m, d = b.d - a.d;
    if (d < 0) {
      m -= 1;
      var pm = b.m - 1, py = b.y;
      if (pm < 1) { pm = 12; py -= 1; }
      d += hijri ? H.monthLength(py, pm) : gDaysInMonth(py, pm);
    }
    if (m < 0) { m += 12; y -= 1; }
    return { y: y, m: m, d: d };
  }

  function ymdText(t) {
    if (!t) { return "—"; }
    var p = [];
    if (t.y) { p.push(M.countText(t.y, M.YEAR_F)); }
    if (t.m) { p.push(M.countText(t.m, M.MONTH_F)); }
    if (t.d || !p.length) { p.push(M.countText(t.d, M.DAY_F)); }
    return p.join(" و");
  }

  TOOLS.age = function () {
    var mode = "g";
    tabs("age-tab-g", "age-tab-h", "age-gbox", "age-hbox", function (w) { mode = w === "a" ? "g" : "h"; });

    function go() {
      var now = M.riyadhNow();
      var todayOrd = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
      var birthOrd;
      if (mode === "g") {
        var gy = ival("ag-y"), gm = ival("ag-m"), gd = clampDay(gy, gm, ival("ag-d"), false);
        birthOrd = H.gToOrd(gy, gm, gd);
      } else {
        var hy = ival("ah-y"), hm = ival("ah-m"), hd = clampDay(hy, hm, ival("ah-d"), true);
        if (!H.inRange(hy)) { return; }
        birthOrd = H.hToOrd(hy, hm, hd);
      }
      show("age-out", true); show("age-stats", true); show("age-extra", true);

      if (birthOrd > todayOrd) {
        txt("age-big", "التاريخ في المستقبل");
        txt("age-hijri", "يرجى إدخال تاريخ ميلاد سابق لليوم.");
        ["age-days", "age-weeks", "age-hours", "age-bday"].forEach(function (i) { txt(i, "—"); });
        html("age-note", "تاريخ الميلاد المُدخل يقع بعد تاريخ اليوم.");
        return;
      }

      var days = todayOrd - birthOrd;
      var gAge = ymdBetween(birthOrd, todayOrd, false);
      var hAge = ymdBetween(birthOrd, todayOrd, true);
      txt("age-big", ymdText(gAge));
      txt("age-hijri", hAge ? "وبالتقويم الهجري: " + ymdText(hAge) : "");
      txt("age-days", n(days));
      txt("age-weeks", n(Math.floor(days / 7)));
      txt("age-hours", n(days * 24));

      var bg = H.ordToG(birthOrd), tg = H.ordToG(todayOrd);
      var nextB = H.gToOrd(tg.y, bg.m, clampDay(tg.y, bg.m, bg.d, false));
      if (nextB < todayOrd) { nextB = H.gToOrd(tg.y + 1, bg.m, clampDay(tg.y + 1, bg.m, bg.d, false)); }
      txt("age-bday", nextB === todayOrd ? "اليوم! 🎉" : n(nextB - todayOrd));

      var wd = H.daysAr[H.weekday(birthOrd)];
      var hb = H.ordToH(birthOrd);
      html("age-note",
        "وُلدت يوم <strong>" + wd + "</strong> الموافق " + H.fmtG(bg) +
        (hb ? " — " + H.fmtH(hb) : "") + "." +
        (nextB === todayOrd ? " كل عام وأنت بخير! 🎉" : ""));
    }
    var b = document.getElementById("age-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ================================================================= age diff */
  TOOLS["age-diff"] = function () {
    function go() {
      var y1 = ival("d1-y"), m1 = ival("d1-m"), dd1 = clampDay(y1, m1, ival("d1-d"), false);
      var y2 = ival("d2-y"), m2 = ival("d2-m"), dd2 = clampDay(y2, m2, ival("d2-d"), false);
      var o1 = H.gToOrd(y1, m1, dd1), o2 = H.gToOrd(y2, m2, dd2);
      var lo = Math.min(o1, o2), hi = Math.max(o1, o2);
      show("diff-out", true); show("diff-stats", true);

      if (o1 === o2) {
        txt("diff-big", "لا فرق");
        txt("diff-sub", "الشخصان وُلدا في اليوم نفسه.");
      } else {
        var t = ymdBetween(lo, hi, false);
        txt("diff-big", ymdText(t));
        txt("diff-sub", (o1 < o2 ? "الشخص الأول" : "الشخص الثاني") + " هو الأكبر سناً.");
      }
      var days = hi - lo;
      txt("diff-days", n(days));
      txt("diff-months", n(Math.floor(days / 30.44)));

      var now = M.riyadhNow(), today = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
      txt("diff-a1", o1 <= today ? ymdBetween(o1, today, false).y : "—");
      txt("diff-a2", o2 <= today ? ymdBetween(o2, today, false).y : "—");
    }
    var b = document.getElementById("diff-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ================================================================= date calculator */
  TOOLS.datecalc = function () {
    tabs("dc-tab-add", "dc-tab-between", "dc-add", "dc-between", function () { show("dc-out", false); show("dc-stats", false); });

    function addUnits(o, amount, unit, dir) {
      var g, h, y, m, d;
      if (unit === "d") { return o + dir * amount; }
      if (unit === "w") { return o + dir * amount * 7; }
      if (unit === "m" || unit === "y") {
        g = H.ordToG(o);
        var total = (unit === "y" ? amount * 12 : amount) * dir;
        var mi = g.y * 12 + (g.m - 1) + total;
        y = Math.floor(mi / 12); m = (mi % 12 + 12) % 12 + 1;
        d = clampDay(y, m, g.d, false);
        return H.gToOrd(y, m, d);
      }
      h = H.ordToH(o);
      if (!h) { return null; }
      var ht = (unit === "hy" ? amount * 12 : amount) * dir;
      var hmi = h.y * 12 + (h.m - 1) + ht;
      y = Math.floor(hmi / 12); m = (hmi % 12 + 12) % 12 + 1;
      if (!H.inRange(y)) { return null; }
      d = clampDay(y, m, h.d, true);
      return H.hToOrd(y, m, d);
    }

    function workdays(a, b) {
      var c = 0;
      for (var o = a; o < b; o++) { var w = H.weekday(o); if (w !== 5 && w !== 6) { c++; } }
      return c;
    }

    function goAdd() {
      var y = ival("dca-y"), m = ival("dca-m"), d = clampDay(y, m, ival("dca-d"), false);
      var o = H.gToOrd(y, m, d);
      var res = addUnits(o, Math.abs(ival("dc-amount") || 0), sval("dc-unit"), parseInt(sval("dc-dir"), 10));
      show("dc-out", true); show("dc-stats", true);
      if (res === null) { txt("dc-big", "خارج النطاق المدعوم"); txt("dc-sub", ""); txt("dc-lbl", ""); return; }
      var g = H.ordToG(res), h = H.ordToH(res);
      txt("dc-lbl", "التاريخ الناتج");
      txt("dc-big", H.fmtG(g));
      txt("dc-sub", "يوم " + H.daysAr[H.weekday(res)] + (h ? " — " + H.fmtH(h) : ""));
      var diff = Math.abs(res - o);
      txt("dc-s1", n(diff)); txt("dc-s1l", "يوماً فرقاً");
      txt("dc-s2", n(Math.floor(diff / 7))); txt("dc-s2l", "أسبوعاً");
      txt("dc-s3", n(workdays(Math.min(o, res), Math.max(o, res)))); txt("dc-s3l", "يوم عمل");
      txt("dc-s4", H.daysAr[H.weekday(res)]); txt("dc-s4l", "يوم الأسبوع");
    }

    function goBetween() {
      var y1 = ival("dcf-y"), m1 = ival("dcf-m"), d1 = clampDay(y1, m1, ival("dcf-d"), false);
      var y2 = ival("dct-y"), m2 = ival("dct-m"), d2 = clampDay(y2, m2, ival("dct-d"), false);
      var a = H.gToOrd(y1, m1, d1), b = H.gToOrd(y2, m2, d2);
      var lo = Math.min(a, b), hi = Math.max(a, b), days = hi - lo;
      show("dc-out", true); show("dc-stats", true);
      txt("dc-lbl", "المدة بين التاريخين");
      txt("dc-big", M.countText(days, M.DAY_F));
      txt("dc-sub", ymdText(ymdBetween(lo, hi, false)) + (a > b ? " (التاريخ الأول بعد الثاني)" : ""));
      txt("dc-s1", n(Math.floor(days / 7))); txt("dc-s1l", "أسبوعاً");
      txt("dc-s2", n(workdays(lo, hi))); txt("dc-s2l", "يوم عمل");
      txt("dc-s3", n(days - workdays(lo, hi))); txt("dc-s3l", "جمعة وسبت");
      txt("dc-s4", n(Math.round(days * 24))); txt("dc-s4l", "ساعة");
    }

    var b1 = document.getElementById("dc-go"), b2 = document.getElementById("dc-go2");
    if (b1) { b1.addEventListener("click", goAdd); }
    if (b2) { b2.addEventListener("click", goBetween); }
  };

  /* ================================================================= week number */
  TOOLS["week-number"] = function () {
    var now = M.riyadhNow();
    var o = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var g = H.ordToG(o), w = isoWeek(g.y, g.m, g.d);
    txt("wk-big", "الأسبوع رقم " + w.week + " من سنة " + w.year);
    txt("wk-range", "من " + H.fmtG(H.ordToG(w.monday)) + " إلى " + H.fmtG(H.ordToG(w.sunday)));
    var total = isoWeeksInYear(g.y);
    txt("wk-total", n(total));
    txt("wk-left", n(Math.max(0, total - w.week)));
    var jan1 = H.gToOrd(g.y, 1, 1), dec31 = H.gToOrd(g.y, 12, 31);
    txt("wk-done", Math.round((o - jan1) / (dec31 - jan1) * 100) + "%");
    txt("wk-quarter", "الربع " + Math.ceil(g.m / 3));

    var b1 = document.getElementById("wk-go1");
    if (b1) {
      b1.addEventListener("click", function () {
        var y = ival("wkd-y"), m = ival("wkd-m"), d = clampDay(y, m, ival("wkd-d"), false);
        var r = isoWeek(y, m, d);
        show("wk-out", true);
        txt("wk-out-big", "الأسبوع رقم " + r.week);
        txt("wk-out-sub", H.fmtG({ y: y, m: m, d: d }) + " يقع في الأسبوع " + r.week +
          " من سنة " + r.year + " — من " + H.fmtG(H.ordToG(r.monday)) + " إلى " + H.fmtG(H.ordToG(r.sunday)));
      });
    }
    var b2 = document.getElementById("wk-go2");
    if (b2) {
      b2.addEventListener("click", function () {
        var wn = ival("wk-num"), wy = ival("wk-year");
        var max = isoWeeksInYear(wy);
        show("wk-out", true);
        if (isNaN(wn) || wn < 1 || wn > max) {
          txt("wk-out-big", "رقم غير صالح");
          txt("wk-out-sub", "سنة " + wy + " تحتوي على " + max + " أسبوعاً فقط.");
          return;
        }
        var jan4 = H.gToOrd(wy, 1, 4);
        var dow = ((jan4 % 7) + 7) % 7, isoDow = dow === 0 ? 7 : dow;
        var mondayW1 = jan4 - (isoDow - 1);
        var mon = mondayW1 + (wn - 1) * 7;
        txt("wk-out-big", "الأسبوع " + wn + " من " + wy);
        txt("wk-out-sub", "من " + H.fmtG(H.ordToG(mon)) + " إلى " + H.fmtG(H.ordToG(mon + 6)));
      });
    }
  };

  /* ================================================================= seasons */
  TOOLS.seasons = function () {
    var now = M.riyadhNow();
    var o = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var s = seasonOf(o);
    if (!s) { return; }
    txt("ss-name", s.emoji + " " + s.name);
    txt("ss-range", "من " + H.fmtG(H.ordToG(s.startOrd)) + " إلى " + H.fmtG(H.ordToG(s.endOrd)));
    var total = s.endOrd - s.startOrd + 1, passed = o - s.startOrd;
    txt("ss-passed", n(passed));
    txt("ss-left", n(total - passed));
    txt("ss-pct", Math.round(passed / total * 100) + "%");
    txt("ss-next", s.next ? s.next.emoji + " " + s.next.name : "—");
    if (s.next) {
      var t = H.ordToG(s.next.o);
      M.startCountdown(document.getElementById("ss-cd"),
        M.riyadhMidnightUTC(t.y, t.m, t.d), "🎉 بدأ الفصل الجديد!");
    }
  };

  /* ================================================================= season countdowns */
  function seasonCountdown() {
    var el = document.getElementById("sc-cd");
    if (!el) { return; }
    var mon = parseInt(el.getAttribute("data-mon"), 10), day = parseInt(el.getAttribute("data-day"), 10);
    var now = M.riyadhNow();
    var todayOrd = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var y = now.getFullYear();
    var target = H.gToOrd(y, mon, day);
    if (target < todayOrd) { target = H.gToOrd(y + 1, mon, day); }
    var tg = H.ordToG(target), th = H.ordToH(target);
    txt("sc-date", H.fmtG(tg));
    txt("sc-h", th ? th.d + " " + H.monthsAr[th.m - 1] : "—");
    txt("sc-wd", H.daysAr[H.weekday(target)]);
    txt("sc-weeks", n(Math.round((target - todayOrd) / 7)));
    var cur = seasonOf(todayOrd);
    txt("sc-cur", cur ? cur.emoji + " " + cur.name : "—");
    M.startCountdown(el, M.riyadhMidnightUTC(tg.y, tg.m, tg.d), "🎉 بدأ الفصل!");
  }
  ["winter", "spring", "summer", "autumn"].forEach(function (k) { TOOLS[k] = seasonCountdown; });

  /* ================================================================= wasm */
  TOOLS.wasam = function () {
    var now = M.riyadhNow();
    var todayOrd = H.gToOrd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var y = now.getFullYear();
    var start = H.gToOrd(y, 10, 16);
    if (todayOrd >= start + 52) { start = H.gToOrd(y + 1, 10, 16); }
    var sg = H.ordToG(start);
    txt("ws-date", H.fmtG(sg));
    if (todayOrd < start) {
      M.startCountdown(document.getElementById("ws-cd"),
        M.riyadhMidnightUTC(sg.y, sg.m, sg.d), "🌧️ بدأ موسم الوسم!");
    } else {
      html("ws-cd", '<p class="cd-done">🌧️ نحن الآن داخل موسم الوسم — اليوم ' +
        (todayOrd - start + 1) + " من 52</p>");
    }
    var names = ["العواء", "السماك", "الغفر", "الزبانا"], out = "";
    for (var i = 0; i < 4; i++) {
      var s0 = start + i * 13, s1 = s0 + 12;
      var inNow = todayOrd >= s0 && todayOrd <= s1;
      out += '<div class="stat"' + (inNow ? ' style="border-color:#0a8f4d;background:var(--green-l)"' : "") + ">" +
        "<b>" + names[i] + "</b><span>" + H.ordToG(s0).d + " " + H.monthsG[H.ordToG(s0).m - 1] +
        " — " + H.ordToG(s1).d + " " + H.monthsG[H.ordToG(s1).m - 1] + "</span></div>";
    }
    html("ws-nawa", out);
  };

  /* ================================================================= custom countdown */
  TOOLS.counter = function () {
    var mode = "g", timer = null;
    tabs("cnt-tab-g", "cnt-tab-h", "cnt-gbox", "cnt-hbox", function (w) { mode = w === "a" ? "g" : "h"; });

    function targetOrd() {
      if (mode === "g") {
        var y = ival("cnf-y"), m = ival("cnf-m"), d = clampDay(y, m, ival("cnf-d"), false);
        return H.gToOrd(y, m, d);
      }
      var hy = ival("cnh-y"), hm = ival("cnh-m"), hd = clampDay(hy, hm, ival("cnh-d"), true);
      return H.inRange(hy) ? H.hToOrd(hy, hm, hd) : null;
    }

    function start(title, ord) {
      if (ord === null) { return; }
      var g = H.ordToG(ord), h = H.ordToH(ord);
      show("cnt-view", true);
      txt("cnt-h", title || "مناسبتي");
      txt("cnt-target", H.fmtG(g) + (h ? " — " + H.fmtH(h) : "") + " · يوم " + H.daysAr[H.weekday(ord)]);
      html("cnt-cd",
        '<div class="cd-cell"><b data-cd="days">—</b><span>يوم</span></div>' +
        '<div class="cd-cell"><b data-cd="hours">—</b><span>ساعة</span></div>' +
        '<div class="cd-cell"><b data-cd="minutes">—</b><span>دقيقة</span></div>' +
        '<div class="cd-cell"><b data-cd="seconds">—</b><span>ثانية</span></div>');
      if (timer) { clearInterval(timer); }
      timer = M.startCountdown(document.getElementById("cnt-cd"),
        M.riyadhMidnightUTC(g.y, g.m, g.d), "🎉 " + (title || "حلّ الموعد") + " — وصلنا!");
      M.store.set("counter", JSON.stringify({ t: title, o: ord }));
    }

    var go = document.getElementById("cnt-go");
    if (go) {
      go.addEventListener("click", function () { start(sval("cnt-title"), targetOrd()); });
    }
    var cp = document.getElementById("cnt-copy");
    if (cp) {
      cp.addEventListener("click", function () {
        var ord = targetOrd();
        if (ord === null) { return; }
        var g = H.ordToG(ord);
        var url = location.origin + location.pathname + "?t=" + encodeURIComponent(sval("cnt-title")) +
                  "&d=" + g.y + "-" + g.m + "-" + g.d;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            cp.textContent = "✓ تم نسخ الرابط";
            setTimeout(function () { cp.textContent = "نسخ رابط العداد"; }, 2200);
          });
        }
      });
    }

    /* restore from ?t=&d= or from the last saved counter */
    var q = new URLSearchParams(location.search);
    if (q.get("d")) {
      var p = q.get("d").split("-").map(Number);
      if (p.length === 3 && p.every(function (x) { return !isNaN(x); })) {
        var el = document.getElementById("cnt-title");
        if (el && q.get("t")) { el.value = q.get("t"); }
        document.getElementById("cnf-y").value = p[0];
        document.getElementById("cnf-m").value = p[1];
        document.getElementById("cnf-d").value = clampDay(p[0], p[1], p[2], false);
        start(q.get("t") || "مناسبتي", H.gToOrd(p[0], p[1], clampDay(p[0], p[1], p[2], false)));
      }
    } else {
      var saved = M.store.get("counter");
      if (saved) {
        try {
          var o = JSON.parse(saved);
          if (o && o.o) { start(o.t, o.o); }
        } catch (e) { /* ignore corrupt value */ }
      }
    }
  };

  /* The registry is populated across tools.js, tools2.js and tools3.js.
     Dispatch happens in init.js, which loads last — see that file. */
  window.TOOLS = TOOLS;
  window.TOOLS.__ready = ready;
})();
