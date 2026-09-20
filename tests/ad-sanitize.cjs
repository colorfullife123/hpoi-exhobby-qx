const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "hpoi-ad-sanitize.js"), "utf8");

function run(body) {
  let output;
  const context = {
    $response: { body },
    $done(value) { output = value; },
    console: { log() {} }
  };
  vm.runInNewContext(script, context, { filename: "hpoi-ad-sanitize.js" });
  return output;
}

{
  const input = {
    success: true,
    code: 200,
    msg: "ok",
    data: {
      list: [{ id: 1, image: "https://example.invalid/a.jpg" }],
      splash: [{ id: 2 }],
      config: { intervals: [1, 2, 3], enabled: true }
    }
  };
  const output = run(JSON.stringify(input));
  const parsed = JSON.parse(output.body);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.code, 200);
  assert.strictEqual(parsed.msg, "ok");
  assert.deepStrictEqual(parsed.data.list, []);
  assert.deepStrictEqual(parsed.data.splash, []);
  assert.deepStrictEqual(parsed.data.config.intervals, []);
  assert.strictEqual(parsed.data.config.enabled, true);
}

{
  const body = "{not-json";
  assert.strictEqual(run(body).body, body);
}

{
  const body = JSON.stringify({ success: true, code: 200, data: { enabled: true } });
  assert.strictEqual(run(body).body, body);
}

{
  const output = run(JSON.stringify([{ id: 1 }, { id: 2 }]));
  assert.deepStrictEqual(JSON.parse(output.body), []);
}

const snippet = fs.readFileSync(path.join(root, "hpoi-exhobby.snippet"), "utf8");
const local = fs.readFileSync(path.join(root, "hpoi-exhobby.local.conf"), "utf8");

assert.match(snippet, /api\/common\/advert\/list.*script-response-body.*hpoi-ad-sanitize\.js\?v=3\.3\.2/);
assert.doesNotMatch(snippet, /api\/common\/advert\/list[^\n]*reject-dict/);
assert.match(local, /api\/common\/advert\/list.*script-response-body hpoi-ad-sanitize\.js/);
assert.doesNotMatch(local, /api\/common\/advert\/list[^\n]*reject-dict/);

console.log("Hpoi advert sanitizer tests passed");
