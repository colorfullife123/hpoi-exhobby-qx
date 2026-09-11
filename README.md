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

## 安装：远程订阅（推荐）

### 1. 添加远程重写

订阅地址：[hpoi-exhobby.snippet](https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.snippet)。

在 Quantumult X 现有配置的 `[rewrite_remote]` 段中添加下面这一行：

```ini
https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.snippet, tag=HPOI_EXHOBBY, enabled=true
```

保存并更新远程资源，确认资源成功加载四条重写规则。该订阅会引用仓库里的 JavaScript，无需额外保存同名本地脚本。

如果通过圈叉的重写资源界面添加，资源地址填写上面的订阅链接。配置行用于 `[rewrite_remote]`，不要把仓库首页链接或 JS 文件链接当作重写订阅地址。

### 2. 保持重写与 MITM 开启

**MITM 总开关、已安装并信任的证书都需要保留。** 本项目依赖 MITM 读取和改写 Hpoi、EXHOBBY 的 HTTPS 请求和响应。

以下三个域名需要在 MITM 中生效：

```text
www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net
```

远程订阅已包含这三个 `hostname`。原来手动添加的相同域名可以保留；若域名尚未生效，将它们追加到现有 `[mitm]` 的 `hostname` 列表，保留其他项目需要的域名。

**从本地规则切换过来时，只停用本项目旧的四条本地重写，MITM 保持开启。** 同时停用旧版 Hpoi 预览图重写、`hpoi-diag.js` 和 `exhobby-page-diag.js` 诊断规则，避免同一响应被重复处理。

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

## 从旧版升级与日常更新

已经使用本地 v2.3／v3.0 的用户，添加并成功加载远程订阅后，停用旧的四条本地重写即可。脚本继续使用原有存储命名空间，已保存的相册模板与仍有效的浏览器会话通常可以复用，无需主动清空数据。

仓库脚本更新后，在圈叉中更新远程资源，并查看运行日志里的版本号确认实际加载的版本。GitHub 文件修改不等于设备已经更新，远程脚本缓存也可能需要刷新。

只有日志提示模板缺失或会话失效时，才重新执行相应的初始化步骤。浏览器会话最多复用 24 小时，网站可能提前使其失效。

## 本地安装（备选）

如果需要使用本地文件，将 [`hpoi-exhobby.js`](hpoi-exhobby.js) 保存为 Quantumult X 可识别的本地脚本，并将 [`hpoi-exhobby.local.conf`](hpoi-exhobby.local.conf) 中的四条规则合并到现有 `[rewrite_local]` 段，同时保留上述 MITM 设置。

本地配置文件是配置片段，不要用它覆盖整份圈叉配置。本地和远程两种安装方式选择一种，避免两套规则同时执行。

脚本原文地址：[hpoi-exhobby.js](https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.js)。正常脚本以 `// Hpoi + EXHOBBY native album v3.0` 开头；`Unsupported Media Type`、HTML 错误页和 Markdown 代码围栏都不能作为 JavaScript 保存。

## 仓库文件与维护

当前订阅使用 `main` 分支。GitHub 文件列表上方的 `main` 下拉按钮表示当前分支；文件根目录是打开仓库后直接看到的第一层文件列表。

| 路径 | 用途 |
| --- | --- |
| `README.md` | 安装、使用和排错说明 |
| `hpoi-exhobby.js` | Quantumult X 主脚本 |
| `hpoi-exhobby.snippet` | 远程重写订阅，引用主脚本并声明 MITM 域名 |
| `hpoi-exhobby.local.conf` | 本地安装配置片段 |
| `package.json` | 离线检查与测试命令 |
| `tests/native-album.cjs` | 离线模拟测试 |

上传压缩包时先解压，保持目录结构。主脚本和订阅文件应在仓库根目录；测试文件应放在 **`tests` 文件夹，末尾带 s**。

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
