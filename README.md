# 星露谷物语 · 攻略站

一个纯静态的游戏攻略前端页面，**像素风游戏界面质感**（木框 + 羊皮纸 + 物品栏格子），包含 10 大模块，图标全部使用游戏内真实贴图：

🌾 农作物 · 🍄 收集物 · 🎣 钓鱼 · ⛏️ 采矿 · ⚔️ 战斗 · 📜 任务 · 👤 NPC · 🎉 节日 · ✨ 事件 · 📦 收集包

## 核心功能

- **游戏化视觉**：导航与模块标题使用游戏内真实贴图（emoji 仅作贴图缺失时的兜底）；木框 + 羊皮纸 + 物品栏格子质感；导航栏木板纹理、选中态做成游戏标签页
- **像素级清晰的图标**：物品贴图 48×48 按 **1:1** 呈现、NPC 立绘 128×128 按 **2 倍整数缩放**，避免非整数缩放导致的像素错位
- **社区中心收集包（含进度勾选）**：31 个收集包按 7 个房间分组，逐格勾选已捐赠的物品，进度存 `localStorage`（刷新不丢、可一键清空）；支持「任选 N 个」型收集包（物品数多于槽位时只需交够 N 格）；金额包标明所需金币
- **收集包与物品双向打通**：收集包里的每个需求物品都能点开对应条目（作物/鱼/矿/怪…）；反过来，任意物品的详情页都有「用于收集包」一节，反查它被哪些包需要
- **农作物收益模型**：按 `（28 天季节内总收获额 − 种子价）÷ 末次收获日` 计算「每日净收益」，支持按 每日收益 / 成熟天数 / 售价 / 种子价 排序，用于横向比较作物效率（多季作物按单季估算，弹窗内附算法说明）
- **负收益警示**：种子价高于售价的作物（如向日葵，靠收获时掉落种子回本）以红色 `⚠️` 标注，避免把正确算法误读成 bug
- **10 模块详情弹窗全覆盖**：所有卡片可点击展开完整数据——农作物显示经济数据与算法、钓鱼显示出没条件与难度、NPC 显示生日与最爱礼物
- **掉落物交叉跳转**：怪物掉落物中能对应到条目的，可直接点击跳转到采矿 / 收集物对应条目
- **深链接可分享**：地址栏实时反映当前位置（`#fish/legend` 这样的 `#模块/条目`），刷新、收藏、发给队友都能直接落到同一条目；非法或过期的链接安全降级、不会白屏
- **状态记忆**：记住上次浏览的模块，回访不再总是跳回农作物
- **全局搜索**：跨 10 模块搜索并定位高亮，索引涵盖用途、掉落物、礼物、房间等字段（可「按用途找东西」）；**回车直达第一条结果**；跳转前自动清空目标模块筛选，避免目标条目被筛选条件挡住
- **多维筛选**：季节 / 水域 / 类型 / 房间筛选，标题实时显示「当前显示 N 条」
- **键盘可达**：卡片可 Tab 聚焦、Enter / 空格打开详情；弹窗关闭后焦点归还

## 新增一个模块（改 1 处即可）

模块的全部能力都声明在 `js/main.js` 的 **`REGISTRY`** 注册表里（唯一事实来源）：

```js
{
  id: "bundles",                 // 模块 id（决定 #module-xxx / #xxxCount / #shown-xxx）
  label: "收集包", sub: "社区中心收集包的所需物品与奖励",
  sprite: "achievement", icon: "📦",     // 导航图标：真实贴图 + emoji 兜底
  spriteFor: "",                 // 条目贴图命名前缀（物品为 ""、NPC 为 "npc-"；不写 = emoji 呈现）
  data: "BUNDLES",               // 数据数组名（在 MODULE_DATA 中登记）
  render: renderBundles,         // 渲染函数
  stateKey: ["bundles"],         // 本模块用到的筛选状态键
  resetFilter: (s) => { s.bundles = "全部"; },   // 搜索跳转前重置筛选（R18）
  indexExtra: (b) => [b.reward],  // 搜索索引的附加关键词
  detail: (b) => ...,            // 详情弹窗渲染函数
}
```

**不需要**再改 `FILTER_RESET`、`DETAIL_RENDERERS`、`buildIndex()`，也不需要改 `test/check.js`——
计数、渲染冒烟、详情渲染、搜索索引覆盖、贴图齐备这些断言都会自动覆盖新模块。

## 项目结构

```
game-guide/
├── index.html        入口页面
├── css/
│   └── style.css     暖色田园主题样式
├── js/
│   ├── data.js       全部攻略数据（可自由增删改；含 BUNDLES 收集包）
│   ├── icons.js      自绘 SVG 备用图标
│   └── main.js       交互逻辑 + 模块注册表（REGISTRY，唯一事实来源）
├── img/              真实游戏贴图 331 张（下载脚本自动填充）
├── test/             测试与审计工具（离线 1 个 + 联网 3 个）
│   ├── check.js      一键全量自检（7 节 98 断言）· 离线
│   ├── verify-wiki.js 存在性核对 · 双轮（防编造/错名）· 联网
│   └── audit-completeness.js  完备性审计（防遗漏）· 联网
├── docs/
│   └── PROBLEMS.md   开发问题记录与规避清单（必读）
├── scripts/          运维脚本（与站点内容分离）
│   ├── deploy.bat / deploy.ps1              一键部署
│   └── download-images.bat / download-images.ps1   仅下载贴图
├── .github/workflows/pages.yml   GitHub Actions 自动部署
├── .nojekyll         禁用 GitHub Pages 的 Jekyll 处理
└── README.md
```

## 开发流程（重要）

**改数据/代码 → 自检 → 双击 `scripts\deploy.bat` 上线**：

```bash
node test/check.js             # 1. 一键全量自检（8 节 116 断言，必须通过）
                               #    ① JS 语法 ② 数据完整性（注册表自洽 / id 唯一 / 贴图覆盖）
                               #    ③ 渲染冒烟（10 模块计数与 section）
                               #    ④ 收益算法基准值 + 10 模块详情渲染（全 397 条）
                               #    ⑤ 点击→弹窗、交叉跳转的合成事件验证
                               #    ⑥ 收集包：勾选→存盘→读回→完成判定、任选包、悬空引用表
                               #    ⑦ 深链接：#模块/条目 解析与落地、前进后退、搜索回车、状态记忆
                               #    ⑧ 模块图标贴图齐备 + 搜索索引覆盖 + 无临时文件残留
node test/verify-wiki.js       # 2. 新增数据时：存在性核对（双轮，防编造/错名）
                               #    ① 中文名直查中文 Wiki（全量条目）
                               #    ② 英文名交叉验证（英文页名规范）
node test/audit-completeness.js # 3. 成批补内容后：完备性审计（防遗漏）
                               #    对照中文 Wiki 分类全集做双向差集
# 4. 双击 scripts\deploy.bat（自动：版本号+1 → 自检 → 下载贴图 → 提交推送 → Actions 部署）
```

> ⚠️ `deploy.bat` 会在推送前自动运行全量自检（`test/check.js`），**失败会中止部署**；版本号也会**自动 +1**，无需手动。
> 所有历史问题和规避规则见 **`docs/PROBLEMS.md`**，改动前务必查看。

## 技术栈

纯 **HTML + CSS + JavaScript**，无框架、无构建步骤、无后端依赖，所有资源使用相对路径，可直接部署到任意静态托管平台。

## 本地预览

方式一：直接双击 `index.html`。

方式二：在项目目录运行

```bash
python -m http.server 8000
```

然后浏览器访问 <http://127.0.0.1:8000>。

## 部署到 GitHub Pages

### 方式 A：网页上传（最简单）

1. 新建一个 GitHub 仓库（例如命名为 `stardew-guide`，选 **Public**）。
2. 进入仓库，点击 **Add file → Upload files**，把本项目里的 `index.html`、`css/`、`js/` 以及 `.nojekyll` 全部拖进去，提交。
3. 打开仓库 **Settings → Pages**：
   - **Source** 选择 `Deploy from a branch`
   - **Branch** 选择 `main`，目录选择 `/ (root)`，保存
4. 等待几分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

### 方式 B：命令行部署

项目已初始化 git 仓库，执行：

```bash
git init                        # 若尚未初始化
git add .
git commit -m "init: 星露谷物语攻略站"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

推送成功后，按方式 A 的第 3 步在 Settings → Pages 里开启 Pages 即可。

## 自定义内容

所有攻略数据都集中在 `js/data.js`，按模块分成清晰的数组（`CROPS`、`COLLECTIBLES`、`FISH`、`MINERALS`、`MONSTERS`、`QUESTS`、`NPCS`、`FESTIVALS`、`EVENTS`）。直接修改或新增条目，刷新页面即可生效，无需改动其他文件。
