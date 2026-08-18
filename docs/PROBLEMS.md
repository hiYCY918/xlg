# 开发问题记录与规避清单

> 本文档汇总本项目开发过程中遇到过的所有问题、根因与解决方案，
> 并沉淀为后续开发的强制性规避规则。**每次改动前先看「规避规则」。**

---

## 一、问题汇总

### 1. 脚本与部署

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 1 | 双击 `deploy.bat` 窗口一闪就关 | `$ErrorActionPreference = "Stop"` 下，原生命令（`gh auth status`）向 stderr 输出即触发致命错误，脚本在开头就退出；且 `.bat` 末尾无 `pause` 兜底 | 错误策略改 `Continue`，用 `$LASTEXITCODE` 判断；`.bat` 末尾加 `pause`；`Fail()` 显式退出 |
| 2 | `git push` 报 `couldn't create signal pipe, Win32 error 5` | 受限环境限制 Git for Windows 的 MSYS 运行库创建信号管道（非项目问题） | 在正常终端执行 push；SSH 密钥已验证有效 |
| 3 | 提交作者是占位身份 `game-guide@local` | 本地无 git 身份配置 | 部署脚本用 `gh api user` 取真实账号，自动 `git commit --amend --reset-author` |
| 4 | `.ps1` 中文乱码 / 解析报错 | 文件为 UTF-8 无 BOM，Windows PowerShell 5.1 按 ANSI 读取导致乱码和花括号误判 | 所有 `.ps1` 保存为 **UTF-8 带 BOM**；**每次编辑后必须重加 BOM 并校验** |

### 2. Wiki 图片下载

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 5 | 多词名称的 12 个物品贴图全部下载失败 | MediaWiki API 响应会把标题中的下划线规范化为空格，脚本用下划线 key 匹配失败 | 响应标题统一 `-replace " ", "_"` 后再匹配 |
| 6 | 加入鱼类后 68 张贴图全部未下载 | MediaWiki `titles` 参数**单次上限 50 个**，106 个标题的一次请求被拒绝 | 分批查询（每批 50 个） |

### 3. GitHub 部署

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 7 | 经典 Pages 构建连续 3 次 `Page build failed` | GitHub 服务端故障（构建服务异常） | 切换到 **GitHub Actions 部署**（`.github/workflows/pages.yml`），更可靠且有日志 |
| 8 | Actions 运行失败在 "Set up job" | codeload.github.com 对插件下载返回 **HTTP 429**（GitHub 限流） | 基础设施错误**重试触发**即可，勿改代码 |
| 9 | 线上一直跑旧版本（图片 404） | 构建失败时 GitHub 继续服务最后一个成功构建 | 部署后必须**验证线上实际文件与渲染**，不只信构建状态 |

### 4. 前端渲染（最严重）

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 10 | 页面只有顶部导航，内容区全空 | `buildSections` 生成 `fishingCount`/`festivalsCount`，而渲染代码查询 `fishCount`/`festivalCount` → 返回 null → `TypeError` → 初始化中断，**所有模块都不渲染**（此 bug 自首版存在，导致线上从未真正显示内容） | 修正 id 一致；计数更新改用 `setCount()` 空值安全函数；新增 `test/smoke.js` 冒烟测试自动拦截 |
| 11 | 部署后浏览器仍显示旧内容/空白 | 无版本参数，浏览器缓存新旧 JS 混用（旧 `icons.js` + 新 `main.js` 会抛错） | `index.html` 静态资源加 `?v=N` 版本参数，每次发布 +1；关键全局引用加 `typeof` 守卫 |

### 5. 工具与命令

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 12 | `node -e` 内联脚本正则被破坏（`Missing type name`） | PowerShell 对引号/正则转义导致 | 复杂脚本**写入临时 `.js` 文件执行** |
| 13 | `gh api --jq` 表达式报错（`no/0` 等） | jq 表达式含中文/特殊字符被 PowerShell 破坏 | 简单 jq 或改用 `ConvertFrom-Json` 在 PowerShell 内解析 |

### 6. 数据正确性（最值得警惕的一类）

| # | 问题现象 | 根因 | 解决方案 |
|---|---------|------|---------|
| 14 | **编造了游戏里不存在的条目**：僵尸 Zombie、盐 Salt、石膏 Gypsum、石蝙蝠 Stone Bat | 数据来自模型记忆而非验证——把脑补/混淆的内容当成星露谷真实内容写进了 `data.js` | 新增数据前**先用 Wiki 搜索 API 验证页面存在性**；拿不准的条目宁可不收录 |
| 15 | **Wiki 文件名凭拼写直觉猜测错误**：虎眼石实际是 `Tigerseye.png`（连写）、星碎实际是 `Star_Shards.png`（复数） | 文件名必须以 Wiki 实际存在为准，不能按 `ItemName.png` 通用规则脑补 | 文件名统一用 **`pageimages` API 按英文条目名取真实 URL**，不要手工拼文件名 |
| 16 | 下载兜底逻辑第一版有 bug（`File:` 前缀未剥离导致匹配永远失败） | 兜底逻辑复杂且未自测 | 复杂逻辑写好后**先本地造数据自测**再交付；同一问题反复失败时，**怀疑数据本身而非文件名** |
| 17 | 让用户反复跑下载脚本 3~4 次才定位 | 排查顺序错误：先猜文件名→改脚本→再猜，没有第一时间验证"数据是否真实存在"；且早期没发现 Node fetch 可直接访问 Wiki | **失败优先查数据真伪**；尽早测试工具能力边界（Node fetch 能通 Wiki 时，自己就能下载/验证，无需用户往返） |

---

## 二、规避规则（后续开发必须遵守）

| 编号 | 规则 |
|------|------|
| R1 | **模板 id 与查询 id 必须一致**：写完渲染函数后，grep 核对 `${m.id}Count` 与所有 `#xxxCount` 引用 |
| R2 | **DOM 查询一律空值安全**：可能为 null 的元素用 `if (el)` 或 `setCount()` 模式，绝不裸调 `.textContent` |
| R3 | **每次发布 bump 版本号**：`index.html` 的 `?v=N` 必须 +1，否则浏览器缓存会出幺蛾子 |
| R4 | **发布前必须跑冒烟测试**：`node test/smoke.js`（已集成进 `deploy.bat`，失败自动中止部署） |
| R5 | **改过任何 `.ps1` 后必须重加 UTF-8 BOM** 并用解析器校验语法 |
| R6 | **批量外部 API 调用前查平台限制**（如 MediaWiki `titles` ≤ 50/次），超限必须分批 |
| R7 | **对接外部 API 先确认返回格式的规范化行为**（大小写、空格/下划线、转义） |
| R8 | **部署后验证线上**：核对线上文件与本地一致、资源 200、渲染无报错（用 `test/verify-online.js` 思路，或 Node fetch 抽查） |
| R9 | **GitHub 基础设施错误先重试**（429 / 构建失败），不要急着重构代码 |
| R10 | **复杂脚本写文件执行**，避免内联命令被 shell 转义破坏；jq 表达式保持纯 ASCII |
| R11 | **数据字段先定义后使用**：给数据加新字段（如 `locCat`）时，确保所有渲染/筛选逻辑同步更新，并跑数据完整性校验（id 唯一、必填字段齐全） |
| R12 | **新增数据必须验证存在性**：任何新物品/怪物/NPC，先用 Wiki 搜索/`allpages` API 确认条目真实存在，杜绝凭记忆编造（已因此误收录 4 个不存在的条目） |
| R13 | **文件名不手工猜**：贴图/图片一律用 `pageimages` API 按英文条目名取真实 URL（如 Tigerseye、Star Shards），不按 `ItemName.png` 惯例脑补 |
| R14 | **持续失败先怀疑数据**：某条目反复下载失败，第一反应查"它是否真的存在于游戏/Wiki"，而不是反复改文件名映射 |
| R15 | **能用 Node fetch 直连外部源就自己做**：本项目沙箱里 Node fetch（undici/OpenSSL）可访问星露谷 Wiki（curl/Invoke-WebRequest 被 schannel 限制），下载与验证优先用 Node 脚本，减少用户往返 |

## 二·补充、解决方案与规避总纲（三层防线）

### ① 自动化工具层（机器把关，无需记忆）

| 工具 | 作用 | 拦截的问题 |
|------|------|-----------|
| `node test/check.js` | 一键全量自检：JS 语法 + 数据完整性（id 唯一/必填/图片覆盖报告）+ DOM 渲染冒烟 | #12 初始化崩溃、id 不匹配、数据残缺 |
| `node test/verify-wiki.js` | 把 data.js 全部条目映射英文名，批量核对 Wiki 存在性 | #14 编造条目、#15/16 错名（Tigerseye/Star Shards 类） |
| `deploy.bat`（内置） | **自动 bump 版本号** + 运行 check.js，失败**中止部署** | #13 缓存混用、上线带 bug |

### ② 流程层（每次发布固定动作）

```
改数据/代码 → node test/check.js → （新增数据时）node test/verify-wiki.js
→ 双击 deploy.bat（自动：bump 版本 → 自检 → 下载贴图 → 推送 → Actions 部署）
→ 线上核对（gh api runs / Node fetch 抽查）
```

### ③ 经验规则层

见下表 R1~R15，核心三条：
- **R12 新增数据先验证存在性**（用 verify-wiki.js / Wiki 搜索，杜绝编造）
- **R13 文件名不手工猜**（用 `pageimages` API 按英文条目名取真实 URL）
- **R15 能用 Node fetch 直连外部源就自己做**（本项目沙箱中 Node fetch 可通 Wiki，curl/Invoke-WebRequest 被 schannel 限制）

---

## 三、发布检查清单（每次 deploy 前）

1. ✅ `node test/check.js` —— 一键全量自检（语法 + 数据完整性 + 渲染冒烟），deploy.bat 已自动运行
2. ✅ （新增数据时）`node test/verify-wiki.js` —— Wiki 存在性核对，杜绝编造/错名
3. ✅ 图片覆盖报告：check.js 会列出缺失图片（兜底图标属设计内，可接受）
4. ✅ 版本号 `?v=N`：deploy.bat **自动 +1**，无需手动
5. ✅ 双击 `deploy.bat`（自动：bump 版本 → 自检 → 下载贴图 → 提交推送 → Actions 部署）
6. ✅ 线上核对：`gh api .../actions/runs` 最新 run 为 success；Node fetch 抽查首页/图片/JS

---

## 四、关键修复记录（时间线）

- `2026-08-17` 部署脚本闪退 → 错误策略 + BOM + pause
- `2026-08-17` 多词图片下载失败 → 标题归一化匹配
- `2026-08-17` GitHub 构建故障 → 切 Actions 部署
- `2026-08-18` 鱼类贴图未下载 → API 分批（50/批）
- `2026-08-18` **页面内容区全空（fishCount id 不匹配）** → 修正 id + `setCount()` + 冒烟测试
- `2026-08-18` 浏览器缓存混用 → `?v=N` 版本参数 + typeof 守卫
- `2026-08-18` 采矿/战斗补全时**误收录 4 个不存在的条目**（僵尸/盐/石膏/石蝙蝠） → Wiki 验证后删除；文件名错误（Tigerseye/Star Shards） → 改用 `pageimages` API 直取真实 URL；发现 **Node fetch 可直连 Wiki**（绕过 schannel 限制），下载/验证自给自足，不再依赖用户反复跑脚本
