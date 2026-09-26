// Hpoi official startup selector v3.7.2 — Quantumult X / Surge / Loon
// Keeps one explicitly identifiable Hpoi startup record and leaves every other field untouched.
// Unknown or malformed responses pass through unchanged. Third-party domains stay blocked by rules.
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
    var score = 0;
    if (record.official === true || record.isOfficial === true) score += 1000;

    ["source", "provider", "owner", "author", "sponsor", "type"].forEach(function (key) {
      if (typeof record[key] === "string" && /(?:hpoi|official|官方)/i.test(record[key])) {
        score += 400;
      }
    });

    var serialized = "";
    try { serialized = JSON.stringify(record); } catch (_) {}
    if (/(?:^|[/.])hpoi\.net(?:\.cn)?(?:[/:]|$)|rfx\.hpoi\.net/i.test(serialized)) {
      score += 500;
    }

    return score > 0 ? score - index : -1;
  }

  function chooseOfficial(array) {
    var chosen = null;
    for (var i = 0; i < array.length; i++) {
      if (!isRecord(array[i])) continue;
      var score = officialScore(array[i], i);
      if (score < 0) continue;
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
        var selected = chooseOfficial(node);
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
        node.forEach(function (child, index) {
          inspect(child, path + "[" + index + "]", key, depth + 1);
        });
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
    log("no explicit Hpoi startup record found; pass through");
    finish(original);
    return;
  }

  if (startup.array.length === 1 && startup.index === 0) {
    log("one official startup record already present; pass through");
    finish(original);
    return;
  }

  var removedItems = Math.max(0, startup.array.length - 1);
  startup.array.splice(0, startup.array.length, startup.item);
  log("kept one official startup record path=" + startup.path +
    " removedItems=" + removedItems + " preservedOtherFields=true");
  finish(JSON.stringify(json));
})();
