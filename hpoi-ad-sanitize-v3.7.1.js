// Hpoi official startup response pass-through v3.7.2 — legacy v3.7.1 path
// Intentionally changes nothing. This neutralizes an older cached startup-response rule.
(function () {
  "use strict";

  if (typeof console !== "undefined" && console.log) {
    console.log("[HPOI_AD_SANITIZE] official startup response passed through unchanged v3.7.2");
  }

  $done({});
})();
