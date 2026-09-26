// Optional one-time local Quantumult X / Surge / Loon task.
// Never upload your edited copy.
// Copy the test push URL shown in Bark, without its /title/body suffix.
var pushURL = "https://api.day.app/REPLACE_WITH_YOUR_KEY";
var key = "HPOI_EXHOBBY_NATIVE_V2:bark-push-url";
var isQX = typeof $prefs !== "undefined";
function write(value) {
  return isQX ? $prefs.setValueForKey(value, key) :
    (typeof $persistentStore !== "undefined" && $persistentStore.write(value, key));
}
function notify(subtitle, body) {
  if (typeof $notify === "function") $notify("HPOI EXHOBBY", subtitle, body);
  else if (typeof $notification !== "undefined") {
    $notification.post("HPOI EXHOBBY", subtitle, body);
  }
}
if (/^https:\/\/[^\s/?#]+\/[^\s/?#]+\/?$/.test(pushURL) &&
    pushURL.indexOf("REPLACE_WITH_YOUR_KEY") < 0) {
  if (write(pushURL)) {
    notify("Bark 已配置", "之后需要验证时会发送可点击的提醒");
  } else {
    notify("配置失败", "当前客户端无法写入本地存储");
  }
} else {
  notify("Bark 尚未配置", "请先在本地脚本填写自己的 Bark 推送地址");
}
$done({});
