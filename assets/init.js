/* Loads last. Every tool file has registered itself into window.TOOLS by now,
   so it is safe to look up the current page's tool and start it. */
(function () {
  "use strict";
  var TOOLS = window.TOOLS;
  if (!TOOLS) { return; }

  function start() {
    var host = document.querySelector("[data-tool]");
    if (!host) { return; }
    var slug = host.getAttribute("data-tool");
    var fn = TOOLS[slug];
    if (typeof fn !== "function") {
      if (window.console) { console.warn("no tool registered for " + slug); }
      return;
    }
    try {
      fn();
    } catch (e) {
      if (window.console) { console.error("tool " + slug + " failed", e); }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
