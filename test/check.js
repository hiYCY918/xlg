/* ============================================================
 * 全量自检（本地运行，无需网络）
 * 用法：node test/check.js
 * 检查项：
 *   1. 三个 JS 文件语法（解析）
 *   2. 数据完整性：id 唯一、必填字段、图片文件覆盖（报告）
 *   3. 渲染冒烟：模拟 DOM 初始化，9 模块计数与数据一致
 * 退出码：0 通过 / 1 失败（deploy.bat 集成，失败中止部署）
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let failures = 0;
const log = (ok, msg) => {
  console.log((ok ? "✓ " : "✗ ") + msg);
  if (!ok) failures++;
};

/* ---------- 1. 语法检查 ---------- */
console.log("=== 1. JS 语法 ===");
for (const f of ["js/data.js", "js/icons.js", "js/main.js"]) {
  try {
    new Function(fs.readFileSync(path.join(root, f), "utf8"));
    log(true, f + " 语法正常");
  } catch (e) {
    log(false, f + " 语法错误: " + e.message);
  }
}

/* ---------- 2. 数据完整性 ---------- */
console.log("\n=== 2. 数据完整性 ===");

/* 先建最小 DOM 模拟（main.js 执行时需要 document） */
const registry = new Map();
const allEls = [];
class El {
  constructor(tag) {
    this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this._cls = new Set();
    this.listeners = {}; this._attrs = {}; this._id = ""; this.hidden = false; this._text = ""; this._html = "";
  }
  set id(v) { this._id = v; if (v) registry.set("#" + v, this); }
  get id() { return this._id; }
  set innerHTML(v) { this._html = String(v); const re = /id="([^"]+)"/g; let m; while ((m = re.exec(this._html))) registry.set("#" + m[1], new El("div")); }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  appendChild(c) { c.parentNode = this; this.children.push(c); allEls.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  addEventListener(t, cb) { (this.listeners[t] || (this.listeners[t] = [])).push(cb); }
  setAttribute(k, v) { this._attrs[k] = String(v); if (k === "id") this.id = v; if (k === "class") this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  getAttribute(k) { return this._attrs[k]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  scrollIntoView() {}
  remove() {}
  get classList() {
    const s = this;
    return {
      add(...c) { c.forEach((x) => s._cls.add(x)); },
      remove(...c) { c.forEach((x) => s._cls.delete(x)); },
      toggle(c, f) { f === undefined ? (s._cls.has(c) ? s._cls.delete(c) : s._cls.add(c)) : (f ? s._cls.add(c) : s._cls.delete(c)); },
      contains(c) { return s._cls.has(c); },
    };
  }
}
const document = {
  body: new El("body"),
  createElement(t) { const e = new El(t); allEls.push(e); return e; },
  createElementNS() { return new El("svg"); },
  addEventListener(t, cb) { if (t === "DOMContentLoaded") setTimeout(cb, 0); },
  querySelector(sel) {
    if (registry.has(sel)) return registry.get(sel);
    const mm = sel.match(/data-module="([^"]+)"/);
    if (mm) return allEls.find((e) => e.dataset.module === mm[1]) || null;
    return null;
  },
  querySelectorAll() { return []; },
};
globalThis.document = document;
globalThis.window = globalThis;
for (const id of ["nav", "page", "globalSearch", "searchDrop", "modal", "modalClose", "modalContent"]) registry.set("#" + id, new El("div"));

const src =
  fs.readFileSync(path.join(root, "js/data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "js/icons.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "js/main.js"), "utf8") + "\n" +
  "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS," +
  "cropProfit,cropHarvests,cropGrowthDays,DETAIL_RENDERERS,CROP_SEASON_FILTERS,FISH_LOCS,MODULES};";

let data;
try {
  data = new Function(src)();
} catch (e) {
  log(false, "数据加载失败: " + e.message);
  console.log("\n结果：失败 " + failures + " 项");
  process.exit(1);
}

const groups = [
  ["cropsCount", "CROPS", data.CROPS],
  ["collectCount", "COLLECTIBLES", data.COLLECTIBLES],
  ["fishingCount", "FISH", data.FISH],
  ["miningCount", "MINERALS", data.MINERALS],
  ["combatCount", "MONSTERS", data.MONSTERS],
  ["questsCount", "QUESTS", data.QUESTS],
  ["npcCount", "NPCS", data.NPCS],
  ["festivalsCount", "FESTIVALS", data.FESTIVALS],
  ["eventsCount", "EVENTS", data.EVENTS],
];
const allItems = groups.flatMap(([, , arr]) => arr);

// id 唯一
const ids = allItems.map((x) => x.id);
const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
log(dups.length === 0, "id 无重复" + (dups.length ? ": " + dups.join(",") : ""));

// 必填字段
const missingName = allItems.filter((x) => !x.name).map((x) => x.id);
log(missingName.length === 0, "全部条目有 name" + (missingName.length ? ": " + missingName.join(",") : ""));

// 图片覆盖（报告，不判失败——兜底图标是设计内）
const haveImgs = fs.existsSync(path.join(root, "img"))
  ? fs.readdirSync(path.join(root, "img")).filter((f) => f.endsWith(".png")).map((f) => f.replace(".png", ""))
  : [];
const imgIds = [
  ...data.CROPS.map((c) => c.id),
  ...data.COLLECTIBLES.map((c) => c.id),
  ...data.FISH.map((f) => f.id),
  ...data.MINERALS.map((m) => m.id),
  ...data.MONSTERS.map((m) => m.id),
  ...data.NPCS.map((n) => "npc-" + n.id),
];
const noImg = imgIds.filter((i) => !haveImgs.includes(i));
console.log(`ℹ 图片覆盖：${imgIds.length - noImg.length}/${imgIds.length}（缺失 ${noImg.length} 个，将用兜底图标）` + (noImg.length ? ": " + noImg.join(",") : ""));

// 模块数量
for (const [, label, arr] of groups) log(arr.length > 0, label + " 数据 " + arr.length + " 条");

/* ---------- 3. 渲染冒烟 ---------- */
console.log("\n=== 3. 渲染冒烟 ===");

(async () => {
  try {
    new Function(src)();
    await new Promise((r) => setTimeout(r, 120));
  } catch (e) {
    log(false, "初始化报错: " + e.message);
    console.log("\n结果：失败 " + failures + " 项");
    process.exit(1);
  }
  for (const [countId, label, arr] of groups) {
    const el = registry.get("#" + countId);
    const val = el ? el.textContent : "(元素缺失)";
    log(String(val) === String(arr.length), countId + " = " + val + "（" + label + " " + arr.length + " 条）");
  }
  const modIds = ["crops", "collect", "fishing", "mining", "combat", "quests", "npc", "festivals", "events"];
  for (const m of modIds) log(registry.has("#module-" + m), "模块 section #module-" + m + " 已创建");
  log(!registry.get("#module-crops").hidden, "默认模块（crops）已显示");

  /* ---------- 4. 收益计算与详情弹窗 ---------- */
  console.log("\n=== 4. 收益计算与详情弹窗 ===");

  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.05 : tol);
  const cropOf = (id) => data.CROPS.find((c) => c.id === id);
  const pct = (p) => (typeof p === "number" && Number.isFinite(p) ? p.toFixed(2) : String(p));

  /* 基准值：蔓越莓与防风草是社区公认的收益标杆，算式若被改坏会立刻暴露 */
  const cran = cropOf("cranberry");
  log(cran && near(data.cropProfit(cran), 5.0),
    "蔓越莓每日净收益 = " + (cran ? pct(data.cropProfit(cran)) : "?") + "（基准 5.00）");
  const pars = cropOf("parsnip");
  log(pars && near(data.cropProfit(pars), 3.75),
    "防风草每日净收益 = " + (pars ? pct(data.cropProfit(pars)) : "?") + "（基准 3.75）");
  log(cran && data.cropHarvests(cran) === 5,
    "蔓越莓 28 天可收 5 次（实际 " + (cran ? data.cropHarvests(cran) : "?") + "）");

  /* 数据中存在 "6-8" 这类区间字符串（水稻近水提前成熟），必须容错而非算出 NaN */
  const rice = cropOf("rice");
  log(rice && Number.isFinite(data.cropProfit(rice)),
    "区间成熟天数不产生 NaN（rice growth=" + (rice ? JSON.stringify(rice.growth) : "?") +
    " → " + (rice ? pct(data.cropProfit(rice)) : "?") + " 金/天）");

  const badProfit = data.CROPS.filter((c) => !Number.isFinite(data.cropProfit(c))).map((c) => c.id);
  log(badProfit.length === 0,
    "全部 " + data.CROPS.length + " 种作物收益可计算" + (badProfit.length ? ": NaN " + badProfit.join(",") : ""));

  /* 筛选入口覆盖：数据里出现过的季节/水域，必须有对应的筛选按钮，否则内容无法触达 */
  const cropSeasons = [...new Set(data.CROPS.flatMap((c) => c.season))];
  const noSeasonChip = cropSeasons.filter((s) => !data.CROP_SEASON_FILTERS.includes(s));
  log(noSeasonChip.length === 0,
    "作物季节筛选覆盖全部季节（" + cropSeasons.join("/") + "）" +
    (noSeasonChip.length ? "：缺 " + noSeasonChip.join(",") : ""));

  const fishLocs = [...new Set(data.FISH.map((f) => f.locCat))];
  const noLocChip = fishLocs.filter((l) => !data.FISH_LOCS.includes(l));
  log(noLocChip.length === 0,
    "钓鱼水域筛选覆盖全部水域（" + fishLocs.length + " 类）" +
    (noLocChip.length ? "：缺 " + noLocChip.join(",") : ""));

  /* 详情弹窗：9 个模块都要能生成内容，且对不存在的 id 安全返回 null */
  const modIds9 = ["crops", "collect", "fishing", "mining", "combat", "quests", "npc", "festivals", "events"];
  const missingRenderer = modIds9.filter((m) => typeof data.DETAIL_RENDERERS[m] !== "function");
  log(missingRenderer.length === 0,
    "9 个模块均有详情渲染器" + (missingRenderer.length ? ": 缺失 " + missingRenderer.join(",") : ""));

  const arrays = {
    crops: data.CROPS, collect: data.COLLECTIBLES, fishing: data.FISH, mining: data.MINERALS,
    combat: data.MONSTERS, quests: data.QUESTS, npc: data.NPCS, festivals: data.FESTIVALS, events: data.EVENTS,
  };
  const detailFails = [];
  for (const m of modIds9) {
    const first = (arrays[m] || [])[0];
    let html = null;
    try { html = first ? data.DETAIL_RENDERERS[m](first.id) : null; } catch (e) { html = null; }
    if (!html || String(html).length < 40) detailFails.push(m);
  }
  log(detailFails.length === 0,
    "9 个模块详情弹窗均可生成内容" + (detailFails.length ? ": " + detailFails.join(",") : ""));

  /* 全量渲染器逐条跑一遍，任何一条抛错都说明有数据没被渲染逻辑接住 */
  const renderErrors = [];
  for (const m of modIds9) {
    for (const item of (arrays[m] || [])) {
      try {
        const html = data.DETAIL_RENDERERS[m](item.id);
        if (!html || String(html).length < 40) renderErrors.push(m + "/" + item.id);
      } catch (e) { renderErrors.push(m + "/" + item.id); }
    }
  }
  log(renderErrors.length === 0,
    "全部 " + Object.values(arrays).reduce((n, a) => n + a.length, 0) + " 条详情渲染无异常" +
    (renderErrors.length ? ": " + renderErrors.slice(0, 8).join(",") : ""));

  const notNullSafe = [];
  for (const m of modIds9) {
    try { if (data.DETAIL_RENDERERS[m]("__not_exist__") !== null) notNullSafe.push(m); }
    catch (e) { notNullSafe.push(m); }
  }
  log(notNullSafe.length === 0, "不存在的 id 安全返回 null" + (notNullSafe.length ? ": " + notNullSafe.join(",") : ""));

  /* 「当前显示 N 条」元素必须齐备，否则筛选后用户看不到结果数量变化 */
  const shownMissing = modIds9.filter((m) => !registry.has("#shown-" + m));
  log(shownMissing.length === 0,
    "9 个模块均有「当前显示」计数元素" + (shownMissing.length ? ": " + shownMissing.join(",") : ""));

  /* ---------- 5. 点击 → 详情弹窗 的事件委托 ---------- */
  console.log("\n=== 5. 交互委托（点击卡片打开详情） ===");

  const pageEl = registry.get("#page");
  const modalContentEl = registry.get("#modalContent");
  const handlers = (pageEl && pageEl.listeners && pageEl.listeners.click) || [];
  log(handlers.length > 0, "已注册卡片点击委托处理器");

  /* 构造最小的合成事件：目标卡片挂在某个模块 section 上 */
  const makeClick = (moduleId, itemId) => {
    const sec = { dataset: { module: moduleId }, hidden: true };
    const card = {
      dataset: { id: itemId },
      classList: { contains: () => true },
      closest: (sel) => (sel === "[data-id]" ? card : (sel === ".module" ? sec : null)),
    };
    return { target: { closest: (sel) => (sel === "[data-id]" ? card : null) } };
  };

  if (handlers.length) {
    const fish = data.FISH.find((f) => f.id === "legend") || data.FISH[0];
    handlers[0](makeClick("fishing", fish.id));
    const html = modalContentEl ? String(modalContentEl.innerHTML) : "";
    log(registry.get("#modal").hidden === false, "点击鱼类卡片后弹窗打开");
    log(html.includes(fish.name), "弹窗内容包含条目名「" + fish.name + "」");
    log(html.includes("modal-section"), "弹窗含结构化分区");

    /* 点击空白处（无 data-id）不应误开弹窗 */
    registry.get("#modal").hidden = true;
    handlers[0]({ target: { closest: () => null } });
    log(registry.get("#modal").hidden === true, "点击非卡片区域不触发弹窗");

    /* 未知模块 id 必须安全忽略 */
    handlers[0](makeClick("not-a-module", fish.id));
    log(registry.get("#modal").hidden === true, "未知模块 id 不触发弹窗");
  }

  /* 弹窗内交叉跳转（怪物掉落物 → 对应条目） */
  const crossHandlers = (modalContentEl && modalContentEl.listeners && modalContentEl.listeners.click) || [];
  log(crossHandlers.length > 0, "已注册弹窗内交叉跳转处理器");
  if (crossHandlers.length) {
    const monster = data.MONSTERS.find((m) => m.drops.some((d) => data.MINERALS.concat(data.COLLECTIBLES).some((x) => x.name === d)));
    if (monster) {
      const drop = monster.drops.find((d) => data.MINERALS.concat(data.COLLECTIBLES).some((x) => x.name === d));
      const target = data.MINERALS.find((x) => x.name === drop) || data.COLLECTIBLES.find((x) => x.name === drop);
      const mod = data.MINERALS.some((x) => x.name === drop) ? "mining" : "collect";
      registry.get("#modalContent").innerHTML = data.DETAIL_RENDERERS.combat(monster.id);
      log(String(registry.get("#modalContent").innerHTML).includes("data-goto-id"),
        "怪物掉落物生成了交叉跳转链接（如 " + monster.name + " → " + drop + "）");
      const link = { dataset: { gotoModule: mod, gotoId: target.id } };
      crossHandlers[0]({ target: { closest: (sel) => (sel === "[data-goto-id]" ? link : null) } });
      log(String(registry.get("#modalContent").innerHTML).includes(target.name),
        "点击掉落物后弹窗切换到「" + target.name + "」");
    }
  }

  /* ---------- 6. 视觉资源 ---------- */
  console.log("\n=== 6. 视觉资源（模块图标贴图） ===");

  /* 模块图标必须是真实游戏贴图且文件存在，否则会静默退化成 emoji */
  const modIconFails = [];
  for (const m of data.MODULES) {
    if (!m.sprite || !m.icon || !m.label) { modIconFails.push(m.id + "(字段缺失)"); continue; }
    if (!fs.existsSync(path.join(root, "img", m.sprite + ".png"))) {
      modIconFails.push(m.id + " → img/" + m.sprite + ".png 不存在");
    }
  }
  log(modIconFails.length === 0,
    data.MODULES.length + " 个模块图标贴图齐备" + (modIconFails.length ? ": " + modIconFails.join("; ") : ""));

  /* 贴图格式报告（不判失败）：GIF 冒名 .png 时浏览器靠内容嗅探仍能渲染 */
  const notPng = [];
  const imgDir = path.join(root, "img");
  if (fs.existsSync(imgDir)) {
    for (const f of fs.readdirSync(imgDir).filter((x) => x.toLowerCase().endsWith(".png"))) {
      const fd = fs.openSync(path.join(imgDir, f), "r");
      const sig = Buffer.alloc(4);
      fs.readSync(fd, sig, 0, 4, 0);
      fs.closeSync(fd);
      if (sig.toString("hex") !== "89504e47") {
        const kind = sig.toString("ascii", 0, 4).replace(/[^\x20-\x7e]/g, "?");
        notPng.push(f + "(" + kind + ")");
      }
    }
  }
  console.log("ℹ 贴图格式：非 PNG 者 " + notPng.length + " 个" + (notPng.length ? "：" + notPng.join(", ") : ""));

  /* 临时文件防漏：deploy.bat 会 git add -A，根目录下遗留的 _ 开头文件会被误提交 */
  const strayTmp = fs.readdirSync(root).filter((f) => f.startsWith("_"));
  log(strayTmp.length === 0,
    "仓库根目录无临时文件残留" + (strayTmp.length ? ": " + strayTmp.join(", ") : ""));

  console.log(failures ? `\n结果：失败 ${failures} 项` : "\n结果：全部通过 ✓");
  process.exit(failures ? 1 : 0);
})();
