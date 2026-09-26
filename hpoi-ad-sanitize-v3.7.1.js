// Hpoi startup advert sanitizer v3.7.1 — Quantumult X / Surge / Loon
// Keeps one server-provided startup record so Hpoi can finish cold-start setup.
// Fail-open by design: unknown or malformed responses are returned unchanged.
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

  function isRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function candidateScore(key, path, depth) {
    var normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (path === "$") return 3000;
    if (/(?:splash|startup|launch|openscreen|boot)/.test(normalized)) {
      return 2000 - depth;
    }
    if (/(?:advert|advertisement)/.test(normalized) || /^(?:ad|ads|adlist)$/.test(normalized)) {
      return 1500 - depth;
    }
    if (/^(?:data|list|items|records)$/.test(normalized)) {
      return 1000 - depth;
    }
    return -1;
  }

  function officialScore(record, index) {
    var score = -index;
    if (record.official === true || record.isOfficial === true) score += 1000;
    var serialized = "";
    try { serialized = JSON.stringify(record); } catch (_) {}
    if (/(?:^|[/.])hpoi\.net(?:\.cn)?(?:[/:]|$)|rfx\.hpoi\.net/i.test(serialized)) {
      score += 500;
    }
    return score;
  }

  function chooseRecord(array) {
    var chosen = null;
    for (var i = 0; i < array.length; i++) {
      if (!isRecord(array[i])) continue;
      var score = officialScore(array[i], i);
      if (!chosen || score > chosen.score) {
        chosen = { item: array[i], index: i, score: score };
      }
    }
    return chosen;
  }

  function findStartupArray(value) {
    var best = null;

    function inspect(node, path, key, depth) {
      if (Array.isArray(node)) {
        var selected = chooseRecord(node);
        var score = selected ? candidateScore(key, path, depth) : -1;
        if (selected && score >= 0 && (!best || score > best.score)) {
          best = {
            array: node,
            item: selected.item,
            index: selected.index,
            path: path,
            score: score
          };
        }
        // Do not select an array nested inside another array: clearing its
        // parent would make the selected record unreachable in the response.
        return;
      }
      if (!node || typeof node !== "object") return;
      Object.keys(node).forEach(function (childKey) {
        inspect(node[childKey], path + "." + childKey, childKey, depth + 1);
      });
    }

    inspect(value, "$", "$root", 0);
    return best;
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

  var startup = findStartupArray(json);
  if (!startup) {
    log("startup array not recognized; pass through");
    finish(original);
    return;
  }

  var changedArrays = 0;
  var removedItems = 0;

  function sanitize(value) {
    if (Array.isArray(value)) {
      if (value === startup.array) {
        if (value.length !== 1 || value[0] !== startup.item) {
          changedArrays++;
          removedItems += Math.max(0, value.length - 1);
        }
        // Keep the selected server record intact, including any asset arrays it needs.
        return [startup.item];
      }
      if (value.length > 0) {
        changedArrays++;
        removedItems += value.length;
      }
      return [];
    }

    if (value && typeof value === "object") {
      Object.keys(value).forEach(function (key) {
        value[key] = sanitize(value[key]);
      });
    }
    return value;
  }

  var cleaned = sanitize(json);
  if (changedArrays === 0) {
    log("one startup record already present; pass through");
    finish(original);
    return;
  }

  log("kept one startup record path=" + startup.path +
    " removedItems=" + removedItems + " changedArrays=" + changedArrays);
  finish(JSON.stringify(cleaned));
})();
