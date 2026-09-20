// Hpoi startup advert sanitizer v3.3.2 — Quantumult X
// Keeps the server response envelope intact and only empties arrays.
// Fail-open by design: malformed or unknown responses are returned unchanged.
(function () {
  "use strict";

  var TAG = "[HPOI_AD_SANITIZE] ";
  var original = (typeof $response !== "undefined" &&
    typeof $response.body === "string") ? $response.body : "";

  function log(message) {
    if (typeof console !== "undefined" && console.log) {
      console.log(TAG + message);
    }
  }

  function finish(body) {
    $done({ body: body });
  }

  if (!original) {
    log("empty response body; pass through");
    $done({});
    return;
  }

  var json;
  try {
    json = JSON.parse(original);
  } catch (_) {
    log("non-JSON response; pass through");
    finish(original);
    return;
  }

  var changed = 0;

  function sanitize(value) {
    if (Array.isArray(value)) {
      if (value.length > 0) changed++;
      return [];
    }

    if (value && typeof value === "object") {
      Object.keys(value).forEach(function (key) {
        var child = value[key];
        if (Array.isArray(child)) {
          if (child.length > 0) changed++;
          value[key] = [];
        } else if (child && typeof child === "object") {
          value[key] = sanitize(child);
        }
      });
    }
    return value;
  }

  var cleaned = sanitize(json);

  if (changed === 0) {
    log("no advert arrays found; pass through");
    finish(original);
    return;
  }

  log("cleared advert arrays=" + changed);
  finish(JSON.stringify(cleaned));
})();
