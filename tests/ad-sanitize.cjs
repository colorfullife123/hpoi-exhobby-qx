const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function scriptText(filename) {
  return fs.readFileSync(path.join(root, filename), "utf8");
}

function run(filename, body) {
  let output;
  const logs = [];
  vm.runInNewContext(scriptText(filename), {
    $response: { body },
    $done(value) { output = value; },
    console: { log(value) { logs.push(String(value)); } }
  }, { filename });
  return { output, logs };
}

assert.strictEqual(scriptText("hpoi-ad-sanitize-v3.7.2.js"), scriptText("hpoi-ad-sanitize.js"),
  "the v3.7.2 remote script must exactly match the maintained startup selector");

{
  const official = {
    id: 2,
    official: true,
    image: "https://rfx.hpoi.net/startup.jpg",
    assets: ["1x", "2x"]
  };
  const input = {
    success: true,
    code: 200,
    data: {
      splash: [
        { id: 1, image: "https://third-party.invalid/a.jpg" },
        official,
        { id: 3, image: "https://third-party.invalid/b.jpg" }
      ],
      list: [{ id: 91 }, { id: 92 }],
      config: {
        intervals: [1, 2, 3],
        placements: [{ name: "launch" }, { name: "home" }],
        enabled: true
      }
    }
  };
  const result = run("hpoi-ad-sanitize.js", JSON.stringify(input));
  const parsed = JSON.parse(result.output.body);
  assert.deepStrictEqual(parsed.data.splash, [official],
    "only the recognized startup array is reduced to one official record");
  assert.deepStrictEqual(parsed.data.list, input.data.list,
    "unrelated sibling arrays must remain intact");
  assert.deepStrictEqual(parsed.data.config, input.data.config,
    "configuration and timing arrays must remain intact");
  assert(result.logs.some(line => line.includes("preservedOtherFields=true")));
}

{
  const official = { id: 7, provider: "Hpoi", image: "https://rfx.hpoi.net/official.jpg" };
  const input = {
    code: 200,
    data: [
      { id: 1, splash: [{ id: 6 }, official], assets: ["keep-a", "keep-b"] },
      { id: 2, splash: [{ id: 8 }], assets: ["keep-c"] }
    ]
  };
  const parsed = JSON.parse(run("hpoi-ad-sanitize.js", JSON.stringify(input)).output.body);
  assert.deepStrictEqual(parsed.data[0].splash, [official]);
  assert.deepStrictEqual(parsed.data[0].assets, input.data[0].assets);
  assert.deepStrictEqual(parsed.data[1], input.data[1],
    "parent and sibling records are never discarded");
}

{
  const body = JSON.stringify({
    code: 200,
    data: {
      splash: [
        { id: 1, image: "https://third-party.invalid/a.jpg" },
        { id: 2, image: "https://third-party.invalid/b.jpg" }
      ],
      intervals: [1, 2, 3]
    }
  });
  assert.strictEqual(run("hpoi-ad-sanitize.js", body).output.body, body,
    "without an explicit Hpoi signal the entire response fails open");
}

{
  const body = JSON.stringify({
    code: 200,
    data: { splash: [{ id: 1, official: true }], intervals: [1, 2, 3] }
  });
  assert.strictEqual(run("hpoi-ad-sanitize.js", body).output.body, body,
    "an already-safe single official record is returned byte-for-byte");
}

for (const body of ["{not-json", ""]) {
  const result = run("hpoi-ad-sanitize.js", body);
  if (body) assert.strictEqual(result.output.body, body);
  else assert.strictEqual(JSON.stringify(result.output), "{}");
}

{
  const legacy = run("hpoi-ad-sanitize-v3.7.1.js",
    JSON.stringify({ code: 200, data: { splash: [{ id: 1 }, { id: 2 }] } }));
  assert.strictEqual(JSON.stringify(legacy.output), "{}",
    "the old fixed script path is a pure pass-through for cached v3.7.1 rules");
}

const snippet = scriptText("hpoi-exhobby.snippet");
const local = scriptText("hpoi-exhobby.local.conf");
const surge = scriptText("hpoi-exhobby.sgmodule");
const loon = scriptText("hpoi-exhobby.plugin");

assert.match(snippet, /api\/common\/advert\/list.*script-response-body.*hpoi-ad-sanitize-v3\.7\.2\.js/);
assert.match(local, /api\/common\/advert\/list.*script-response-body hpoi-ad-sanitize\.js/);
assert.match(surge, /api\/common\/advert\/list.*hpoi-ad-sanitize-v3\.7\.2\.js/);
assert.match(loon, /api\/common\/advert\/list.*hpoi-ad-sanitize-v3\.7\.2\.js/);
for (const text of [snippet, surge, loon]) {
  assert.doesNotMatch(text, /api\/common\/advert\/list[^\n]*hpoi-ad-sanitize-v3\.7\.1\.js/);
}

const qxAds = scriptText("hpoi-ads-filter.list");
const clash = scriptText("hpoi-ads-clash.yaml");
const clashExample = scriptText("hpoi-clash-example.yaml");
assert.match(qxAds, /host-suffix, pangolin-sdk-toutiao\.com, reject/i);
assert.match(surge, /DOMAIN-SUFFIX,pangolin-sdk-toutiao\.com,REJECT/);
assert.match(loon, /DOMAIN-SUFFIX,pangolin-sdk-toutiao\.com,REJECT/);
assert.match(clash, /DOMAIN-SUFFIX,pangolin-sdk-toutiao\.com/);
assert.match(clashExample, /RULE-SET,hpoi-ads,REJECT/);
assert.doesNotMatch(qxAds, /^\s*(?:host|host-suffix),\s*(?:www\.)?hpoi\.net(?:\.cn)?\s*,\s*reject/im,
  "official Hpoi hosts must never be present in the third-party reject list");

console.log("PASS: one explicit Hpoi startup record is kept without clearing sibling arrays; third-party ad domains remain rejected.");
