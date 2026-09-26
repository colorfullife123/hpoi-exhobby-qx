const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "hpoi-ad-sanitize.js"), "utf8");

function run(body) {
  let output;
  const logs = [];
  const context = {
    $response: { body },
    $done(value) { output = value; },
    console: { log(value) { logs.push(String(value)); } }
  };
  vm.runInNewContext(script, context, { filename: "hpoi-ad-sanitize.js" });
  return { output, logs };
}

{
  const retained = {
    id: 2,
    official: true,
    image: "https://rfx.hpoi.net/startup.jpg",
    assets: ["1x", "2x"]
  };
  const input = {
    success: true,
    code: 200,
    msg: "ok",
    data: {
      list: [{ id: 1, image: "https://example.invalid/a.jpg" }],
      splash: [retained, { id: 3 }],
      config: { intervals: [1, 2, 3], enabled: true }
    }
  };
  const result = run(JSON.stringify(input));
  const parsed = JSON.parse(result.output.body);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.code, 200);
  assert.strictEqual(parsed.msg, "ok");
  assert.deepStrictEqual(parsed.data.list, []);
  assert.deepStrictEqual(parsed.data.splash, [retained]);
  assert.deepStrictEqual(parsed.data.splash[0].assets, ["1x", "2x"]);
  assert.deepStrictEqual(parsed.data.config.intervals, []);
  assert.strictEqual(parsed.data.config.enabled, true);
  assert(result.logs.some(line => line.includes("kept one startup record")));
}

{
  const input = {
    code: 200,
    data: {
      advertList: [
        { id: 1, image: "https://third-party.invalid/ad.jpg" },
        { id: 2, image: "https://www.hpoi.net.cn/static/official.jpg" },
        { id: 3 }
      ]
    }
  };
  const parsed = JSON.parse(run(JSON.stringify(input)).output.body);
  assert.deepStrictEqual(parsed.data.advertList, [input.data.advertList[1]],
    "an explicitly official Hpoi record is preferred when available");
}

{
  const input = [{ id: 1, nestedAssets: ["a", "b"] }, { id: 2 }];
  const parsed = JSON.parse(run(JSON.stringify(input)).output.body);
  assert.deepStrictEqual(parsed, [input[0]]);
  assert.deepStrictEqual(parsed[0].nestedAssets, ["a", "b"]);
}

{
  const input = {
    code: 200,
    data: [
      { id: 1, splash: [{ asset: "keep-a" }, { asset: "keep-b" }] },
      { id: 2, splash: [{ asset: "drop-with-parent" }] }
    ]
  };
  const parsed = JSON.parse(run(JSON.stringify(input)).output.body);
  assert.deepStrictEqual(parsed.data, [input.data[0]],
    "the retained startup array cannot be nested below an array that is removed");
  assert.deepStrictEqual(parsed.data[0].splash, input.data[0].splash);
}

{
  const body = "{not-json";
  assert.strictEqual(run(body).output.body, body);
}

{
  const body = JSON.stringify({
    success: true,
    code: 200,
    data: { enabled: true, intervals: [1, 2, 3] }
  });
  assert.strictEqual(run(body).output.body, body,
    "an unknown shape is passed through instead of risking cold-start failure");
}

{
  const body = JSON.stringify({ code: 200, data: { splash: [{ id: 1 }] } });
  assert.strictEqual(run(body).output.body, body,
    "an already-safe single startup record is returned byte-for-byte");
}

const versioned = fs.readFileSync(path.join(root, "hpoi-ad-sanitize-v3.7.1.js"), "utf8");
assert.strictEqual(versioned, script, "versioned startup sanitizer must match the main file");

const snippet = fs.readFileSync(path.join(root, "hpoi-exhobby.snippet"), "utf8");
const local = fs.readFileSync(path.join(root, "hpoi-exhobby.local.conf"), "utf8");
const surge = fs.readFileSync(path.join(root, "hpoi-exhobby.sgmodule"), "utf8");
const loon = fs.readFileSync(path.join(root, "hpoi-exhobby.plugin"), "utf8");

assert.match(snippet, /api\/common\/advert\/list.*script-response-body.*hpoi-ad-sanitize-v3\.7\.1\.js/);
assert.doesNotMatch(snippet, /api\/common\/advert\/list[^\n]*reject-dict/);
assert.match(local, /api\/common\/advert\/list.*script-response-body hpoi-ad-sanitize\.js/);
assert.doesNotMatch(local, /api\/common\/advert\/list[^\n]*reject-dict/);
assert.match(surge, /api\/common\/advert\/list.*hpoi-ad-sanitize-v3\.7\.1\.js/);
assert.match(loon, /api\/common\/advert\/list.*hpoi-ad-sanitize-v3\.7\.1\.js/);

console.log("PASS: one server-provided Hpoi startup record is preserved; unknown shapes fail open.");
