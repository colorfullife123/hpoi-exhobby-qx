## 更新内容

- 仅收缩 Hpoi 官方 `/api/common/advert/list` 中被明确识别的开屏数组，并只保留一个带官方标记、Hpoi 来源字段或官方域名信号的记录。
- 不再递归清空响应中的其他数组；配置、时间间隔、素材列表及父级／同级字段全部保持原样。
- 新增固定版本脚本 `hpoi-ad-sanitize-v3.7.2.js`，避免客户端继续命中旧缓存。
- 旧 `hpoi-ad-sanitize-v3.7.1.js` 改为直接放行，防止残留规则继续执行有问题的递归清理。
- Quantumult X、Surge、Loon 与 Clash/Mihomo 仍拒绝全部已收录的第三方广告域名。
- EXHOBBY 原生相册、20 张懒加载、7 天缓存回收及淘宝关联商品清理保持不变。

## 升级方法

- Quantumult X：更新 `HPOI_EXHOBBY` 远程重写和 `HPOI_ADS` 过滤订阅。
- Surge：更新 `HPOI EXHOBBY` 模块。
- Loon：更新 `HPOI EXHOBBY` 插件。
- 更新后确认开屏接口使用 `hpoi-ad-sanitize-v3.7.2.js`，再彻底结束 Hpoi 并冷启动。
- 从 v3.7.1 升级无需清除 EXHOBBY 缓存，也无需重新完成 Safari 年龄验证。

## 验证

已通过 `npm test`、`npm run check`、单官方开屏保留、同级数组完整保留、未知结构原样放行、旧 v3.7.1 路径透传及四端第三方广告拒绝回归测试。

## 校验

`SHA-256: b220dd78c7df58f2879b184ac00cb9f6b6654c62f6f94cab68a679a4e11fd17e`
