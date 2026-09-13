// Hpoi + EXHOBBY native album v3.3 — Quantumult X
// Automatically handles hobby entries with an EXHOBBY gallery.
// Reuses the browser session and native templates saved by v2.3.
// No Hpoi token is stored or sent to EXHOBBY.
// EXHOBBY cookies are captured locally only after its gallery loads normally.
(function () {
  "use strict";
  var NS = "HPOI_EXHOBBY_NATIVE_V2:";
  var VERIFY_COOLDOWN = 45 * 60 * 1000;
  var HOBBY = 0, ITEM = 0, ALBUM = 0;
  var ALBUM_BASE = 1000000000, PIC_BASE = 2001000000;
  var FIELDS = ["id", "itemId", "itemType", "albumId", "picId",
    "hobbyId", "type", "subType", "order", "sort", "page", "pageSize"];
  var ID_FIELDS = ["id", "itemId", "albumId", "picId", "hobbyId"];
  var req = $request, ended = false, virtualResponse = false;
  var match = String(req.url || "").match(
    /^https:\/\/www\.hpoi\.net\.cn\/api\/(item\/get|hobby\/album|album\/detail|pic\/list\/relate-v2)(?:\?|$)/);
  var endpoint = match && match[1];

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
      log("v3.3 notice cooldown could not be saved");
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
      log("v3.3 Bark delivery failed; falling back to Quantumult X notice");
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
      var n = Number(p[ID_FIELDS[i]]), item = n - ALBUM_BASE;
      if (validItem(item) && read("all:" + item + ":known")) {
        return { type: "album", item: item };
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
      if (record && record.row && record.row.path === row.path) return id;
      if (!record) {
        if (!save("image:" + id, { item: ITEM, row: row })) {
          throw new Error("picture mapping write failed");
        }
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
  function albumObject(gallery) {
    var seed = read("seed:album/detail");
    if (!seed || !seed.album) throw new Error("open a normal Hpoi album first");
    var a = copy(seed.album);
    a.id = ALBUM; a.itemId = ALBUM; a.itemType = "album";
    a.name = a.nameCN = "EXHOBBY 相册";
    a.detail = "<p>EXHOBBY 相册，共 " + gallery.rows.length + " 张图片。</p>";
    // Keep the gallery preview recognizable without changing any photo inside it.
    a.cover = "/__exhobby__/cover-v3.2.png";
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
          log("v3.3 browser session saved; reopen Hpoi");
        } else log("v3.3 browser session cache write failed");
      } else log("v3.3 gallery loaded, but Cookie header missing; tap More in Safari");
    }
    done();
    return true;
  }
  var exClient = null;

  function makeExClient() {
    var root = "https://www.exhobby.net";
    var galleryURL = "", firstRows = null;
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
      log("v3.3 " + stage + " title=" + label(title && title[1]) +
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
      log("v3.3 " + stage + " HTTP=" + response.statusCode +
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
          log("v3.3 " + stage + " redirect=" + url.split("?")[0]);
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
      if (actualItem !== null && actualItem !== ITEM) {
        throw new Error("first HTML belongs to a different item");
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
      log("v3.3 first HTML count=" + rows.length);
      return rows;
    }
    async function bootstrap(ticket) {
      var query = HOBBY ? "itemId=" + HOBBY + "&itemType=hobby" : "id=" + ITEM;
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
      save("gallery-link", url);
      log("v3.3 fresh map.url ready; preview list not used");
      firstRows = parseFirst(await request(url, "GET", "", "first HTML", ticket));
    }
    return {
      page: async function (page, ticket) {
        if (firstRows === null) await bootstrap(ticket);
        if (page === 1) return firstRows;
        var text = await request(root + "/picture/" + ITEM, "POST",
          "page=" + page + "&item=" + ITEM + "&type=all", "page " + page, ticket);
        var list = parseJSON(text, "page " + page);
        if (!Array.isArray(list)) throw new Error("page " + page + " response is not an array");
        log("v3.3 page=" + page + " count=" + list.length);
        return list;
      }
    };
  }
  function fetchPage(page, milliseconds) {
    if (!exClient) exClient = makeExClient();
    return new Promise(function (resolve, reject) {
      var finished = false;
      var timer = setTimeout(function () {
        finish(new Error("v3.3 page=" + page + " timeout; refresh to resume"));
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
      exClient.page(page, ticket).then(function (value) {
        finish(null, value);
      }, function (error) { finish(error); });
    });
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
        log("v3.3 first page changed; restarting pagination");
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
    if (captureExhobbySession()) return;
    if (!endpoint) return done();
    var isResponse = typeof $response !== "undefined" && $response !== null;
    var session = req.sessionIndex;
    var key = "request:" + (Number(session) % 256);
    if (!isResponse) {
      if (session == null) { log("request session unavailable"); return done(); }
      var p = params(), v = endpoint === "hobby/album" ? null : virtualItem(p);
      if (v) setTarget(v.item);
      else if (endpoint === "hobby/album") setTarget(p.id);
      var ctx = { session: session, time: Date.now(), endpoint: endpoint, p: p, v: v, target: ITEM };
      var output = {};
      if (v) {
        var seed = read("seed:" + endpoint);
        if (!seed || !seed.p) throw new Error("open a normal Hpoi album first");
        var changes = {};
        Object.keys(seed.p).forEach(function (k) { changes[k] = seed.p[k]; });
        if (endpoint === "pic/list/relate-v2") changes.page = "1";
        ID_FIELDS.forEach(function (k) {
          if (p[k] && !changes[k] && (Number(p[k]) === ALBUM || Number(p[k]) > PIC_BASE)) {
            throw new Error("unrecognized native album request field: " + k);
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
      virtualResponse = true;
      if (!ctx.remapped || doc.success !== true) return errorReply();
      if (endpoint === "item/get" && ctx.v.type === "pic") {
        return reply({ itemData: pictureObject(ctx.v.row, ctx.v.nativeId) });
      }
      var g = read("gallery");
      if (!g || !g.complete || g.version !== 30) return errorReply();
      if (endpoint === "album/detail") {
        return reply({ album: albumObject(g), videoList: [], event: null });
      }
      if (endpoint === "item/get") {
        if (ctx.v.type === "album") return reply({ itemData: albumObject(g) });
        return errorReply();
      }
      if (endpoint === "pic/list/relate-v2") {
        var page = Math.max(1, Number(ctx.p.page) || 1);
        var size = Math.max(1, Number(ctx.p.pageSize) || 20);
        if (!Number.isInteger(page) || !Number.isInteger(size)) return errorReply();
        var start = (page - 1) * size;
        var pictures = g.rows.slice(start, start + size).map(function (r, i) {
          var picture = pictureObject(r);
          return { id: picture.id, rank: start + i + 1, pictureInfo: picture };
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
      var picture = copy(doc.data.list[0].pictureInfo);
      picture.relate = []; delete picture.user;
      save("seed:pic/list/relate-v2", { p: ctx.p, picture: picture });
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
      doc.data.list = doc.data.list.filter(function (a) { return Number(a.itemId) !== ALBUM; });
      doc.data.list.unshift(albumObject(gallery));
      log("native album entry added; total=" + gallery.rows.length);
      return done({ body: JSON.stringify(doc) });
    }
    done();
  }
  main().catch(function (e) {
    log("v3.3 " + (e && e.message ? e.message : "operation failed"));
    Promise.resolve().then(function () {
      if (e && e.verificationURL) return notifyVerification(e);
    }).catch(function () {}).then(function () {
      if (virtualResponse) errorReply(); else done();
    });
  });
})();
