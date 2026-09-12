// Optional one-time local Quantumult X task. Never upload your edited copy.
// Copy the test push URL shown in Bark, without its /title/body suffix.
var pushURL = "https://api.day.app/REPLACE_WITH_YOUR_KEY";
if (/^https:\/\/[^\s/?#]+\/[^\s/?#]+\/?$/.test(pushURL) &&
    pushURL.indexOf("REPLACE_WITH_YOUR_KEY") < 0) {
  if ($prefs.setValueForKey(pushURL, "HPOI_EXHOBBY_NATIVE_V2:bark-push-url")) {
    $notify("HPOI EXHOBBY", "Bark 已配置", "之后需要验证时会发送可点击的提醒");
  } else {
    $notify("HPOI EXHOBBY", "配置失败", "圈叉无法写入本地存储");
  }
} else {
  $notify("HPOI EXHOBBY", "Bark 尚未配置", "请先在本地脚本填写自己的 Bark 推送地址");
}
$done();
