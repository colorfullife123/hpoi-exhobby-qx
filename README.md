# Hpoi EXHOBBY · Quantumult X

在 Hpoi iOS App 的手办词条相册列表中添加「EXHOBBY 相册」入口，点击后通过 Hpoi 原生相册查看图片。

当前版本：**v3.0**。自动识别不同手办词条，为每个条目分别保存图库和分页数据。外层详情页只添加相册入口，不插入预览图片网格。

## 功能

- 从当前 Hpoi 词条识别 EXHOBBY 图库，无需逐个填写条目 ID。
- 获取图库第一页及后续分页，收到空数组后才标记抓取完成，不把六张预览图当作完整图库。
- 在原有相册列表中添加入口，保留 Hpoi 自带相册。
- 支持原生相册分页、不同词条之间的缓存隔离和中断后继续获取。
- 沿用 v2.3 已保存的浏览器会话和原生相册模板。

适用范围是触发 `/api/hobby/album` 的手办／模型词条；不包含人物、厂商等其他页面。

## 安装

### 1. 保存脚本

将仓库根目录的 `hpoi-exhobby.js` 保存为 Quantumult X 可识别的本地脚本，文件名保持一致。已有 v2.3／v3.0 的用户可以覆盖同名文件。

确认文件内容以 `// Hpoi + EXHOBBY native album v3.0` 开头。如果下载到的是 `Unsupported Media Type`、网页 HTML 或 Markdown 代码围栏，请重新获取脚本原文，不能将这些内容当作 JavaScript。

### 2. 添加重写与 MITM 域名

将下面四条规则加入现有配置的 `[rewrite_local]` 段。完整片段也可见 [`hpoi-exhobby.local.conf`](hpoi-exhobby.local.conf)。

```ini
^https://www\.exhobby\.net/picture(?:\?|/\d+(?:\?|$)) url script-response-body hpoi-exhobby.js
^https://www\.hpoi\.net\.cn/api/(?:item/get|hobby/album|album/detail|pic/list/relate-v2)(?:\?|$) url script-request-body hpoi-exhobby.js
^https://www\.hpoi\.net\.cn/api/(?:item/get|hobby/album|album/detail|pic/list/relate-v2)(?:\?|$) url script-response-body hpoi-exhobby.js
^https://rfx\.hpoi\.net/[^?]*__exhobby__/([^?]+)(?:\?.*)?$ url 302 https://res.e39x.com/pic/n/$1
```

在现有 `[mitm]` 的 `hostname` 中追加：

```text
www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net
```

保留已有的其他域名，并确保 Quantumult X 的重写与 MITM 已启用、证书已正确安装并信任。

停用旧版 Hpoi 预览图重写、`hpoi-diag.js` 和 `exhobby-page-diag.js` 的诊断规则，避免多个脚本处理同一响应。

### 3. 首次准备原生相册模板

打开一个正常的 Hpoi 相册并等待图片出现。看到下面的日志说明相册详情模板已保存；图片列表也需要正常加载。

```text
[HPOI_EXHOBBY] native album template ready
```

已经完成过初始化的用户通常无需重复。

### 4. 首次准备 EXHOBBY 会话

保持 Quantumult X 开启，在 Safari 打开 [EXHOBBY 搜索页](https://www.exhobby.net/search)，搜索一个有图库的 Hpoi 词条链接，按照网站要求完成年龄确认，进入图库并点击一次「更多／More」。

看到以下日志后返回 Hpoi：

```text
[HPOI_EXHOBBY] v3.0 browser session saved; reopen Hpoi
```

这是保存当前设备正常访问图库所使用的浏览器会话，不需要手动复制 Cookie，也不需要对每个词条分别操作。会话失效后重复此步骤即可。

### 5. 使用

重新进入有 EXHOBBY 图库的 Hpoi 词条，找到「EXHOBBY 相册」并打开，向下滑动加载后续图片。

首次进入时脚本会获取完整图库的**图片路径和元数据**，图片文件在浏览时按需请求。图片较多或网络较慢时，可能需要返回词条刷新，继续获取尚未完成的分页。

## GitHub 上传

建议仓库名：`hpoi-exhobby-qx`。选择公开或私有仓库后，将项目文件放在仓库根目录，使 `README.md` 和 `hpoi-exhobby.js` 能在首页文件列表中直接看到。

如果使用项目压缩包，请先解压，再上传里面的文件与 `tests` 文件夹；只上传 ZIP 不会生成脚本源文件地址。仓库已有本项目 README 时，无需在创建仓库时另建 README。

GitHub 官方说明：[创建仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)、[通过网页上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

本包提供的是**本地脚本规则**，可以独立于仓库地址使用。仓库地址确定后，可另行配置指向该仓库脚本原文的远程规则。

## 常见日志

| 日志或现象 | 含义与处理 |
| --- | --- |
| `script not found` | Quantumult X 找不到本地脚本，检查保存位置及文件名。 |
| `Unexpected identifier 'Media'` | 文件可能保存成了下载错误页，重新下载脚本原文。 |
| `initialization: open one normal Hpoi album` | 打开一个普通 Hpoi 相册，让详情与图片列表都加载。 |
| `open the EXHOBBY gallery in Safari...` | 尚无有效浏览器会话，按首次会话步骤操作。 |
| `h1=年齡提醒！` | 返回的是网站年龄提醒页，在 Safari 完成网站要求后重新保存会话。 |
| `empty/missing body; end NOT confirmed` | 本次响应缺失，不能当作图库结束；返回词条刷新重试。 |
| `pagination timeout; refresh to resume` | 已保存本轮进度，返回词条刷新以继续抓取。 |
| `page=N count=0` 后出现 `complete=true` | 收到了结束分页，完整元数据已经缓存。 |
| `native page=1 count=20 total=44` | 原生相册当前返回 20 张，共 44 张，继续滑动加载。 |

## 当前边界

- 依赖 Hpoi 和 EXHOBBY 的现有接口、网页结构及图片域名；站点更新后可能需要调整。
- 使用 Hpoi 原生相册样式，不修改 App 本身的页面布局。
- EXHOBBY 相册及图片使用本地合成 ID；当前只适配浏览，收藏、点赞、评论等操作未适配。
- 完整图库元数据缓存有效期为 10 分钟，未完成抓取的进度有效期为 2 分钟。浏览器会话在本脚本中最多复用 24 小时，网站可能提前使其失效。
- 当前没有自动清理全部旧条目与图片 ID 映射的功能；有效期不等于所有历史缓存都会被物理删除。
- 图片显示使用 EXHOBBY 的 `/pic/n/` 地址，不承诺是上传原始分辨率。

## 数据与隐私

仓库只包含脚本、规则、文档和使用假数据的测试，不附带实际抓包、账号凭据或图库图片。

脚本通过 Quantumult X 本地偏好存储保存浏览器 Cookie、User-Agent、请求关联信息、原生模板和图库元数据。EXHOBBY Cookie 仅用于 `www.exhobby.net` 的请求，不写入脚本文件、不打印到日志，也不上传 GitHub。Hpoi 的 `utoken` 不会被记录到脚本的请求关联缓存或转发给 EXHOBBY；原本发往 Hpoi 的 App 请求仍照常使用自己的凭据。

每台设备需要通过网站正常完成访问要求。提交问题时请提供版本、词条 ID 和相关报错，并先遮盖账号凭据。

## 验证

2026-09-11 的用户实机日志已确认：另一个 Hpoi 词条 `64287`（内部 ID `8274446`）抓取到完整 44 张图、创建相册入口，并返回原生相册第一页 20 张。此记录不代表所有条目和所有 App 版本均已验证。

本仓库另有离线模拟测试，覆盖并发词条隔离、分页尾页、相册与图片导航、缓存复用、中断恢复、图片 ID 冲突和凭据隔离。测试不连接真实站点，不代表实机验证。

安装 Node.js 后在仓库根目录执行，无需安装 npm 依赖：

```sh
npm run check
npm test
```

## 参考

接口调用方式参考 [Exhobby For Hpoi 用户脚本](https://greasyfork.org/zh-CN/scripts/382359-exhobby-for-hpoi/code)。Quantumult X 的脚本与配置接口可查阅[官方示例](https://github.com/crossutility/Quantumult-X)。

此项目是第三方适配，不代表 Hpoi、EXHOBBY 或 Quantumult X 官方。尚未为本项目指定开源许可证。
