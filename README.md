# 星露谷物语 · 攻略站

一个纯静态的游戏攻略前端页面，**像素风游戏界面质感**（木框 + 羊皮纸 + 物品栏格子），包含 9 大模块，图标全部使用游戏内真实贴图：

🌾 农作物 · 🍄 收集物 · 🎣 钓鱼 · ⛏️ 采矿 · ⚔️ 战斗 · 📜 任务 · 👤 NPC · 🎉 节日 · ✨ 事件

## 核心功能

- **游戏化视觉**：导航与模块标题使用游戏内真实贴图（emoji 仅作贴图缺失时的兜底）；木框 + 羊皮纸 + 物品栏格子质感；导航栏木板纹理、选中态做成游戏标签页
- **像素级清晰的图标**：物品贴图 48×48 按 **1:1** 呈现、NPC 立绘 128×128 按 **2 倍整数缩放**，避免非整数缩放导致的像素错位
- **农作物收益模型**：按 `（28 天季节内总收获额 − 种子价）÷ 末次收获日` 计算「每日净收益」，支持按 每日收益 / 成熟天数 / 售价 / 种子价 排序，用于横向比较作物效率（多季作物按单季估算，弹窗内附算法说明）
- **负收益警示**：种子价高于售价的作物（如向日葵，靠收获时掉落种子回本）以红色 `⚠️` 标注，避免把正确算法误读成 bug
- **9 模块详情弹窗全覆盖**：所有卡片可点击展开完整数据——农作物显示经济数据与算法、钓鱼显示出没条件与难度、NPC 显示生日与最爱礼物
- **掉落物交叉跳转**：怪物掉落物中能对应到条目的，可直接点击跳转到采矿 / 收集物对应条目
- **全局搜索**：跨 9 模块搜索并定位高亮；跳转前自动清空目标模块筛选，避免目标条目被筛选条件挡住
- **多维筛选**：季节 / 水域 / 类型筛选，标题实时显示「当前显示 N 条」
- **键盘可达**：卡片可 Tab 聚焦、Enter / 空格打开详情；弹窗关闭后焦点归还

## 项目结构

```
game-guide/
├── index.html        入口页面
├── css/
│   └── style.css     暖色田园主题样式
├── js/
│   ├── data.js       全部攻略数据（可自由增删改）
│   ├── icons.js      自绘 SVG 备用图标
│   └── main.js       交互逻辑
├── img/              真实游戏贴图（下载脚本自动填充）
├── test/
│   ├── check.js      一键全量自检（语法+数据+渲染+收益+交互委托）
│   ├── smoke.js      渲染冒烟测试（node test/smoke.js）
│   ├── verify-wiki.js 存在性核对 · 双轮（防编造/错名）
│   └── audit-completeness.js  完备性审计（防遗漏）
├── docs/
│   └── PROBLEMS.md   开发问题记录与规避清单（必读）
├── deploy.bat        一键部署入口（双击）
├── download-images.bat  仅下载贴图（双击）
├── .github/workflows/pages.yml   GitHub Actions 自动部署
├── .nojekyll         禁用 GitHub Pages 的 Jekyll 处理
└── README.md
```

## 开发流程（重要）

**改数据/代码 → 自检 → 双击 deploy.bat 上线**：

```bash
node test/check.js             # 1. 一键全量自检（5 节 40+ 断言，必须通过）
                               #    ① JS 语法 ② 数据完整性 ③ 渲染冒烟
                               #    ④ 收益算法基准值与 9 模块详情渲染（全 313 条）
                               #    ⑤ 点击→弹窗、交叉跳转的合成事件验证
node test/verify-wiki.js       # 2. 新增数据时：存在性核对（双轮，防编造/错名）
                               #    ① 中文名直查中文 Wiki（全量 313 条）
                               #    ② 英文名交叉验证（英文页名规范）
node test/audit-completeness.js # 3. 成批补内容后：完备性审计（防遗漏）
                               #    对照中文 Wiki 分类全集做双向差集
# 4. 双击 deploy.bat（自动：版本号+1 → 自检 → 下载贴图 → 提交推送 → Actions 部署）
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
