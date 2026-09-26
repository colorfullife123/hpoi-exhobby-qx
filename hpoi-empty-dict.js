// Hpoi empty JSON response helper v3.7.0 — Surge / Loon
// Used only for the two Taobao-related product endpoints.
(function () {
  "use strict";
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: "{}"
    }
  });
})();
