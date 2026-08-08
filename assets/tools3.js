/* Finance, health, national and fun tools. */
(function () {
  "use strict";

  var H = window.Hijri, M = window.M, T = window.TOOLS;
  if (!T) { return; }

  function ival(id) { var e = document.getElementById(id); var v = e ? parseInt(e.value, 10) : NaN; return isNaN(v) ? 0 : v; }
  function fval(id) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isNaN(v) ? 0 : v; }
  function sval(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function txt(id, v) { var e = document.getElementById(id); if (e) { e.textContent = v; } }
  function html(id, v) { var e = document.getElementById(id); if (e) { e.innerHTML = v; } }
  function show(id, on) { var e = document.getElementById(id); if (e) { e.classList.toggle("hide", !on); } }
  function n(v, dp) { return M.n(v, dp); }
  function money(v) { return n(Math.round(v * 100) / 100, 2); }
  function todayOrd() { var t = M.riyadhNow(); return H.gToOrd(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  function isWeekend(o) { var w = H.weekday(o); return w === 5 || w === 6; }

  function tabs(aId, bId, aBox, bBox, cb) {
    var a = document.getElementById(aId), b = document.getElementById(bId);
    if (!a || !b) { return; }
    function set(w) {
      a.setAttribute("aria-pressed", w === "a" ? "true" : "false");
      b.setAttribute("aria-pressed", w === "b" ? "true" : "false");
      var ea = document.getElementById(aBox), eb = document.getElementById(bBox);
      if (ea) { ea.hidden = w !== "a"; }
      if (eb) { eb.hidden = w !== "b"; }
      if (cb) { cb(w); }
    }
    a.addEventListener("click", function () { set("a"); });
    b.addEventListener("click", function () { set("b"); });
  }

  function countdownTo(elId, ord, doneMsg) {
    var g = H.ordToG(ord);
    return M.startCountdown(document.getElementById(elId),
      M.riyadhMidnightUTC(g.y, g.m, g.d), doneMsg);
  }

  /* ============================================================ salary (27 Hijri) */
  function salaryPayOrd(hy, hm) {
    if (!H.inRange(hy) || 27 > H.monthLength(hy, hm)) { return null; }
    var o = H.hToOrd(hy, hm, 27);
    while (isWeekend(o)) { o -= 1; }
    return o;
  }

  T.salary = function () {
    var t = todayOrd(), h = H.ordToH(t);
    if (!h) { return; }
    var list = [], hy = h.y, hm = h.m;
    for (var i = 0; i < 4; i++) {
      var o = salaryPayOrd(hy, hm);
      if (o !== null) { list.push({ o: o, hy: hy, hm: hm }); }
      hm += 1; if (hm > 12) { hm = 1; hy += 1; }
    }
    /* include the previous Hijri month in case its pay date is still ahead */
    var ph = h.m - 1, py = h.y;
    if (ph < 1) { ph = 12; py -= 1; }
    var po = salaryPayOrd(py, ph);
    if (po !== null) { list.unshift({ o: po, hy: py, hm: ph }); }
    list = list.filter(function (x) { return x.o >= t; }).sort(function (a, b) { return a.o - b.o; });
    if (!list.length) { return; }

    var next = list[0], g = H.ordToG(next.o);
    txt("sal-date", H.fmtG(g) + " — " + H.daysAr[H.weekday(next.o)]);
    txt("sal-h", "27 " + H.monthsAr[next.hm - 1] + " " + next.hy);
    txt("sal-wd", H.daysAr[H.weekday(next.o)]);
    var raw = H.hToOrd(next.hy, next.hm, 27);
    txt("sal-note", raw === next.o ? "في موعده" : "قُدّم " + (raw - next.o) + " يوماً");
    if (list[1]) {
      var g2 = H.ordToG(list[1].o);
      txt("sal-next", g2.d + " " + H.monthsG[g2.m - 1]);
    }
    countdownTo("sal-cd", next.o, "💰 نزل الراتب!");
  };

  /* ============================================================ citizen account (10th) */
  function citizenOrd(y, m) {
    var o = H.gToOrd(y, m, 10), w = H.weekday(o);
    if (w === 5) { return o - 1; }   /* Friday  -> the 9th  */
    if (w === 6) { return o + 1; }   /* Saturday -> the 11th */
    return o;
  }

  T.citizen = function () {
    var t = todayOrd(), g0 = H.ordToG(t);
    var cands = [];
    for (var k = -1; k <= 3; k++) {
      var mi = g0.y * 12 + (g0.m - 1) + k;
      cands.push(citizenOrd(Math.floor(mi / 12), (mi % 12 + 12) % 12 + 1));
    }
    cands = cands.filter(function (o) { return o >= t; }).sort(function (a, b) { return a - b; });
    if (!cands.length) { return; }
    var next = cands[0], g = H.ordToG(next), h = H.ordToH(next);
    txt("ct-date", H.fmtG(g) + " — " + H.daysAr[H.weekday(next)]);
    txt("ct-wd", H.daysAr[H.weekday(next)]);
    txt("ct-h", h ? h.d + " " + H.monthsAr[h.m - 1] : "—");
    var base = H.gToOrd(g.y, g.m, 10);
    txt("ct-note", next === base ? "في موعده"
      : next < base ? "قُدّم ليوم الخميس" : "أُخّر ليوم الأحد");
    if (cands[1]) {
      var g2 = H.ordToG(cands[1]);
      txt("ct-next", g2.d + " " + H.monthsG[g2.m - 1]);
    }
    countdownTo("ct-cd", next, "🏦 نزل حساب المواطن!");
  };

  /* ============================================================ loan */
  T.loan = function () {
    function go() {
      var amount = fval("ln-amount") - fval("ln-down");
      var years = fval("ln-years"), apr = fval("ln-apr") / 100;
      var cur = sval("ln-cur"), income = fval("ln-income");
      var months = Math.round(years * 12);
      show("ln-out", true); show("ln-stats", true); show("ln-schedule", true);
      if (amount <= 0 || months <= 0) {
        txt("ln-big", "—");
        txt("ln-sub", "أدخل مبلغ تمويل ومدة صحيحين.");
        return;
      }
      var r = apr / 12;
      var pmt = r === 0 ? amount / months : amount * r / (1 - Math.pow(1 + r, -months));
      var total = pmt * months, cost = total - amount;
      txt("ln-big", money(pmt) + " " + cur);
      txt("ln-sub", "على " + months + " قسطاً شهرياً" +
        (fval("ln-down") > 0 ? " بعد دفعة أولى " + money(fval("ln-down")) + " " + cur : ""));
      txt("ln-total", money(total));
      txt("ln-cost", money(cost));
      txt("ln-months", n(months));
      txt("ln-ratio", income > 0 ? Math.round(pmt / income * 100) + "%" : "—");

      var bal = amount, rows = "", step = months > 60 ? 12 : (months > 24 ? 3 : 1), shown = 0;
      for (var i = 1; i <= months; i++) {
        var interest = bal * r, principal = pmt - interest;
        bal = Math.max(0, bal - principal);
        if (i % step === 0 || i === 1 || i === months) {
          rows += "<tr><td>" + i + "</td><td class=\"num\">" + money(principal) +
            "</td><td class=\"num\">" + money(interest) + "</td><td class=\"num\">" + money(bal) + "</td></tr>";
          shown++;
        }
      }
      html("ln-body", rows);
      txt("ln-note", step > 1
        ? "الجدول يعرض " + shown + " صفاً من أصل " + months + " قسطاً (كل " + step + " أقساط) لتسهيل القراءة."
        : "الجدول يعرض كل الأقساط.");
    }
    var b = document.getElementById("ln-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ end of service */
  T.service = function () {
    function go() {
      var wage = fval("sv-basic") + fval("sv-housing");
      var years = ival("sv-years"), months = ival("sv-months"), days = ival("sv-days");
      var totalYears = years + months / 12 + days / 365;
      var reason = sval("sv-reason");
      show("sv-out", true); show("sv-stats", true); show("sv-detail", true);

      if (wage <= 0 || totalYears <= 0) {
        txt("sv-big", "—"); txt("sv-sub", "أدخل الأجر ومدة الخدمة."); return;
      }
      var firstPart = Math.min(totalYears, 5) * 0.5;
      var secondPart = Math.max(0, totalYears - 5) * 1;
      var fullMonths = firstPart + secondPart;
      var full = fullMonths * wage;

      var pct = 1, why = "";
      if (reason === "resign") {
        if (totalYears < 2) { pct = 0; why = "الاستقالة قبل إكمال سنتين — لا تُستحق مكافأة."; }
        else if (totalYears < 5) { pct = 1 / 3; why = "استقالة بعد سنتين وقبل خمس سنوات — يُستحق ثلث المكافأة."; }
        else if (totalYears < 10) { pct = 2 / 3; why = "استقالة بعد خمس سنوات وقبل عشر — يُستحق ثلثا المكافأة."; }
        else { pct = 1; why = "استقالة بعد عشر سنوات فأكثر — تُستحق المكافأة كاملة."; }
      } else {
        var labels = {
          employer: "إنهاء العلاقة من صاحب العمل",
          expiry: "انتهاء مدة العقد محدد المدة",
          force: "القوة القاهرة أو إغلاق المنشأة",
          retire: "بلوغ سن التقاعد",
          female: "استقالة العاملة خلال المدة النظامية بعد الزواج أو الوضع",
          art81: "ترك العمل لسبب مشروع وفق المادة 81"
        };
        why = (labels[reason] || "") + " — تُستحق المكافأة كاملة.";
      }
      var amount = full * pct;
      txt("sv-big", money(amount) + " ريال");
      txt("sv-sub", why);
      txt("sv-wage", money(wage));
      txt("sv-dur", years + " سنة" + (months ? " و" + months + " شهر" : ""));
      txt("sv-full", money(full));
      txt("sv-pct", Math.round(pct * 100) + "%");

      html("sv-steps",
        "<strong>خطوات الحساب:</strong><br>" +
        "الأجر المحتسب = " + money(fval("sv-basic")) + " أساسي" +
        (fval("sv-housing") > 0 ? " + " + money(fval("sv-housing")) + " بدلات" : "") +
        " = <strong>" + money(wage) + " ريال</strong><br>" +
        "الخمس سنوات الأولى: " + Math.min(totalYears, 5).toFixed(2) + " × نصف شهر = " +
        firstPart.toFixed(2) + " شهر<br>" +
        (secondPart > 0 ? "ما زاد عن خمس سنوات: " + Math.max(0, totalYears - 5).toFixed(2) +
          " × شهر كامل = " + secondPart.toFixed(2) + " شهر<br>" : "") +
        "إجمالي الأشهر المستحقة = " + fullMonths.toFixed(2) + " شهر<br>" +
        "المكافأة كاملة = " + fullMonths.toFixed(2) + " × " + money(wage) + " = <strong>" + money(full) + " ريال</strong><br>" +
        "نسبة الاستحقاق = " + Math.round(pct * 100) + "% ← <strong>" + money(amount) + " ريال</strong>");
    }
    var b = document.getElementById("sv-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ annual leave */
  T.vacation = function () {
    function go() {
      var wage = fval("vc-basic") + fval("vc-housing");
      var years = ival("vc-years") + ival("vc-months") / 12;
      var used = fval("vc-used");
      var annual = years >= 5 ? 30 : 21;
      var dayValue = wage / 30;
      var accrued = annual;                 /* full-year entitlement */
      var left = Math.max(0, annual - used);
      show("vc-out", true); show("vc-stats", true);
      if (wage <= 0) { txt("vc-big", "—"); txt("vc-sub", "أدخل الأجر."); return; }
      txt("vc-big", money(left * dayValue) + " ريال");
      txt("vc-sub", "عن " + n(left, 1) + " يوماً متبقية من رصيدك السنوي البالغ " + annual + " يوماً" +
        (years >= 5 ? " (لإكمالك خمس سنوات فأكثر)" : " (لخدمة أقل من خمس سنوات)"));
      txt("vc-annual", annual + " يوماً");
      txt("vc-left", n(left, 1));
      txt("vc-day", money(dayValue));
      txt("vc-accrued", n(accrued, 1) + " يوماً");
    }
    var b = document.getElementById("vc-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ pensions */
  function pension(prefix, divisor) {
    return function () {
      function go() {
        var salary = fval(prefix + "-salary");
        var months = ival(prefix + "-years") * 12 + ival(prefix + "-months");
        show(prefix + "-out", true); show(prefix + "-stats", true); show(prefix + "-detail", true);
        if (salary <= 0 || months <= 0) {
          txt(prefix + "-big", "—"); txt(prefix + "-sub", "أدخل الراتب ومدة الخدمة."); return;
        }
        var raw = salary * months / divisor;
        var cap = salary * 0.8;
        var final = Math.min(raw, cap);
        var minYears = divisor === 480 ? 25 : 18;
        txt(prefix + "-big", money(final) + " ريال شهرياً");
        txt(prefix + "-sub", months < minYears * 12
          ? "تنبيه: مدة الخدمة أقل من " + minYears + " سنة، وهي الحد الأدنى المعتاد لاستحقاق المعاش — وقد تُصرف مكافأة بدل المعاش."
          : (raw > cap ? "بلغ المعاش الحد الأقصى وهو 80% من الراتب الأساسي." : "مستوفٍ للحد الأدنى لمدة الخدمة."));
        txt(prefix + "-pct", Math.round(final / salary * 100) + "%");
        txt(prefix + "-year", money(final * 12));
        txt(prefix + "-months2", n(months));
        txt(prefix + "-cap", money(cap));
        html(prefix + "-steps",
          "<strong>خطوات الحساب:</strong><br>" +
          "المعاش = (" + money(salary) + " × " + months + ") ÷ " + divisor + " = <strong>" + money(raw) + " ريال</strong><br>" +
          "الحد الأقصى (80% من الراتب) = " + money(cap) + " ريال<br>" +
          "المعاش النهائي = <strong>" + money(final) + " ريال شهرياً</strong>");
      }
      var b = document.getElementById(prefix + "-go");
      if (b) { b.addEventListener("click", go); }
    };
  }
  T["retirement-civil"] = pension("rc", 480);
  T["retirement-military"] = pension("rm2", 420);

  /* ============================================================ VAT */
  T.vat = function () {
    var mode = "add";
    tabs("vt-tab-add", "vt-tab-ext", "", "", function (w) {
      mode = w === "a" ? "add" : "ext";
      txt("vt-lbl", mode === "add" ? "المبلغ قبل الضريبة" : "المبلغ شامل الضريبة");
      show("vt-out", false); show("vt-stats", false);
    });
    function go() {
      var amount = fval("vt-amount"), rate = fval("vt-rate") / 100, cur = sval("vt-cur");
      show("vt-out", true); show("vt-stats", true);
      var net, tax, gross;
      if (mode === "add") { net = amount; tax = net * rate; gross = net + tax; }
      else { gross = amount; net = gross / (1 + rate); tax = gross - net; }
      txt("vt-rlbl", mode === "add" ? "المبلغ شامل الضريبة" : "المبلغ قبل الضريبة");
      txt("vt-big", money(mode === "add" ? gross : net) + " " + cur);
      txt("vt-sub", "قيمة الضريبة " + money(tax) + " " + cur + " بنسبة " + fval("vt-rate") + "%");
      txt("vt-net", money(net));
      txt("vt-tax", money(tax));
      txt("vt-gross", money(gross));
      txt("vt-pct", fval("vt-rate") + "%");
    }
    var b = document.getElementById("vt-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ GOSI */
  T.gosi = function () {
    var sel = document.getElementById("gs-nat");
    function syncRates() {
      var expat = sval("gs-nat") === "expat";
      ["gs-emp", "gs-comp", "gs-saned"].forEach(function (id) {
        var e = document.getElementById(id);
        if (e) { e.disabled = expat; }
      });
    }
    if (sel) { sel.addEventListener("change", syncRates); syncRates(); }

    function go() {
      var base = fval("gs-basic") + fval("gs-housing");
      var expat = sval("gs-nat") === "expat";
      var eRate = expat ? 0 : fval("gs-emp") + fval("gs-saned");
      var cRate = expat ? 2 : fval("gs-comp") + fval("gs-saned") + 2;
      var e = base * eRate / 100, c = base * cRate / 100;
      show("gs-out", true); show("gs-stats", true); show("gs-detail", true);
      txt("gs-big", money(e) + " ريال شهرياً");
      txt("gs-sub", expat
        ? "غير السعوديين لا يُخصم من رواتبهم شيء — التسجيل في فرع الأخطار المهنية فقط وهو على صاحب العمل."
        : "بنسبة إجمالية " + n(eRate, 2) + "% من الأجر الخاضع للاشتراك.");
      txt("gs-base", money(base));
      txt("gs-e", money(e));
      txt("gs-c", money(c));
      txt("gs-net", money(fval("gs-basic") + fval("gs-housing") - e));
      html("gs-steps",
        "<strong>تفصيل الحساب:</strong><br>" +
        "الأجر الخاضع للاشتراك = " + money(fval("gs-basic")) + " أساسي + " +
        money(fval("gs-housing")) + " سكن = <strong>" + money(base) + " ريال</strong><br>" +
        (expat
          ? "الأخطار المهنية 2% على صاحب العمل = " + money(c) + " ريال — ولا خصم على الموظف."
          : "حصة الموظف = " + n(fval("gs-emp"), 2) + "% معاشات + " + n(fval("gs-saned"), 2) +
            "% ساند = " + n(eRate, 2) + "% ← <strong>" + money(e) + " ريال</strong><br>" +
            "حصة صاحب العمل = " + n(fval("gs-comp"), 2) + "% معاشات + " + n(fval("gs-saned"), 2) +
            "% ساند + 2% أخطار مهنية = " + n(cRate, 2) + "% ← " + money(c) + " ريال") +
        "<br><em>عدّل النسب لتطابق ما هو ظاهر في مسيّر راتبك.</em>");
    }
    var b = document.getElementById("gs-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ BMI */
  T.bmi = function () {
    function go() {
      var h = fval("bmi-h") / 100, w = fval("bmi-w");
      show("bmi-out", true); show("bmi-stats", true);
      if (h <= 0 || w <= 0) { txt("bmi-big", "—"); txt("bmi-cat", "أدخل طولاً ووزناً صحيحين."); return; }
      var bmi = w / (h * h);
      var cats = [[18.5, "نقص في الوزن", "قد يستدعي مراجعة مختص التغذية"],
                  [25, "وزن طبيعي ✅", "وزنك ضمن النطاق الصحي — حافظ عليه"],
                  [30, "زيادة في الوزن", "يُنصح بتعديل النمط الغذائي والحركي"],
                  [35, "سمنة درجة أولى", "يُنصح بمتابعة طبية وخطة واضحة"],
                  [40, "سمنة درجة ثانية", "تستدعي متابعة طبية منتظمة"],
                  [999, "سمنة مفرطة", "تحتاج خطة علاجية بإشراف مختص"]];
      var cat = cats[cats.length - 1];
      for (var i = 0; i < cats.length; i++) { if (bmi < cats[i][0]) { cat = cats[i]; break; } }
      txt("bmi-big", bmi.toFixed(1));
      txt("bmi-cat", cat[1] + " — " + cat[2]);
      var lo = 18.5 * h * h, hi = 24.9 * h * h;
      txt("bmi-ideal", n(lo, 1) + " – " + n(hi, 1) + " كغ");
      txt("bmi-min", n(lo, 1) + " كغ");
      txt("bmi-max", n(hi, 1) + " كغ");
      txt("bmi-diff", w < lo ? "+" + n(lo - w, 1) + " كغ" : w > hi ? "−" + n(w - hi, 1) + " كغ" : "ضمن النطاق ✅");
    }
    var b = document.getElementById("bmi-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ ideal weight */
  T["ideal-weight"] = function () {
    function go() {
      var cm = fval("iw-h"), male = sval("iw-sex") === "m", cur = fval("iw-w");
      show("iw-out", true); show("iw-stats", true);
      if (cm <= 0) { txt("iw-big", "—"); return; }
      var inchesOver5ft = Math.max(0, (cm - 152.4) / 2.54);
      var devine = (male ? 50 : 45.5) + (male ? 2.3 : 2.3) * inchesOver5ft;
      var robinson = (male ? 52 : 49) + (male ? 1.9 : 1.7) * inchesOver5ft;
      var miller = (male ? 56.2 : 53.1) + (male ? 1.41 : 1.36) * inchesOver5ft;
      var hamwi = (male ? 48 : 45.5) + (male ? 2.7 : 2.2) * inchesOver5ft;
      var m = cm / 100, lo = 18.5 * m * m, hi = 24.9 * m * m;
      txt("iw-big", n(lo, 1) + " – " + n(hi, 1) + " كغ");
      txt("iw-sub", cur > 0
        ? (cur < lo ? "وزنك الحالي أقل من النطاق بـ " + n(lo - cur, 1) + " كغ."
          : cur > hi ? "وزنك الحالي أعلى من النطاق بـ " + n(cur - hi, 1) + " كغ."
            : "وزنك الحالي داخل النطاق الصحي ✅")
        : "النطاق مبني على مؤشر كتلة الجسم بين 18.5 و24.9 لطولك.");
      txt("iw-devine", n(devine, 1) + " كغ");
      txt("iw-robinson", n(robinson, 1) + " كغ");
      txt("iw-miller", n(miller, 1) + " كغ");
      txt("iw-hamwi", n(hamwi, 1) + " كغ");
    }
    var b = document.getElementById("iw-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ calories */
  T.calories = function () {
    function go() {
      var male = sval("cl-sex") === "m";
      var age = fval("cl-age"), h = fval("cl-h"), w = fval("cl-w");
      var act = parseFloat(sval("cl-act")) || 1.2;
      show("cl-out", true); show("cl-stats", true); show("cl-macro", true);
      if (age <= 0 || h <= 0 || w <= 0) { txt("cl-big", "—"); return; }
      var bmr = 10 * w + 6.25 * h - 5 * age + (male ? 5 : -161);
      var tdee = bmr * act;
      txt("cl-big", n(Math.round(tdee)) + " سعرة يومياً");
      txt("cl-sub", "معدل الأيض الأساسي " + n(Math.round(bmr)) + " سعرة، مضروباً في معامل نشاطك " + act);
      txt("cl-bmr", n(Math.round(bmr)));
      txt("cl-loss", n(Math.round(Math.max(male ? 1500 : 1200, tdee - 550))));
      txt("cl-loss2", n(Math.round(Math.max(male ? 1500 : 1200, tdee - 1100))));
      txt("cl-gain", n(Math.round(tdee + 400)));
      var macros = [["البروتين", 0.30, 4], ["الكربوهيدرات", 0.40, 4], ["الدهون", 0.30, 9]];
      var rows = "";
      macros.forEach(function (mc) {
        var cal = tdee * mc[1];
        rows += "<tr><td>" + mc[0] + "</td><td>" + Math.round(mc[1] * 100) + "%</td><td class=\"num\">" +
          n(Math.round(cal)) + "</td><td class=\"num\">" + n(Math.round(cal / mc[2])) + " غ</td></tr>";
      });
      html("cl-macro-body", rows);
    }
    var b = document.getElementById("cl-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ water */
  T.water = function () {
    function go() {
      var w = fval("wt-w");
      var act = parseFloat(sval("wt-act")) || 0, heat = parseFloat(sval("wt-heat")) || 0;
      show("wt-out", true); show("wt-stats", true); show("wt-plan", true);
      if (w <= 0) { txt("wt-big", "—"); return; }
      var base = w * 0.033;
      var extra = act + heat;
      var total = base + extra;
      txt("wt-big", n(total, 1) + " لتر يومياً");
      txt("wt-sub", "نحو " + Math.round(total * 1000 / 250) + " كوباً — ويأتي نحو 20% منها من الطعام");
      txt("wt-cups", Math.round(total * 1000 / 250));
      txt("wt-bottles", n(total * 1000 / 600, 1));
      txt("wt-base", n(base, 1) + " ل");
      txt("wt-extra", "+" + n(extra, 1) + " ل");
      var plan = [["عند الاستيقاظ", 0.12, "كوبان يعوّضان فقد الليل"],
                  ["مع الإفطار", 0.13, "قبل القهوة لا بعدها"],
                  ["منتصف الصباح", 0.15, "ذكّر نفسك بمنبّه"],
                  ["مع الغداء", 0.15, "وزّعها أثناء الوجبة"],
                  ["العصر", 0.18, "أكثرها إن كنت تتمرن"],
                  ["مع العشاء", 0.15, "قبل الوجبة بقليل"],
                  ["قبل النوم", 0.12, "قلّلها إن كنت تستيقظ ليلاً"]];
      var rows = "";
      plan.forEach(function (p) {
        rows += "<tr><td>" + p[0] + "</td><td class=\"num\">" + Math.round(total * p[1] * 1000) +
          " مل</td><td>" + p[2] + "</td></tr>";
      });
      html("wt-plan-body", rows);
    }
    var b = document.getElementById("wt-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ pregnancy */
  T.pregnancy = function () {
    var lmp = document.getElementById("pg-lmp");
    if (lmp && !lmp.value) {
      var t = M.riyadhNow();
      t.setDate(t.getDate() - 70);
      lmp.value = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" +
        String(t.getDate()).padStart(2, "0");
    }
    function go() {
      var v = lmp ? lmp.value : "";
      if (!v) { return; }
      var p = v.split("-").map(Number);
      var lmpOrd = H.gToOrd(p[0], p[1], p[2]);
      var cycle = fval("pg-cycle") || 28;
      var dueOrd = lmpOrd + 280 + (cycle - 28);
      var t = todayOrd();
      show("pg-out", true); show("pg-stats", true); show("pg-milestones", true);
      var g = H.ordToG(dueOrd);
      txt("pg-big", H.fmtG(g));
      txt("pg-sub", "يوم " + H.daysAr[H.weekday(dueOrd)] +
        " — المدى الطبيعي للولادة بين " + H.fmtG(H.ordToG(dueOrd - 21)) + " و" + H.fmtG(H.ordToG(dueOrd + 14)));
      var elapsed = t - lmpOrd;
      var weeks = Math.floor(elapsed / 7), days = elapsed % 7;
      if (elapsed < 0) {
        txt("pg-week", "—"); txt("pg-tri", "—"); txt("pg-left", "—"); txt("pg-pct", "—");
      } else {
        txt("pg-week", weeks + " + " + days);
        txt("pg-tri", weeks < 14 ? "الأول" : weeks < 28 ? "الثاني" : "الثالث");
        txt("pg-left", n(Math.max(0, dueOrd - t)));
        txt("pg-pct", Math.min(100, Math.round(elapsed / 280 * 100)) + "%");
      }
      var ms = [["نهاية الثلث الأول", 13], ["بداية الشعور بالحركة (تقريباً)", 20],
                ["سونار التشوّهات", 20], ["نهاية الثلث الثاني", 27],
                ["بداية الثلث الثالث", 28], ["الولادة المبكرة تنتهي هنا", 37],
                ["الولادة المكتملة", 39], ["الموعد المتوقع", 40]];
      var rows = "";
      ms.forEach(function (m2) {
        var o = lmpOrd + m2[1] * 7 + (cycle - 28);
        rows += "<tr><td>" + m2[0] + "</td><td>الأسبوع " + m2[1] + "</td><td>" +
          H.fmtG(H.ordToG(o)) + "</td></tr>";
      });
      html("pg-ms-body", rows);
    }
    var b = document.getElementById("pg-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ blood type */
  T.bloodtype = function () {
    function split(s) { return { abo: s.replace(/[+-]/, ""), rh: s.slice(-1) }; }
    function aboAlleles(abo) {
      if (abo === "A") { return ["A", "A", "A", "O"]; }   /* AA or AO, weighted like a carrier */
      if (abo === "B") { return ["B", "B", "B", "O"]; }
      if (abo === "AB") { return ["A", "B"]; }
      return ["O"];
    }
    function go() {
      var f = split(sval("bt-f")), m = split(sval("bt-m"));
      var fa = aboAlleles(f.abo), ma = aboAlleles(m.abo);
      var counts = {}, total = 0;
      fa.forEach(function (x) {
        ma.forEach(function (y) {
          var pair = [x, y].sort().join("");
          var type = pair === "OO" ? "O" : pair === "AB" ? "AB"
            : pair.indexOf("A") >= 0 ? "A" : "B";
          counts[type] = (counts[type] || 0) + 1; total++;
        });
      });
      var rhBoth = f.rh === "-" && m.rh === "-";
      var rhList = rhBoth ? ["−"] : ["+", "−"];
      show("bt-out", true); show("bt-detail", true);
      var types = Object.keys(counts).sort();
      txt("bt-big", types.map(function (x) { return x + (rhBoth ? "−" : ""); }).join(" · "));
      txt("bt-sub", rhBoth
        ? "الوالدان سالبا الريسوس، فالطفل سالب حتماً."
        : "عامل الريسوس قد يكون موجباً أو سالباً بحسب التركيب الجيني للوالدين.");
      var rows = "";
      types.forEach(function (x) {
        var pct = Math.round(counts[x] / total * 100);
        rhList.forEach(function (r) {
          rows += "<tr><td><strong>" + x + r + "</strong></td><td>" +
            (rhBoth ? pct + "%" : "حتى " + pct + "%") + "</td></tr>";
        });
      });
      html("bt-body", rows);
      html("bt-rh", rhBoth
        ? "<strong>الريسوس:</strong> لا يمكن لأبوين سالبين إنجاب طفل موجب الريسوس."
        : "<strong>الريسوس:</strong> النسب أعلاه تقريبية لأن التركيب الجيني الدقيق للوالدين (هل يحمل الأليل المتنحّي أم لا) غير معروف من الفصيلة الظاهرة وحدها. " +
          ((f.rh === "-" || m.rh === "-") ? "بما أن أحد الوالدين سالب الريسوس، فمن المهم متابعة ذلك مع الطبيب أثناء الحمل." : ""));
    }
    var b = document.getElementById("bt-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ national counters */
  function nationalCounter(prefix, mon, day, firstYear) {
    return function () {
      var t = todayOrd(), g0 = H.ordToG(t);
      var target = H.gToOrd(g0.y, mon, day);
      if (target < t) { target = H.gToOrd(g0.y + 1, mon, day); }
      var g = H.ordToG(target), h = H.ordToH(target);
      txt(prefix + "-date", H.fmtG(g));
      txt(prefix + "-num", n(g.y - firstYear));
      txt(prefix + "-wd", H.daysAr[H.weekday(target)]);
      txt(prefix + "-h", h ? h.d + " " + H.monthsAr[h.m - 1] + " " + h.y : "—");
      txt(prefix + "-weeks", n(Math.max(0, Math.round((target - t) / 7))));
      countdownTo(prefix + "-cd", target, "🇸🇦 كل عام والوطن بخير!");
    };
  }
  T["national-day"] = nationalCounter("nd", 9, 23, 1932);
  T["founding-day"] = nationalCounter("fd", 2, 22, 1727);

  /* ============================================================ school age */
  T.school = function () {
    var dsel = document.getElementById("schh-d"), msel = document.getElementById("schh-m"),
        ysel = document.getElementById("schh-y");
    if (dsel && !dsel.options.length) {
      for (var d = 1; d <= 30; d++) { dsel.add(new Option(d, d)); }
      H.monthsAr.forEach(function (nm, i) { msel.add(new Option(nm, i + 1)); });
      for (var y = 1420; y <= 1470; y++) { ysel.add(new Option(y, y)); }
      ysel.value = 1441;
    }
    var start = document.getElementById("sch-start");
    if (start && !start.value) {
      var t = M.riyadhNow();
      var yy = t.getMonth() + 1 >= 9 ? t.getFullYear() + 1 : t.getFullYear();
      start.value = yy + "-08-24";
    }
    var mode = "h";
    tabs("sch-tab-h", "sch-tab-g", "sch-hbox", "sch-gbox", function (w) { mode = w === "a" ? "h" : "g"; });

    function go() {
      var birthOrd;
      if (mode === "h") {
        var hy = ival("schh-y"), hm = ival("schh-m"), hd = ival("schh-d");
        if (!H.inRange(hy)) { return; }
        hd = Math.min(hd, H.monthLength(hy, hm));
        birthOrd = H.hToOrd(hy, hm, hd);
      } else {
        var v = sval("sch-gdate");
        if (!v) { return; }
        var p = v.split("-").map(Number);
        birthOrd = H.gToOrd(p[0], p[1], p[2]);
      }
      var sv = sval("sch-start");
      if (!sv) { return; }
      var sp = sv.split("-").map(Number);
      var startOrd = H.gToOrd(sp[0], sp[1], sp[2]);
      show("sch-out", true); show("sch-stats", true);

      var bg = H.ordToG(birthOrd), sg = H.ordToG(startOrd);
      var y = sg.y - bg.y, mo = sg.m - bg.m, dd = sg.d - bg.d;
      if (dd < 0) {
        mo -= 1;
        var pm = sg.m - 1, py = sg.y;
        if (pm < 1) { pm = 12; py -= 1; }
        dd += new Date(Date.UTC(py, pm, 0)).getUTCDate();
      }
      if (mo < 0) { mo += 12; y -= 1; }
      var totalMonths = y * 12 + mo;
      txt("sch-big", y + " سنة و" + mo + " شهراً و" + dd + " يوماً");

      var status;
      if (totalMonths >= 132) {
        status = "⚠️ العمر يتجاوز 11 سنة — يُوجَّه الطالب إلى برامج تعليمية مناسبة لعمره.";
      } else if (totalMonths >= 68) {
        status = "✅ مؤهل للتسجيل في الصف الأول الابتدائي مباشرة (5 سنوات و8 أشهر فأكثر).";
      } else if (totalMonths >= 65) {
        status = "⚠️ مؤهل بشرط اجتياز رياض الأطفال — العمر بين 5 سنوات و5 أشهر و5 سنوات و8 أشهر.";
      } else {
        var needed = 65 - totalMonths;
        status = "❌ غير مؤهل هذا العام — ينقصه نحو " + needed + " شهراً لبلوغ الحد الأدنى (5 سنوات و5 أشهر).";
      }
      txt("sch-status", status);
      txt("sch-days", n(startOrd - birthOrd));
      var hb = H.ordToH(birthOrd);
      var hAgeY = 0;
      if (hb) {
        var hs = H.ordToH(startOrd);
        hAgeY = hs.y - hb.y - ((hs.m < hb.m || (hs.m === hb.m && hs.d < hb.d)) ? 1 : 0);
      }
      txt("sch-hijri", hAgeY + " سنة");
      txt("sch-gbirth", H.fmtG(bg));
      txt("sch-hbirth", hb ? hb.d + "/" + hb.m + "/" + hb.y : "—");
    }
    var b = document.getElementById("sch-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ zodiac */
  var ZODIAC = [["الجدي", "♑", "التراب", 1, 19], ["الدلو", "♒", "الهواء", 2, 18],
                ["الحوت", "♓", "الماء", 3, 20], ["الحمل", "♈", "النار", 4, 19],
                ["الثور", "♉", "التراب", 5, 20], ["الجوزاء", "♊", "الهواء", 6, 20],
                ["السرطان", "♋", "الماء", 7, 22], ["الأسد", "♌", "النار", 8, 22],
                ["العذراء", "♍", "التراب", 9, 22], ["الميزان", "♎", "الهواء", 10, 22],
                ["العقرب", "♏", "الماء", 11, 21], ["القوس", "♐", "النار", 12, 21]];
  var ZR = ["22 ديسمبر – 19 يناير", "20 يناير – 18 فبراير", "19 فبراير – 20 مارس",
            "21 مارس – 19 أبريل", "20 أبريل – 20 مايو", "21 مايو – 20 يونيو",
            "21 يونيو – 22 يوليو", "23 يوليو – 22 أغسطس", "23 أغسطس – 22 سبتمبر",
            "23 سبتمبر – 22 أكتوبر", "23 أكتوبر – 21 نوفمبر", "22 نوفمبر – 21 ديسمبر"];

  function zodiacOf(m, d) {
    var z = ZODIAC[m - 1];
    return d <= z[4] ? m - 1 : m % 12;
  }

  T.zodiac = function () {
    var el = document.getElementById("zd-date");
    if (el && !el.value) { el.value = "1995-06-15"; }
    function go() {
      var v = el ? el.value : "";
      if (!v) { return; }
      var p = v.split("-").map(Number);
      var idx = zodiacOf(p[1], p[2]);
      var z = ZODIAC[idx];
      var o = H.gToOrd(p[0], p[1], p[2]), h = H.ordToH(o);
      show("zd-out", true); show("zd-stats", true);
      txt("zd-big", z[1] + " " + z[0]);
      txt("zd-sub", "برج " + z[0] + " من عنصر " + z[2]);
      txt("zd-el", z[2]);
      txt("zd-range", ZR[idx]);
      txt("zd-day", H.daysAr[H.weekday(o)]);
      txt("zd-h", h ? h.d + "/" + h.m + "/" + h.y : "—");
    }
    var b = document.getElementById("zd-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* zodiac compatibility — a published, deterministic rule, not a random number */
  T["love-zodiac"] = function () {
    var ORDER = ["الحمل", "الثور", "الجوزاء", "السرطان", "الأسد", "العذراء",
                 "الميزان", "العقرب", "القوس", "الجدي", "الدلو", "الحوت"];
    var ELEM = ["النار", "التراب", "الهواء", "الماء", "النار", "التراب",
                "الهواء", "الماء", "النار", "التراب", "الهواء", "الماء"];
    function score(a, b) {
      var ea = ELEM[a], eb = ELEM[b];
      if (ea === eb) { return 88; }
      var friendly = (ea === "النار" && eb === "الهواء") || (ea === "الهواء" && eb === "النار") ||
                     (ea === "التراب" && eb === "الماء") || (ea === "الماء" && eb === "التراب");
      if (friendly) { return 80; }
      var opposed = (ea === "النار" && eb === "الماء") || (ea === "الماء" && eb === "النار") ||
                    (ea === "التراب" && eb === "الهواء") || (ea === "الهواء" && eb === "التراب");
      return opposed ? 55 : 68;
    }
    function go() {
      var a = ival("lz-a"), b = ival("lz-b");
      var base = score(a, b);
      /* small deterministic variation so identical elements are not all the same number */
      var adj = ((a * 7 + b * 13) % 9) - 4;
      var total = Math.max(40, Math.min(97, base + adj));
      show("lz-out", true); show("lz-stats", true);
      txt("lz-big", total + "%");
      txt("lz-sub", ORDER[a] + " (" + ELEM[a] + ") مع " + ORDER[b] + " (" + ELEM[b] + ") — " +
        (total >= 82 ? "توافق مرتفع في هذا التقسيم التقليدي"
          : total >= 68 ? "توافق متوسط" : "توافق منخفض في التقسيم التقليدي") +
        ". تذكّر أن هذا للتسلية لا أكثر.");
      txt("lz-love", total + "%");
      txt("lz-friend", Math.max(45, Math.min(98, total + ((a + b) % 7) - 2)) + "%");
      txt("lz-talk", Math.max(45, Math.min(98, total + ((a * 3 + b) % 9) - 4)) + "%");
      txt("lz-elem", ELEM[a] + " / " + ELEM[b]);
    }
    var b2 = document.getElementById("lz-go");
    if (b2) { b2.addEventListener("click", go); }
  };

  T["love-name"] = function () {
    function normalize(s) {
      return (s || "").trim().replace(/\s+/g, "")
        .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[ىي]/g, "ي")
        .replace(/[ً-ْ]/g, "");
    }
    function go() {
      var a = normalize(sval("ln1")), b = normalize(sval("ln2"));
      show("lnm-out", true); show("lnm-stats", true);
      if (!a || !b) {
        txt("lnm-big", "—"); txt("lnm-sub", "اكتب الاسمين أولاً."); return;
      }
      var setA = {}, shared = 0;
      for (var i = 0; i < a.length; i++) { setA[a[i]] = true; }
      var seen = {};
      for (var j = 0; j < b.length; j++) {
        if (setA[b[j]] && !seen[b[j]]) { shared++; seen[b[j]] = true; }
      }
      /* deterministic, order-independent hash of the two names */
      var joined = [a, b].sort().join("");
      var hash = 0;
      for (var k = 0; k < joined.length; k++) {
        hash = (hash * 31 + joined.charCodeAt(k)) % 100000;
      }
      var lenScore = shared / Math.max(1, Math.min(a.length, b.length));
      var total = Math.round(45 + lenScore * 35 + (hash % 20));
      total = Math.max(35, Math.min(99, total));
      txt("lnm-big", total + "%");
      txt("lnm-sub", "بينهما " + shared + " من الحروف المشتركة. النتيجة ثابتة لهذين الاسمين — أعد الحساب وستحصل عليها نفسها.");
      txt("lnm-love", total + "%");
      txt("lnm-friend", Math.max(40, Math.min(99, total + (hash % 11) - 5)) + "%");
      txt("lnm-talk", Math.max(40, Math.min(99, total + (hash % 13) - 6)) + "%");
      txt("lnm-shared", shared);
    }
    var b = document.getElementById("lnm-go");
    if (b) { b.addEventListener("click", go); }
  };

  /* ============================================================ greeting card */
  T.ecard = function () {
    var canvas = document.getElementById("ec-canvas");
    if (!canvas) { return; }
    var ctx = canvas.getContext("2d");
    var THEMES = [["#04502a", "#0a9a53", "#ffffff", "#cdeadb"],
                  ["#1c1408", "#8a6a15", "#fff8e6", "#e0c47a"],
                  ["#08203f", "#123f77", "#ffffff", "#a9c9ef"],
                  ["#4a1030", "#a03266", "#fff0f6", "#f3bfd8"],
                  ["#2a1050", "#6a35b8", "#f6f0ff", "#cbb0f0"],
                  ["#4a3418", "#a8814a", "#fdf6ea", "#e8d3b0"]];
    var OCC = {
      eid: ["عيد مبارك", "كل عام وأنتم بخير", "🌙"],
      fitr: ["عيد فطر مبارك", "تقبّل الله منّا ومنكم صالح الأعمال", "🎉"],
      adha: ["عيد أضحى مبارك", "تقبّل الله طاعتكم وأضاحيكم", "🐑"],
      ramadan: ["رمضان كريم", "بلّغكم الله الشهر وأعانكم على صيامه وقيامه", "🕌"],
      national: ["اليوم الوطني السعودي", "كل عام والوطن بخير 🇸🇦", "🇸🇦"],
      birthday: ["كل عام وأنت بخير", "أعاده الله عليك بالصحة والسعادة", "🎂"],
      wedding: ["زواج مبارك", "بارك الله لكما وبارك عليكما وجمع بينكما في خير", "💍"],
      graduation: ["مبروك التخرج", "ثمرة جهدٍ طويل — وإلى نجاحات أكبر", "🎓"],
      newborn: ["مولود مبارك", "جعله الله من مواليد السعادة وقرّة عين لوالديه", "👶"],
      thanks: ["شكراً لك", "امتنانٌ لا توفيه الكلمات", "🌷"]
    };

    function wrap(text, maxWidth) {
      var words = text.split(" "), lines = [], line = "";
      words.forEach(function (w) {
        var test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
        else { line = test; }
      });
      if (line) { lines.push(line); }
      return lines;
    }

    function draw() {
      var th = THEMES[parseInt(sval("ec-theme"), 10) || 0];
      var occ = OCC[sval("ec-occ")] || OCC.eid;
      var name = (sval("ec-name") || "").trim();
      var msg = (sval("ec-msg") || "").trim() || occ[1];
      var W = canvas.width, Hh = canvas.height;

      var grad = ctx.createLinearGradient(0, 0, W, Hh);
      grad.addColorStop(0, th[0]); grad.addColorStop(1, th[1]);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, Hh);

      /* decorative frame */
      ctx.strokeStyle = th[3]; ctx.globalAlpha = 0.55; ctx.lineWidth = 4;
      ctx.strokeRect(50, 50, W - 100, Hh - 100);
      ctx.lineWidth = 1.5; ctx.strokeRect(68, 68, W - 136, Hh - 136);
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      ctx.font = "150px system-ui, sans-serif";
      ctx.fillText(occ[2], W / 2, 300);

      ctx.fillStyle = th[2];
      ctx.font = "bold 84px 'IBM Plex Sans Arabic', system-ui, sans-serif";
      ctx.fillText(occ[0], W / 2, 440);

      ctx.strokeStyle = th[3]; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 150, 490); ctx.lineTo(W / 2 + 150, 490); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = th[3];
      ctx.font = "40px 'IBM Plex Sans Arabic', system-ui, sans-serif";
      var lines = wrap(msg, W - 260);
      lines.slice(0, 4).forEach(function (l, i) { ctx.fillText(l, W / 2, 580 + i * 62); });

      if (name) {
        ctx.fillStyle = th[2];
        ctx.font = "bold 62px 'IBM Plex Sans Arabic', system-ui, sans-serif";
        ctx.fillText(name, W / 2, 860);
        ctx.fillStyle = th[3]; ctx.globalAlpha = 0.75;
        ctx.font = "30px 'IBM Plex Sans Arabic', system-ui, sans-serif";
        ctx.fillText("مع أطيب التمنيات", W / 2, 915);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = th[3]; ctx.globalAlpha = 0.5;
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillText("mortb.online", W / 2, Hh - 88);
      ctx.globalAlpha = 1;
    }

    ["ec-occ", "ec-theme", "ec-name", "ec-msg"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener("input", draw); e.addEventListener("change", draw); }
    });
    var go = document.getElementById("ec-go");
    if (go) { go.addEventListener("click", draw); }
    var dl = document.getElementById("ec-dl");
    if (dl) {
      dl.addEventListener("click", function () {
        draw();
        var a = document.createElement("a");
        a.download = "mortb-card.png";
        a.href = canvas.toDataURL("image/png");
        a.click();
      });
    }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(draw); }
    draw();
  };
})();
