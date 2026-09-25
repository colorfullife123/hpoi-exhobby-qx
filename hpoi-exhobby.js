// Hpoi + EXHOBBY native album v3.5.9 — Quantumult X
// Automatically handles hobby entries with an EXHOBBY gallery.
// Reuses the browser session and native templates saved by v2.3.
// No Hpoi token is stored or sent to EXHOBBY.
// EXHOBBY cookies are captured locally only after its gallery loads normally.
(function () {
  "use strict";
  var NS = "HPOI_EXHOBBY_NATIVE_V2:";
  var VERIFY_COOLDOWN = 45 * 60 * 1000;
  var HOBBY = 0, ITEM = 0, ALBUM = 0;
  var ALBUM_BASE = 1000000000, PROXY_BASE = 1400000000;
  var PROXY_SPAN = 500000000, PIC_BASE = 2001000000;
  var EX_ROUTE_BASE = 800000000, EX_ROUTE_SPAN = 199999999;
  var CACHE_ITEM_TTL = 3 * 86400000, CACHE_ITEM_LIMIT = 8;
  var ALBUM_GALLERY_TTL = 30 * 60000;
  var FIELDS = ["id", "itemId", "itemType", "albumId", "picId",
    "hobbyId", "type", "subType", "order", "sort", "page", "pageSize"];
  var ID_FIELDS = ["id", "itemId", "albumId", "picId", "hobbyId"];
  var req = $request, ended = false, virtualResponse = false;
  var match = String(req.url || "").match(
    /^https:\/\/www\.hpoi\.net\.cn\/api\/(item\/get|hobby\/album|album\/detail|pic\/list\/relate-v2)(?:\?|$)/);
  var endpoint = match && match[1];
  var cacheClearRequest = /^https:\/\/www\.exhobby\.net\/__hpoi_cache_clear__(?:\?|$)/i
    .test(String(req.url || ""));

  function log(s) { console.log("[HPOI_EXHOBBY] " + (ITEM ? "item=" + ITEM + " " : "") + s); }
  function done(value) {
    if (!ended) { ended = true; $done(value || {}); }
  }
  function storageKey(key) {
    return NS + (/^(gallery|gallery-link|work|lock|hobby|known)$/.test(key) ? "all:" + ITEM + ":" : "") + key;
  }
  function drop(key) { $prefs.removeValueForKey(storageKey(key)); }
  function validItem(n) { return Number.isInteger(n) && n > 0 && n < 1000000000; }
  function setTarget(n) {
    n = Number(n);
    if (!validItem(n)) throw new Error("unsupported hobby internal ID");
    ITEM = n; ALBUM = ALBUM_BASE + n;
    trackCacheValue(null, null);
    runCacheGC(false);
    var metadata = read("hobby");
    HOBBY = metadata ? Number(metadata.hobbyId) || 0 : 0;
  }
  function read(key) {
    try { return JSON.parse($prefs.valueForKey(storageKey(key)) || "null"); }
    catch (_) { return null; }
  }
  function save(key, value) {
    return $prefs.setValueForKey(JSON.stringify(value), storageKey(key));
  }
  function saveRaw(key, value) {
    return $prefs.setValueForKey(JSON.stringify(value), NS + key);
  }
  function readRaw(key) {
    try { return JSON.parse($prefs.valueForKey(NS + key) || "null"); }
    catch (_) { return null; }
  }

  function cacheIndex() {
    var index = readRaw("cache-index");
    return index && typeof index === "object" && !Array.isArray(index) ? index : {};
  }
  function writeCacheIndex(index) {
    return saveRaw("cache-index", index || {});
  }
  function trackCacheValue(kind, value) {
    if (!validItem(ITEM)) return;
    var index = cacheIndex(), key = String(ITEM);
    var entry = index[key] || { last: Date.now(), albums: [], images: [], routes: [] };
    if (!Array.isArray(entry.albums)) entry.albums = [];
    if (!Array.isArray(entry.images)) entry.images = [];
    if (!Array.isArray(entry.routes)) entry.routes = [];
    entry.last = Date.now();
    if (kind && value != null) {
      var list = entry[kind], n = Number(value);
      if (Array.isArray(list) && Number.isInteger(n) && list.indexOf(n) < 0) list.push(n);
    }
    index[key] = entry;
    writeCacheIndex(index);
  }
  function pictureIdBaseForPath(path) {
    var hash = 2166136261, value = String(path || "");
    for (var i = 0; i < value.length; i++) {
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
    }
    return PIC_BASE + (hash % 139999999 + 1);
  }
  function removeGalleryImageMappings(gallery) {
    if (!gallery || !Array.isArray(gallery.rows)) return 0;
    var removed = 0;
    gallery.rows.forEach(function (row) {
      var id = pictureIdBaseForPath(row && row.path);
      if ($prefs.removeValueForKey(NS + "image:" + id)) removed++;
    });
    return removed;
  }
  function purgeTrackedItem(item, entry) {
    item = Number(item);
    if (!validItem(item)) return 0;
    entry = entry || {};
    var removed = 0;
    try {
      var legacyGallery = JSON.parse($prefs.valueForKey(NS + "all:" + item + ":gallery") || "null");
      removed += removeGalleryImageMappings(legacyGallery);
    } catch (_) {}
    ["gallery", "gallery-link", "work", "lock", "hobby", "known"].forEach(function (k) {
      if ($prefs.removeValueForKey(NS + "all:" + item + ":" + k)) removed++;
    });
    (Array.isArray(entry.albums) ? entry.albums : []).forEach(function (albumId) {
      try {
        var scoped = JSON.parse($prefs.valueForKey(
          NS + "album-gallery:" + item + ":" + albumId) || "null");
        removed += removeGalleryImageMappings(scoped);
      } catch (_) {}
      ["album-gallery:", "album-work:", "album-lock:"].forEach(function (prefix) {
        if ($prefs.removeValueForKey(NS + prefix + item + ":" + albumId)) removed++;
      });
      if ($prefs.removeValueForKey(NS + "album-owner:" + albumId)) removed++;
    });
    (Array.isArray(entry.images) ? entry.images : []).forEach(function (id) {
      if ($prefs.removeValueForKey(NS + "image:" + id)) removed++;
    });
    (Array.isArray(entry.routes) ? entry.routes : []).forEach(function (route) {
      if ($prefs.removeValueForKey(NS + "exhobby-route:" + route)) removed++;
    });
    if ($prefs.removeValueForKey(NS + "exhobby-route-for-item:" + item)) removed++;
    return removed;
  }
  function runCacheGC(force) {
    var now = Date.now(), last = Number(readRaw("gc-last") || 0);
    if (!force && last && now - last < 6 * 3600000) return 0;
    var index = cacheIndex(), keys = Object.keys(index), removed = 0;
    keys.sort(function (a, b) {
      return Number(index[b] && index[b].last || 0) - Number(index[a] && index[a].last || 0);
    });
    keys.forEach(function (key, position) {
      var entry = index[key] || {};
      var stale = now - Number(entry.last || 0) > CACHE_ITEM_TTL;
      var overflow = position >= CACHE_ITEM_LIMIT;
      if ((stale || overflow) && Number(key) !== ITEM) {
        removed += purgeTrackedItem(Number(key), entry);
        delete index[key];
      }
    });
    writeCacheIndex(index);
    saveRaw("gc-last", now);
    if (removed) log("cache GC removed=" + removed + " tracked entries");
    return removed;
  }
  function clearTrackedCaches() {
    var index = cacheIndex(), removed = 0;
    Object.keys(index).forEach(function (key) {
      removed += purgeTrackedItem(Number(key), index[key]);
    });
    $prefs.removeValueForKey(NS + "cache-index");
    $prefs.removeValueForKey(NS + "gc-last");
    return removed;
  }
  function handleCacheClear() {
    if (!cacheClearRequest) return false;
    var removed = clearTrackedCaches();
    var body = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>HPOI EXHOBBY Cache</title><body style=\"font-family:-apple-system;padding:32px;line-height:1.6\">" +
      "<h2>EXHOBBY 缓存已清理</h2><p>已清理 " + removed +
      " 个已跟踪运行缓存项。</p><p>Safari 年龄验证会话和通知设置已保留。</p></body>";
    done({ status: "HTTP/1.1 200 OK", body: body,
      headers: { "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store" } });
    return true;
  }
  function routeFieldHints() {
    var detail = read("seed:album/detail"), picture = read("seed:pic/list/relate-v2");
    var seedAlbum = detail && detail.album, values = Object.create(null), hints = [];
    [detail && detail.p, picture && picture.p].forEach(function (p) {
      ID_FIELDS.forEach(function (k) {
        var n = Number(p && p[k]);
        if (Number.isInteger(n) && n > 0 && n < ALBUM_BASE) values[n] = true;
      });
    });
    ["itemId", "id", "albumId"].forEach(function (k) {
      var n = Number(seedAlbum && seedAlbum[k]);
      if (Number.isInteger(n) && values[n]) hints.push(k);
    });
    return hints;
  }
  function albumRouteProfile(album) {
    var preferred = routeFieldHints(), fallback = ["itemId", "id", "albumId"];
    var fields = preferred.length ? preferred.concat(fallback.filter(function (k) {
      return preferred.indexOf(k) < 0;
    })) : fallback;
    for (var i = 0; i < fields.length; i++) {
      var n = Number(album && album[fields[i]]);
      if (!Number.isInteger(n) || n <= 0 || n >= ALBUM_BASE || n === ITEM) continue;
      var routeFields = ["itemId", "id", "albumId"].filter(function (k) {
        return Number(album && album[k]) === n &&
          (!preferred.length || preferred.indexOf(k) >= 0 || k === fields[i]);
      });
      if (!routeFields.length) routeFields = [fields[i]];
      return { route: n, fields: routeFields };
    }
    return null;
  }
  function rememberDedicatedRoute(profile, album) {
    if (!profile || !Number.isInteger(profile.route) ||
        profile.route <= 0 || profile.route >= ALBUM_BASE) return false;
    return saveRaw("dedicated-route:" + profile.route, {
      item: ITEM, route: profile.route, fields: profile.fields || [],
      album: copy(album), time: Date.now()
    });
  }
  function normalAlbumProxy(profile, album) {
    var route = Number(profile && profile.route);
    var source = ITEM + ":" + route, hash = 2166136261;
    for (var i = 0; i < source.length; i++) {
      hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
    }
    var offset = hash % PROXY_SPAN;
    for (var probe = 0; probe < 100; probe++) {
      var id = PROXY_BASE + offset, record = readRaw("album-proxy:" + id);
      if (record && Number(record.item) === ITEM && Number(record.route) === route) {
        saveRaw("album-proxy:" + id, {
          item: ITEM, route: route, fields: profile.fields || [],
          album: copy(album), time: Date.now()
        });
        return id;
      }
      if (!record) {
        if (!saveRaw("album-proxy:" + id, {
          item: ITEM, route: route, fields: profile.fields || [],
          album: copy(album), time: Date.now()
        })) {
          throw new Error("normal album proxy write failed");
        }
        return id;
      }
      offset = (offset + 1) % PROXY_SPAN;
    }
    throw new Error("normal album proxy collision; refresh to retry");
  }
  function rewriteAlbumRoute(album, fromRoute, toRoute, fields) {
    if (!album) return album;
    var selected = Array.isArray(fields) && fields.length ? fields :
      ["itemId", "id", "albumId"].filter(function (k) {
        return Number(album[k]) === Number(fromRoute);
      });
    if (!selected.length) selected = ["itemId", "id", "albumId"];
    selected.forEach(function (k) {
      if (k in album || k === "itemId" || k === "id") album[k] = toRoute;
    });
    return album;
  }
  function proxyAlbumObject(album, proxy, profile) {
    var a = copy(album);
    rewriteAlbumRoute(a, profile.route, proxy, profile.fields);
    return a;
  }
  function dedicatedAlbumRoute(nativeAlbums) {
    var used = Object.create(null);
    (nativeAlbums || []).forEach(function (album) {
      ["id", "itemId", "albumId"].forEach(function (k) {
        var n = Number(album && album[k]);
        if (Number.isInteger(n) && n > 0) used[n] = true;
      });
    });

    var saved = readRaw("exhobby-route-for-item:" + ITEM);
    var savedRoute = Number(saved && saved.route);
    if (Number.isInteger(savedRoute) &&
        savedRoute >= EX_ROUTE_BASE &&
        savedRoute < EX_ROUTE_BASE + EX_ROUTE_SPAN &&
        !used[savedRoute]) {
      saveRaw("exhobby-route:" + savedRoute, {
        item: ITEM, route: savedRoute, time: Date.now()
      });
      trackCacheValue("routes", savedRoute);
      return savedRoute;
    }

    var source = "exhobby:" + ITEM, hash = 2166136261;
    for (var i = 0; i < source.length; i++) {
      hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
    }
    var offset = hash % EX_ROUTE_SPAN;
    for (var probe = 0; probe < 1000; probe++) {
      var route = EX_ROUTE_BASE + offset;
      var record = readRaw("exhobby-route:" + route);
      var occupied = used[route] ||
        (record && Number(record.item) !== ITEM);
      if (!occupied) {
        if (savedRoute && savedRoute !== route) {
          $prefs.removeValueForKey(NS + "exhobby-route:" + savedRoute);
        }
        if (!saveRaw("exhobby-route:" + route, {
          item: ITEM, route: route, time: Date.now()
        }) || !saveRaw("exhobby-route-for-item:" + ITEM, {
          item: ITEM, route: route, time: Date.now()
        })) {
          throw new Error("dedicated EXHOBBY route write failed");
        }
        trackCacheValue("routes", route);
        return route;
      }
      offset = (offset + 1) % EX_ROUTE_SPAN;
    }
    throw new Error("dedicated EXHOBBY route collision");
  }

  function rememberAlbumOwner(album) {
    var itemId = Number(album && album.itemId);
    var nativeId = Number(album && album.id);
    if (!Number.isInteger(itemId) || itemId <= 0 || itemId >= ALBUM_BASE) return false;
    var ok = saveRaw("album-owner:" + itemId, {
      item: ITEM,
      itemId: itemId,
      nativeId: Number.isInteger(nativeId) ? nativeId : 0,
      time: Date.now()
    });
    if (ok) trackCacheValue("albums", itemId);
    return ok;
  }
  function embeddedGalleryPictures(gallery) {
    return gallery.rows.map(function (row, index) {
      return pictureRowObject(row, index + 1);
    });
  }
  function isEmbeddedExhobbyRow(row) {
    var info = row && row.pictureInfo;
    return Number(row && row.id) > PIC_BASE ||
      Number(info && info.id) > PIC_BASE ||
      /^\/__exhobby__\//.test(String(info && info.path || ""));
  }
  async function injectGalleryIntoNativePictures(doc, ctx) {
    if (!doc || !doc.data || !Array.isArray(doc.data.list)) return false;
    var page = Math.max(1, Number(ctx && ctx.p && ctx.p.page) || 1);
    if (page !== 1) return false;
    var albumItemId = Number(ctx && ctx.v && ctx.v.route);
    var gallery = await loadAlbumGallery(albumItemId);
    if (!gallery || !gallery.complete || gallery.version !== 31 ||
        !gallery.scoped || !Array.isArray(gallery.rows) || !gallery.rows.length) {
      log("native album itemId=" + albumItemId + " has no scoped EXHOBBY gallery");
      return false;
    }
    var nativeRows = doc.data.list.filter(function (row) {
      return !isEmbeddedExhobbyRow(row);
    });
    doc.data.list = embeddedGalleryPictures(gallery).concat(nativeRows);
    log("scoped EXHOBBY pictures added inside native album itemId=" +
      albumItemId + "; exhobby=" + gallery.rows.length +
      " native=" + nativeRows.length);
    return true;
  }
  function navigationProxy(album) {
    var nativeId = Number(album && album.id);
    var nativeItemId = Number(album && album.itemId);
    if (!Number.isInteger(nativeId) || nativeId <= 0 || nativeId >= ALBUM_BASE ||
        !Number.isInteger(nativeItemId) || nativeItemId <= 0 || nativeItemId >= ALBUM_BASE) {
      return null;
    }
    var source = ITEM + ":nav:" + nativeItemId, hash = 2166136261;
    for (var i = 0; i < source.length; i++) {
      hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
    }
    var offset = hash % PROXY_SPAN;
    for (var probe = 0; probe < 100; probe++) {
      var proxy = PROXY_BASE + offset;
      var record = readRaw("nav-proxy:" + proxy);
      if (!record || (Number(record.item) === ITEM &&
          Number(record.nativeItemId) === nativeItemId &&
          Number(record.nativeId) === nativeId)) {
        if (!saveRaw("nav-proxy:" + proxy, {
          item: ITEM, proxy: proxy, nativeId: nativeId,
          nativeItemId: nativeItemId, album: copy(album), time: Date.now()
        })) throw new Error("navigation proxy write failed");
        return { proxy: proxy, nativeId: nativeId, nativeItemId: nativeItemId };
      }
      offset = (offset + 1) % PROXY_SPAN;
    }
    throw new Error("navigation proxy collision");
  }
  function verifyURL(value) {
    var url = String(value || "");
    var gallery = /^https:\/\/www\.exhobby\.net\/picture\?[^\s#]+$/i.test(url) &&
      /(?:\?|&)link=[^&#\s]+/i.test(url);
    var search = url === "https://www.exhobby.net/search";
    return (gallery || search) && !/[\r\n]/.test(url) ? url : "https://www.exhobby.net/search";
  }
  function verificationRequired(message, url) {
    var error = new Error(message);
    error.verificationURL = verifyURL(url || read("gallery-link"));
    return error;
  }
  function verificationPage(body) {
    var html = String(body || "");
    if (/<h1\b[^>]*>\s*年[齡龄]提醒/i.test(html)) return true;
    return /cf-chl-|cf-turnstile|g-recaptcha/i.test(html) &&
      !/<figure\b/i.test(html) &&
      !/(?:https?:)?\/\/res\.e39x\.com\/pic\//i.test(html);
  }
  async function notifyVerification(error) {
    if (!error.verificationURL) return;
    var previous = read("verify-notice"), now = Date.now();
    if (previous && now - Number(previous.time) < VERIFY_COOLDOWN) return;
    if (!save("verify-notice", { time: now })) {
      log("v3.5.9 notice cooldown could not be saved");
    }
    var url = error.verificationURL;
    var title = "EXHOBBY 需要验证";
    var message = "请在 Safari 完成年龄确认，进入图库点一次『更多』，再返回 Hpoi。";
    var barkURL = String($prefs.valueForKey(NS + "bark-push-url") || "");
    // The full Bark push URL is set locally, never committed to this repository.
    if (/^https:\/\/[^\s/?#]+\/[^\s/?#]+\/?$/.test(barkURL)) {
      var timer;
      try {
        var response = await Promise.race([
          $task.fetch({ url: barkURL, method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            opts: { "auto-cookie": false, "redirection": false },
            body: JSON.stringify({ title: title, body: message,
              url: url, group: "HPOI", isArchive: "0" }) }),
          new Promise(function (_, reject) {
            timer = setTimeout(function () { reject(new Error("push timeout")); }, 1200);
          })
        ]);
        if (Number(response.statusCode) === 200) return;
      } catch (_) {} finally {
        if (typeof clearTimeout === "function") clearTimeout(timer);
      }
      log("v3.5.9 Bark delivery failed; falling back to Quantumult X notice");
    }
    if (typeof $notify === "function") {
      $notify(title, "打开 EXHOBBY 验证", message + "\n" + url);
    }
  }
  function copy(value) {
    return JSON.parse(JSON.stringify(value, function (k, v) {
      return k.charAt(0) === "@" ? undefined : v;
    }));
  }
  function decode(s) {
    try { return decodeURIComponent(String(s).replace(/\+/g, " ")); }
    catch (_) { return ""; }
  }
  function pairs(s) {
    var out = {};
    String(s || "").split("&").forEach(function (part) {
      var n = part.indexOf("=");
      if (n >= 0) out[decode(part.slice(0, n))] = decode(part.slice(n + 1));
    });
    return out;
  }
  function params() {
    var out = pairs(String(req.url).split("?")[1]);
    var body = req.body || "", fields = {};
    if (/^\s*\{/.test(body)) {
      try { fields = JSON.parse(body); } catch (_) {}
    } else if (/Content-Disposition:\s*form-data/i.test(body)) {
      var re = /Content-Disposition:[^\r\n]*\bname="([^"]+)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)(?=\r?\n--)/gi;
      var m;
      while ((m = re.exec(body))) fields[m[1]] = m[2];
    } else {
      fields = pairs(body);
    }
    Object.keys(fields).forEach(function (k) { out[k] = fields[k]; });
    var publicFields = {};
    FIELDS.forEach(function (k) {
      if (out[k] != null && /^[^\r\n]{0,100}$/.test(String(out[k]))) {
        publicFields[k] = String(out[k]);
      }
    });
    return publicFields;
  }
  function changeRequest(changes) {
    var url = String(req.url), body = String(req.body || "");
    var json = /^\s*\{/.test(body) ? JSON.parse(body) : null;
    var multi = /Content-Disposition:\s*form-data/i.test(body);
    var boundary = "";
    Object.keys(req.headers || {}).forEach(function (k) {
      if (k.toLowerCase() === "content-type") {
        var m = String(req.headers[k]).match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
        if (m) boundary = m[1] || m[2];
      }
    });
    Object.keys(changes).forEach(function (k) {
      var value = String(changes[k]);
      var queryRE = new RegExp("([?&])" + k + "=[^&]*", "g");
      var inQuery = queryRE.test(url);
      queryRE.lastIndex = 0;
      if (inQuery) url = url.replace(queryRE, function (_, sep) {
        return sep + k + "=" + encodeURIComponent(value);
      });
      if (json) {
        json[k] = value;
      } else if (multi) {
        var re = new RegExp('(Content-Disposition:[^\\r\\n]*\\bname="' + k +
          '"[^\\r\\n]*\\r?\\n(?:[^\\r\\n]+\\r?\\n)*\\r?\\n)[\\s\\S]*?(?=\\r?\\n--)', "gi");
        if (re.test(body)) {
          re.lastIndex = 0;
          body = body.replace(re, function (_, prefix) { return prefix + value; });
        } else if (!inQuery) {
          var closing = boundary && body.lastIndexOf("--" + boundary + "--");
          if (closing === "" || closing < 0) throw new Error("multipart boundary missing");
          body = body.slice(0, closing) + "--" + boundary +
            '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' +
            value + "\r\n" + body.slice(closing);
        }
      } else if (String(req.method).toUpperCase() === "GET") {
        if (!inQuery) url += (url.indexOf("?") >= 0 ? "&" : "?") +
          k + "=" + encodeURIComponent(value);
      } else {
        var formRE = new RegExp("(^|&)" + k + "=[^&]*", "g");
        if (formRE.test(body)) {
          formRE.lastIndex = 0;
          body = body.replace(formRE, function (_, sep) {
            return sep + k + "=" + encodeURIComponent(value);
          });
        } else if (!inQuery) {
          body += (body ? "&" : "") + k + "=" + encodeURIComponent(value);
        }
      }
    });
    if (json) body = JSON.stringify(json);
    var output = {};
    if (url !== req.url) output.url = url;
    if (body !== String(req.body || "")) output.body = body;
    return output;
  }
  function virtualItem(p) {
    for (var i = 0; i < ID_FIELDS.length; i++) {
      var n = Number(p[ID_FIELDS[i]]);
      if (!Number.isInteger(n) || n <= 0) continue;
      var dedicated = readRaw("exhobby-route:" + n);
      if (dedicated && validItem(Number(dedicated.item)) &&
          Number(dedicated.route) === n) {
        return { type: "album", item: Number(dedicated.item), route: n };
      }
      var nav = readRaw("nav-proxy:" + n);
      if (nav && validItem(Number(nav.item)) &&
          Number(nav.proxy) === n &&
          Number.isInteger(Number(nav.nativeItemId)) &&
          Number(nav.nativeItemId) > 0 && Number(nav.nativeItemId) < ALBUM_BASE) {
        return { type: "normal-nav", item: Number(nav.item), proxy: n,
          route: Number(nav.nativeItemId), nativeId: Number(nav.nativeId),
          album: nav.album || null };
      }
      var owner = readRaw("album-owner:" + n);
      if (owner && validItem(Number(owner.item)) && Number(owner.itemId) === n) {
        return { type: "normal-owner", item: Number(owner.item),
          route: n, nativeId: Number(owner.nativeId) || 0 };
      }
      var item = n - ALBUM_BASE;
      if (validItem(item) && read("all:" + item + ":known")) {
        return { type: "album", item: item, route: n };
      }
      if (n > PIC_BASE) {
        var record = read("image:" + n);
        if (record && record.row && validItem(record.item)) {
          return { type: "pic", item: record.item, row: record.row, nativeId: n };
        }
      }
    }
    return null;
  }
  function nativePictureId(row) {
    var hash = 2166136261;
    for (var i = 0; i < row.path.length; i++) {
      hash = Math.imul(hash ^ row.path.charCodeAt(i), 16777619) >>> 0;
    }
    var offset = hash % 139999999 + 1;
    for (var probe = 0; probe < 100; probe++) {
      var id = PIC_BASE + offset, record = read("image:" + id);
      if (record && record.row && record.row.path === row.path) {
        trackCacheValue("images", id);
        return id;
      }
      if (!record) {
        if (!save("image:" + id, { item: ITEM, row: row, time: Date.now() })) {
          throw new Error("picture mapping write failed");
        }
        trackCacheValue("images", id);
        return id;
      }
      offset = offset % 139999999 + 1;
    }
    throw new Error("picture ID collision; refresh to retry");
  }
  function neutralUser(user) {
    var out = {};
    Object.keys(user || {}).forEach(function (k) {
      var v = user[k];
      if (k.charAt(0) === "@") return;
      if (typeof v === "string") out[k] = "";
      if (typeof v === "number") out[k] = 0;
      if (typeof v === "boolean") out[k] = false;
    });
    out.id = 0; out.userId = 0; out.userType = 0;
    out.nickname = "EXHOBBY"; out.header = ""; out.verifyStatus = false;
    return out;
  }
  function resetCounts(value) {
    ["commentCount", "hits", "hitsDay", "hits7Day", "collect", "praiseCount",
      "topTime", "topLevel"].forEach(function (k) { value[k] = 0; });
  }
  function albumObject(gallery, nativeAlbum, route, routeFields) {
    var seed = read("seed:album/detail");
    if (!seed || !seed.album) throw new Error("open a normal Hpoi album first");
    var a = copy(nativeAlbum || seed.album);
    if (nativeAlbum && route) {
      var nativeFields = Array.isArray(routeFields) ? routeFields : [];
      rewriteAlbumRoute(a, route, route, nativeFields);
      // Keep the actual Hpoi navigation route, but give the dedicated card
      // its own object identity when "id" itself is not the navigation field.
      if (nativeFields.indexOf("id") < 0) a.id = ALBUM;
    } else {
      rewriteAlbumRoute(a, null, route || ALBUM, ["id", "itemId", "albumId"]);
    }
    a.itemType = "album";
    a.name = a.nameCN = "EXHOBBY 相册";
    a.detail = "<p>EXHOBBY 相册，共 " + gallery.rows.length + " 张图片。</p>";
    a.cover = "/__exhobby__/" + gallery.rows[0].path;
    a.picCount = gallery.rows.length;
    a.owner = ""; a.video = false; a.r18 = Math.max(20, Number(a.r18) || 0);
    a.user = neutralUser(a.user);
    resetCounts(a);
    return a;
  }
  function pictureObject(row, nativeId) {
    var seed = read("seed:pic/list/relate-v2");
    if (!seed || !seed.picture) throw new Error("picture template missing");
    var p = copy(seed.picture);
    p.id = p.itemId = nativeId || nativePictureId(row);
    p.path = "/__exhobby__/" + row.path;
    p.r18 = Math.max(20, Number(p.r18) || 0);
    p.original = 0; p.originalPainting = false; p.relate = [];
    if ("name" in p) p.name = "EXHOBBY";
    if ("nameCN" in p) p.nameCN = "EXHOBBY";
    if ("detail" in p) p.detail = "";
    // Square layout placeholder when the source API supplies no dimensions.
    p.width = row.width || 1000; p.height = row.height || 1000;
    p.size = row.size || 0;
    resetCounts(p);
    return p;
  }
  function pictureRowObject(row, rank) {
    var seed = read("seed:pic/list/relate-v2");
    if (!seed || !seed.picture) throw new Error("picture template missing");
    var picture = pictureObject(row);
    var wrapper = seed.row ? copy(seed.row) : {};
    wrapper.id = picture.id;
    wrapper.rank = rank;
    wrapper.pictureInfo = picture;
    return wrapper;
  }
  function mergeTemplate(previous, current) {
    var out = copy(previous || {});
    Object.keys(current || {}).forEach(function (k) {
      var value = current[k];
      if (value !== undefined && value !== null && value !== "") out[k] = copy(value);
      else if (!(k in out)) out[k] = value;
    });
    return out;
  }
  function savePictureRowSeed(p, nativeRow) {
    if (!nativeRow || !nativeRow.pictureInfo) return false;
    var previous = read("seed:pic/list/relate-v2") || {};
    var row = mergeTemplate(previous.row, nativeRow);
    var picture = mergeTemplate(previous.picture, nativeRow.pictureInfo);
    picture.relate = []; delete picture.user;
    row.pictureInfo = picture;
    var ok = save("seed:pic/list/relate-v2", {
      p: p || previous.p || {}, picture: picture, row: row
    });
    if (ok) {
      var preserved = nativeRow.subType == null && row.subType != null;
      log("native picture row template ready" +
        (row.subType != null ? " subType=" + row.subType : "") +
        (preserved ? " preserved" : ""));
    }
    return ok;
  }
  function reply(data) {
    done({ body: JSON.stringify({
      success: true, msg: "操作成功", code: 200, data: data
    }) });
  }
  function errorReply() {
    done({ body: JSON.stringify({
      success: false, msg: "EXHOBBY 相册暂不可用，请返回词条刷新", code: 503, data: {}
    }) });
  }
  function captureExhobbySession() {
    var url = String(req.url || "");
    if (!/^https:\/\/www\.exhobby\.net\/picture(?:\?|\/\d+(?:\?|$))/.test(url)) {
      return false;
    }
    if (typeof $response === "undefined" || Number($response.statusCode) !== 200) {
      done(); return true;
    }
    var body = typeof $response.body === "string" ? $response.body : "";
    var confirmed = false;
    if (/^https:\/\/www\.exhobby\.net\/picture\?/.test(url)) {
      var item = body.match(/\bquery\s*\.\s*item\s*=\s*["']?(\d+)/i);
      confirmed = !!(item && Number(item[1]) > 0 &&
        /(?:https?:)?\/\/res\.e39x\.com\/pic\/(?:s|n|raw)\//i.test(body) &&
        !/<h1\b[^>]*>\s*年[齡龄]提醒/i.test(body));
    } else {
      try {
        var list = JSON.parse(body);
        confirmed = Array.isArray(list) && list.length > 0 && list.every(function (row) {
          return row && typeof row.path === "string" &&
            /^[a-z0-9_./-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(row.path) &&
            Number.isInteger(Number(row.id)) && Number(row.id) > 0;
        });
      } catch (_) {}
    }
    if (confirmed) {
      var cookie = "", agent = "";
      Object.keys(req.headers || {}).forEach(function (k) {
        if (k.toLowerCase() === "cookie") cookie = String(req.headers[k]);
        if (k.toLowerCase() === "user-agent") agent = String(req.headers[k]);
      });
      if (cookie && !/[\r\n]/.test(cookie) && !/[\r\n]/.test(agent)) {
        if (save("browser-session", { cookie: cookie, agent: agent, time: Date.now() })) {
          drop("verify-notice");
          var pageItem = body.match(/\bquery\s*\.\s*item\s*=\s*["']?(\d+)/i);
          if (pageItem && validItem(Number(pageItem[1])) &&
              /^https:\/\/www\.exhobby\.net\/picture\?link=/.test(url)) {
            save("all:" + Number(pageItem[1]) + ":gallery-link", verifyURL(url));
          }
          log("v3.5.9 browser session saved; reopen Hpoi");
        } else log("v3.5.9 browser session cache write failed");
      } else log("v3.5.9 gallery loaded, but Cookie header missing; tap More in Safari");
    }
    done();
    return true;
  }
  var exClient = null;

  function makeExClient(options) {
    options = options || {};
    var root = "https://www.exhobby.net";
    var galleryURL = "", firstRows = null, pageItem = 0;
    var targetType = options.itemType === "album" ? "album" : "hobby";
    var targetItemId = Number(options.itemId || (targetType === "album" ? 0 : HOBBY));
    var expectedPageItem = Number(options.expectedPageItem || (targetType === "hobby" ? ITEM : 0));
    var scopeLabel = targetType + ":" + (targetItemId || ITEM);
    var browser = read("browser-session");
    if (!browser || typeof browser.cookie !== "string" || !browser.cookie ||
        /[\r\n]/.test(browser.cookie) || !Number.isFinite(browser.time)) {
      throw verificationRequired("open the EXHOBBY gallery in Safari, complete the site's age confirmation, then tap More");
    }

    function safeURL(value) {
      var url = String(value || "").trim().replace(/&amp;/g, "&");
      if (url.charAt(0) === "/" && url.charAt(1) !== "/") url = root + url;
      if (url.indexOf("//") === 0) url = "https:" + url;
      if (!/^https?:\/\/www\.exhobby\.net\//i.test(url) ||
          /[\s\\\x00-\x1f]/.test(url)) {
        throw new Error("unexpected EXHOBBY URL; request stopped");
      }
      return url.replace(/^http:/i, "https:").split("#")[0];
    }
    function header(response, name) {
      var headers = response.headers || {}, value = "";
      Object.keys(headers).forEach(function (k) {
        if (k.toLowerCase() === name) value = String(headers[k]);
      });
      return value;
    }
    function label(value) {
      return String(value || "").replace(/<[^>]*>/g, " ")
        .replace(/https?:\/\/\S+/gi, "[url]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
        .replace(/(?:UTK)?[a-f0-9]{24,}/gi, "[redacted]")
        .replace(/\s+/g, " ").trim().slice(0, 100);
    }
    function htmlInfo(html, stage) {
      var title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      var heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      var item = html.match(/\bquery\s*\.\s*item\s*=\s*["']?(\d+)/i);
      log("v3.5.9 " + stage + " title=" + label(title && title[1]) +
        " h1=" + label(heading && heading[1]) +
        " figures=" + (html.match(/<figure\b/gi) || []).length +
        " images=" + (html.match(/<img\b/gi) || []).length +
        " item=" + (item ? item[1] : "unknown") +
        " passwordForm=" + /type\s*=\s*["']password["']/i.test(html) +
        " challenge=" + /cf-chl-|cf-turnstile|g-recaptcha/i.test(html));
      return item ? Number(item[1]) : null;
    }
    function readText(response, stage) {
      var text = typeof response.body === "string" ? response.body : null;
      var raw = response.bodyBytes, bytes = null;
      if (raw != null) {
        if (Object.prototype.toString.call(raw) === "[object ArrayBuffer]") {
          bytes = new Uint8Array(raw);
        } else if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView &&
            ArrayBuffer.isView(raw)) {
          bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
        } else if (Array.isArray(raw) && raw.every(function (n) {
          return Number.isInteger(n) && n >= 0 && n <= 255;
        })) bytes = new Uint8Array(raw);
      }
      if ((text === null || text === "") && bytes !== null) {
        if (bytes.length > 1000000) throw new Error(stage + " response too large");
        var encoded = "";
        for (var i = 0; i < bytes.length; i++) {
          encoded += "%" + ("0" + bytes[i].toString(16)).slice(-2);
        }
        try { text = decodeURIComponent(encoded); }
        catch (_) { throw new Error(stage + " invalid UTF-8 bodyBytes"); }
      }
      log("v3.5.9 " + stage + " HTTP=" + response.statusCode +
        " body=" + (text === null ? "missing" : text.length) +
        " type=" + (header(response, "content-type") || "unknown"));
      if (text === null || !text.trim()) {
        throw new Error(stage + " empty/missing body; end NOT confirmed");
      }
      if (text.length > 1000000) throw new Error(stage + " response too large");
      return text.replace(/^\uFEFF/, "");
    }
    function parseJSON(text, stage) {
      try { return JSON.parse(text); }
      catch (_) {
        if (/^\s*</.test(text)) {
          htmlInfo(text, stage);
          if (verificationPage(text)) {
            throw verificationRequired("EXHOBBY requires browser verification", galleryURL);
          }
        }
        throw new Error(stage + " expected JSON, received other content");
      }
    }
    async function request(url, method, body, stage, ticket) {
      url = safeURL(url);
      for (var hop = 0; hop < 5; hop++) {
        ticket.check();
        var headers = {
          "Accept": stage === "first HTML" ? "text/html" : "application/json",
          "Accept-Encoding": "identity",
          "Cookie": browser.cookie
        };
        if (typeof browser.agent === "string" && browser.agent && !/[\r\n]/.test(browser.agent)) {
          headers["User-Agent"] = browser.agent;
        }
        if (galleryURL) headers.Referer = galleryURL;
        if (method === "POST") {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        if (stage.indexOf("page ") === 0) {
          headers["X-Requested-With"] = "XMLHttpRequest";
          headers.Origin = root;
        }
        var options = {
          url: url, method: method, headers: headers,
          opts: { "auto-cookie": false, "redirection": false }
        };
        if (method === "POST") options.body = body || "";
        var response;
        try { response = await $task.fetch(options); }
        catch (_) { throw new Error(stage + " network error"); }
        ticket.check();
        var status = Number(response.statusCode);
        if ([301, 302, 303, 307, 308].indexOf(status) >= 0) {
          url = safeURL(header(response, "location"));
          log("v3.5.9 " + stage + " redirect=" + url.split("?")[0]);
          if (status === 303 || ((status === 301 || status === 302) && method === "POST")) {
            method = "GET"; body = "";
          }
          continue;
        }
        if (status !== 200) {
          if (verificationPage(response.body)) {
            throw verificationRequired("EXHOBBY requires browser verification", galleryURL);
          }
          throw new Error(stage + " HTTP " + status);
        }
        return readText(response, stage);
      }
      throw new Error(stage + " too many redirects");
    }
    function parseFirst(html) {
      var actualItem = htmlInfo(html, "first HTML");
      if (verificationPage(html)) {
        throw verificationRequired("EXHOBBY requires browser verification; reopen its gallery in Safari and tap More", galleryURL);
      }
      if (targetType === "hobby" && actualItem !== null &&
          expectedPageItem && actualItem !== expectedPageItem) {
        throw new Error("first HTML belongs to a different item");
      }
      pageItem = actualItem || expectedPageItem || ITEM;
      if (!validItem(Number(pageItem))) {
        throw new Error("EXHOBBY gallery page item is invalid");
      }
      var figures = html.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) || [];
      var blocks = figures.length ? figures : (html.match(/<a\b[^>]*>/gi) || []);
      var rows = [], seen = Object.create(null), unmatched = 0;
      blocks.forEach(function (block) {
        var re = figures.length
          ? /\b(?:href|src|data-src|data-original)\s*=\s*["'](?:https?:)?\/\/res\.e39x\.com\/pic\/(?:s|n|raw)\/([^"'?#<>]+)(?:\?[^"']*)?["']/i
          : /\bhref\s*=\s*["'](?:https?:)?\/\/res\.e39x\.com\/pic\/(?:n|raw)\/([^"'?#<>]+)(?:\?[^"']*)?["']/i;
        var m = block.match(re);
        if (!m) { if (figures.length) unmatched++; return; }
        if (!seen[m[1]]) {
          seen[m[1]] = true;
          rows.push({ id: 139000000 + rows.length, path: m[1] });
        }
      });
      if (unmatched) throw new Error("first HTML has unrecognized figures=" + unmatched);
      if (!rows.length) {
        throw new Error("fresh first HTML has no gallery pictures; see title/redirect above");
      }
      log("v3.5.9 " + scopeLabel + " first HTML count=" + rows.length);
      return rows;
    }
    async function bootstrap(ticket) {
      var query;
      if (targetType === "album") {
        if (!Number.isInteger(targetItemId) || targetItemId <= 0 || targetItemId >= ALBUM_BASE) {
          throw new Error("invalid native album itemId for EXHOBBY lookup");
        }
        query = "itemId=" + targetItemId + "&itemType=album";
      } else {
        query = HOBBY ? "itemId=" + HOBBY + "&itemType=hobby" : "id=" + ITEM;
      }
      var text = await request(root + "/get/pic?" + query, "POST", "", "resolve link", ticket);
      var data = parseJSON(text, "resolve link");
      if (data && data.success !== false && data.map &&
          Array.isArray(data.map.list) && data.map.list.length === 0 && !data.map.url) {
        firstRows = []; return;
      }
      if (!data || data.success === false || !data.map || typeof data.map.url !== "string") {
        throw new Error("resolve link response has no map.url");
      }
      var url = safeURL(data.map.url);
      if (!/\/picture\?/.test(url) || !/(?:\?|&)link=[^&#]+/.test(url)) {
        throw new Error("map.url is not a full picture link");
      }
      galleryURL = url;
      if (targetType === "hobby") save("gallery-link", url);
      log("v3.5.9 " + scopeLabel + " fresh map.url ready; preview list not used");
      firstRows = parseFirst(await request(url, "GET", "", "first HTML", ticket));
    }
    return {
      page: async function (page, ticket) {
        if (firstRows === null) await bootstrap(ticket);
        if (page === 1) return firstRows;
        var text = await request(root + "/picture/" + pageItem, "POST",
          "page=" + page + "&item=" + pageItem + "&type=all", "page " + page, ticket);
        var list = parseJSON(text, "page " + page);
        if (!Array.isArray(list)) throw new Error("page " + page + " response is not an array");
        log("v3.5.9 " + scopeLabel + " page=" + page + " count=" + list.length);
        return list;
      }
    };
  }
  function fetchClientPage(client, page, milliseconds, label) {
    return new Promise(function (resolve, reject) {
      var finished = false;
      var timer = setTimeout(function () {
        finish(new Error("v3.5.9 " + (label || "gallery") +
          " page=" + page + " timeout; refresh to resume"));
      }, milliseconds);
      function finish(error, value) {
        if (finished) return;
        finished = true;
        if (typeof clearTimeout === "function") clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      }
      var ticket = { check: function () {
        if (finished) throw new Error("request expired");
      } };
      client.page(page, ticket).then(function (value) {
        finish(null, value);
      }, function (error) { finish(error); });
    });
  }
  function fetchPage(page, milliseconds) {
    if (!exClient) exClient = makeExClient({
      itemType: "hobby", itemId: HOBBY, expectedPageItem: ITEM
    });
    return fetchClientPage(exClient, page, milliseconds, "hobby");
  }

  function sanitizeGalleryRows(list, state) {
    var paths = state.paths, ids = state.ids;
    var additions = [], pagePaths = Object.create(null), pageIds = Object.create(null);
    list.forEach(function (r) {
      var path = String(r.path || "").replace(/^\/+/, ""), id = Number(r.id);
      if (!path || path.length > 500 || !/^[a-z0-9_./-]+$/i.test(path) ||
          path.split("/").some(function (part) { return part === "." || part === ".." || !part; }) ||
          !Number.isInteger(id) || id <= 0 || id >= 140000000) {
        throw new Error("unsupported EXHOBBY picture metadata");
      }
      if ((ids[id] && ids[id] !== path) || (pageIds[id] && pageIds[id] !== path)) {
        throw new Error("conflicting EXHOBBY picture IDs");
      }
      pageIds[id] = path;
      if (!paths[path] && !pagePaths[path]) {
        pagePaths[path] = true;
        var row = { id: id, path: path };
        ["width", "height", "size"].forEach(function (k) {
          var n = Number(r[k]);
          if (Number.isFinite(n) && n > 0) row[k] = n;
        });
        additions.push(row);
      }
    });
    additions.forEach(function (r) {
      paths[r.path] = true; ids[r.id] = r.path;
    });
    return additions;
  }

  function sameGalleryRows(a, b) {
    if (!a || !b || !Array.isArray(a.rows) || !Array.isArray(b.rows) ||
        a.rows.length !== b.rows.length) return false;
    for (var i = 0; i < a.rows.length; i++) {
      if (String(a.rows[i].path) !== String(b.rows[i].path)) return false;
    }
    return true;
  }

  async function loadAlbumGallery(albumItemId) {
    albumItemId = Number(albumItemId);
    if (!Number.isInteger(albumItemId) || albumItemId <= 0 || albumItemId >= ALBUM_BASE) {
      return { version: 31, complete: true, time: Date.now(), rows: [], scoped: false };
    }
    trackCacheValue("albums", albumItemId);
    var prefix = ITEM + ":" + albumItemId;
    var complete = readRaw("album-gallery:" + prefix), now = Date.now();
    if (complete && complete.complete && complete.version === 31 &&
        now - Number(complete.time) < ALBUM_GALLERY_TTL) return complete;

    var lockKey = "album-lock:" + prefix, workKey = "album-work:" + prefix;
    var lock = readRaw(lockKey);
    if (lock && now < Number(lock.until || 0)) {
      return complete && complete.complete ? complete :
        { version: 31, complete: true, time: now, rows: [], scoped: false };
    }

    var owner = String(now) + Math.random();
    saveRaw(lockKey, { owner: owner, until: now + 6500 });
    var work = readRaw(workKey);
    if (!work || work.version !== 31 || now - Number(work.started || 0) > 120000) {
      work = { version: 31, started: now, next: 1, rows: [], last: "", first: "" };
    }
    var client = makeExClient({ itemType: "album", itemId: albumItemId, expectedPageItem: 0 });
    var deadline = now + 5500;
    try {
      var first = await fetchClientPage(client, 1, Math.max(100, deadline - Date.now()),
        "album:" + albumItemId);
      var firstSignature = first.map(function (r) { return r.path; }).join("|");
      if (work.next > 1 && work.first !== firstSignature) {
        work = { version: 31, started: now, next: 1, rows: [], last: "", first: "" };
      }
      work.first = firstSignature;

      var state = { paths: Object.create(null), ids: Object.create(null) };
      work.rows.forEach(function (r) {
        state.paths[r.path] = true; state.ids[r.id] = r.path;
      });

      while (Date.now() < deadline - 150) {
        var list = work.next === 1 ? first :
          await fetchClientPage(client, work.next, Math.max(100, deadline - Date.now()),
            "album:" + albumItemId);
        if (!list.length) {
          complete = { version: 31, complete: true, time: Date.now(),
            rows: work.rows, scoped: true, albumItemId: albumItemId };
          var full = read("gallery");
          var index = cacheIndex(), entry = index[String(ITEM)] || {};
          var multipleAlbums = Array.isArray(entry.albums) && entry.albums.length > 1;
          if (multipleAlbums && full && full.complete && sameGalleryRows(complete, full)) {
            complete.rows = [];
            complete.scoped = false;
            log("album=" + albumItemId +
              " EXHOBBY resolver returned full hobby gallery; skip native injection");
          }
          saveRaw("album-gallery:" + prefix, complete);
          $prefs.removeValueForKey(NS + workKey);
          log("album=" + albumItemId + " EXHOBBY scoped total=" +
            complete.rows.length + " scoped=" + complete.scoped);
          return complete;
        }
        var signature = list.map(function (r) {
          return String(r.id) + ":" + String(r.path);
        }).join("|");
        if (signature === work.last) throw new Error("repeated EXHOBBY album page");
        var additions = sanitizeGalleryRows(list, state);
        additions.forEach(function (r) { work.rows.push(r); });
        work.last = signature; work.next++;
        saveRaw(workKey, work);
      }
      throw new Error("EXHOBBY album pagination timeout");
    } catch (e) {
      log("album=" + albumItemId + " scoped gallery unavailable: " +
        (e && e.message ? e.message : "unknown"));
      return { version: 31, complete: true, time: Date.now(), rows: [], scoped: false };
    } finally {
      var current = readRaw(lockKey);
      if (current && current.owner === owner) $prefs.removeValueForKey(NS + lockKey);
    }
  }

  async function loadGallery() {
    var now = Date.now(), complete = read("gallery");
    if (complete && complete.complete && complete.version === 30 && now - complete.time < 600000) return complete;
    var lock = read("lock");
    if (lock && now < lock.until) throw new Error("gallery is loading; refresh shortly");
    var owner = String(now) + Math.random();
    save("lock", { owner: owner, until: now + 7500 });
    var work = read("work");
    if (!work || work.version !== 30 || now - work.started > 120000) {
      work = { version: 30, started: now, next: 1, rows: [], last: "", first: "" };
    }
    var deadline = now + 6500;
    try {
      var first = await fetchPage(1, Math.max(100, deadline - Date.now()));
      var firstSignature = first.map(function (r) { return r.path; }).join("|");
      if (work.next > 1 && work.first !== firstSignature) {
        work = { version: 30, started: now, next: 1, rows: [], last: "", first: "" };
        log("v3.5.9 first page changed; restarting pagination");
      }
      work.first = firstSignature;
      var paths = Object.create(null), ids = Object.create(null);
      work.rows.forEach(function (r) { paths[r.path] = true; ids[r.id] = r.path; });
      while (Date.now() < deadline - 200) {
        var list = work.next === 1 ? first : await fetchPage(work.next, Math.max(100, deadline - Date.now()));
        if (!list.length) {
          complete = { version: 30, complete: true, time: Date.now(), rows: work.rows };
          if (!save("gallery", complete)) throw new Error("gallery cache write failed");
          drop("work");
          log("hobby=" + HOBBY + " total=" + complete.rows.length +
            " complete=true pages=" + (work.next - 1));
          return complete;
        }
        var signature = list.map(function (r) { return String(r.id) + ":" + r.path; }).join("|");
        if (signature === work.last) throw new Error("repeated EXHOBBY page; completeness not confirmed");
        var additions = [], pagePaths = Object.create(null), pageIds = Object.create(null);
        list.forEach(function (r) {
          var path = String(r.path || "").replace(/^\/+/, ""), id = Number(r.id);
          if (!path || path.length > 500 || !/^[a-z0-9_./-]+$/i.test(path) ||
              path.split("/").some(function (s) { return s === "." || s === ".." || !s; }) ||
              !Number.isInteger(id) || id <= 0 || id >= 140000000) {
            throw new Error("unsupported EXHOBBY picture metadata");
          }
          if ((ids[id] && ids[id] !== path) || (pageIds[id] && pageIds[id] !== path)) {
            throw new Error("conflicting EXHOBBY picture IDs");
          }
          pageIds[id] = path;
          if (!paths[path] && !pagePaths[path]) {
            pagePaths[path] = true;
            var row = { id: id, path: path };
            ["width", "height", "size"].forEach(function (k) {
              var n = Number(r[k]);
              if (Number.isFinite(n) && n > 0) row[k] = n;
            });
            additions.push(row);
          }
        });
        additions.forEach(function (r) {
          paths[r.path] = true; ids[r.id] = r.path; work.rows.push(r);
        });
        work.last = signature; work.next++;
        if (!save("work", work)) throw new Error("pagination cache write failed");
      }
      throw new Error("pagination timeout; refresh to resume from page " + work.next);
    } finally {
      var current = read("lock");
      if (current && current.owner === owner) drop("lock");
    }
  }
  async function main() {
    if (handleCacheClear()) return;
    if (captureExhobbySession()) return;
    if (!endpoint) return done();
    var isResponse = typeof $response !== "undefined" && $response !== null;
    var session = req.sessionIndex;
    var key = "request:" + (Number(session) % 256);
    if (!isResponse) {
      if (session == null) { log("request session unavailable"); return done(); }
      var p = params(), v = endpoint === "hobby/album" ? null : virtualItem(p);
      log("runtime=v3.5.9 phase=request endpoint=" + endpoint);
      if (endpoint === "album/detail" || endpoint === "pic/list/relate-v2" ||
          endpoint === "item/get") {
        var routeBits = [];
        ["id", "itemId", "albumId", "picId", "itemType", "subType", "page", "pageSize"]
          .forEach(function (k) {
            if (p[k] != null && p[k] !== "") routeBits.push(k + "=" + p[k]);
          });
        log("route request endpoint=" + endpoint +
          (routeBits.length ? " " + routeBits.join(" ") : " no-public-route-fields") +
          (v ? " virtual=" + v.type + " target=" + v.item : " virtual=none"));
      }
      if (v) setTarget(v.item);
      else if (endpoint === "hobby/album") setTarget(p.id);
      var ctx = { session: session, time: Date.now(), endpoint: endpoint, p: p, v: v,
        target: ITEM };
      var output = {};
      if (v && v.type === "normal-owner") {
        ctx.remapped = false;
        log("v3.5.9 native album owner resolved itemId=" + v.route);
      } else if (v && v.type === "normal-nav") {
        if (Number(p.itemId) !== Number(v.proxy)) {
          throw new Error("navigation proxy itemId missing");
        }
        output = changeRequest({ itemId: String(v.route) });
        ctx.remapped = true;
        log("v3.5.9 native album navigation itemId restored " +
          v.proxy + "->" + v.route);
      } else if (v && v.type === "normal") {
        var proxyChanges = {};
        ID_FIELDS.forEach(function (k) {
          if (Number(p[k]) === Number(v.proxy)) proxyChanges[k] = String(v.route);
        });
        if (!Object.keys(proxyChanges).length) {
          throw new Error("normal album proxy field missing");
        }
        output = changeRequest(proxyChanges);
        ctx.remapped = true;
        log("v3.5.9 normal album proxy remapped to native route");
      } else if (v) {
        var seed = read("seed:" + endpoint);
        if (!seed || !seed.p) throw new Error("open a normal Hpoi album first");
        var changes = {}, safeId = "";
        Object.keys(seed.p).forEach(function (k) {
          changes[k] = seed.p[k];
          if (!safeId && ID_FIELDS.indexOf(k) >= 0) {
            var candidate = Number(seed.p[k]);
            if (Number.isInteger(candidate) && candidate > 0 && candidate < ALBUM_BASE) {
              safeId = String(seed.p[k]);
            }
          }
        });
        if (endpoint === "pic/list/relate-v2") changes.page = "1";
        ID_FIELDS.forEach(function (k) {
          var nativeId = Number(p[k]);
          var dedicatedRoute = v.type === "album" && nativeId === Number(v.route);
          if (p[k] && (nativeId === ALBUM || nativeId > PIC_BASE || dedicatedRoute) &&
              !changes[k]) {
            if (!safeId) throw new Error("native album template has no safe ID field");
            changes[k] = safeId;
            log("v3.5.9 remap request field " + k + " via template ID");
          }
        });
        output = changeRequest(changes);
        ctx.remapped = true;
      }
      if (!save(key, ctx)) throw new Error("request context write failed");
      return done(output);
    }

    var ctx = read(key);
    if (!ctx || ctx.session !== session || ctx.endpoint !== endpoint ||
        Date.now() - ctx.time > 60000) ctx = null;
    else $prefs.removeValueForKey(NS + key);
    if (ctx && ctx.target) setTarget(ctx.target);
    var doc;
    try { doc = JSON.parse($response.body); } catch (_) { return done(); }
    if (ctx && ctx.v) {
      if (ctx.v.type === "normal-owner") {
        if (doc.success !== true || !doc.data) return done();
        if (endpoint === "pic/list/relate-v2") {
          if (Array.isArray(doc.data.list) && doc.data.list.length &&
              doc.data.list[0] && doc.data.list[0].pictureInfo) {
            savePictureRowSeed(ctx.p, doc.data.list[0]);
          }
          if (await injectGalleryIntoNativePictures(doc, ctx)) {
            return done({ body: JSON.stringify(doc) });
          }
        }
        return done();
      }
      if (ctx.v.type === "normal-nav") {
        if (!ctx.remapped || doc.success !== true || !doc.data) return done();
        var navRestored = false;
        if (endpoint === "album/detail" && doc.data.album) {
          if (Number(doc.data.album.itemId) === Number(ctx.v.route)) {
            doc.data.album.itemId = ctx.v.proxy;
          }
          navRestored = true;
        }
        if (endpoint === "item/get" && doc.data.itemData) {
          if (Number(doc.data.itemData.itemId) === Number(ctx.v.route)) {
            doc.data.itemData.itemId = ctx.v.proxy;
          }
          navRestored = true;
        }
        if (endpoint === "pic/list/relate-v2") {
          if (Array.isArray(doc.data.list) && doc.data.list.length &&
              doc.data.list[0] && doc.data.list[0].pictureInfo) {
            savePictureRowSeed(ctx.p, doc.data.list[0]);
          }
          if (await injectGalleryIntoNativePictures(doc, ctx)) {
            log("native Hpoi album navigation proxy preserved");
            return done({ body: JSON.stringify(doc) });
          }
        }
        log("native Hpoi album navigation proxy preserved");
        return navRestored ? done({ body: JSON.stringify(doc) }) : done();
      }
      if (ctx.v.type === "normal") {
        if (!ctx.remapped || doc.success !== true || !doc.data) return done();
        var restored = false;
        if (endpoint === "album/detail" && doc.data.album) {
          rewriteAlbumRoute(doc.data.album, ctx.v.route, ctx.v.proxy, ctx.v.fields); restored = true;
        }
        if (endpoint === "item/get" && doc.data.itemData) {
          rewriteAlbumRoute(doc.data.itemData, ctx.v.route, ctx.v.proxy, ctx.v.fields); restored = true;
        }
        log("normal Hpoi album kept separate from EXHOBBY");
        return restored ? done({ body: JSON.stringify(doc) }) : done();
      }
      virtualResponse = true;
      if (!ctx.remapped || doc.success !== true) return errorReply();
      if (endpoint === "item/get" && ctx.v.type === "pic") {
        return reply({ itemData: pictureObject(ctx.v.row, ctx.v.nativeId) });
      }
      var g = read("gallery");
      if (!g || !g.complete || g.version !== 30) return errorReply();
      if (endpoint === "album/detail") {
        return reply({ album: albumObject(g, ctx.v.album, ctx.v.route, ctx.v.fields), videoList: [], event: null });
      }
      if (endpoint === "item/get") {
        if (ctx.v.type === "album") {
          return reply({ itemData: albumObject(g, ctx.v.album, ctx.v.route, ctx.v.fields) });
        }
        return errorReply();
      }
      if (endpoint === "pic/list/relate-v2") {
        if (doc.data && Array.isArray(doc.data.list) && doc.data.list.length &&
            doc.data.list[0] && doc.data.list[0].pictureInfo) {
          savePictureRowSeed(ctx.p, doc.data.list[0]);
        }
        var page = Math.max(1, Number(ctx.p.page) || 1);
        var size = Math.max(1, Number(ctx.p.pageSize) || 20);
        if (!Number.isInteger(page) || !Number.isInteger(size)) return errorReply();
        var start = (page - 1) * size;
        var pictures = g.rows.slice(start, start + size).map(function (r, i) {
          return pictureRowObject(r, start + i + 1);
        });
        log("native page=" + page + " count=" + pictures.length + " total=" + g.rows.length);
        return reply({ list: pictures });
      }
      return errorReply();
    }
    if (doc.success !== true || !doc.data) return done();
    if (endpoint === "item/get") {
      var item = doc.data.itemData;
      if (item && item.itemType === "hobby" && validItem(Number(item.id)) &&
          Number.isInteger(Number(item.itemId)) && Number(item.itemId) > 0) {
        setTarget(item.id); HOBBY = Number(item.itemId);
        save("hobby", { hobbyId: HOBBY, cover: item.cover || "" });
        if (ctx) save("seed:item/get", { p: ctx.p });
        var old = item.detail;
        if (typeof old === "string") {
          item.detail = old.replace(/<!--HPOI_EXHOBBY_START-->[\s\S]*?<!--HPOI_EXHOBBY_END-->/g, "");
          if (item.detail !== old) return done({ body: JSON.stringify(doc) });
        }
      }
      return done();
    }
    if (!ctx) return done();
    if (endpoint === "album/detail" && doc.data.album) {
      var album = copy(doc.data.album);
      album.user = neutralUser(album.user); delete album.detail;
      save("seed:album/detail", { p: ctx.p, album: album });
      log("native album template ready");
    }
    if (endpoint === "pic/list/relate-v2" && Array.isArray(doc.data.list) &&
        doc.data.list.length && doc.data.list[0].pictureInfo) {
      savePictureRowSeed(ctx.p, doc.data.list[0]);
    }
    if (endpoint === "hobby/album" && ITEM && Number(ctx.p.id) === ITEM &&
        Math.max(1, Number(ctx.p.page) || 1) === 1 && Array.isArray(doc.data.list)) {
      if (!read("seed:album/detail") || !read("seed:pic/list/relate-v2")) {
        log("initialization: open one normal Hpoi album, then reopen the hobby");
        return done();
      }
      if (!save("known", true)) throw new Error("album mapping write failed");
      var gallery = await loadGallery();
      if (!gallery.rows.length) { log("EXHOBBY gallery is empty"); return done(); }
      doc.data.list = doc.data.list.filter(function (a) {
        return Number(a && a.id) !== ALBUM && Number(a && a.itemId) !== ALBUM;
      });
      doc.data.list.forEach(function (nativeAlbum) {
        rememberAlbumOwner(nativeAlbum);
      });

      // v3.5.9: native Hpoi albums keep their original id/itemId unchanged.
      // EXHOBBY receives its own stable local route that is checked against all
      // native id/itemId/albumId values in this hobby before insertion.
      var dedicatedRoute = dedicatedAlbumRoute(doc.data.list);
      doc.data.list = doc.data.list.filter(function (a) {
        return Number(a && a.id) !== dedicatedRoute &&
          Number(a && a.itemId) !== dedicatedRoute &&
          Number(a && a.albumId) !== dedicatedRoute &&
          Number(a && a.id) !== ALBUM &&
          Number(a && a.itemId) !== ALBUM;
      });
      var dedicatedEntry = albumObject(gallery, null, dedicatedRoute);
      doc.data.list.unshift(dedicatedEntry);
      log("dedicated EXHOBBY entry added; native Hpoi ids unchanged; total=" +
        gallery.rows.length + " route id=" + dedicatedEntry.id +
        " itemId=" + dedicatedEntry.itemId +
        " uniqueRoute=" + dedicatedRoute +
        (dedicatedEntry.subType != null ? " subType=" + dedicatedEntry.subType : ""));
      return done({ body: JSON.stringify(doc) });
    }
    done();
  }
  main().catch(function (e) {
    log("v3.5.9 " + (e && e.message ? e.message : "operation failed"));
    Promise.resolve().then(function () {
      if (e && e.verificationURL) return notifyVerification(e);
    }).catch(function () {}).then(function () {
      if (virtualResponse) errorReply(); else done();
    });
  });
})();
