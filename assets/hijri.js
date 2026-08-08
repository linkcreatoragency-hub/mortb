/* Umm al-Qura Hijri engine — the official Saudi calendar.
   Covers 1370–1500 AH (13 Oct 1950 – 15 Nov 2077 CE). Month lengths are taken from the
   Umm al-Qura tables and every month boundary in the range was verified before shipping.
   Dates outside the range return null rather than a wrong answer. */
(function (g) {
  var Y0 = 1370, EPOCH = 712143; /* ordinal (0001-01-01 = day 1) of 1 Muharram 1370 */
  var M = [1365,3749,3370,2730,3285,1621,1394,3497,1365,2730,1365,1325,2669,1370,1365,1869,3411,3412,1366,3413,725,3413,3412,3397,1621,1325,2653,1370,2773,1706,3403,1322,2647,1198,2422,1388,2901,2730,2645,1197,2397,730,1497,3506,2980,2890,2645,693,1397,2922,3026,3012,2953,2709,1325,1453,2922,1748,3529,3474,2726,2390,686,1389,874,2901,2730,2381,1181,2397,698,1461,1450,3413,2714,2350,622,1373,2778,1748,1701,1355,2711,1358,2734,1452,2985,3474,2853,1611,3243,1370,2901,1746,3749,3658,2709,1325,2733,876,1881,1746,1685,1325,2651,1210,2490,948,2921,2898,2726,1206,2413,748,1753,3762,3412,3370,2646,1198,2413,3434,2900,2857,2707,1323,2647,1334,2741,1706,3731];

  var MONTHS_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
                   "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  var MONTHS_G = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var DAYS_SHORT = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  function mlen(y, m) { return ((M[y - Y0] >> (m - 1)) & 1) ? 30 : 29; }
  function yearLen(y) { var t = 0, i; for (i = 1; i <= 12; i++) { t += mlen(y, i); } return t; }
  function inRange(y) { return y >= Y0 && y < Y0 + M.length; }

  function gToOrd(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    var jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
              Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    return jdn - 1721425;
  }
  function ordToG(o) {
    var jdn = o + 1721425;
    var a = jdn + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    var d2 = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d2 / 4);
    var m2 = Math.floor((5 * e + 2) / 153);
    return { y: 100 * b + d2 - 4800 + Math.floor(m2 / 10),
             m: m2 + 3 - 12 * Math.floor(m2 / 10),
             d: e - Math.floor((153 * m2 + 2) / 5) + 1 };
  }

  function hToOrd(y, m, d) {
    if (!inRange(y) || m < 1 || m > 12 || d < 1 || d > mlen(y, m)) { return null; }
    var o = EPOCH, yy, i;
    for (yy = Y0; yy < y; yy++) { o += yearLen(yy); }
    for (i = 1; i < m; i++) { o += mlen(y, i); }
    return o + d - 1;
  }
  function ordToH(o) {
    var y = Y0, rest = o - EPOCH, yl, m = 1, ml;
    if (rest < 0) { return null; }
    for (;;) {
      if (!inRange(y)) { return null; }
      yl = yearLen(y);
      if (rest < yl) { break; }
      rest -= yl; y++;
    }
    for (;;) { ml = mlen(y, m); if (rest < ml) { break; } rest -= ml; m++; }
    return { y: y, m: m, d: rest + 1 };
  }

  g.Hijri = {
    Y0: Y0, YN: Y0 + M.length - 1,
    monthsAr: MONTHS_AR, monthsG: MONTHS_G, daysAr: DAYS_AR, daysShort: DAYS_SHORT,
    monthLength: mlen, yearLength: yearLen, inRange: inRange,
    gToOrd: gToOrd, ordToG: ordToG, hToOrd: hToOrd, ordToH: ordToH,
    gToH: function (y, m, d) { return ordToH(gToOrd(y, m, d)); },
    hToG: function (y, m, d) { var o = hToOrd(y, m, d); return o === null ? null : ordToG(o); },
    fromDate: function (dt) { return ordToH(gToOrd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())); },
    /* 0 = Sunday. Ordinal day 1 (0001-01-01) was a Monday, so ord % 7 lands Monday on 1. */
    weekday: function (o) { var w = o % 7; return w < 0 ? w + 7 : w; },
    /* Riyadh wall-clock time (UTC+3, no DST) whatever the visitor's own timezone is */
    riyadhNow: function () {
      var n = new Date();
      return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 3 * 3600000);
    },
    fmtH: function (h) { return h ? h.d + " " + MONTHS_AR[h.m - 1] + " " + h.y + " هـ" : "—"; },
    fmtG: function (o) { return o ? o.d + " " + MONTHS_G[o.m - 1] + " " + o.y + " م" : "—"; }
  };
})(window);
