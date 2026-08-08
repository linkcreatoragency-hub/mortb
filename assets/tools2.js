/* Islamic tools: prayer times, qibla, Ramadan/Eid/Hajj counters, Hijri calendar, zakat. */
(function () {
  "use strict";

  var H = window.Hijri, M = window.M, T = window.TOOLS;
  if (!T) { return; }

  function ival(id) { var e = document.getElementById(id); return e ? parseInt(e.value, 10) : NaN; }
  function fval(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) || 0 : 0; }
  function sval(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function txt(id, v) { var e = document.getElementById(id); if (e) { e.textContent = v; } }
  function html(id, v) { var e = document.getElementById(id); if (e) { e.innerHTML = v; } }
  function show(id, on) { var e = document.getElementById(id); if (e) { e.classList.toggle("hide", !on); } }
  function n(v, dp) { return M.n(v, dp); }
  function todayOrd() { var t = M.riyadhNow(); return H.gToOrd(t.getFullYear(), t.getMonth() + 1, t.getDate()); }

  /* ============================================================ solar maths */
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function tan(d) { return Math.tan(d * D2R); }
  function arccos(x) { return Math.acos(Math.min(1, Math.max(-1, x))) * R2D; }
  function arccot(x) { return Math.atan(1 / x) * R2D; }
  function fixHour(h) { h = h % 24; return h < 0 ? h + 24 : h; }

  /* Julian day for a Gregorian date at 0h UT */
  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }

  /* Sun declination and equation of time for a Julian day (low-precision, ±0.01°) */
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * D);
    var q = fixAngle(280.459 + 0.98564736 * D);
    var L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    var e = 23.439 - 0.00000036 * D;
    var RA = Math.atan2(cos(e) * sin(L), cos(L)) * R2D / 15;
    var decl = Math.asin(sin(e) * sin(L)) * R2D;
    var eqt = q / 15 - fixHourAngle(RA);
    return { decl: decl, eqt: eqt };
  }
  function fixAngle(a) { a = a % 360; return a < 0 ? a + 360 : a; }
  function fixHourAngle(h) { h = h % 24; return h < 0 ? h + 24 : h; }

  /* Hour angle for the sun being `angle` degrees below the horizon */
  function sunAngleTime(angle, decl, lat) {
    var x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (x < -1 || x > 1) { return null; }   /* polar day/night — not possible in KSA */
    return arccos(x) / 15;
  }
  function asrTime(factor, decl, lat) {
    var angle = -arccot(factor + tan(Math.abs(lat - decl)));
    return sunAngleTime(angle, decl, lat);
  }

  /* Umm al-Qura convention: Fajr 18.5°, Isha = Maghrib + 90 min (120 in Ramadan),
     Asr at shadow factor 1 (the position of the majority of scholars). */
  function prayerTimes(y, m, d, lat, lon, tz, ramadan) {
    var jd = julian(y, m, d) - lon / (15 * 24);
    var s = sunPosition(jd);
    var dhuhr = fixHour(12 + tz - lon / 15 - s.eqt);
    var tFajr = sunAngleTime(18.5, s.decl, lat);
    var tRise = sunAngleTime(0.833, s.decl, lat);
    var tAsr = asrTime(1, s.decl, lat);
    if (tFajr === null || tRise === null || tAsr === null) { return null; }
    var maghrib = dhuhr + tRise;
    return {
      fajr: dhuhr - tFajr,
      sunrise: dhuhr - tRise,
      dhuhr: dhuhr,                   /* solar noon, matching the Umm al-Qura published tables */
      asr: dhuhr + tAsr,
      maghrib: maghrib,
      isha: maghrib + (ramadan ? 2 : 1.5)
    };
  }

  function fmtTime(h) {
    if (h === null || h === undefined || isNaN(h)) { return "—"; }
    h = fixHour(h + 0.5 / 60);        /* round to the nearest minute */
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    var ampm = hh < 12 ? "ص" : "م";
    var h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + ":" + String(mm).padStart(2, "0") + " " + ampm;
  }

  /* ============================================================ prayer times */
  T.prayers = function () {
    var NAMES = [["fajr", "الفجر", "بداية الصيام والصلاة الأولى"],
                 ["sunrise", "الشروق", "ينتهي وقت الفجر"],
                 ["dhuhr", "الظهر", "بعد زوال الشمس"],
                 ["asr", "العصر", "حين يصير ظل الشيء مثله"],
                 ["maghrib", "المغرب", "وقت الإفطار في رمضان"],
                 ["isha", "العشاء", "بعد المغرب بـ 90 دقيقة"]];
    var timer = null;

    function paint(lat, lon, label) {
      var now = M.riyadhNow();
      var y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
      var o = H.gToOrd(y, m, d), h = H.ordToH(o);
      var isRamadan = !!(h && h.m === 9);
      var t = prayerTimes(y, m, d, lat, lon, 3, isRamadan);
      if (!t) { txt("pr-meta", "تعذّر الحساب لهذا الموقع."); return; }

      var nowH = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      var rows = "", nextName = null, nextAt = null;
      NAMES.forEach(function (p) {
        var v = t[p[0]];
        var isNext = nextName === null && v > nowH && p[0] !== "sunrise";
        if (isNext) { nextName = p[1]; nextAt = v; }
        rows += "<tr" + (isNext ? ' style="background:var(--green-l)"' : "") + "><td><strong>" +
          p[1] + "</strong></td><td class=\"num\">" + fmtTime(v) + "</td><td>" + p[2] + "</td></tr>";
      });
      html("pr-body", rows);

      if (nextName === null) {
        /* everything today has passed — next is tomorrow's Fajr */
        var t2 = prayerTimes(y, m, d + 1, lat, lon, 3, isRamadan);
        nextName = "الفجر (غداً)";
        nextAt = t2 ? t2.fajr + 24 : null;
      }
      txt("pr-next-name", nextName);
      if (timer) { clearInterval(timer); }
      function tick() {
        var nw = M.riyadhNow();
        var cur = nw.getHours() + nw.getMinutes() / 60 + nw.getSeconds() / 3600;
        var left = (nextAt - cur) * 3600;
        if (left <= 0) { paint(lat, lon, label); return; }
        var hh = Math.floor(left / 3600), mm = Math.floor(left / 60) % 60, ss = Math.floor(left) % 60;
        txt("pr-next-in", "بعد " + hh + " ساعة و" + mm + " دقيقة و" + ss + " ثانية");
      }
      tick();
      timer = setInterval(tick, 1000);

      txt("pr-meta", label + " · " + (h ? H.fmtH(h) : "") + " · " + H.fmtG({ y: y, m: m, d: d }) +
        " · طريقة أم القرى" + (isRamadan ? " (العشاء بعد المغرب بـ 120 دقيقة في رمضان)" : ""));
    }

    function fromSelect() {
      var v = sval("pr-city");
      if (v === "geo") {
        if (!navigator.geolocation) { alert("متصفحك لا يدعم تحديد الموقع."); return; }
        navigator.geolocation.getCurrentPosition(
          function (p) { paint(p.coords.latitude, p.coords.longitude, "موقعك الحالي"); },
          function () { alert("تعذّر تحديد موقعك. اختر مدينتك من القائمة."); });
        return;
      }
      var parts = v.split(",");
      var el = document.getElementById("pr-city");
      paint(parseFloat(parts[0]), parseFloat(parts[1]), el.options[el.selectedIndex].text);
    }
    var sel = document.getElementById("pr-city");
    if (sel) { sel.addEventListener("change", fromSelect); fromSelect(); }
  };

  /* ============================================================ qibla */
  T.compass = function () {
    var KAABA_LAT = 21.4225, KAABA_LON = 39.8262;

    function bearing(lat, lon) {
      var dLon = (KAABA_LON - lon) * D2R;
      var la1 = lat * D2R, la2 = KAABA_LAT * D2R;
      var y = Math.sin(dLon) * Math.cos(la2);
      var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
      return (Math.atan2(y, x) * R2D + 360) % 360;
    }
    function distance(lat, lon) {
      var R = 6371, la1 = lat * D2R, la2 = KAABA_LAT * D2R;
      var dLa = la2 - la1, dLo = (KAABA_LON - lon) * D2R;
      var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
              Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    function compassName(b) {
      var names = ["الشمال", "الشمال الشرقي", "الشرق", "الجنوب الشرقي",
                   "الجنوب", "الجنوب الغربي", "الغرب", "الشمال الغربي"];
      return names[Math.round(b / 45) % 8];
    }

    var qibla = 0;
    function paint(lat, lon) {
      qibla = bearing(lat, lon);
      txt("qb-deg", qibla.toFixed(1) + "°");
      txt("qb-dir", "من الشمال في اتجاه عقارب الساعة — جهة " + compassName(qibla));
      txt("qb-dist", n(Math.round(distance(lat, lon))));
      txt("qb-lat", lat.toFixed(3) + "°");
      txt("qb-lon", lon.toFixed(3) + "°");
      txt("qb-comp", compassName(qibla));
      rotate(qibla);
    }
    function rotate(deg) {
      var g = document.getElementById("qb-needle");
      if (g) { g.setAttribute("transform", "rotate(" + deg + " 100 100)"); }
    }

    function fromSelect() {
      var v = sval("qb-city");
      if (v === "geo") {
        if (!navigator.geolocation) { alert("متصفحك لا يدعم تحديد الموقع."); return; }
        navigator.geolocation.getCurrentPosition(
          function (p) { paint(p.coords.latitude, p.coords.longitude); },
          function () { alert("تعذّر تحديد موقعك. اختر مدينتك من القائمة."); });
        return;
      }
      var parts = v.split(",");
      paint(parseFloat(parts[0]), parseFloat(parts[1]));
    }
    var sel = document.getElementById("qb-city");
    if (sel) { sel.addEventListener("change", fromSelect); fromSelect(); }

    var live = document.getElementById("qb-live-btn");
    if (live) {
      live.addEventListener("click", function () {
        function attach() {
          window.addEventListener("deviceorientationabsolute", onOrient, true);
          window.addEventListener("deviceorientation", onOrient, true);
          txt("qb-live", "البوصلة مفعّلة — وجّه أعلى الجهاز نحو السهم الأخضر. ابتعد عن المعادن للحصول على قراءة دقيقة.");
        }
        if (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
          DeviceOrientationEvent.requestPermission().then(function (r) {
            if (r === "granted") { attach(); } else { txt("qb-live", "لم يُسمح بالوصول إلى حساس الاتجاه."); }
          }).catch(function () { txt("qb-live", "تعذّر تفعيل البوصلة على هذا الجهاز."); });
        } else if (window.DeviceOrientationEvent) {
          attach();
        } else {
          txt("qb-live", "هذا الجهاز لا يحتوي على حساس اتجاه. استخدم زاوية القبلة بالدرجات مع بوصلة عادية.");
        }
      });
    }
    function onOrient(e) {
      var heading = e.webkitCompassHeading !== undefined ? e.webkitCompassHeading
        : (e.alpha !== null ? 360 - e.alpha : null);
      if (heading === null) { return; }
      rotate(qibla - heading);
    }
  };

  /* ============================================================ hijri events */
  function nextHijri(hm, hd) {
    var t = todayOrd(), h = H.ordToH(t);
    if (!h) { return null; }
    for (var y = h.y; y <= h.y + 2 && H.inRange(y); y++) {
      if (hd > H.monthLength(y, hm)) { continue; }
      var o = H.hToOrd(y, hm, hd);
      if (o !== null && o >= t) { return { ord: o, hy: y }; }
    }
    return null;
  }

  function eventRow(label, hy, hm, hd) {
    if (!H.inRange(hy) || hd > H.monthLength(hy, hm)) { return ""; }
    var o = H.hToOrd(hy, hm, hd);
    return "<tr><td>" + label + "</td><td>" + H.fmtH({ y: hy, m: hm, d: hd }) +
      "</td><td>" + H.fmtG(H.ordToG(o)) + " (" + H.daysAr[H.weekday(o)] + ")</td></tr>";
  }

  T.ramadan = function () {
    var r = nextHijri(9, 1);
    if (!r) { return; }
    var g = H.ordToG(r.ord);
    txt("rm-date", H.fmtG(g) + " — " + H.daysAr[H.weekday(r.ord)]);
    txt("rm-h", "1 رمضان " + r.hy);
    txt("rm-wd", H.daysAr[H.weekday(r.ord)]);
    txt("rm-len", H.monthLength(r.hy, 9) + " يوماً");
    var eidOrd = H.hToOrd(r.hy, 10, 1);
    txt("rm-eid", eidOrd ? H.ordToG(eidOrd).d + " " + H.monthsG[H.ordToG(eidOrd).m - 1] : "—");
    M.startCountdown(document.getElementById("rm-cd"),
      M.riyadhMidnightUTC(g.y, g.m, g.d), "🌙 رمضان مبارك — بدأ الشهر الكريم!");
    html("rm-body",
      eventRow("أول أيام رمضان", r.hy, 9, 1) +
      eventRow("بداية العشر الأواخر", r.hy, 9, 21) +
      eventRow("ليلة القدر (أرجى الليالي)", r.hy, 9, 27) +
      eventRow("آخر أيام رمضان", r.hy, 9, H.monthLength(r.hy, 9)) +
      eventRow("عيد الفطر", r.hy, 10, 1));
  };

  T.eid = function () {
    var which = "fitr", timer = null;
    function paint() {
      var e = which === "fitr" ? nextHijri(10, 1) : nextHijri(12, 10);
      if (!e) { return; }
      var g = H.ordToG(e.ord);
      txt("eid-name", which === "fitr" ? "عيد الفطر" : "عيد الأضحى");
      txt("eid-date", H.fmtG(g));
      txt("eid-h", which === "fitr" ? "1 شوال " + e.hy : "10 ذو الحجة " + e.hy);
      txt("eid-wd", H.daysAr[H.weekday(e.ord)]);
      txt("eid-weeks", n(Math.max(0, Math.round((e.ord - todayOrd()) / 7))));
      txt("eid-year", e.hy + " هـ");
      if (timer) { clearInterval(timer); }
      html("eid-cd",
        '<div class="cd-cell"><b data-cd="days">—</b><span>يوم</span></div>' +
        '<div class="cd-cell"><b data-cd="hours">—</b><span>ساعة</span></div>' +
        '<div class="cd-cell"><b data-cd="minutes">—</b><span>دقيقة</span></div>' +
        '<div class="cd-cell"><b data-cd="seconds">—</b><span>ثانية</span></div>');
      timer = M.startCountdown(document.getElementById("eid-cd"),
        M.riyadhMidnightUTC(g.y, g.m, g.d), "🎉 عيدكم مبارك!");
      var body = which === "fitr"
        ? eventRow("آخر أيام رمضان", e.hy - (0), 9, H.monthLength(e.hy, 9)) +
          eventRow("عيد الفطر", e.hy, 10, 1) +
          eventRow("ثاني أيام العيد", e.hy, 10, 2) +
          eventRow("ثالث أيام العيد", e.hy, 10, 3)
        : eventRow("يوم التروية", e.hy, 12, 8) +
          eventRow("يوم عرفة", e.hy, 12, 9) +
          eventRow("عيد الأضحى (يوم النحر)", e.hy, 12, 10) +
          eventRow("أول أيام التشريق", e.hy, 12, 11) +
          eventRow("ثاني أيام التشريق", e.hy, 12, 12) +
          eventRow("ثالث أيام التشريق", e.hy, 12, 13);
      html("eid-body", body);
    }
    var a = document.getElementById("eid-tab-f"), b = document.getElementById("eid-tab-a");
    if (a && b) {
      a.addEventListener("click", function () {
        which = "fitr"; a.setAttribute("aria-pressed", "true"); b.setAttribute("aria-pressed", "false"); paint();
      });
      b.addEventListener("click", function () {
        which = "adha"; b.setAttribute("aria-pressed", "true"); a.setAttribute("aria-pressed", "false"); paint();
      });
    }
    paint();
  };

  T.hajj = function () {
    var e = nextHijri(12, 8);
    if (!e) { return; }
    var g = H.ordToG(e.ord);
    txt("hj-date", H.fmtG(g) + " — " + H.daysAr[H.weekday(e.ord)]);
    var ar = H.hToOrd(e.hy, 12, 9), eid = H.hToOrd(e.hy, 12, 10);
    txt("hj-arafah", ar ? H.ordToG(ar).d + " " + H.monthsG[H.ordToG(ar).m - 1] : "—");
    txt("hj-eid", eid ? H.ordToG(eid).d + " " + H.monthsG[H.ordToG(eid).m - 1] : "—");
    txt("hj-year", e.hy + " هـ");
    txt("hj-wd", H.daysAr[H.weekday(e.ord)]);
    M.startCountdown(document.getElementById("hj-cd"),
      M.riyadhMidnightUTC(g.y, g.m, g.d), "🕋 بدأت مناسك الحج — حجٌّ مبرور!");
    var steps = [[8, "يوم التروية", "الإحرام والتوجّه إلى منى والمبيت بها"],
                 [9, "يوم عرفة", "الوقوف بعرفة ثم الدفع إلى مزدلفة"],
                 [10, "يوم النحر", "رمي جمرة العقبة، الذبح، الحلق، طواف الإفاضة"],
                 [11, "أول أيام التشريق", "المبيت بمنى ورمي الجمرات الثلاث"],
                 [12, "ثاني أيام التشريق", "رمي الجمرات، ومن تعجّل خرج قبل الغروب"],
                 [13, "ثالث أيام التشريق", "لمن تأخّر: رمي الجمرات ثم طواف الوداع"]];
    var rows = "";
    steps.forEach(function (s) {
      if (s[0] > H.monthLength(e.hy, 12)) { return; }
      var o = H.hToOrd(e.hy, 12, s[0]);
      rows += "<tr><td><strong>" + s[1] + "</strong></td><td>" + s[0] + " ذو الحجة — " +
        H.fmtG(H.ordToG(o)) + "</td><td>" + s[2] + "</td></tr>";
    });
    html("hj-body", rows);
  };

  /* ============================================================ hijri calendar */
  T["hijri-calendar"] = function () {
    var EVENTS = { "1-1": "رأس السنة الهجرية", "1-10": "عاشوراء", "3-12": "المولد النبوي",
                   "7-27": "الإسراء والمعراج", "8-15": "منتصف شعبان", "9-1": "أول رمضان",
                   "9-27": "ليلة القدر (أرجى)", "10-1": "عيد الفطر", "12-8": "يوم التروية",
                   "12-9": "يوم عرفة", "12-10": "عيد الأضحى" };
    function paint() {
      var hy = ival("hc-y"), hm = ival("hc-m");
      if (!H.inRange(hy)) { return; }
      var len = H.monthLength(hy, hm), first = H.hToOrd(hy, hm, 1);
      var lead = H.weekday(first);
      txt("hc-title", H.monthsAr[hm - 1] + " " + hy + " هـ");
      txt("hc-sub", len + " يوماً — من " + H.fmtG(H.ordToG(first)) +
        " إلى " + H.fmtG(H.ordToG(first + len - 1)));
      var t = todayOrd(), rows = "", cell = 0, row = "";
      for (var i = 0; i < lead; i++) { row += "<td></td>"; cell++; }
      for (var d = 1; d <= len; d++) {
        var o = first + d - 1, g = H.ordToG(o);
        var ev = EVENTS[hm + "-" + d];
        var isToday = o === t;
        row += '<td' + (isToday ? ' style="background:var(--green);color:#fff;border-radius:8px"'
                        : ev ? ' style="background:var(--green-l)"' : "") + '>' +
          '<strong style="font-size:1.05rem">' + d + "</strong><br>" +
          '<span style="font-size:.72rem;color:' + (isToday ? "#d6efe1" : "var(--ink-faint)") + '">' +
          g.d + "/" + g.m + "</span>" +
          (ev ? '<br><span style="font-size:.62rem;color:' + (isToday ? "#fff" : "var(--green-d)") + '">' + ev + "</span>" : "") +
          "</td>";
        cell++;
        if (cell % 7 === 0) { rows += "<tr>" + row + "</tr>"; row = ""; }
      }
      if (row) {
        while (cell % 7 !== 0) { row += "<td></td>"; cell++; }
        rows += "<tr>" + row + "</tr>";
      }
      html("hc-body", rows);
    }
    function shift(k) {
      var hy = ival("hc-y"), hm = ival("hc-m") + k;
      if (hm > 12) { hm = 1; hy++; }
      if (hm < 1) { hm = 12; hy--; }
      if (!H.inRange(hy)) { return; }
      document.getElementById("hc-y").value = hy;
      document.getElementById("hc-m").value = hm;
      paint();
    }
    ["hc-y", "hc-m"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener("change", paint); }
    });
    var p = document.getElementById("hc-prev"), nx = document.getElementById("hc-next"),
        nw = document.getElementById("hc-now");
    if (p) { p.addEventListener("click", function () { shift(-1); }); }
    if (nx) { nx.addEventListener("click", function () { shift(1); }); }
    if (nw) {
      nw.addEventListener("click", function () {
        var h = H.ordToH(todayOrd());
        if (!h) { return; }
        document.getElementById("hc-y").value = h.y;
        document.getElementById("hc-m").value = h.m;
        paint();
      });
    }
    var h0 = H.ordToH(todayOrd());
    if (h0) {
      document.getElementById("hc-y").value = h0.y;
      document.getElementById("hc-m").value = h0.m;
    }
    paint();
  };

  /* ============================================================ zakat */
  T.zkah = function () {
    function go() {
      var assets = fval("zk-cash") + fval("zk-gold") + fval("zk-trade") + fval("zk-debtin");
      var net = assets - fval("zk-debtout");
      var nisab = 595 * fval("zk-silver");
      show("zk-out", true); show("zk-stats", true);
      txt("zk-total", n(assets, 2));
      txt("zk-net", n(net, 2));
      txt("zk-nisab", n(nisab, 2));
      if (net <= 0) {
        txt("zk-big", "لا زكاة");
        txt("zk-status", "الصافي بعد خصم الديون صفر أو أقل، فلا وعاء زكوي.");
        return;
      }
      if (nisab <= 0) {
        txt("zk-big", "—");
        txt("zk-status", "أدخل سعر غرام الفضة لتحديد النصاب.");
        return;
      }
      if (net < nisab) {
        txt("zk-big", "لم يبلغ النصاب");
        txt("zk-status", "الصافي " + n(net, 2) + " ريال، والنصاب " + n(nisab, 2) +
          " ريال. ينقصك " + n(nisab - net, 2) + " ريال لبلوغ النصاب.");
        return;
      }
      txt("zk-big", n(net * 0.025, 2) + " ريال");
      txt("zk-status", "بلغ مالك النصاب. الزكاة 2.5% من " + n(net, 2) +
        " ريال، بشرط أن يكون قد حال عليه الحول (سنة هجرية كاملة).");
    }
    var b = document.getElementById("zk-go");
    if (b) { b.addEventListener("click", go); }
  };

  T["zkah-gold"] = function () {
    function go() {
      var karat = parseFloat(sval("zg-karat")), w = fval("zg-weight"), price = fval("zg-price");
      var pure = w * karat / 24, value = w * price;
      show("zg-out", true); show("zg-stats", true);
      txt("zg-pure", n(pure, 1));
      txt("zg-value", n(value, 2));
      if (pure < 85) {
        txt("zg-big", "لم يبلغ النصاب");
        txt("zg-status", "وزنك يعادل " + n(pure, 1) + " غراماً من الذهب الخالص، والنصاب 85 غراماً. " +
          "ينقصك " + n(85 - pure, 1) + " غراماً — أي نحو " + n((85 - pure) * 24 / karat, 1) +
          " غراماً من عيار " + karat + ".");
        return;
      }
      txt("zg-big", n(value * 0.025, 2) + " ريال");
      txt("zg-status", "بلغ ذهبك النصاب (" + n(pure, 1) + " غراماً خالصاً). الزكاة 2.5% من قيمته " +
        "السوقية البالغة " + n(value, 2) + " ريال، بشرط حولان الحول.");
    }
    var b = document.getElementById("zg-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* expose for tests */
  window.__solar = { prayerTimes: prayerTimes, fmtTime: fmtTime, julian: julian };
})();
