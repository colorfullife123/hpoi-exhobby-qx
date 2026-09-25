# Hpoi EXHOBBY · Quantumult X

在 Hpoi iOS App 的手办词条相册列表中添加「EXHOBBY 相册」入口，点击后通过 Hpoi 原生相册查看图片。

当前版本：**v3.4.3**。自动识别不同手办词条，为每个条目分别保存图库和分页数据。每个词条只新增一个独立「EXHOBBY 相册」入口；全部 EXHOBBY 图片只显示在这个专用相册中，普通 Hpoi 相册保持原样。

## v3.4.3 独立 EXHOBBY 入口

- 调整 v3.4.2 的相册链路：不再把当前词条的全部 EXHOBBY 图片注入每一个普通 Hpoi 相册。
- 词条相册列表只新增一个「EXHOBBY 相册」。打开后按 Hpoi 原生分页显示该词条在 EXHOBBY 中的全部图片，不混入普通 Hpoi 图片。
- 为兼容必须使用真实相册路由的 Hpoi 版本，专用入口会保留一个真实原生路由；对应的普通 Hpoi 相册使用透明的本地代理路由，返回内容仍是原来的 Hpoi 相册与图片。
- 其他普通相册完全不改写；专用相册和普通相册的内容链路彼此隔离。
- 专用入口继续使用 EXHOBBY 第一张实图作为预览，不插入 EXHOBBY 标识封面。
- 升级不需要清除图库缓存、年龄验证 Cookie 或重新初始化模板。

## v3.4.2 首页相册与无封面图片序列

- 修复部分 Hpoi 版本中，词条首页的独立「EXHOBBY 相册」仍无法打开、只有普通相册内图片序列可用的问题。
- 首页入口现在使用双通道路由：保留唯一的本地合成 `id`，同时保留一个真实普通相册的 `itemId` 作为兼容后备。客户端无论读取哪种字段，都能进入可用的图片查看链路。
- 首页 EXHOBBY 相册卡片改用当前图库第一张实图作为预览图，不再使用 EXHOBBY 标识封面。
- v3.4.2 的普通 Hpoi 相册第一页曾返回「完整 EXHOBBY 图片序列 + 原 Hpoi 图片」；此行为已在 v3.4.3 删除。
- 原 Hpoi 图片不会被替换或删除；EXHOBBY 图片只在第一页插入，后续分页不会重复出现。
- 升级不需要清除图库缓存、年龄验证 Cookie 或重新初始化模板。

## v3.4.1 相册内查看链路修复

- 修复 v3.4.0 在普通 Hpoi 相册中只插入一张 EXHOBBY 封面、点击后只能把它当作普通单图查看的问题。
- Hpoi 的图片列表不会按返回数据里的 `itemType=album` 执行跨相册跳转，因此 v3.4.1 不再依赖这一无效点击路径。
- v3.4.1 的普通相册第一页返回「EXHOBBY 标识封面 + 当前词条完整 EXHOBBY 图片序列 + 原 Hpoi 图片」；该封面项已在 v3.4.2 移除。
- 原 Hpoi 图片不会被替换或删除；EXHOBBY 序列只在第一页注入，后续分页不会重复出现。
- 外层词条相册列表中的独立「EXHOBBY 相册」入口保持不变，仍可直接进入虚拟相册。

## v3.4.0 相册内 EXHOBBY 入口

- 除词条相册列表顶部的「EXHOBBY 相册」外，现在进入当前词条的任意普通 Hpoi 相册后，第一页图片列表顶部也会出现一个 EXHOBBY 入口。
- 入口使用同一张 EXHOBBY 标识封面，不替换、不删除原 Hpoi 图片；普通相册第二页及后续分页不会重复插入。
- 脚本会在词条相册列表加载时记录“普通相册 ID → 当前词条”的本地映射，因此不同词条、不同普通相册会进入各自对应的 EXHOBBY 图库。
- v3.4.0 曾尝试依靠图片项里的虚拟相册 ID 触发跳转；实机确认 Hpoi 会把该项固定当作普通图片，现已由 v3.4.1 的连续查看序列取代。
- 升级不需要清除图库缓存、年龄验证 Cookie 或重新初始化模板。更新 Quantumult X 的远程重写资源即可。

## v3.3.3 原生相册字段兼容修复

- 修复 Hpoi 在打开 EXHOBBY 虚拟相册时，原生 `/api/album/detail` 等请求可能由 `id` 改用 `itemId`，导致脚本报 `unrecognized native album request field: itemId` 的问题。
- 当正常 Hpoi 相册模板和虚拟相册请求使用不同 ID 字段名时，脚本现在会使用模板中的真实安全 ID 对虚拟字段进行重映射，再在响应阶段替换为 EXHOBBY 相册内容。
- 虚拟的 10 亿级相册 ID 和图片合成 ID 不再因为字段名变化而直接落到 Hpoi 后端，从而避免 App 显示“相册不存在”。
- 新增 `itemId` 字段变体回归测试；远程主脚本 URL 提升为 `v=3.3.3` 以绕过 Quantumult X 旧缓存。

## v3.3.2 冷启动稳定性修复

- Hpoi 自家开屏广告接口 `/api/common/advert/list` 不再使用 `reject-dict` 强制替换为 `{}`。
- 新增 `hpoi-ad-sanitize.js`：保留服务器原有 JSON 外层结构，只把广告响应中的数组清空，避免 App 冷启动仍按原字段读取时发生闪退。
- 新脚本采用 **fail-open**：响应不是合法 JSON、没有可安全清理的数组或后端结构发生未知变化时，直接返回原始响应，优先保证 Hpoi 能启动。
- EXHOBBY 相册逻辑、淘宝关联商品清理和 MITM 域名保持不变。
- 升级后请在 Quantumult X 中手动更新 `HPOI_EXHOBBY` 远程重写资源，再从后台彻底结束 Hpoi 后进行冷启动测试。

## v3.3.1 冷启动兼容修复

- 修复开启 Quantumult X 时 Hpoi 冷启动闪退、必须先关闭圈叉进入一次才能恢复的问题。
- 第三方广告 SDK 域名不再加入 MITM，也不再返回正文为空的 `HTTP 200`；这些域名只在 `hpoi-ads-filter.list` 的分流层拒绝。
- 广告过滤订阅只包含第三方广告域名；需要直连 Hpoi 时，在 `[filter_local]` 单独设置 `hpoi.net.cn` 和 `hpoi.net`。
- 保留 EXHOBBY 原生相册、Hpoi 自家开屏广告接口清空，以及词条下方淘宝关联商品清空。

## v3.3 更新

- 修复部分旧版 iOS／Safari 从 `http://www.exhobby.net` 打开图库时，HTTPS 会话捕获规则完全不执行的问题。
- 在脚本规则之前使用 `307` 自动升级到 HTTPS，保留「更多／More」分页请求的 POST 方法、Cookie 和请求体。
- 不更改相册缓存结构、合成 ID 或标识封面；从 v3.2 升级无需清除现有数据，也无需重新初始化普通 Hpoi 相册模板。

## 功能

- 从当前 Hpoi 词条识别 EXHOBBY 图库，无需逐个填写条目 ID。
- 获取图库第一页及后续分页，收到空数组后才标记抓取完成，不把六张预览图当作完整图库。
- 在原有相册列表中添加入口，保留 Hpoi 自带相册。
- 在每个词条的相册列表中新增一个独立 EXHOBBY 入口，普通 Hpoi 相册内容不变。
- EXHOBBY 专用相册显示该词条的完整 EXHOBBY 图库，并使用第一张实图作为预览；图库图片不添加水印。
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

保存并更新远程资源，确认资源成功加载九条重写规则。EXHOBBY 主脚本使用带 `v=3.4.3` 标记的地址，避免继续使用旧脚本缓存；开屏广告清理脚本仍可使用其独立缓存版本。旧标识封面资产仅为兼容 v3.4.1 缓存保留，v3.4.3 不再把它插入任何相册。

如果通过圈叉的重写资源界面添加，资源地址填写上面的订阅链接。配置行用于 `[rewrite_remote]`，不要把仓库首页链接或 JS 文件链接当作重写订阅地址。

### 2. 保持重写与 MITM 开启

**MITM 总开关、已安装并信任的证书都需要保留。** 本项目依赖 MITM 读取和改写 Hpoi、EXHOBBY 的 HTTPS 请求和响应。

以下三个域名需要在 MITM 中生效：

```text
www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net
```

远程订阅已包含这三个 `hostname`。原来手动添加的相同域名可以保留；若域名尚未生效，将它们追加到现有 `[mitm]` 的 `hostname` 列表，保留其他项目需要的域名。

不要把 `fancyapi.com`、`gdt.qq.com`、`pangolin-sdk-toutiao.com`、`zhangyuyidong.cn` 等第三方广告 SDK 域名加入 MITM。圈叉官方定义的 `reject-200` 是“HTTP 200 且正文为空”，部分广告 SDK 会把它当成有效响应继续解析，导致 Hpoi 在没有缓存的冷启动阶段闪退。

**如果使用了旧版 `hpoi-ads-filter.list`，立即更新该远程资源。** 旧版将以下两条直连规则放在广告订阅里；若订阅行带 `force-policy=reject`，圈叉会把它们也改为拒绝，导致 Hpoi 无法连接服务器。新版广告订阅已移除直连规则。

需要固定直连 Hpoi 时，将以下两条规则加入现有配置的 `[filter_local]`，放在宽泛的代理／拒绝规则之前：

```ini
host-suffix, hpoi.net.cn, direct
host-suffix, hpoi.net, direct
```

如果更新远程资源前 Hpoi 已经无法连接，先暂时停用 `HPOI_ADS` 过滤订阅，确认恢复后再更新并开启。刷新后检查 `hpoi-ads-filter.list` 中不再含有 `hpoi.net.cn`／`hpoi.net` 规则。

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

从 v3.4.2 升级到 v3.4.3 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。确认主脚本地址带 `hpoi-exhobby.js?v=3.4.3`，再彻底结束 Hpoi 并重新打开。已有图库缓存、原生相册模板和浏览器验证会话都会保留；升级后 EXHOBBY 图片只出现在独立入口，普通 Hpoi 相册恢复原内容。

从 v3.4.1 升级到 v3.4.2 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。确认主脚本地址带 `hpoi-exhobby.js?v=3.4.2`，再彻底结束 Hpoi 并重新打开。已有图库缓存、普通相册映射和浏览器验证会话都会保留；普通相册内不再显示 EXHOBBY 封面项。

从 v3.4.0 升级到 v3.4.1 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。主脚本地址应更新为 `hpoi-exhobby.js?v=3.4.1`；图库缓存、普通相册映射及浏览器验证会话都会保留。打开普通相册后，点击顶部 EXHOBBY 封面并继续滑动即可查看完整图库。

从 v3.3.3 升级到 v3.4.0 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。主脚本地址应更新为 `hpoi-exhobby.js?v=3.4.0`。进入词条一次以建立普通相册到词条的映射，之后打开该词条任意普通相册即可看到 EXHOBBY 入口。

从 v3.3.2 升级到 v3.3.3 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。更新后主脚本地址应带 `hpoi-exhobby.js?v=3.3.3`；无需清除已经抓取的 EXHOBBY 图库缓存或重新做年龄验证。若之前出现 `unrecognized native album request field: itemId`，更新后直接重新打开对应词条和相册即可。

从 v3.3.1 升级到 v3.3.2 时，只需更新圈叉里的 `HPOI_EXHOBBY` 远程资源。确认 `/api/common/advert/list` 已变为 `script-response-body .../hpoi-ad-sanitize.js?v=3.3.2`，不再出现 `url reject-dict`。随后从后台彻底结束 Hpoi，在圈叉保持开启的情况下重新冷启动。

仓库脚本更新后，在圈叉中更新远程资源，并查看运行日志里的版本号确认实际加载的版本。GitHub 文件修改不等于设备已经更新，远程脚本缓存也可能需要刷新。

只有日志提示模板缺失或会话失效时，才重新执行相应的初始化步骤。已保存的浏览器 Cookie 会在网站仍接受时继续复用，网站要求再次验证时才提醒。

## 本地安装（备选）

如果需要使用本地文件，将 [`hpoi-exhobby.js`](hpoi-exhobby.js) 和 [`hpoi-ad-sanitize.js`](hpoi-ad-sanitize.js) 保存为 Quantumult X 可识别的本地脚本，并将 [`hpoi-exhobby.local.conf`](hpoi-exhobby.local.conf) 中的规则合并到现有 `[rewrite_local]` 段，同时保留上述 MITM 设置。

本地配置文件是配置片段，不要用它覆盖整份圈叉配置。本地和远程两种安装方式选择一种，避免两套规则同时执行。

脚本原文地址：[hpoi-exhobby.js](https://raw.githubusercontent.com/colorfullife123/hpoi-exhobby-qx/main/hpoi-exhobby.js)。当前脚本以 `// Hpoi + EXHOBBY native album v3.4.3` 开头；`Unsupported Media Type`、HTML 错误页和 Markdown 代码围栏都不能作为 JavaScript 保存。

## 仓库文件与维护

当前订阅使用 `main` 分支。GitHub 文件列表上方的 `main` 下拉按钮表示当前分支；文件根目录是打开仓库后直接看到的第一层文件列表。

| 路径 | 用途 |
| --- | --- |
| `README.md` | 安装、使用和排错说明 |
| `hpoi-exhobby.js` | Quantumult X 主脚本 |
| `hpoi-ad-sanitize.js` | Hpoi 开屏广告结构保持型响应清理脚本 |
| `bark-setup.example.js` | 可选的一次性 Bark 本地配置模板；不要上传含个人密钥的副本 |
| `hpoi-exhobby.snippet` | 远程重写订阅，引用主脚本并声明 MITM 域名 |
| `hpoi-exhobby.local.conf` | 本地安装配置片段 |
| `assets/exhobby-cover-v3.2.png` | 仅用于兼容 v3.4.1 旧缓存；v3.4.3 不再插入该封面 |
| `package.json` | 离线检查与测试命令 |
| `tests/native-album.cjs` | EXHOBBY 原生相册离线模拟测试 |
| `tests/ad-sanitize.cjs` | Hpoi 开屏广告响应清理离线测试 |

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
| 词条首页 EXHOBBY 相册无法打开 | 确认已更新到 `v3.4.3`，彻底结束 Hpoi 后重新进入词条；仍异常时提供 `album/detail` 与 `pic/list/relate-v2` 日志。 |
| 普通 Hpoi 相册仍混入 EXHOBBY 图片 | 实际仍在运行 v3.4.2 旧缓存；更新远程资源，确认脚本 URL 带 `v=3.4.3`，再彻底结束 Hpoi。 |
| `empty/missing body; end NOT confirmed` | 本次响应缺失，不能当作图库结束；返回词条刷新重试。 |
| `pagination timeout; refresh to resume` | 已保存本轮进度，返回词条刷新以继续抓取。 |
| `page=N count=0` 后出现 `complete=true` | 收到了结束分页，完整元数据已经缓存。 |
| `native page=1 count=20 total=44` | 原生相册当前返回 20 张，共 44 张，继续滑动加载。 |

## 当前边界

- 依赖 Hpoi 和 EXHOBBY 的现有接口、网页结构及图片域名；站点更新后可能需要调整。
- 使用 Hpoi 原生相册样式，不修改 App 本身的页面布局。
- v3.4.3 不再把标识封面或 EXHOBBY 图片插入普通相册；词条首页的专用卡片使用图库第一张实图。
- EXHOBBY 专用相册借用一个真实原生路由，原普通相册通过本地代理保持可访问；EXHOBBY 图片仍使用本地合成 ID。当前只适配浏览，收藏、点赞、评论等操作未适配。
- 完整图库元数据缓存有效期为 10 分钟，未完成抓取的进度有效期为 2 分钟。已有浏览器会话会复用至网站明确要求重新验证；提醒的冷却时间为 45 分钟。
- 当前没有自动清理全部旧条目与图片 ID 映射的功能；有效期不等于所有历史缓存都会被物理删除。
- 图片显示使用 EXHOBBY 的 `/pic/n/` 地址，不承诺是上传原始分辨率。

## 数据与隐私

仓库只包含脚本、兼容旧版缓存的原创标识封面资产、规则、文档和使用假数据的测试，不附带实际抓包、账号凭据或图库图片。

脚本通过 Quantumult X 本地偏好存储保存浏览器 Cookie、User-Agent、请求关联信息、原生模板、图库元数据和已访问图库的链接。EXHOBBY Cookie 仅用于 `www.exhobby.net` 的 HTTPS 请求；v3.3 会在会话捕获之前升级站点返回的旧 HTTP 链接。Cookie 不写入脚本文件、不打印到日志，也不上传 GitHub。Hpoi 的 `utoken` 不会被记录到脚本的请求关联缓存或转发给 EXHOBBY；原本发往 Hpoi 的 App 请求仍照常使用自己的凭据。

每台设备需要通过网站正常完成访问要求。提交问题时请提供版本、词条 ID 和相关报错，并先遮盖账号凭据。

## 验证

2026-09-11 的用户实机日志已确认：另一个 Hpoi 词条 `64287`（内部 ID `8274446`）抓取到完整 44 张图、创建相册入口，并返回原生相册第一页 20 张。此记录不代表所有条目和所有 App 版本均已验证。

2026-09-13 的另一台 iOS 16.7.16／Safari 16.6.2 设备实机请求确认：EXHOBBY 的「更多」分页仍可能使用 HTTP POST，且已携带 `is18=yes` 的年龄确认 Cookie；手动改用 HTTPS 后会话成功保存。v3.3 据此加入自动 `307` 升级。

本仓库另有离线模拟测试，覆盖并发词条隔离、专用入口的真实路由、普通相册透明代理与内容隔离、无封面图片序列、分页尾页、相册与图片导航、缓存复用、中断恢复、图片 ID 冲突、验证提醒、凭据隔离，以及 HTTP 图库链接到 HTTPS 的 307 规则顺序与 URL 保真。测试不连接真实站点，不代表所有设备和站点状态均已验证。

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
