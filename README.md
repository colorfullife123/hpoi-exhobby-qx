# Hpoi EXHOBBY · Quantumult X

在 Hpoi iOS App 的手办词条相册列表中添加「EXHOBBY 相册」入口，点击后通过 Hpoi 原生相册查看图片。

当前版本：**v3.3.1**。自动识别不同手办词条，为每个条目分别保存图库和分页数据。外层详情页只添加相册入口，不插入预览图片网格。EXHOBBY 相册列表使用单独设计的标识封面，进入相册后仍显示各词条自己的图库图片。

## v3.3.1 冷启动兼容修复

- 修复开启 Quantumult X 时 Hpoi 冷启动闪退、必须先关闭圈叉进入一次才能恢复的问题。
- 第三方广告 SDK 域名不再加入 MITM，也不再返回正文为空的 `HTTP 200`；这些域名只在 `hpoi-ads-filter.list` 的分流层拒绝。
- `hpoi.net.cn` 与 `hpoi.net` 在 Hpoi 广告过滤列表中固定直连，避免落入全局代理规则。
- 保留 EXHOBBY 原生相册、Hpoi 自家开屏广告接口清空，以及词条下方淘宝关联商品清空。

## v3.3 更新

- 修复部分旧版 iOS／Safari 从 `http://www.exhobby.net` 打开图库时，HTTPS 会话捕获规则完全不执行的问题。
- 在脚本规则之前使用 `307` 自动升级到 HTTPS，保留「更多／More」分页请求的 POST 方法、Cookie 和请求体。
- 不更改相册缓存结构、合成 ID 或标识封面；从 v3.2 升级无需清除现有数据，也无需重新初始化普通 Hpoi 相册模板。

## 功能

- 从当前 Hpoi 词条识别 EXHOBBY 图库，无需逐个填写条目 ID。
- 获取图库第一页及后续分页，收到空数组后才标记抓取完成，不把六张预览图当作完整图库。
- 在原有相册列表中添加入口，保留 Hpoi 自带相册。
- EXHOBBY 相册的预览封面明确写有「EXHOBBY」，不同词条使用同一张标识封面；图库内图片不添加水印。
- 支持原生相册分页、不同词条之间的缓存隔离和中断后继续获取。
- 沿用 v2.3 已保存的浏览器会话和原生相册模板。
- 只有在缺少会话或网站明确返回年龄／人机验证页面时通知，45 分钟内不重复提醒；已有 Cookie 仍可使用时自动复用。
- 自动把旧设备产生的 EXHOBBY HTTP 图库请求升级为 HTTPS。

适用范围是触发 `/api/hobby/album` 的手办／模型词条；不包含人物、厂商等其他页面。

## 安装：远程订阅（推荐）

### 1. 添加远程重写

订阅地址：[hpoi-exhobby.snippet](https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.snippet)。

在 Quantumult X 现有配置的 `[rewrite_remote]` 段中添加下面这一行：

```ini
https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.snippet, tag=HPOI_EXHOBBY, enabled=true
```

保存并更新远程资源，确认资源成功加载九条重写规则。该订阅会通过带 `v=3.3.1` 标记的地址引用仓库 JavaScript，避免继续使用旧脚本缓存；同时引用 `assets/exhobby-cover-v3.2.png`，无需额外保存同名本地脚本。

如果通过圈叉的重写资源界面添加，资源地址填写上面的订阅链接。配置行用于 `[rewrite_remote]`，不要把仓库首页链接或 JS 文件链接当作重写订阅地址。

### 2. 保持重写与 MITM 开启

**MITM 总开关、已安装并信任的证书都需要保留。** 本项目依赖 MITM 读取和改写 Hpoi、EXHOBBY 的 HTTPS 请求和响应。

以下三个域名需要在 MITM 中生效：

```text
www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net
```

远程订阅已包含这三个 `hostname`。原来手动添加的相同域名可以保留；若域名尚未生效，将它们追加到现有 `[mitm]` 的 `hostname` 列表，保留其他项目需要的域名。

不要把 `fancyapi.com`、`gdt.qq.com`、`pangolin-sdk-toutiao.com`、`zhangyuyidong.cn` 等第三方广告 SDK 域名加入 MITM。圈叉官方定义的 `reject-200` 是“HTTP 200 且正文为空”，部分广告 SDK 会把它当成有效响应继续解析，导致 Hpoi 在没有缓存的冷启动阶段闪退。

如果同时订阅 `hpoi-ads-filter.list`，更新后确认资源顶部包含以下两条直连规则：

```ini
host-suffix, hpoi.net.cn, direct
host-suffix, hpoi.net, direct
```

**从本地规则切换过来时，只停用本项目旧的本地重写，MITM 保持开启。** 同时停用旧版 Hpoi 预览图重写、`hpoi-diag.js` 和 `exhobby-page-diag.js` 诊断规则，避免同一响应被重复处理。

### 3. 首次准备原生相册模板

打开一个正常的 Hpoi 相册并等待图片出现。看到下面的日志说明相册详情模板已保存；图片列表也需要正常加载。

```text
[HPOI_EXHOBBY] native album template ready
```

已经完成过初始化的用户通常无需重复。

### 4. 首次准备 EXHOBBY 会话

保持 Quantumult X 开启，在 Safari 打开 [EXHOBBY 搜索页](https://www.exhobby.net/search)，搜索一个有图库的 Hpoi 词条链接，按照网站要求完成年龄确认，进入图库并点击一次「更多／More」。如果旧设备收到的是 HTTP 链接，v3.3 会先用 `307` 自动升级为 HTTPS，再由脚本保存会话。

看到以下日志后返回 Hpoi：

```text
[HPOI_EXHOBBY] v3.3 browser session saved; reopen Hpoi
```

这是保存当前设备正常访问图库所使用的浏览器会话，不需要手动复制 Cookie，也不需要对每个词条分别操作。会话失效后重复此步骤即可。

### 5. 使用

重新进入有 EXHOBBY 图库的 Hpoi 词条，找到「EXHOBBY 相册」并打开，向下滑动加载后续图片。

首次进入时脚本会获取完整图库的**图片路径和元数据**，图片文件在浏览时按需请求。图片较多或网络较慢时，可能需要返回词条刷新，继续获取尚未完成的分页。

## 验证到期提醒

如果 EXHOBBY 会话尚未保存，或网站明确返回年龄／人机验证页面，脚本会发出圈叉通知。请先在 iPhone 设置中允许 Quantumult X 通知。圈叉官方 `$notify` 只提供标题、副标题和正文参数，本项目会把验证网址写入正文，**不能保证点击圈叉原生通知就打开网址**。

希望点击通知就进入验证网页，可选用 [Bark](https://github.com/Finb/Bark)。Bark 的 `url` 参数支持点击推送跳转；本项目会优先使用它，发送失败时退回圈叉原生通知。验证只会在打开 Hpoi 对应词条时检测，不会在后台定时检查。配置方法：

1. 在 iPhone 安装 Bark 并复制 App 提供的测试推送地址，例如 `https://api.day.app/你的密钥/测试内容`。
2. 把仓库中的 [`bark-setup.example.js`](bark-setup.example.js) **复制到手机本地**，文件名可改为 `bark-setup.js`。仅在本地把 `pushURL` 改成 `https://api.day.app/你的密钥`，不要包含 `/测试内容`，也不要把改过的文件上传 GitHub。
3. 在圈叉中把它作为本地任务运行一次，看到「Bark 已配置」后，移除该任务和含密钥的本地脚本。如果不能手动运行任务，可临时在 `[task_local]` 添加 `* * * * * bark-setup.js`，收到配置通知后立即删除该行。推送地址会保存在圈叉本地 `$prefs` 中。

对**已访问过**的词条，提醒优先打开先前保存的具体相册链接；首次访问且尚未取得相册链接时，会打开 EXHOBBY 搜索页，需要在站内找到目标图库。完成网站要求的确认、进入图库并点击一次「更多／More」后，返回 Hpoi 刷新词条。脚本不会替用户点击年龄确认或绕过人机验证；只会继续使用网站仍接受的已有会话。

使用 Bark 时，推送服务器会收到通知文案和目标 EXHOBBY 链接；不会收到 Hpoi `utoken` 或 EXHOBBY Cookie。Bark 推送密钥保存在手机本地，不进入 GitHub 仓库。

## 从旧版升级与日常更新

已经使用本地 v2.3／v3.0／v3.1／v3.2 的用户，添加并成功加载远程订阅后，停用旧的本地重写即可。脚本继续使用原有存储命名空间，已保存的相册模板与仍有效的浏览器会话通常可以复用，无需主动清空数据。

从远程 v3.2 升级时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。确认资源中新增的 HTTP `307` 规则排在 HTTPS 会话捕获规则之前；不需要重新上传或改名 `assets/exhobby-cover-v3.2.png`。

从 v3.1 或更早版本升级时，仍需确认主脚本、两份重写配置以及 `assets/exhobby-cover-v3.2.png` 都已在仓库中；封面规则必须排在 EXHOBBY 图片通用跳转规则之前。

仓库脚本更新后，在圈叉中更新远程资源，并查看运行日志里的版本号确认实际加载的版本。GitHub 文件修改不等于设备已经更新，远程脚本缓存也可能需要刷新。

只有日志提示模板缺失或会话失效时，才重新执行相应的初始化步骤。已保存的浏览器 Cookie 会在网站仍接受时继续复用，网站要求再次验证时才提醒。

## 本地安装（备选）

如果需要使用本地文件，将 [`hpoi-exhobby.js`](hpoi-exhobby.js) 保存为 Quantumult X 可识别的本地脚本，并将 [`hpoi-exhobby.local.conf`](hpoi-exhobby.local.conf) 中的规则合并到现有 `[rewrite_local]` 段，同时保留上述 MITM 设置。标识封面通过公开 Raw 链接加载，图片资产仍需上传到仓库。

本地配置文件是配置片段，不要用它覆盖整份圈叉配置。本地和远程两种安装方式选择一种，避免两套规则同时执行。

脚本原文地址：[hpoi-exhobby.js](https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.js)。正常脚本以 `// Hpoi + EXHOBBY native album v3.3` 开头；`Unsupported Media Type`、HTML 错误页和 Markdown 代码围栏都不能作为 JavaScript 保存。

## 仓库文件与维护

当前订阅使用 `main` 分支。GitHub 文件列表上方的 `main` 下拉按钮表示当前分支；文件根目录是打开仓库后直接看到的第一层文件列表。

| 路径 | 用途 |
| --- | --- |
| `README.md` | 安装、使用和排错说明 |
| `hpoi-exhobby.js` | Quantumult X 主脚本 |
| `bark-setup.example.js` | 可选的一次性 Bark 本地配置模板；不要上传含个人密钥的副本 |
| `hpoi-exhobby.snippet` | 远程重写订阅，引用主脚本并声明 MITM 域名 |
| `hpoi-exhobby.local.conf` | 本地安装配置片段 |
| `assets/exhobby-cover-v3.2.png` | 本项目原创的 EXHOBBY 相册列表标识封面 |
| `package.json` | 离线检查与测试命令 |
| `tests/native-album.cjs` | 离线模拟测试 |

上传压缩包时先解压，保持目录结构。主脚本和订阅文件应在仓库根目录；封面图应在 `assets` 文件夹，测试文件应放在 **`tests` 文件夹，末尾带 s**。

如果测试文件误放在根目录，可在 GitHub 打开 `native-album.cjs`，点击编辑按钮，在顶部文件名输入框前加上 `tests/`，使最终路径为 `tests/native-album.cjs`，然后提交。文件夹会随提交创建。修改的是文件路径，测试代码沿用原内容。

远程订阅使用无需登录的 Raw 地址。使用自己的 Fork 时，请同步修改 README 中的订阅地址，以及 `hpoi-exhobby.snippet` 内三个 JavaScript 地址的用户名、仓库名和分支；仅修改订阅链接仍会引用原仓库的脚本。

GitHub 官方说明：[移动文件](https://docs.github.com/en/repositories/working-with-files/managing-files/moving-a-file-to-a-new-location)、[查看分支](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/viewing-branches-in-your-repository)。

## 常见日志

| 日志或现象 | 含义与处理 |
| --- | --- |
| 订阅或脚本链接返回 `404` | 检查仓库是否允许公开访问、分支是否为 `main`、文件名是否正确，以及文件是否误放进了子文件夹。 |
| `script not found` | 本地模式检查保存位置和文件名；远程模式检查脚本 Raw 地址及资源下载状态。 |
| `Unexpected identifier 'Media'` | 文件可能保存成了下载错误页，重新下载脚本原文。 |
| `initialization: open one normal Hpoi album` | 打开一个普通 Hpoi 相册，让详情与图片列表都加载。 |
| `open the EXHOBBY gallery in Safari...` | 尚无有效浏览器会话，按首次会话步骤操作。 |
| `h1=年齡提醒！` | 返回的是网站年龄提醒页，在 Safari 完成网站要求后重新保存会话。 |
| `EXHOBBY requires browser verification` | 网站明确返回了年龄／人机验证页面，点击 Bark 提醒中的网址并按网页提示操作。 |
| `Bark delivery failed` | 推送服务器暂不可用，脚本已改发圈叉原生通知。 |
| Safari 已验证但没有任何脚本日志 | 检查请求地址是否仍为 `http://www.exhobby.net`。v3.3 应先命中 `307` 规则并升级为 HTTPS；更新远程资源后重试。 |
| EXHOBBY 相册封面未显示 | 检查 `assets/exhobby-cover-v3.2.png` 是否上传，以及封面 302 规则是否排在通用图片 302 规则之前；远程资源更新后再刷新 Hpoi。 |
| `empty/missing body; end NOT confirmed` | 本次响应缺失，不能当作图库结束；返回词条刷新重试。 |
| `pagination timeout; refresh to resume` | 已保存本轮进度，返回词条刷新以继续抓取。 |
| `page=N count=0` 后出现 `complete=true` | 收到了结束分页，完整元数据已经缓存。 |
| `native page=1 count=20 total=44` | 原生相册当前返回 20 张，共 44 张，继续滑动加载。 |

## 当前边界

- 依赖 Hpoi 和 EXHOBBY 的现有接口、网页结构及图片域名；站点更新后可能需要调整。
- 使用 Hpoi 原生相册样式，不修改 App 本身的页面布局。
- 标识封面只用于 EXHOBBY 相册列表，不会在每张原始照片上添加角标；封面图片需经公开的 GitHub Raw 地址加载。
- EXHOBBY 相册及图片使用本地合成 ID；当前只适配浏览，收藏、点赞、评论等操作未适配。
- 完整图库元数据缓存有效期为 10 分钟，未完成抓取的进度有效期为 2 分钟。已有浏览器会话会复用至网站明确要求重新验证；提醒的冷却时间为 45 分钟。
- 当前没有自动清理全部旧条目与图片 ID 映射的功能；有效期不等于所有历史缓存都会被物理删除。
- 图片显示使用 EXHOBBY 的 `/pic/n/` 地址，不承诺是上传原始分辨率。

## 数据与隐私

仓库只包含脚本、原创标识封面、规则、文档和使用假数据的测试，不附带实际抓包、账号凭据或图库图片。

脚本通过 Quantumult X 本地偏好存储保存浏览器 Cookie、User-Agent、请求关联信息、原生模板、图库元数据和已访问图库的链接。EXHOBBY Cookie 仅用于 `www.exhobby.net` 的 HTTPS 请求；v3.3 会在会话捕获之前升级站点返回的旧 HTTP 链接。Cookie 不写入脚本文件、不打印到日志，也不上传 GitHub。Hpoi 的 `utoken` 不会被记录到脚本的请求关联缓存或转发给 EXHOBBY；原本发往 Hpoi 的 App 请求仍照常使用自己的凭据。

每台设备需要通过网站正常完成访问要求。提交问题时请提供版本、词条 ID 和相关报错，并先遮盖账号凭据。

## 验证

2026-09-11 的用户实机日志已确认：另一个 Hpoi 词条 `64287`（内部 ID `8274446`）抓取到完整 44 张图、创建相册入口，并返回原生相册第一页 20 张。此记录不代表所有条目和所有 App 版本均已验证。

2026-09-13 的另一台 iOS 16.7.16／Safari 16.6.2 设备实机请求确认：EXHOBBY 的「更多」分页仍可能使用 HTTP POST，且已携带 `is18=yes` 的年龄确认 Cookie；手动改用 HTTPS 后会话成功保存。v3.3 据此加入自动 `307` 升级。

本仓库另有离线模拟测试，覆盖并发词条隔离、分页尾页、相册与图片导航、缓存复用、中断恢复、图片 ID 冲突、标识封面映射、验证提醒、凭据隔离，以及 HTTP 图库链接到 HTTPS 的 307 规则顺序与 URL 保真。测试不连接真实站点，不代表所有设备和站点状态均已验证。

安装 Node.js 后在仓库根目录执行，无需安装 npm 依赖：

```sh
npm run check
npm test
```

## 参考

接口调用方式参考 [Exhobby For Hpoi 用户脚本](https://greasyfork.org/zh-CN/scripts/382359-exhobby-for-hpoi/code)。Quantumult X 的脚本与配置接口可查阅[官方示例](https://github.com/crossutility/Quantumult-X)。

## 许可证与免责声明

本仓库中由本项目作者原创的代码和文档采用 [MIT License](LICENSE) 发布。

本项目是第三方适配项目，与 Hpoi、EXHOBBY、Quantumult X 及其开发者、运营方不存在官方关联、授权或背书关系。

Hpoi、EXHOBBY、Quantumult X 的名称、商标、接口、网站内容及 EXHOBBY 图库中的图片等第三方内容，其相关权利归各自权利人所有。MIT License 仅适用于本仓库中由本项目作者原创并有权许可的代码与文档，不授予任何第三方内容、商标或素材的使用权。

使用本项目时，请自行遵守相关服务的使用条款以及所在地适用的法律法规。
