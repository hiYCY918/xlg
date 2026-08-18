# 星露谷物语 · 攻略站

一个纯静态的游戏攻略前端页面，暖色田园风格，包含 9 大模块：

🌾 农作物 · 🍄 收集物 · 🎣 钓鱼 · ⛏️ 采矿 · ⚔️ 战斗 · 📜 任务 · 👤 NPC · 🎉 节日 · ✨ 事件

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
│   └── smoke.js      渲染冒烟测试（node test/smoke.js）
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
node test/check.js             # 1. 一键全量自检（语法+数据完整性+渲染冒烟，必须通过）
node test/verify-wiki.js       # 2. 新增数据时：Wiki 存在性核对（防编造/错名）
# 3. 双击 deploy.bat（自动：版本号+1 → 自检 → 下载贴图 → 提交推送 → Actions 部署）
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
