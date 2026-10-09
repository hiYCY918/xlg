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
/* 断言计数：README/PROBLEMS 里的「N 节 M 处断言」是**数据**，必须能从输出里核对（R60）。
 * 这里数的是**运行时真正执行的** log() 次数——循环里的断言会按执行次数计，
 * 与「调用点数」不同，两者差 50 上下，凭印象写必错。 */
let assertions = 0;
const log = (ok, msg) => {
  assertions++;
  console.log((ok ? "[OK] " : "[FAIL] ") + msg);
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
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
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

/* 深链接用到 location / history：给出最小可用实现，
 * 才能断言「切模块与打开条目会写 URL」「#模块/条目 能落地」 */
const winListeners = {};
globalThis.addEventListener = (t, cb) => { (winListeners[t] || (winListeners[t] = [])).push(cb); };
globalThis.location = { hash: "", href: "https://example.test/" };
/* 记录写历史的粒度：模块切换应为 replace，打开条目应为 push（对应 R41） */
const historyCalls = [];
globalThis.history = {
  state: null,
  replaceState(state, title, url) {
    historyCalls.push({ mode: "replace", url });
    this.state = state;
    if (typeof url === "string" && url.charAt(0) === "#") globalThis.location.hash = url;
    else globalThis.location.hash = "";
  },
  pushState(state, title, url) {
    historyCalls.push({ mode: "push", url });
    this.state = state;
    if (typeof url === "string" && url.charAt(0) === "#") globalThis.location.hash = url;
    else globalThis.location.hash = "";
  },
};

/* localStorage 模拟：收集包进度全靠它，必须有可断言的实现才能验证「勾选后真的存下来了」 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => { store.set(String(k), String(v)); },
  removeItem: (k) => { store.delete(String(k)); },
  clear: () => store.clear(),
};
for (const id of ["nav", "page", "globalSearch", "searchDrop", "modal", "modalClose", "modalContent"]) registry.set("#" + id, new El("div"));

const src =
  fs.readFileSync(path.join(root, "js/data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "js/icons.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "js/main.js"), "utf8") + "\n" +
  "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS," +
  "cropProfit,cropHarvests,cropGrowthDays,DETAIL_RENDERERS,CROP_SEASON_FILTERS,FISH_LOCS," +
  "MODULES,REGISTRY,MODULE_DATA,buildIndex,BUNDLES,BUNDLE_ROOMS,BUNDLE_ITEM_INDEX,BUNDLE_USES," +
  "toggleBundleSlot,bundleProgress,bundleFilled,isBundleDone,bundleNeeded,bundleSlotCount," +
  "bundleItemNames,doneBundleCount,readBundleProgress,BUNDLE_PROGRESS_KEY," +
  "parseHash,hashFor,setRouteHash,currentModuleId,defaultModuleId,restoreRoute,gotoItem,LAST_MODULE_KEY," +
  "GIFT_USES,GIFT_PLACEHOLDERS,giftChip,giftUsesSection,NAME_INDEX," +
  "CRAFTING,CRAFT_CATS,CRAFTED_BY,craftedBySection,sortCrafting," +
  "ARTISAN,artisanMachines," +
  "ARTIFACTS,MUSEUM_NAMES,MUSEUM_REWARDS,isDonated,toggleDonate,museumDonatedCount,readMuseum," +
  "SEEDS,SEED_SEASON_FILTERS,SEEDED_BY,seededBySection,seedPriceText,seedGrowthText,sortSeeds," +
  "FRUIT_TREES,TREE_SEASONS,saplingChip,sortTrees,ANIMALS,ANIMAL_FILTERS,nameChip," +
  "ANIMAL_PRODUCTS,PRODUCT_BY,PRODUCT_FILTERS,productKinds,renderProducts," +
  "TOOLS,TOOL_CATS,TOOL_FILTERS,toolCostText,tierRows," +
  "BUILDINGS,BUILDING_FILTERS,buildingCostText,renderBuildings," +
  "WEAPONS,WEAPON_FILTERS,critText,weaponStatText,renderWeapons," +
  "RINGS,ringEffectText,renderRings," +
  "TREES,TREE_FILTERS,seedChip,ensureNavVisible};";

let data;
try {
  data = new Function(src)();
} catch (e) {
  log(false, "数据加载失败: " + e.message);
  console.log("\n结果：失败 " + failures + " 项");
  process.exit(1);
}

/* 模块清单由注册表驱动：新增模块时下面的计数、渲染、详情断言自动覆盖，
 * 不再需要在这里补一行（这是 #30 那类「审计随数据增长而静默失守」的机制化修复）。 */
const mods = data.MODULES;
const secOf = (id) => data.REGISTRY.find((s) => s.id === id);
const arrays = {};
const groups = mods.map((m) => {
  const arr = data.MODULE_DATA[secOf(m.id).dataRef] || [];
  arrays[m.id] = arr;
  return [m.id + "Count", m.label, arr];
});
const allItems = groups.flatMap(([, , arr]) => arr);
const modIds = mods.map((m) => m.id);

/* 注册表自洽性：任一模块缺字段，都会让渲染/详情/筛选静默失配（R1 的根因） */
const secFails = [];
for (const s of data.REGISTRY) {
  const miss = [];
  if (!s.id) miss.push("id");
  if (!s.label) miss.push("label");
  if (!s.sprite) miss.push("sprite");
  if (!Array.isArray(s.data) || !s.data.length) miss.push("data(" + s.dataRef + ")");
  if (typeof s.render !== "function") miss.push("render");
  if (typeof s.detail !== "function") miss.push("detail");
  if (typeof s.resetFilter !== "function") miss.push("resetFilter");
  if (typeof s.indexExtra !== "function") miss.push("indexExtra");
  if (miss.length) secFails.push(s.id + " 缺 " + miss.join("/"));
}
log(secFails.length === 0,
  "注册表 " + data.REGISTRY.length + " 个模块字段自洽" + (secFails.length ? ": " + secFails.join("; ") : ""));
log(mods.length === data.REGISTRY.length, "MODULES 与 REGISTRY 数量一致（" + mods.length + "）");

// id 唯一
const ids = allItems.map((x) => x.id);
const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
log(dups.length === 0, "id 无重复" + (dups.length ? ": " + dups.join(",") : ""));

// 必填字段
const missingName = allItems.filter((x) => !x.name).map((x) => x.id);
log(missingName.length === 0, "全部条目有 name" + (missingName.length ? ": " + missingName.join(",") : ""));

// 图片覆盖（**断言**，不是报告）：上一轮新增「树液产物」时漏了 4 张贴图，
// 而这里当时写的是 console.log 而不是 log，于是缺陷一路滑到了线上（见第三十轮）。
// 兜底图标本身是设计内（R65），所以判据不是「必须有图」，而是「缺图必须都在已知清单里」。
// 只统计「以贴图方式呈现」的模块：注册表用 spriteFor 显式声明前缀的才算
// （npc 为 "npc-"，物品类为空串）；没声明 spriteFor 的模块用 emoji 呈现，不计缺口。
// 注意判据是 hasOwnProperty 而非真值——空串前缀是合法值却 falsy。
const haveImgs = fs.existsSync(path.join(root, "img"))
  ? fs.readdirSync(path.join(root, "img")).filter((f) => f.endsWith(".png")).map((f) => f.replace(".png", ""))
  : [];
const imgIds = [];
const emojiOnly = [];
for (const [countId, label, arr] of groups) {
  const sec = secOf(String(countId).replace(/Count$/, ""));
  if (sec && Object.prototype.hasOwnProperty.call(sec, "spriteFor")) {
    for (const it of arr) imgIds.push(sec.spriteFor + it.id);
  } else {
    /* 任务/节日/事件在 UI 上用 emoji 呈现，本就没有贴图，不计入覆盖率分母 */
    emojiOnly.push(label + " " + arr.length);
  }
}
const noImg = imgIds.filter((i) => !haveImgs.includes(i));
/* 已知缺图（各有理由，Wiki 上没有可用的 48x48 素材），除此之外一律判失败。
 * 注意白名单是「数据」：有理由才能进，理由消失就要出（下面第二条断言守着它）。 */
const KNOWN_NO_IMG = { "gold-slime": "Wiki 无独立贴图", "dusty": "只有 220x349 的带相框立绘" };
const untracked = noImg.filter((id) => !KNOWN_NO_IMG[id]);
log(untracked.length === 0,
  "无表外缺图（" + (imgIds.length - noImg.length) + "/" + imgIds.length + "，缺失 " + noImg.length + " 个均有登记）" +
  (untracked.length ? "：新增缺图 " + untracked.join(",") : ""));
/* 白名单防腐化：某个 id 已经配上图了，说明这条登记过期，该删（R31 可解释归零） */
const staleKnown = Object.keys(KNOWN_NO_IMG).filter((id) => !noImg.includes(id));
log(staleKnown.length === 0,
  "缺图白名单无过期项" + (staleKnown.length ? "：" + staleKnown.join(",") + " 已能配上图，请从 KNOWN_NO_IMG 移除" : ""));
console.log(`[INFO] 贴图模块 ${groups.length - emojiOnly.length} 个；emoji 呈现模块 ${emojiOnly.length} 个（${emojiOnly.join(" / ")}），不计入覆盖率`);

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
    /* 注册表可用 countText 自定义计数文案（如收集包显示「已完成 N / 总数」），
     * 其余模块仍必须是「条数」——计数写错的 bug 就是靠这条断言拦住的。 */
    const sec = secOf(String(countId).replace(/Count$/, ""));
    const want = sec && typeof sec.countText === "function" ? sec.countText() : String(arr.length);
    log(String(val) === String(want), countId + " = " + val + "（" + label + " " + arr.length + " 条）");
  }
  for (const m of modIds) log(registry.has("#module-" + m), "模块 section #module-" + m + " 已创建");
  log(!registry.get("#module-" + modIds[0]).hidden, "默认模块（" + modIds[0] + "）已显示");

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

  /* 详情弹窗：每个注册模块都要能生成内容，且对不存在的 id 安全返回 null */
  const missingRenderer = modIds.filter((m) => typeof data.DETAIL_RENDERERS[m] !== "function");
  log(missingRenderer.length === 0,
    modIds.length + " 个模块均有详情渲染器" + (missingRenderer.length ? ": 缺失 " + missingRenderer.join(",") : ""));

  const detailFails = [];
  for (const m of modIds) {
    const first = (arrays[m] || [])[0];
    let html = null;
    try { html = first ? data.DETAIL_RENDERERS[m](first.id) : null; } catch (e) { html = null; }
    if (!html || String(html).length < 40) detailFails.push(m);
  }
  log(detailFails.length === 0,
    modIds.length + " 个模块详情弹窗均可生成内容" + (detailFails.length ? ": " + detailFails.join(",") : ""));

  /* 全量渲染器逐条跑一遍，任何一条抛错都说明有数据没被渲染逻辑接住 */
  const renderErrors = [];
  for (const m of modIds) {
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
  for (const m of modIds) {
    try { if (data.DETAIL_RENDERERS[m]("__not_exist__") !== null) notNullSafe.push(m); }
    catch (e) { notNullSafe.push(m); }
  }
  log(notNullSafe.length === 0, "不存在的 id 安全返回 null" + (notNullSafe.length ? ": " + notNullSafe.join(",") : ""));

  /* 「当前显示 N 条」元素必须齐备，否则筛选后用户看不到结果数量变化 */
  const shownMissing = modIds.filter((m) => !registry.has("#shown-" + m));
  log(shownMissing.length === 0,
    modIds.length + " 个模块均有「当前显示」计数元素" + (shownMissing.length ? ": " + shownMissing.join(",") : ""));

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

  /* 怪物掉落物的落点守恒（第二十九轮补）：
   * 此前**没有任何断言**看这件事，于是掉落物名里混着的**非官方译名**
   * （史莱姆黏液 / 骨头 / 暗黑剑 / 巨型炸弹 / 稻芽 / 日光精华 / 齐氏宝石 / 白色藻类，
   * 它们在中文 Wiki 上根本没有页面）长期无人发现——16 种掉落物没有落点。
   * 改名后有 9 种仍是真缺口，登记如下（R31 口径：可跳转 + 已知缺口 == 全部）。 */
  const MONSTER_DROP_GAPS = [
    "太阳精华", "虚空精华", "虫肉", "蝙蝠翅膀", "齐钻", "龙牙",   // 打造材料的同批缺口
    "白藻", "蟹壳", "鱿鱼墨汁",                                   // 尚未被任何模块收录
  ];
  {
    const dropSet = new Set();
    for (const m of data.MODULES.length ? data.MODULE_DATA.MONSTERS : []) for (const d of (m.drops || [])) dropSet.add(d);
    const dropMiss = [...dropSet].filter((d) => !data.NAME_INDEX.has(d)).sort();
    const dropUntracked = dropMiss.filter((d) => MONSTER_DROP_GAPS.indexOf(d) < 0);
    log(dropUntracked.length === 0,
      "怪物掉落物无表外缺口（" + (dropSet.size - dropMiss.length) + " 可跳转 / " + dropMiss.length + " 在缺口表内）" +
      (dropUntracked.length ? "：新增 " + dropUntracked.join(",") : ""));
    const dropStale = MONSTER_DROP_GAPS.filter((d) => dropMiss.indexOf(d) < 0);
    log(dropStale.length === 0,
      "怪物掉落物缺口表无过期项（" + MONSTER_DROP_GAPS.length + " 项）" +
      (dropStale.length ? "：已可跳转却仍在表内 " + dropStale.join(",") : ""));
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

  /* ---------- 6. 收集包（进度勾选 + localStorage） ---------- */
  console.log("\n=== 6. 收集包（进度勾选 + localStorage） ===");

  const B = data.BUNDLES;
  console.log("[INFO] 收集包 " + B.length + " 个 / 房间 " + data.BUNDLE_ROOMS.length +
    " 个 / 需求项 " + B.reduce((n, b) => n + (b.items || []).length, 0) + " 项");

  /* 6.1 数据完整性 */
  const bIds = B.map((b) => b.id);
  const bDup = bIds.filter((v, i) => bIds.indexOf(v) !== i);
  log(bDup.length === 0, "收集包 id 无重复" + (bDup.length ? ": " + bDup.join(",") : ""));

  const badRoom = B.filter((b) => !data.BUNDLE_ROOMS.some((r) => r.name === b.room)).map((b) => b.id);
  log(badRoom.length === 0, "每个收集包的房间都能对上房间表" + (badRoom.length ? ": " + badRoom.join(",") : ""));

  /* 需要的格数不能超过可选物品数——否则玩家永远填不满（数据侧的「不可能完成」） */
  const badSlots = B.filter((b) => data.bundleNeeded(b) > data.bundleSlotCount(b)).map((b) => b.id);
  log(badSlots.length === 0, "所需格数不超过可选物品数" + (badSlots.length ? ": " + badSlots.join(",") : ""));

  /* 全交包必须「需交格数 = 可选物品数」；任选包必须严格小于（否则 choose 字段没意义） */
  const badForm = B.filter((b) => {
    if (b.price) return false;
    const n = data.bundleNeeded(b), t = data.bundleSlotCount(b);
    return b.choose > 0 ? !(n < t || b.choose === t) : n !== t;
  }).map((b) => b.id);
  log(badForm.length === 0, "全交/任选包的形态自洽（任选 " + B.filter((b) => b.choose > 0).length +
    " 个 / 全交 " + B.filter((b) => !b.price && !b.choose).length + " 个）" +
    (badForm.length ? ": " + badForm.join(",") : ""));

  const badItem = [];
  for (const b of B) {
    if (b.price) { if (!(b.price > 0)) badItem.push(b.id + "(金额)"); continue; }
    for (const it of (b.items || [])) {
      const names = data.bundleItemNames(it);
      if (!names.length || names.some((n) => !n)) badItem.push(b.id + "(空名)");
      if (!(it.qty >= 1)) badItem.push(b.id + "/" + names[0] + "(数量)");
    }
  }
  log(badItem.length === 0, "全部收集包需求项字段齐全" + (badItem.length ? ": " + badItem.slice(0, 6).join(",") : ""));

  /* 6.2 需求物品的跳转落点。
   * 规则（对应 R31「可解释归零」）：每个需求物品要么能在站内找到条目/同源贴图，
   * 要么必须落在这张**已知缺口表**里并写明理由；出现表外的新悬空引用即失败。 */
  /* 第二十二轮加「动物制品」模块后，兔子的脚 / 动物毛 / 史莱姆泥 / 大壶牛奶 /
   * 大瓶羊奶 / 大鸡蛋 / 鸭毛 / 鸭蛋 共 8 项已可跳转并从本表移除（R31 的收缩）。 */
  /* 第二十七轮：BUNDLE_ITEM_INDEX 补上"查别名"这一遍后，
   * 杏子 / 桃子 / 樱桃 / 橙子 / 石榴 / 苹果 共 6 项由别名命中（果树模块），从本表移除。
   * 它们此前是**假缺口**：站内早有落点，却因索引不查别名而被当成悬空引用。 */
  /* 第二十八轮：松焦油 / 枫糖浆 / 橡树树脂 补进「工匠制品」后由本表移除
   * （它们由树液采集器插在对应树上产出，此前站内没有任何条目）。 */
  const BUNDLE_ITEM_GAPS = {
    "太阳精华": "待建：后续模块",
    "干草": "待建：后续模块",
    "果酱": "待建：后续模块",
    "棕色大鸡蛋": "待建：后续模块",
    "虚空精华": "待建：后续模块",
    "蝙蝠翅膀": "待建：后续模块",
  };
  const dangling = new Set();
  for (const b of B) for (const it of (b.items || [])) for (const n of data.bundleItemNames(it)) {
    if (!data.BUNDLE_ITEM_INDEX.has(n)) dangling.add(n);
  }
  const untracked = [...dangling].filter((n) => !BUNDLE_ITEM_GAPS[n]);
  log(untracked.length === 0,
    "无表外悬空引用（" + (data.BUNDLE_ITEM_INDEX.size) + " 个已建索引，" + dangling.size + " 个在已知缺口表内）" +
    (untracked.length ? "：新增悬空 " + untracked.slice(0, 8).join(",") : ""));
  const staleGaps = Object.keys(BUNDLE_ITEM_GAPS).filter((n) => !dangling.has(n));
  log(staleGaps.length === 0,
    "已知缺口表无过期项（缺口表 " + Object.keys(BUNDLE_ITEM_GAPS).length + " 项）" +
    (staleGaps.length ? "：已可跳转却仍在表内 " + staleGaps.slice(0, 6).join(",") : ""));

  /* 索引口径一致（第二十七轮补）：BUNDLE_ITEM_INDEX 与 NAME_INDEX 面向的是同一批"物品名"，
   * 只要模块条目（正式名 + 别名）在 NAME_INDEX 里能命中，BUNDLE_ITEM_INDEX 也必须能命中。
   * 这条断言直接守住本轮修掉的 bug：BUNDLE_ITEM_INDEX 少查了一遍别名，
   * 于是「苹果」「桃子」等**以别名为准**的名字在收集包里成了假缺口——
   * 缺口表挂着、界面渲染成不可点的灰 chip，而站内其实早有落点。 */
  const idxMismatch = [];
  for (const sec of data.REGISTRY) {
    for (const it of sec.data) {
      for (const n of [it.name].concat(it.aka || [])) {
        if (data.NAME_INDEX.has(n) && !data.BUNDLE_ITEM_INDEX.has(n)) idxMismatch.push(sec.id + "/" + n);
      }
    }
  }
  log(idxMismatch.length === 0,
    "BUNDLE_ITEM_INDEX 与 NAME_INDEX 口径一致（含别名）" +
    (idxMismatch.length ? "：查不到 " + idxMismatch.slice(0, 6).join(",") : "（" + data.BUNDLE_ITEM_INDEX.size + " 项）"));

  /* 反向索引：有需求就必有「用于收集包」，两表必须互洽 */
  const noReverse = [];
  for (const b of B) for (const it of (b.items || [])) for (const n of data.bundleItemNames(it)) {
    if (!(data.BUNDLE_USES.get(n) || []).some((x) => x.id === b.id)) noReverse.push(b.id + "/" + n);
  }
  log(noReverse.length === 0, "反向索引（物品 → 收集包）覆盖全部需求项" + (noReverse.length ? ": " + noReverse.slice(0, 6).join(",") : ""));

  /* 6.3 进度读写：勾选 → 落盘 → 读回 → 完成判定 */
  store.clear();
  const spring = B.find((b) => b.id === "spring-foraging-bundle") || B.find((b) => !b.price && !b.choose);
  if (spring) {
    const slots = data.bundleNeeded(spring);
    log(data.bundleFilled(spring) === 0, "初始进度为 0（" + spring.name + "）");
    log(data.toggleBundleSlot(spring, 0) === true, "勾选第 1 格返回「已变更」");
    log(data.bundleFilled(spring) === 1, "勾选后已填格数 = 1（实际 " + data.bundleFilled(spring) + "）");
    log(JSON.stringify(data.bundleProgress(spring)) === "[0]",
      "进度数组无重复项（" + JSON.stringify(data.bundleProgress(spring)) + "）");
    log(JSON.stringify(data.bundleProgress(spring.id)) === "[0]",
      "bundleProgress 同时接受 id 与包对象（防止传错类型时静默返回空数组）");

    /* 同名函数是「切换」语义：再调一次应取消勾选，且同一格不会被算成两格 */
    log(data.toggleBundleSlot(spring, 0) === true && data.bundleFilled(spring) === 0,
      "再次调用同一格为取消勾选（filled=" + data.bundleFilled(spring) + "）");
    data.toggleBundleSlot(spring, 0);   /* 复位：重新勾上 */

    const raw = store.get("xlg.bundleProgress.v1");
    log(!!raw && JSON.parse(raw)[spring.id].length === 1, "进度已写入 localStorage 且只含 1 格");

    for (let i = 1; i < slots; i++) data.toggleBundleSlot(spring, i);
    log(data.isBundleDone(spring), "填满 " + slots + " 格后判定为已完成");
    log(data.toggleBundleSlot(spring, slots + 5) === false, "越界槽位被安全拒绝");
    log(data.bundleFilled(spring) === slots, "越界操作没有污染进度");

    /* 已完成的包仍允许撤销（游戏里提交后可以取回物品），但不能因为撤销以外的操作而变动 */
    log(data.toggleBundleSlot(spring, 0, false) === true && data.bundleFilled(spring) === slots - 1,
      "已完成的收集包可撤销单格（" + slots + " → " + data.bundleFilled(spring) + "）");
    log(!data.isBundleDone(spring), "撤销一格后不再判定为已完成");
    data.toggleBundleSlot(spring, 0);
  } else {
    log(false, "未找到可用于进度测试的收集包");
  }

  /* 6.4 「任选 N 个」：提交够 choose 格即完成，不必全交 */
  const chooseBundle = B.find((b) => b.choose > 0 && (b.items || []).length > b.choose);
  console.log("[INFO] 任选型收集包 " + B.filter((b) => b.choose > 0).length + " 个，用例取「" +
    (chooseBundle ? chooseBundle.name + "」（" + chooseBundle.choose + " / " + chooseBundle.items.length + "）" : "无") + "」");
  if (chooseBundle) {
    store.clear();
    for (let i = 0; i < chooseBundle.choose; i++) data.toggleBundleSlot(chooseBundle, i);
    log(data.isBundleDone(chooseBundle),
      "任选包「" + chooseBundle.name + "」交满 " + chooseBundle.choose + " 格即完成（共 " +
      (chooseBundle.items || []).length + " 种）");
    log(data.bundleFilled(chooseBundle) === chooseBundle.choose,
      "任选包只计已提交的格数（" + data.bundleFilled(chooseBundle) + " / " + chooseBundle.choose + "）");
    log(data.toggleBundleSlot(chooseBundle, chooseBundle.choose) === true,
      "任选包在已完成后仍可追加提交第 " + (chooseBundle.choose + 1) + " 格");
  } else {
    log(false, "未找到「物品数多于槽位」的任选型收集包");
  }

  /* 6.5 头部计数文案随进度变化 */
  store.clear();
  log(String(data.doneBundleCount()) === "0", "清空后已完成收集包数 = 0");
  if (spring) {
    for (let i = 0; i < data.bundleNeeded(spring); i++) data.toggleBundleSlot(spring, i);
    log(data.doneBundleCount() === 1, "完成 1 个包后计数 = 1（实际 " + data.doneBundleCount() + "）");
  }
  store.clear();
  log(data.doneBundleCount() === 0, "清空进度后计数归零（可重复清空）");

  /* 6.6 金额包：无需求物品、必须有价格，且不该被判成「未完成即缺物品」 */
  const vault = B.filter((b) => b.room === "金库");
  log(vault.length === 4 && vault.every((b) => b.price > 0 && !(b.items || []).length),
    "金库 4 个金额包均带价格且无物品需求（" + vault.map((b) => b.price).join("/") + "）");

  /* 6.7 点击收集包卡片 → 打开该包详情（走真实的页面委托处理器） */
  const pageHandlers = (registry.get("#page") || {}).listeners.click || [];
  const bcard = B[0];
  const bSec = { dataset: { module: "bundles" }, hidden: true };
  const bCardEl = {
    dataset: { id: bcard.id },
    classList: { contains: () => true },
    closest: (sel) => (sel === "[data-id]" ? bCardEl : (sel === ".module" ? bSec : null)),
  };
  registry.get("#modal").hidden = true;
  pageHandlers[0]({ target: { closest: (sel) => (sel === "[data-id]" ? bCardEl : (sel === "[data-bundle]" ? null : null)) } });
  const bHtml = String(registry.get("#modalContent").innerHTML);
  log(registry.get("#modal").hidden === false && bHtml.includes(bcard.name),
    "点击收集包卡片打开详情（" + bcard.name + "）");
  log(bHtml.includes("所需物品") || bHtml.includes("完成方式"), "收集包详情含所需物品/完成方式分区");
  log(bHtml.includes("奖励"), "收集包详情含奖励分区");

  /* 6.8 详情里的「用于收集包」反向区块：找一个确属某包的物品，验证反查得到 */
  const revName = [...data.BUNDLE_USES.keys()].find((n) => data.BUNDLE_ITEM_INDEX.has(n));
  if (revName) {
    const hit = data.BUNDLE_ITEM_INDEX.get(revName);
    const html = data.DETAIL_RENDERERS[hit.module](hit.id);
    log(String(html).includes("用于收集包"),
      "物品详情含「用于收集包」区块（" + hit.module + "/" + hit.id + " → " + revName + "）");
  } else {
    log(false, "找不到可用于验证反向区块的物品");
  }
  registry.get("#modal").hidden = true;

  /* 6.9 勾选框的点击必须走真实处理器：既改 localStorage，又不该顺手弹出详情。
   * （勾选按钮在卡片内部，若不拦截就会同时触发卡片点击 → 详情弹窗） */
  store.clear();
  const boxBundle = B.find((b) => !b.price && !b.choose) || B.find((b) => !b.price);
  if (boxBundle && pageHandlers.length) {
    registry.get("#modal").hidden = true;
    let stopped = false;
    const box = {
      dataset: { bundle: boxBundle.id, slot: "0" },
      closest: (sel) => (sel === "[data-bundle]" ? box : null),
    };
    pageHandlers[0]({
      target: { closest: (sel) => (sel === "[data-bundle]" ? box : null) },
      stopPropagation: () => { stopped = true; },
    });
    log(data.bundleFilled(boxBundle) === 1,
      "点击勾选框后该包已填格数 = 1（实际 " + data.bundleFilled(boxBundle) + "）");
    log(!!store.get("xlg.bundleProgress.v1"), "点击勾选框写入了 localStorage");
    log(stopped, "勾选时阻止了事件冒泡（不会连带打开详情弹窗）");
    log(registry.get("#modal").hidden === true, "勾选操作未打开详情弹窗");

    /* 再点一次取消 */
    pageHandlers[0]({ target: { closest: (sel) => (sel === "[data-bundle]" ? box : null) }, stopPropagation: () => {} });
    const afterUn = data.bundleFilled(boxBundle);
    const progUn = JSON.stringify(data.bundleProgress(boxBundle));
    const rawUn = store.get("xlg.bundleProgress.v1");
    const mockUn = localStorage.getItem("xlg.bundleProgress.v1");
    const readUn = JSON.stringify(data.readBundleProgress());
    log(afterUn === 0 && progUn === "[]",
      "再次点击同一格即取消勾选（filled=" + afterUn + " prog=" + progUn +
      " store=" + rawUn + " mock=" + mockUn + " read=" + readUn + "）");
  } else {
    log(false, "未找到可用于勾选交互测试的收集包");
  }
  store.clear();
  registry.get("#modal").hidden = true;

  /* ---------- 7. 深链接与状态记忆 ---------- */
  console.log("\n=== 7. 深链接与状态记忆 ===");

  /* 7.1 解析：合法 / 非法 / 越界 三种情况都要安全 */
  const pt = [
    ["#fishing/legend", "fishing", "legend"],
    ["fishing/legend", "fishing", "legend"],
    ["#bundles", "bundles", null],
    ["", null, null],
    ["#", null, null],
    ["#not-a-module/legend", null, null],
    ["#fishing/__not_exist__", "fishing", null],
    ["#fishing/", "fishing", null],
  ];
  const parseFails = [];
  for (const [h, m, it] of pt) {
    const r = data.parseHash(h);
    if (r.module !== m || r.item !== it) parseFails.push(JSON.stringify(h) + "→" + r.module + "/" + r.item);
  }
  log(parseFails.length === 0,
    "hash 解析（含非法/越界降级）" + (parseFails.length ? "：不符 " + parseFails.join("; ") : " 8 例"));

  /* 7.2 生成与写回：写 hash 必须带上条目，且不重复写 */
  log(data.hashFor("fishing", "legend") === "#fishing/legend" &&
      data.hashFor("bundles", null) === "#bundles",
    "hash 生成格式正确");

  /* 7.2b 写历史的粒度：模块切换 replace、打开条目 push（R41）。
   * 粒度写错的表现是「后退一次回不到上一个有意义的位置」。 */
  historyCalls.length = 0;
  location.hash = "";
  data.setRouteHash("mining", null);
  data.setRouteHash("mining", "diamond", "push");
  const modes = historyCalls.map((c) => c.mode).join(",");
  log(modes === "replace,push", "模块切换用 replace、打开条目用 push（实际 " + modes + "）");

  location.hash = "";
  data.setRouteHash("fishing", "legend");
  log(location.hash === "#fishing/legend", "setRouteHash 写入了 location.hash（" + location.hash + "）");
  location.hash = "#fishing/legend";
  data.setRouteHash("fishing", "legend");
  log(location.hash === "#fishing/legend", "重复写同一 hash 不出错");

  /* 7.3 直接打开分享链接能落地 */
  location.hash = "#fishing/legend";
  registry.get("#modal").hidden = true;
  const okRestore = data.restoreRoute();
  const mHtml = String(registry.get("#modalContent").innerHTML);
  log(okRestore && data.currentModuleId() === "fishing",
    "打开 #fishing/legend 后当前模块为 fishing（实际 " + data.currentModuleId() + "）");
  log(registry.get("#modal").hidden === false && mHtml.includes("传说之鱼"),
    "打开 #fishing/legend 后直接展开该条目详情");

  /* 7.4 非法链接不能让页面崩，也不该误开弹窗（R2 空值安全） */
  location.hash = "#not-a-module/whatever";
  registry.get("#modal").hidden = true;
  let crash = false;
  try { data.restoreRoute(); } catch (e) { crash = true; }
  log(!crash, "非法 hash 不抛异常");
  location.hash = "#fishing/__not_exist__";
  data.restoreRoute();
  log(registry.get("#modal").hidden === true, "条目不存在时只切模块、不误开弹窗");

  /* 7.5 状态记忆：上次访问的模块写入 localStorage，下次优先落地 */
  store.clear();
  data.gotoItem("bundles", null);
  log(store.get(data.LAST_MODULE_KEY) === "bundles",
    "切换模块写入上次访问记录（" + store.get(data.LAST_MODULE_KEY) + "）");
  location.hash = "";
  log(data.defaultModuleId() === "bundles", "无 hash 时按上次访问落地（" + data.defaultModuleId() + "）");
  location.hash = "#mining";
  log(data.defaultModuleId() === "mining", "有 hash 时 URL 优先于上次访问");

  /* 7.6 浏览器前进/后退：hashchange 要重新落地，非法值安全忽略 */
  const hashHandlers = winListeners.hashchange || [];
  log(hashHandlers.length > 0, "已注册 hashchange 处理器");
  if (hashHandlers.length) {
    registry.get("#modal").hidden = true;
    location.hash = "#npc/abigail";
    hashHandlers[0]({});
    log(data.currentModuleId() === "npc" && registry.get("#modal").hidden === false,
      "hashchange 后切到 npc 并打开条目详情");
    location.hash = "#not-a-module";
    let crash2 = false;
    try { hashHandlers[0]({}); } catch (e) { crash2 = true; }
    log(!crash2 && data.currentModuleId() === "npc", "hashchange 收到非法模块时保持原状");
    location.hash = "#npc";
    hashHandlers[0]({});
    log(registry.get("#modal").hidden === true, "回到模块级 hash 时关闭详情弹窗");
  }

  /* 7.7 搜索回车直达第一条结果 */
  const searchInput = registry.get("#globalSearch");
  const enterHandlers = (searchInput.listeners.keydown || []);
  log(enterHandlers.length > 0, "搜索框已注册 keydown 处理器");
  if (enterHandlers.length) {
    location.hash = "";
    registry.get("#modal").hidden = true;
    searchInput.value = "传说之鱼";
    enterHandlers[0]({ key: "Enter", preventDefault: () => {} });
    log(data.currentModuleId() === "fishing" && location.hash === "#fishing/legend",
      "搜索后回车直达第一条结果（" + location.hash + "）");
    log(searchInput.value === "", "回车跳转后清空搜索框");
  }

  /* ---------- 8. 反向索引（礼物 ↔ 物品 ↔ 收集包） ---------- */
  console.log("\n=== 8. 反向索引与搜索扩展 ===");

  /* 8.1 礼物反向索引必须覆盖全部「真实礼物名」（占位说明不算物品） */
  const NPC_DATA = data.MODULE_DATA.NPCS;
  const PLACEHOLDERS = ["不可送礼", "（无礼物）"];
  const giftNames = new Set();
  for (const n of NPC_DATA) for (const g of (n.loves || [])) if (PLACEHOLDERS.indexOf(g) < 0) giftNames.add(g);
  const giftMissing = [...giftNames].filter((g) => !data.GIFT_USES.has(g));
  log(giftMissing.length === 0,
    "礼物反向索引覆盖全部 " + giftNames.size + " 个真实礼物名" +
    (giftMissing.length ? "：缺 " + giftMissing.slice(0, 6).join(",") : ""));

  /* 反向索引与 NPC 数据必须互洽（索引里有的，NPC 必须真的喜欢） */
  const giftInconsist = [];
  for (const [g, list] of data.GIFT_USES) {
    for (const n of list) if ((n.loves || []).indexOf(g) < 0) giftInconsist.push(g + "→" + n.name);
  }
  log(giftInconsist.length === 0, "反向索引与 NPC 礼物数据一致" +
    (giftInconsist.length ? "：不符 " + giftInconsist.slice(0, 4).join(",") : ""));

  /* 8.2 能对上条目的礼物，chip 必须真的可点 */
  const clickableGifts = [...giftNames].filter((g) => data.NAME_INDEX.has(g));
  const badChip = clickableGifts.filter((g) => {
    const html = data.giftChip(g);
    return !html.includes("data-goto-id") || !html.includes("chip-link");
  });
  log(badChip.length === 0,
    clickableGifts.length + " 个可跳转礼物都渲染成链接" +
    (badChip.length ? "：未成链接 " + badChip.slice(0, 5).join(",") : ""));

  const placeChip = data.giftChip("不可送礼");
  log(placeChip.includes("chip-plain") && !placeChip.includes("data-goto-id"),
    "占位说明（不可送礼）渲染为不可点的弱化 chip");

  /* 8.3 礼物落点的「已知缺口表」：全部必须来自尚未收录的模块，且表不能过期。
   * 收录「料理」模块后，其中的菜肴（沙拉/披萨/粉红蛋糕…）已可跳转，从表中移除。 */
  const GIFT_GAPS = [
    "仙子玫瑰", "冷冻泪", "可乐", "墨鱼", "夏季紫丁香", "太阳精华", "宝石",
    "油炸鱿鱼", "泡菜", "海洋料理", "炖豆", "电池", "秋季蔬菜",
    "罂粟", "羊奶酪", "羊毛", "葡萄酒", "蓝莓派", "蕨菜炖饭", "虚空精华",
    "辣鳗鱼",
  ];
  const giftGapActual = [...giftNames].filter((g) => !data.NAME_INDEX.has(g));
  const giftUntracked = giftGapActual.filter((g) => GIFT_GAPS.indexOf(g) < 0);
  log(giftUntracked.length === 0,
    "礼物落点无表外缺口（" + clickableGifts.length + " 可跳转 / " + giftGapActual.length + " 在已知缺口表内）" +
    (giftUntracked.length ? "：新增 " + giftUntracked.join(",") : ""));
  const giftStale = GIFT_GAPS.filter((g) => giftGapActual.indexOf(g) < 0);
  log(giftStale.length === 0,
    "礼物缺口表无过期项（" + GIFT_GAPS.length + " 项）" +
    (giftStale.length ? "：已可跳转却仍在表内 " + giftStale.slice(0, 6).join(",") : ""));

  /* 8.4 物品详情页要能反查「送给谁」 */
  const giftItem = (() => {
    for (const sec of data.REGISTRY) {
      /* 找「本身不是 NPC、但出现在某个村民的最爱清单里」的条目 */
      if (sec.id === "npc") continue;
      for (const it of sec.data) if (data.GIFT_USES.has(it.name)) return { sec, it };
    }
    return null;
  })();
  if (giftItem) {
    const html = String(data.DETAIL_RENDERERS[giftItem.sec.id](giftItem.it.id));
    log(html.includes("送礼对象") && html.includes('data-goto-module="npc"'),
      "物品详情含「送礼对象」反查区块（" + giftItem.sec.id + "/" + giftItem.it.id +
      " → " + giftItem.it.name + "）");
    log(html.includes("用于收集包") || !data.BUNDLE_USES.has(giftItem.it.name),
      "同一详情页可同时容纳「送礼对象」与「用于收集包」两节");
  } else {
    log(false, "找不到可验证「送礼对象」区块的物品");
  }

  /* 8.5 卡片上的礼物 chip 必须优先于整卡点击：
   * 否则点「紫水晶」会打开阿比盖尔自己，而不是紫水晶条目 */
  const pageClick = (registry.get("#page").listeners.click || [])[0];
  if (pageClick) {
    const giftName = "紫水晶";
    const target = data.NAME_INDEX.get(giftName);
    const chipEl = {
      dataset: { gotoModule: target.module, gotoId: target.id },
      closest: (sel) => (sel === "[data-goto-id]" ? chipEl : null),
    };
    registry.get("#modal").hidden = true;
    location.hash = "";
    pageClick({ target: { closest: (sel) => (sel === "[data-goto-id]" ? chipEl : null) }, stopPropagation: () => {} });
    const chipHtml = String(registry.get("#modalContent").innerHTML);
    log(registry.get("#modal").hidden === false && chipHtml.includes(giftName),
      "点卡片上的礼物 chip 打开的是礼物本身（" + giftName + "）");
    log(location.hash === data.hashFor(target.module, target.id),
      "点礼物 chip 同步了 URL（" + location.hash + "）");
  } else {
    log(false, "未找到页面点击委托处理器");
  }

  /* 8.6 搜索可「按用途/关系」找东西：礼物名要能搜到喜欢它的 NPC */
  const idxAll = data.buildIndex();
  const npcHits = idxAll.filter((e) => e.module === "npc" && e.kw.includes("紫水晶"));
  log(npcHits.length > 0, "搜索索引含礼物名（搜「紫水晶」命中 " + npcHits.length + " 位村民）");
  const bundleHits = idxAll.filter((e) => e.module === "bundles" && e.kw.includes("收集包"));
  log(bundleHits.length > 0, "搜索索引含收集包关键词（命中 " + bundleHits.length + " 条）");

  /* ---------- 9. 打造（配方 ↔ 材料） ---------- */
  console.log("\n=== 9. 打造（配方 ↔ 材料） ===");

  const CR = data.MODULE_DATA.CRAFTING;
  const craftIds = CR.map((r) => r.id);
  const craftDup = [...new Set(craftIds.filter((v, i) => craftIds.indexOf(v) !== i))];
  log(craftDup.length === 0, "打造 id 无重复（" + CR.length + " 条）" + (craftDup.length ? "：" + craftDup.join(",") : ""));

  /* id 必须与既有模块全局唯一——否则深链接 #crafting/x 与 #mining/x 会撞车 */
  const globalOwner = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) {
    if (!globalOwner.has(it.id)) globalOwner.set(it.id, sec.id);
  }
  const crossDup = CR.filter((r) => globalOwner.get(r.id) !== "crafting").map((r) => r.id + "(属" + globalOwner.get(r.id) + ")");
  log(crossDup.length === 0, "打造 id 与其它模块无冲突" + (crossDup.length ? "：" + crossDup.join(",") : ""));

  const badCraft = [];
  for (const r of CR) {
    if (!r.name) badCraft.push(r.id + "(无名称)");
    if (!r.cat) badCraft.push(r.id + "(无分类)");
    if (!(r.ingredients || []).length) badCraft.push(r.id + "(无材料)");
    if (!r.source) badCraft.push(r.id + "(无来源)");
  }
  log(badCraft.length === 0, "打造字段齐全（名称/分类/材料/来源）" + (badCraft.length ? "：" + badCraft.slice(0, 8).join(",") : ""));

  /* 筛选入口覆盖：数据里出现过的分类必须有对应按钮（沿用 R17 的口径） */
  const craftCats = [...new Set(CR.map((r) => r.cat))];
  const missCat = craftCats.filter((c) => data.CRAFT_CATS.indexOf(c) < 0);
  log(missCat.length === 0, "打造筛选覆盖全部 " + craftCats.length + " 个分类" + (missCat.length ? "：缺 " + missCat.join(",") : ""));

  /* 材料落点：可跳转 + 已知缺口必须守恒。
   * 第十四轮加「种子」模块后，本表自动收了 7 项（夏季亮片种子/松果/枫树种子/橡子/
   * 蓝爵士种子/虞美人种子/郁金香球茎）——这正是这套「可解释归零」机制的设计意图：
   * 模块补齐后表会自己变小，过期项没删则会直接失败（R31）。 */
  /* 第二十八轮：松焦油 / 枫糖浆 / 树液 / 橡树树脂 补进「工匠制品」后由本表移除。 */
  const CR_GAPS = [
    "太阳精华",
    "河凝胶", "洞穴凝胶", "海凝胶", "虚空精华",
    "虫肉", "蝙蝠翅膀", "鱼", "鱼饵（物品）|鱼饵", "齐钻", "龙牙",
  ];
  const craftMats = new Set(CR.flatMap((r) => (r.ingredients || []).map((i) => i.name)));
  const matHit = [...craftMats].filter((n) => data.NAME_INDEX.has(n));
  const matGap = [...craftMats].filter((n) => !data.NAME_INDEX.has(n)).sort();
  const matUntracked = matGap.filter((n) => CR_GAPS.indexOf(n) < 0);
  log(matUntracked.length === 0,
    "打造材料无表外缺口（" + matHit.length + " 可跳转 / " + matGap.length + " 在缺口表内）" +
    (matUntracked.length ? "：新增 " + matUntracked.join(",") : ""));
  const matStale = CR_GAPS.filter((n) => matGap.indexOf(n) < 0);
  log(matStale.length === 0, "打造材料缺口表无过期项（" + CR_GAPS.length + " 项）" +
    (matStale.length ? "：已可跳转却仍在表内 " + matStale.join(",") : ""));

  /* 反向索引：每个材料都要能在「用于打造」里查到这张配方。
   * 这条断言能抓到一类真 bug：把索引写成「配方 → 材料」而不是「材料 → 配方」，
   * 渲染不报错、界面也照常显示，但反查区块永远是空的。 */
  const cbNoReverse = [];
  for (const r of CR) for (const i of (r.ingredients || [])) {
    if (!(data.CRAFTED_BY.get(i.name) || []).some((x) => x.id === r.id)) cbNoReverse.push(r.id + "/" + i.name);
  }
  log(cbNoReverse.length === 0, "打造反向索引覆盖全部材料引用" + (cbNoReverse.length ? "：" + cbNoReverse.slice(0, 6).join(",") : ""));

  /* 端到端：物品详情页必须真的渲染出「用于打造」 */
  const craftedItem = (() => {
    for (const sec of data.REGISTRY) {
      if (sec.id === "crafting") continue;
      for (const it of sec.data) if ((data.CRAFTED_BY.get(it.name) || []).length) return { sec, it };
    }
    return null;
  })();
  if (craftedItem) {
    const html = String(data.DETAIL_RENDERERS[craftedItem.sec.id](craftedItem.it.id));
    log(html.includes("用于打造") && html.includes('data-goto-module="crafting"'),
      "物品详情含「用于打造」反查区块（" + craftedItem.sec.id + "/" + craftedItem.it.id +
      " → " + craftedItem.it.name + "）");
  } else {
    log(false, "找不到可验证「用于打造」区块的物品");
  }

  /* 打造详情：材料 chip 可点、来源与产出齐全 */
  const cFirst = CR.find((r) => (r.ingredients || []).some((i) => data.NAME_INDEX.has(i.name))) || CR[0];
  const cHtml = String(data.DETAIL_RENDERERS.crafting(cFirst.id));
  log(cHtml.includes("所需材料") && cHtml.includes("配方获取"),
    "打造详情含「所需材料」与「配方获取」分区（" + cFirst.name + "）");
  log(cHtml.includes("data-goto-id"), "打造详情中的材料生成了跳转链接");

  /* ---------- 10. 工匠制品（加工品 ↔ 产出机器） ---------- */
  console.log("\n=== 10. 工匠制品（加工品 ↔ 产出机器） ===");

  const AR = data.MODULE_DATA.ARTISAN;
  const arIds = AR.map((a) => a.id);
  const arDup = [...new Set(arIds.filter((v, i) => arIds.indexOf(v) !== i))];
  log(arDup.length === 0, "工匠制品 id 无重复（" + AR.length + " 条）" + (arDup.length ? "：" + arDup.join(",") : ""));

  /* id 全局唯一（深链接键） */
  const owner2 = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) if (!owner2.has(it.id)) owner2.set(it.id, sec.id);
  const arCross = AR.filter((a) => owner2.get(a.id) !== "artisan").map((a) => a.id + "(属" + owner2.get(a.id) + ")");
  log(arCross.length === 0, "工匠制品 id 与其它模块无冲突" + (arCross.length ? "：" + arCross.join(",") : ""));

  const badAr = [];
  for (const a of AR) {
    if (!a.name) badAr.push(a.id + "(无名称)");
    if (!(a.machines || []).length) badAr.push(a.id + "(无产出机器)");
    /* 无固定售价的必须写明计价规则，否则界面上只有一个「浮动」无从理解 */
    if (!a.sell && !a.priceNote) badAr.push(a.id + "(既无售价也无计价规则)");
  }
  log(badAr.length === 0, "工匠制品字段齐全（名称/机器/售价或计价规则）" + (badAr.length ? "：" + badAr.slice(0, 6).join(",") : ""));

  /* 分组覆盖：数据里出现过的产出机器都必须能筛（沿用 R17 口径） */
  const arMachines = [];
  AR.forEach((a) => (a.machines || []).forEach((m) => { if (arMachines.indexOf(m) < 0) arMachines.push(m); }));
  log(arMachines.length > 0, "工匠制品按 " + arMachines.length + " 类产出机器分组（" + arMachines.join("/") + "）");

  const arHtml = String(data.DETAIL_RENDERERS.artisan(AR[0].id));
  log(arHtml.includes("产出机器") && arHtml.includes("基础售价"),
    "工匠详情含「产出机器」与「基础售价」分区（" + AR[0].name + "）");
  const CRAFT_ALL = data.MODULE_DATA.CRAFTING;
  const linkedMachine = AR.find((a) => (a.machines || []).some((m) => CRAFT_ALL.some((c) => c.name === m)));
  if (linkedMachine) {
    const h = String(data.DETAIL_RENDERERS.artisan(linkedMachine.id));
    log(h.includes('data-goto-module="crafting"'),
      "产出机器可跳转到打造配方（" + linkedMachine.name + " → " +
      (linkedMachine.machines || []).find((m) => CRAFT_ALL.some((c) => c.name === m)) + "）");
  } else {
    log(false, "找不到「产出机器能对上打造配方」的工匠条目");
  }

  /* 树液产物 ↔ 树木的**双向一致**（第二十八轮）：
   * 树木模块写了 tapper（哪棵树出什么），工匠制品就得有对应的条目——
   * 只查一边会让"树上写着产物名、点进去却没有这个物品"这种断链长期存在。
   * 反过来，树液产物条目的 machines 写的必须是**真实存在的树**。 */
  const tapperTrees = (arrays.trees || []).filter((x) => x.tapper);
  const tapperMissing = tapperTrees.filter((x) => !AR.some((a) => a.name === x.tapper)).map((x) => x.name + "→" + x.tapper);
  log(tapperMissing.length === 0,
    "树木声明的树液产物都有工匠制品条目（" + tapperTrees.length + " 棵树：" +
    tapperTrees.map((x) => x.tapper).join("、") + "）" + (tapperMissing.length ? "：缺 " + tapperMissing.join(",") : ""));

  const tapperRows = AR.filter((a) => (a.producedBy || "").indexOf("树液采集器") >= 0);
  const badTapper = [];
  for (const a of tapperRows) {
    if (!(a.machines || []).length) badTapper.push(a.name + "(无机器/树)");
    for (const m of (a.machines || [])) {
      if (!(arrays.trees || []).some((x) => x.name === m)) badTapper.push(a.name + "→" + m + "(不是已知的树)");
    }
  }
  log(tapperRows.length >= 4 && badTapper.length === 0,
    tapperRows.length + " 件树液产物的产出树都可跳转" + (badTapper.length ? "：" + badTapper.join(",") : ""));

  /* 语义不能复用：有固定售价的条目不该带"浮动价"说明。
   * 这条断言守的是"字段被借用"这类问题——priceNote 本来是给果酒那类变价品写的。 */
  const badNote = AR.filter((a) => a.sell != null && a.priceNote).map((a) => a.name);
  log(badNote.length === 0,
    "有固定售价的工匠制品不带浮动价说明" + (badNote.length ? "：" + badNote.join(",") : "（" + AR.filter((a) => a.sell != null).length + " 条固定售价）"));

  /* 变价品必须写明规则（界面不能只显示「浮动」） */
  const varItems = AR.filter((a) => !a.sell);
  log(varItems.length > 0 && varItems.every((a) => a.priceNote && a.priceNote.length >= 4),
    varItems.length + " 个变价品均写明计价规则（如 " + (varItems[0] ? varItems[0].priceNote : "-") + "）");

  /* ---------- 11. 古物与博物馆捐赠 ---------- */
  console.log("\n=== 11. 古物与博物馆捐赠 ===");

  const ARF = data.MODULE_DATA.ARTIFACTS;
  const arfIds = ARF.map((a) => a.id);
  const arfDup = [...new Set(arfIds.filter((v, i) => arfIds.indexOf(v) !== i))];
  log(arfDup.length === 0, "古物 id 无重复（" + ARF.length + " 件）" + (arfDup.length ? "：" + arfDup.join(",") : ""));

  const owner3 = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) if (!owner3.has(it.id)) owner3.set(it.id, sec.id);
  const arfCross = ARF.filter((a) => owner3.get(a.id) !== "artifacts").map((a) => a.id + "(属" + owner3.get(a.id) + ")");
  log(arfCross.length === 0, "古物 id 与其它模块无冲突" + (arfCross.length ? "：" + arfCross.join(",") : ""));

  const badArf = ARF.filter((a) => !a.name || !a.from || !(a.sell >= 0));
  log(badArf.length === 0, "古物字段齐全（名称/获取途径/售价）" + (badArf.length ? "：" + badArf.map((a) => a.id).join(",") : ""));

  /* 博物馆清单 = 古物 + 矿物，且不重复 */
  const mn = data.MUSEUM_NAMES;
  log(mn.length === ARF.length + data.MODULE_DATA.MINERALS.length,
    "博物馆清单 = 古物 " + ARF.length + " + 矿物 " + data.MODULE_DATA.MINERALS.length + " = " + mn.length);
  const mnDup = [...new Set(mn.filter((v, i) => mn.indexOf(v) !== i))];
  log(mnDup.length === 0, "博物馆清单无重名" + (mnDup.length ? "：" + mnDup.join(",") : ""));

  /* 捐赠进度读写：勾选 → 落盘 → 读回 → 计数 */
  store.clear();
  log(data.museumDonatedCount() === 0, "初始捐赠数为 0");
  const firstName = ARF[0].name;
  data.toggleDonate(firstName);
  log(data.isDonated(firstName), "勾选后该古物标记为已捐赠");
  log(data.museumDonatedCount() === 1, "捐赠计数 = 1（实际 " + data.museumDonatedCount() + "）");
  const rawMuseum = store.get("xlg.museum.v1");
  log(!!rawMuseum && JSON.parse(rawMuseum)[firstName] === true, "进度已写入 localStorage");
  data.toggleDonate(firstName);
  log(!data.isDonated(firstName) && data.museumDonatedCount() === 0, "再次调用即取消捐赠");
  store.clear();

  /* 详情弹窗要显示获取途径与捐赠状态 */
  const arfHtml = String(data.DETAIL_RENDERERS.artifacts(ARF[0].id));
  log(arfHtml.includes("获取途径") && (arfHtml.includes("已捐赠") || arfHtml.includes("未捐赠")),
    "古物详情含「获取途径」与捐赠状态（" + ARF[0].name + "）");

  /* 奖励门槛必须单调递增且不超过清单总数（写错会让玩家永远拿不到） */
  const needs = data.MUSEUM_REWARDS.map((r) => r.need);
  const sortedNeeds = needs.slice().sort((a, b) => a - b);
  log(JSON.stringify(needs) === JSON.stringify(sortedNeeds),
    "博物馆奖励门槛递增（" + needs.join(" < ") + "）");
  log(needs[needs.length - 1] <= mn.length,
    "最高奖励门槛 " + needs[needs.length - 1] + " 不超过清单总数 " + mn.length);

  /* ---------- 12. 种子（价格 / 成熟时间 / 结果物） ---------- */
  console.log("\n=== 12. 种子（价格 / 成熟时间 / 结果物） ===");

  const SD = arrays.seeds || [];
  const sdIds = SD.map((s) => s.id);
  const sdDup = [...new Set(sdIds.filter((v, i) => sdIds.indexOf(v) !== i))];
  log(sdDup.length === 0, "种子 id 无重复（" + SD.length + " 条）" + (sdDup.length ? "：" + sdDup.join(",") : ""));

  /* id 全局唯一（深链接键；种子 id 同时是贴图文件名） */
  const ownerS = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) if (!ownerS.has(it.id)) ownerS.set(it.id, sec.id);
  const sdCross = SD.filter((s) => ownerS.get(s.id) !== "seeds").map((s) => s.id + "(属" + ownerS.get(s.id) + ")");
  log(sdCross.length === 0, "种子 id 与其它模块无冲突" + (sdCross.length ? "：" + sdCross.join(",") : ""));

  /* 名称唯一性：反向索引（结果物 → 种子）与搜索都以**名字**为键，
   * 重名会让「由这些种子种出」互相串台，而界面上完全看不出来（R57 的同类） */
  const sdNames = SD.map((s) => s.name);
  const sdNameDup = [...new Set(sdNames.filter((v, i) => sdNames.indexOf(v) !== i))];
  log(sdNameDup.length === 0, "种子名称无重复（名字是反向索引与搜索的键）" + (sdNameDup.length ? "：" + sdNameDup.join(",") : ""));

  /* 字段齐全：成熟时间可以「不定」，但必须写明文字，否则界面上是一片空白 */
  const badSd = [];
  for (const s of SD) {
    if (!s.name) badSd.push(s.id + "(无名称)");
    if (!(s.season || []).length) badSd.push(s.id + "(无季节)");
    if (s.growth == null && !s.growthText) badSd.push(s.id + "(成熟时间既无天数也无文字)");
    if (typeof s.sell !== "number") badSd.push(s.id + "(无售价)");
    if (!s.source) badSd.push(s.id + "(无获取方式)");
  }
  log(badSd.length === 0, "种子字段齐全（名称/季节/成熟时间/售价/获取方式）" + (badSd.length ? "：" + badSd.slice(0, 6).join(",") : ""));

  /* 季节筛选必须覆盖数据里出现过的全部季节（R17：否则该季节的种子筛不出来） */
  const sdSeasons = [...new Set(SD.flatMap((s) => s.season))];
  const missSdSeason = sdSeasons.filter((x) => data.SEED_SEASON_FILTERS.indexOf(x) < 0);
  log(missSdSeason.length === 0,
    "种子季节筛选覆盖全部季节（" + sdSeasons.join("/") + "）" + (missSdSeason.length ? "：缺 " + missSdSeason.join(",") : ""));

  /* 结果物落点守恒：能跳转的 + 已知缺口的 == 全部有固定结果物的种子。
   * 缺口表随模块补齐自动收缩（R31）：第十五轮 14 项 → 第十七轮加果树后 7 项
   * → **第十八轮加树木后只剩「草」**（草是农场杂物、不属任何已收录模块，故长期保留）。
   * 注意「纤维」在采矿、「蘑菇树」在事件，都已收录，故**不**入表。 */
  const SD_CROP_GAPS = ["草"];
  const sdWithCrop = SD.filter((s) => s.crop);
  const sdHit = sdWithCrop.filter((s) => data.NAME_INDEX.has(s.crop));
  const sdGap = [...new Set(sdWithCrop.filter((s) => !data.NAME_INDEX.has(s.crop)).map((s) => s.crop))].sort();
  const sdUntracked = sdGap.filter((n) => SD_CROP_GAPS.indexOf(n) < 0);
  log(sdUntracked.length === 0,
    "种子结果物无表外缺口（" + sdHit.length + " 可跳转 / " + sdGap.length + " 个名字在缺口表内）" +
    (sdUntracked.length ? "：新增 " + sdUntracked.join(",") : ""));
  const sdStale = SD_CROP_GAPS.filter((n) => sdGap.indexOf(n) < 0);
  log(sdStale.length === 0, "种子结果物缺口表无过期项（" + SD_CROP_GAPS.length + " 项）" +
    (sdStale.length ? "：已可跳转却仍在表内 " + sdStale.join(",") : ""));
  log(SD.filter((s) => !s.crop).length > 0, "存在「结果不固定」的种子（混合种子类）(" +
    SD.filter((s) => !s.crop).map((s) => s.name).join("、") + ")");

  /* 反向索引：每个可跳转的结果物，都要能在「由这些种子种出」里查到对应的种子 */
  const sdRevMiss = sdHit.filter((s) => (data.SEEDED_BY.get(s.crop) || []).indexOf(s) < 0);
  log(sdRevMiss.length === 0, "种子反向索引（结果物 → 种子）覆盖全部可跳转项" +
    (sdRevMiss.length ? "：缺 " + sdRevMiss.slice(0, 5).map((s) => s.name).join(",") : ""));

  /* 详情弹窗要能看到「怎么获得」与「长成什么」，否则卡片上只有价格 */
  const sdHtml = String(data.DETAIL_RENDERERS.seeds(SD[0].id));
  log(sdHtml.includes("获取方式") && sdHtml.includes("成熟结果"),
    "种子详情含「获取方式」与「成熟结果」分区（" + SD[0].name + "）");

  /* 结果物 chip 应生成跳转链接（如 防风草种子 → 防风草） */
  const sdLinked = SD.find((s) => data.NAME_INDEX.has(s.crop));
  const sdLinkHtml = sdLinked ? String(data.DETAIL_RENDERERS.seeds(sdLinked.id)) : "";
  log(sdLinkHtml.includes("data-goto-id"), "种子详情中的结果物生成了跳转链接（" + (sdLinked ? sdLinked.name : "—") + "）");

  /* 售价 0 是「不可出售」的真实值，渲染层必须给出文字而不是显示 0 金（R24） */
  const sdZero = SD.filter((s) => s.sell === 0);
  log(sdZero.length === 0 || data.seedPriceText(sdZero[0]) === "不可出售",
    "售价为 0 的种子渲染成「不可出售」而非 0 金（" + sdZero.length + " 条）");

  /* ---------- 13. 果树（树 ↔ 树苗 ↔ 果实） ---------- */
  console.log("\n=== 13. 果树（树 ↔ 树苗 ↔ 果实） ===");

  const FT = arrays.fruittrees || [];
  const ftIds = FT.map((t) => t.id);
  const ftDup = [...new Set(ftIds.filter((v, i) => ftIds.indexOf(v) !== i))];
  log(ftDup.length === 0, "果树 id 无重复（" + FT.length + " 棵）" + (ftDup.length ? "：" + ftDup.join(",") : ""));

  const ownerT = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) if (!ownerT.has(it.id)) ownerT.set(it.id, sec.id);
  const ftCross = FT.filter((t) => ownerT.get(t.id) !== "fruittrees").map((t) => t.id + "(属" + ownerT.get(t.id) + ")");
  log(ftCross.length === 0, "果树 id 与其它模块无冲突" + (ftCross.length ? "：" + ftCross.join(",") : ""));

  const ftNames = FT.map((t) => t.name);
  const ftNameDup = [...new Set(ftNames.filter((v, i) => ftNames.indexOf(v) !== i))];
  log(ftNameDup.length === 0, "果树名称无重复" + (ftNameDup.length ? "：" + ftNameDup.join(",") : ""));

  const badFt = [];
  for (const t of FT) {
    if (!t.fruit) badFt.push(t.id + "(无果实)");
    if (!t.sapling) badFt.push(t.id + "(无树苗)");
    if (!(t.season || []).length) badFt.push(t.id + "(无季节)");
    if (t.growth == null) badFt.push(t.id + "(无成熟时间)");
    if (typeof t.fruitSell !== "number") badFt.push(t.id + "(无果实售价)");
  }
  log(badFt.length === 0, "果树字段齐全（果实/树苗/季节/成熟时间/果实售价）" + (badFt.length ? "：" + badFt.slice(0, 6).join(",") : ""));

  /* 跨模块交叉校验：每棵树苗都必须能在**种子**模块找到，
   * 且两边对同一个树苗的售价必须一致（否则界面会出现两个说法） */
  const seedArr = arrays.seeds || [];
  const saplingMiss = FT.filter((t) => !seedArr.some((s) => s.name === t.sapling)).map((t) => t.name + "→" + t.sapling);
  log(saplingMiss.length === 0, "每棵果树的树苗都能在种子模块找到" + (saplingMiss.length ? "：" + saplingMiss.join(",") : ""));
  const priceMismatch = FT.filter((t) => {
    const s = seedArr.find((x) => x.name === t.sapling);
    return s && s.sell != null && t.saplingSell != null && s.sell !== t.saplingSell;
  }).map((t) => t.name);
  log(priceMismatch.length === 0, "树苗售价与种子模块一致（" + FT.length + " 棵交叉核对）" +
    (priceMismatch.length ? "：" + priceMismatch.join(",") : ""));

  /* 季节筛选覆盖数据里出现过的全部季节（R17） */
  const ftSeasons = [...new Set(FT.flatMap((t) => t.season))];
  const missFt = ftSeasons.filter((x) => data.TREE_SEASONS.indexOf(x) < 0);
  log(missFt.length === 0, "果树季节筛选覆盖全部季节（" + ftSeasons.join("/") + "）" + (missFt.length ? "：缺 " + missFt.join(",") : ""));

  /* 别名机制（第十六轮新增）：别名让「苹果」能落到「苹果树」，
   * 但**不得覆盖已有的正式名**——芒果已由 CROPS 收录，果树模块就不该登记该别名（R53） */
  const akaBad = [];
  for (const t of FT) {
    for (const a of (t.aka || [])) {
      const hit = data.NAME_INDEX.get(a);
      if (!hit || hit.module !== "fruittrees" || hit.id !== t.id) {
        akaBad.push(`${a}→${hit ? hit.module + "/" + hit.id : "无"}`);
      }
    }
  }
  log(akaBad.length === 0, "果树别名都能解析到自己" + (akaBad.length ? "：" + akaBad.join(",") : ""));
  const akaShadow = FT.filter((t) => (t.aka || []).some((a) => {
    const first = data.REGISTRY.find((sec) => sec.data.some((x) => x.name === a));
    return first && first.id !== "fruittrees";
  })).map((t) => t.name);
  log(akaShadow.length === 0, "别名未覆盖其它模块的正式名（R53）" + (akaShadow.length ? "：" + akaShadow.join(",") : ""));
  /* 芒果是唯一被已有模块占用的果实名：它必须**没有**别名，且仍能解析到 CROPS */
  const mango = FT.find((t) => t.fruit === "芒果");
  log(!mango || (mango.aka || []).indexOf("芒果") < 0,
    "「芒果」未登记别名（该名字已由 " + (data.NAME_INDEX.get("芒果") || {}).module + " 收录，以已有为准）");

  /* 种子模块的「成熟后得到」要能落到果树：这是本轮缺口表收缩的直接来源 */
  const fruitHits = FT.filter((t) => data.NAME_INDEX.has(t.fruit)).map((t) => t.fruit);
  log(fruitHits.length >= 7, "果树的果实可从种子模块反向命中（" + fruitHits.length + " 个：" + fruitHits.join("、") + "）");

  const ftHtml = String(data.DETAIL_RENDERERS.fruittrees(FT[0].id));
  log(ftHtml.includes("树苗") && ftHtml.includes("果树通用规则"),
    "果树详情含「树苗」与「果树通用规则」分区（" + FT[0].name + "）");
  log(ftHtml.includes("data-goto-id"), "果树详情中的树苗生成了跳转链接（" + FT[0].name + "）");

  /* ---------- 14. 树木（树 ↔ 种子 ↔ 树液产物） ---------- */
  console.log("\n=== 14. 树木（树 ↔ 种子 ↔ 树液产物） ===");

  const TR = arrays.trees || [];
  const trIds = TR.map((t) => t.id);
  const trDup = [...new Set(trIds.filter((v, i) => trIds.indexOf(v) !== i))];
  log(trDup.length === 0, "树木 id 无重复（" + TR.length + " 棵）" + (trDup.length ? "：" + trDup.join(",") : ""));

  const ownerR = new Map();
  for (const sec of data.REGISTRY) for (const it of sec.data) if (!ownerR.has(it.id)) ownerR.set(it.id, sec.id);
  const trCross = TR.filter((t) => ownerR.get(t.id) !== "trees").map((t) => t.id + "(属" + ownerR.get(t.id) + ")");
  log(trCross.length === 0, "树木 id 与其它模块无冲突" + (trCross.length ? "：" + trCross.join(",") : ""));

  const trNames = TR.map((t) => t.name);
  const trNameDup = [...new Set(trNames.filter((v, i) => trNames.indexOf(v) !== i))];
  log(trNameDup.length === 0, "树木名称无重复（名字同时是 SEEDED_BY 的键）" + (trNameDup.length ? "：" + trNameDup.join(",") : ""));

  const badTr = [];
  for (const t of TR) {
    if (t.growth == null && !t.growthText) badTr.push(t.id + "(成熟时间既无天数也无文字)");
    if (t.tapper && !/[\u4e00-\u9fff]/.test(t.tapper)) badTr.push(t.id + "(树液产物未本地化)");
  }
  log(badTr.length === 0, "树木字段齐全（成熟时间；树液产物有则必须本地化）" + (badTr.length ? "：" + badTr.slice(0, 5).join(",") : ""));

  /* 跨模块交叉校验：每棵树的种子都要能在种子模块找到（棕榈树是野生树、本就没有种子） */
  const trSeedMiss = TR.filter((t) => t.seed && !seedArr.some((s) => s.name === t.seed)).map((t) => t.name + "→" + t.seed);
  log(trSeedMiss.length === 0, "每棵树的种子都能在种子模块找到（" +
    TR.filter((t) => t.seed).length + "/" + TR.length + " 棵有种子）" + (trSeedMiss.length ? "：" + trSeedMiss.join(",") : ""));
  log(TR.filter((t) => !t.seed).length === 1 && TR.find((t) => !t.seed).name === "棕榈树",
    "唯一没有种子的是棕榈树（野生、不能种植，与 Wiki 一致）");

  /* 反向索引：种子模块里 crop 指向本树的种子，必须能在「由这些种子种出」里查到 */
  const trRevMiss = TR.filter((t) => t.seed).filter((t) => {
    const s = seedArr.find((x) => x.name === t.seed);
    return s && (data.SEEDED_BY.get(s.crop) || []).indexOf(s) < 0;
  }).map((t) => t.name);
  log(trRevMiss.length === 0, "树木的种子在反向索引（由这些种子种出）中可达" + (trRevMiss.length ? "：" + trRevMiss.join(",") : ""));

  /* 本轮目标：种子结果物缺口表应当只剩「草」（草是农场杂物、不属任何模块） */
  const sdGapNow = [...new Set(seedArr.filter((s) => s.crop && !data.NAME_INDEX.has(s.crop)).map((s) => s.crop))].sort();
  log(sdGapNow.length === 1 && sdGapNow[0] === "草",
    "加完树木后，种子结果物缺口表只剩「草」（" + sdGapNow.join("、") + "）");

  const trHtml = String(data.DETAIL_RENDERERS.trees(TR[0].id));
  log(trHtml.includes("砍伐产出") && trHtml.includes("树液采集器"),
    "树木详情含「砍伐产出」与「树液采集器」分区（" + TR[0].name + "）");
  const trWithSeed = TR.find((t) => t.seed && data.NAME_INDEX.has(t.seed));
  const trSeedHtml = trWithSeed ? String(data.DETAIL_RENDERERS.trees(trWithSeed.id)) : "";
  log(trSeedHtml.includes("data-goto-module=\"seeds\""),
    "树木详情中的种子生成了跳转链接（" + (trWithSeed ? trWithSeed.name : "—") + "）");

  /* ---------- 15. 动物 ---------- */
  console.log("\n=== 15. 动物（动物 ↔ 建筑 ↔ 动物制品） ===");

  const AN = arrays.animals || [];
  const anDup = [...new Set(AN.map((a) => a.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(anDup.length === 0, "动物 id 无重复（" + AN.length + " 条）" + (anDup.length ? "：" + anDup.join(",") : ""));
  const anCross = AN.filter((a) => ownerR.get(a.id) !== "animals").map((a) => a.id + "(属" + ownerR.get(a.id) + ")");
  log(anCross.length === 0, "动物 id 与其它模块无冲突" + (anCross.length ? "：" + anCross.join(",") : ""));

  const anTypes = [...new Set(AN.map((a) => a.type))].sort();
  log(anTypes.length >= 3, "动物类别覆盖完整（" + anTypes.join(" / ") + "）");

  const badAn = [];
  for (const a of AN) {
    if (!a.type) badAn.push(a.id + "(缺类别)");
    if (a.type !== "宠物" && !a.building) badAn.push(a.id + "(缺建筑)");
    if (a.building && !/[\u4e00-\u9fff]/.test(a.building)) badAn.push(a.id + "(建筑名未本地化)");
    if (a.buyprice == null && !a.buyText && a.type !== "宠物") badAn.push(a.id + "(缺价格)");
  }
  log(badAn.length === 0, "动物字段齐全（类别 / 建筑 / 价格）" + (badAn.length ? "：" + badAn.join(",") : ""));

  /* 产出的落点守恒（R31）：能跳转的 + 已知缺口的 == 全部产出。
   * 「动物制品」是 Category:动物制品 的独立分类，尚未收录，故先入缺口表；
   * 待该模块落地后本表应收缩到 0（过期项断言会报出来）。 */
  /* 第二十二轮「动物制品」模块落地后清空——13 项产物现在都能跳转了。
   * 表本身保留：将来给动物新增产物时，落点检查仍然生效（R31）。 */
  const ANIMAL_PRODUCE_GAPS = [];
  const allProduce = [...new Set(AN.flatMap((a) => a.produce || []))];
  const prodLinked = allProduce.filter((p) => data.NAME_INDEX.has(p));
  const prodGap = allProduce.filter((p) => !data.NAME_INDEX.has(p));
  const prodUntracked = prodGap.filter((p) => ANIMAL_PRODUCE_GAPS.indexOf(p) < 0);
  log(prodUntracked.length === 0,
    "动物产出无表外缺口（" + prodLinked.length + " 可跳转 / " + prodGap.length + " 在已知缺口表内）" +
    (prodUntracked.length ? "：表外 " + prodUntracked.join(",") : ""));
  const prodStale = ANIMAL_PRODUCE_GAPS.filter((p) => allProduce.indexOf(p) < 0 || data.NAME_INDEX.has(p));
  log(prodStale.length === 0,
    "动物产出缺口表无过期项（" + ANIMAL_PRODUCE_GAPS.length + " 项）" +
    (prodStale.length ? "：已可跳转却仍在表内 " + prodStale.join(",") : ""));

  const anHtml = String(data.DETAIL_RENDERERS.animals(AN[0].id));
  log(anHtml.includes("饲养要点") && anHtml.includes("所需建筑"),
    "动物详情含「数值」与「饲养要点」分区（" + AN[0].name + "）");

  /* ---------- 16. 动物制品（制品 ↔ 产出它的动物） ---------- */
  console.log("\n=== 16. 动物制品（制品 ↔ 产出它的动物） ===");

  const AP = arrays.products || [];
  const apDup = [...new Set(AP.map((p) => p.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(apDup.length === 0, "动物制品 id 无重复（" + AP.length + " 件）" + (apDup.length ? "：" + apDup.join(",") : ""));
  const apCross = AP.filter((p) => ownerR.get(p.id) !== "products").map((p) => p.id + "(属" + ownerR.get(p.id) + ")");
  log(apCross.length === 0, "动物制品 id 与其它模块无冲突" + (apCross.length ? "：" + apCross.join(",") : ""));

  const apNames = AP.map((p) => p.name);
  const apNameDup = [...new Set(apNames.filter((v, i) => apNames.indexOf(v) !== i))];
  log(apNameDup.length === 0, "动物制品名称无重复（名字是反向索引的键）" + (apNameDup.length ? "：" + apNameDup.join(",") : ""));

  /* 售价不一定是数字：鱼籽是公式、史莱姆球是 N/A —— 但两者必居其一，不能都空 */
  const badAp = [];
  for (const p of AP) {
    if (!p.eng) badAp.push(p.id + "(无英文名)");
    if (!p.source) badAp.push(p.id + "(无获取方式)");
    if (p.sell == null && !p.sellText) badAp.push(p.id + "(既无售价也无售价说明)");
  }
  log(badAp.length === 0, "动物制品字段齐全（英文名 / 获取方式 / 售价或售价说明）" +
    (badAp.length ? "：" + badAp.join(",") : ""));
  log(AP.filter((p) => p.sell == null && p.sellText).length > 0,
    "存在「售价不是数字」的制品且已写明规则（如 " +
    (AP.find((p) => p.sell == null && p.sellText) || {}).name + "：" +
    (AP.find((p) => p.sell == null && p.sellText) || {}).sellText + "）");

  /* 反向索引的方向必须正确：产物 → 动物（写反了界面不报错，但「由这些动物产出」永远是空的） */
  const apFromAnimal = AP.filter((p) => (data.PRODUCT_BY.get(p.name) || []).length);
  const revBad = apFromAnimal.filter((p) => AN.filter((a) => (a.produce || []).indexOf(p.name) < 0 &&
    (data.PRODUCT_BY.get(p.name) || []).some((a) => a.name === p.name)).length);
  log(apFromAnimal.length >= 13,
    "反向索引把动物产物对上了产出动物（" + apFromAnimal.length + " / " + AP.length + " 件有产出动物）");
  const apLead = apFromAnimal[0];
  const apHtml = apLead ? String(data.DETAIL_RENDERERS.products(apLead.id)) : "";
  log(apHtml.includes("由这些动物产出") && apHtml.includes("data-goto-id"),
    "动物制品详情含可跳转的「由这些动物产出」（" + (apLead ? apLead.name : "—") + "）");

  /* 本轮目标：动物模块登记的 13 项产物缺口应当全部闭合 */
  const stillGap = [...new Set(AN.flatMap((a) => a.produce || []))].filter((p) => !data.NAME_INDEX.has(p));
  log(stillGap.length === 0,
    "动物的全部产物都有了落点（缺口表已清零）" + (stillGap.length ? "：仍缺 " + stillGap.join(",") : ""));

  /* ---------- 17. 工具（工具 ↔ 升级链 ↔ 商店） ---------- */
  console.log("\n=== 17. 工具（工具 ↔ 升级链 ↔ 商店） ===");

  const TL = arrays.tools || [];
  const tlDup = [...new Set(TL.map((t) => t.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(tlDup.length === 0, "工具 id 无重复（" + TL.length + " 件）" + (tlDup.length ? "：" + tlDup.join(",") : ""));
  const tlCross = TL.filter((t) => ownerR.get(t.id) !== "tools").map((t) => t.id + "(属" + ownerR.get(t.id) + ")");
  log(tlCross.length === 0, "工具 id 与其它模块无冲突" + (tlCross.length ? "：" + tlCross.join(",") : ""));

  const tlNames = TL.map((t) => t.name);
  const tlNameDup = [...new Set(tlNames.filter((v, i) => tlNames.indexOf(v) !== i))];
  log(tlNameDup.length === 0, "工具名称无重复" + (tlNameDup.length ? "：" + tlNameDup.join(",") : ""));

  const badTl = [];
  for (const t of TL) {
    if (!t.eng) badTl.push(t.id + "(无英文名)");
    if (t.cost == null && !t.costText && !t.soldby && !t.source) badTl.push(t.id + "(既无价格也无获取方式)");
    if (t.soldby && !/[\u4e00-\u9fff]/.test(t.soldby)) badTl.push(t.id + "(购买地点未本地化)");
  }
  log(badTl.length === 0, "工具字段齐全（英文名 / 价格或来源）" + (badTl.length ? "：" + badTl.join(",") : ""));

  /* 分组完整性（R17）：每个工具**恰好**落在一个筛选分组里。
   * 用显式 id 清单归组，就必须断言"清单覆盖了全部工具"——
   * 否则将来加一件工具，它会既不在任何分组里、也不报错（内容存在但筛不出来）。 */
  const catAll = Object.values(data.TOOL_CATS).flat();
  const catDup = [...new Set(catAll.filter((v, i) => catAll.indexOf(v) !== i))];
  log(catDup.length === 0, "工具分组清单无重复 id" + (catDup.length ? "：" + catDup.join(",") : ""));
  const catMiss = TL.filter((t) => catAll.indexOf(t.id) < 0).map((t) => t.id);
  const catGhost = catAll.filter((id) => !TL.some((t) => t.id === id));
  log(catMiss.length === 0 && catGhost.length === 0,
    "工具分组覆盖全部 " + TL.length + " 件且无幽灵项" +
    (catMiss.length ? "：漏 " + catMiss.join(",") : "") + (catGhost.length ? "：多 " + catGhost.join(",") : ""));

  /* 等级表：有就必须完整——缺一格在界面上就是一行空白，不报错 */
  const tlTiered = TL.filter((t) => t.tiers && t.tiers.length);
  const badTier = [];
  for (const t of tlTiered) {
    if (t.tiers.length < 2) badTier.push(t.id + "(等级数 " + t.tiers.length + ")");
    for (const x of t.tiers) {
      if (!x.name) badTier.push(t.id + "(等级缺名称)");
      if (!x.cost) badTier.push(t.id + "/" + x.name + "(缺花费)");
      if (!x.effect) badTier.push(t.id + "/" + x.name + "(缺提升说明)");
      for (const m of (x.materials || [])) {
        if (!/[\u4e00-\u9fff]/.test(m.name)) badTier.push(t.id + "/" + x.name + "(材料未本地化：" + m.name + ")");
      }
    }
  }
  log(badTier.length === 0, tlTiered.length + " 件带等级表的工具条目完整" +
    (badTier.length ? "：" + badTier.slice(0, 6).join(",") : ""));

  /* 等级表的材料应当是站内可跳转的物品（可跳转 + 已知缺口守恒） */
  const tierMats = [...new Set(tlTiered.flatMap((t) => t.tiers.flatMap((x) => (x.materials || []).map((m) => m.name))))];
  const tierMatHit = tierMats.filter((n) => data.NAME_INDEX.has(n));
  log(tierMatHit.length === tierMats.length,
    "升级材料全部可跳转（" + tierMatHit.length + " / " + tierMats.length + "）" +
    (tierMatHit.length < tierMats.length ? "：未命中 " + tierMats.filter((n) => !data.NAME_INDEX.has(n)).join(",") : ""));

  const tiered = tlTiered[0];
  const tlHtml = tiered ? String(data.DETAIL_RENDERERS.tools(tiered.id)) : "";
  log(tlHtml.includes("升级链") && tlHtml.includes("数值"),
    "带等级表的工具详情含「升级链」与「数值」分区（" + (tiered ? tiered.name : "—") + "）");
  const plainTool = TL.find((t) => !t.tiers || !t.tiers.length);
  const plainHtml = plainTool ? String(data.DETAIL_RENDERERS.tools(plainTool.id)) : "";
  log(plainHtml.includes("数值") && !plainHtml.includes("升级链"),
    "不可升级的工具不显示「升级链」（" + (plainTool ? plainTool.name : "—") + "）");

  /* ---------- 18. 建筑（农场建筑 ↔ 城镇地点） ---------- */
  console.log("\n=== 18. 建筑（农场建筑 ↔ 城镇地点） ===");

  const BD = arrays.buildings || [];
  const bdDup = [...new Set(BD.map((b) => b.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(bdDup.length === 0, "建筑 id 无重复（" + BD.length + " 条）" + (bdDup.length ? "：" + bdDup.join(",") : ""));
  const bdCross = BD.filter((b) => ownerR.get(b.id) !== "buildings").map((b) => b.id + "(属" + ownerR.get(b.id) + ")");
  log(bdCross.length === 0, "建筑 id 与其它模块无冲突" + (bdCross.length ? "：" + bdCross.join(",") : ""));

  const bdNames = BD.map((b) => b.name);
  const bdNameDup = [...new Set(bdNames.filter((v, i) => bdNames.indexOf(v) !== i))];
  log(bdNameDup.length === 0, "建筑名称无重复" + (bdNameDup.length ? "：" + bdNameDup.join(",") : ""));

  /* 两种形态必须都被覆盖：漏掉一类会让整个半区在界面上"不存在" */
  const bdTypes = [...new Set(BD.map((b) => b.type))].sort();
  log(bdTypes.indexOf("农场建筑") >= 0 && bdTypes.indexOf("城镇地点") >= 0,
    "两种建筑类型都有（" + bdTypes.join(" / ") + "：" +
    bdTypes.map((x) => x + " " + BD.filter((b) => b.type === x).length).join("，") + "）");

  const badBd = [];
  for (const b of BD) {
    if (!b.eng) badBd.push(b.id + "(无英文名)");
    if (!b.type) badBd.push(b.id + "(无类型)");
    /* 城镇地点：农舍（自己家）、大树桩（地点）、树屋本来就没有营业时间 */
    if (b.type === "城镇地点" && !b.openHours && !/农舍|大树桩|树屋/.test(b.name)) badBd.push(b.id + "(缺营业时间)");
    /* 农场建筑：造价 / 材料 / 升级表 至少有一个，否则界面上是一张空卡 */
    if (b.type === "农场建筑" && b.cost == null && !b.costText && !(b.materials || []).length && !(b.tiers || []).length) {
      badBd.push(b.id + "(既无造价也无材料)");
    }
  }
  log(badBd.length === 0, "建筑字段齐全（类型 + 各自的必需项）" + (badBd.length ? "：" + badBd.slice(0, 6).join(",") : ""));

  /* 材料 / 驻地 NPC 的落点：能跳转的 + 已知缺口的 == 全部引用 */
  const OCCUPANT_GAPS = ["Witch", "Island Trader"];
  const bdMats = [...new Set(BD.flatMap((b) => (b.materials || []).map((m) => m.name))
    .concat(BD.flatMap((b) => (b.tiers || []).flatMap((t) => (t.materials || []).map((m) => m.name)))))];
  /* 建筑材料同样按「可跳转 + 已知缺口」守恒（R31）。
   * 龙牙同时也是打造材料的已知缺口；绿藻尚未被任何模块收录。 */
  const BD_MAT_GAPS = ["龙牙", "绿藻"];
  const bdMatMiss = bdMats.filter((n) => !data.NAME_INDEX.has(n) && !/[A-Za-z]/.test(n));
  const bdMatUntracked = bdMatMiss.filter((n) => BD_MAT_GAPS.indexOf(n) < 0);
  log(bdMatUntracked.length === 0,
    "建筑材料无表外缺口（" + (bdMats.length - bdMatMiss.length) + " 可跳转 / " + bdMatMiss.length + " 在缺口表内）" +
    (bdMatUntracked.length ? "：表外 " + bdMatUntracked.join(",") : ""));
  const bdMatStale = BD_MAT_GAPS.filter((n) => bdMatMiss.indexOf(n) < 0);
  log(bdMatStale.length === 0, "建筑材料缺口表无过期项（" + BD_MAT_GAPS.length + " 项）" +
    (bdMatStale.length ? "：已可跳转却仍在表内 " + bdMatStale.join(",") : ""));

  const bdOcc = [...new Set(BD.flatMap((b) => b.occupants || []))];
  const bdOccMiss = bdOcc.filter((n) => !data.NAME_INDEX.has(n));
  const bdOccUntracked = bdOccMiss.filter((n) => OCCUPANT_GAPS.indexOf(n) < 0);
  log(bdOccUntracked.length === 0,
    "驻地居民无表外缺口（" + (bdOcc.length - bdOccMiss.length) + " 可跳转 / " + bdOccMiss.length + " 在已知缺口表内）" +
    (bdOccUntracked.length ? "：表外 " + bdOccUntracked.join(",") : ""));
  const bdOccStale = OCCUPANT_GAPS.filter((n) => bdOccMiss.indexOf(n) < 0);
  log(bdOccStale.length === 0, "驻地居民缺口表无过期项（" + OCCUPANT_GAPS.length + " 项）" +
    (bdOccStale.length ? "：已可跳转却仍在表内 " + bdOccStale.join(",") : ""));

  /* 升级表（畜棚 / 鸡舍 / 小屋）：造价与材料都要解析出来。
   * 这里曾经因为"用文件名 split 定位"而全错位——"Big Barn.png" 里也含 "Barn.png"。 */
  const bdTiered = BD.filter((b) => b.tiers && b.tiers.length);
  const badBdTier = [];
  for (const b of bdTiered) {
    if (b.tiers.length < 2) badBdTier.push(b.id + "(档数 " + b.tiers.length + ")");
    for (const x of b.tiers) {
      if (!x.name) badBdTier.push(b.id + "(档缺名称)");
      else if (!x.cost) badBdTier.push(b.id + "/" + x.name + "(缺造价)");
    }
  }
  log(bdTiered.length >= 3 && badBdTier.length === 0,
    bdTiered.length + " 个可升级建筑（" + bdTiered.map((b) => b.name).join("/") + "）档位完整" +
    (badBdTier.length ? "：" + badBdTier.join(",") : ""));

  /* 详情按类型分支：两类各自的分区不能串 */
  const locB = BD.find((b) => b.type === "城镇地点" && b.openHours);
  const farmB = BD.find((b) => b.type === "农场建筑" && b.cost != null);
  const locHtml = locB ? String(data.DETAIL_RENDERERS.buildings(locB.id)) : "";
  const farmHtml = farmB ? String(data.DETAIL_RENDERERS.buildings(farmB.id)) : "";
  log(locHtml.includes("营业时间") && locHtml.includes("常驻居民"),
    "城镇地点详情含「营业时间」与「常驻居民」（" + (locB ? locB.name : "—") + "）");
  log(farmHtml.includes("建造价格") && farmHtml.includes("所需材料"),
    "农场建筑详情含「建造价格」与「所需材料」（" + (farmB ? farmB.name : "—") + "）");
  log(farmHtml.indexOf("营业时间") < 0, "农场建筑详情不串入城镇地点的分区");

  /* 建筑用的是 96px 大图标位：图源是游戏截图，48px 格子装不下（见 css 注释） */
  log(/icon-lg/.test(String(data.DETAIL_RENDERERS.buildings(BD[0].id))),
    "建筑详情使用 96px 大图标位（图源是截图而非 48×48 精灵）");

  /* ---------- 19. 武器（类型 ↔ 伤害 ↔ 附加属性） ---------- */
  console.log("\n=== 19. 武器（类型 ↔ 伤害 ↔ 附加属性） ===");

  const WP = arrays.weapons || [];
  const wpDup = [...new Set(WP.map((w) => w.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(wpDup.length === 0, "武器 id 无重复（" + WP.length + " 件）" + (wpDup.length ? "：" + wpDup.join(",") : ""));
  const wpCross = WP.filter((w) => ownerR.get(w.id) !== "weapons").map((w) => w.id + "(属" + ownerR.get(w.id) + ")");
  log(wpCross.length === 0, "武器 id 与其它模块无冲突" + (wpCross.length ? "：" + wpCross.join(",") : ""));

  const wpNames = WP.map((w) => w.name);
  const wpNameDup = [...new Set(wpNames.filter((v, i) => wpNames.indexOf(v) !== i))];
  log(wpNameDup.length === 0, "武器名称无重复" + (wpNameDup.length ? "：" + wpNameDup.join(",") : ""));

  const badWp = [];
  for (const w of WP) {
    if (!w.type) badWp.push(w.id + "(无类型)");
    if (!w.damage) badWp.push(w.id + "(无伤害)");
    if (!w.source) badWp.push(w.id + "(无获取方式)");
    /* 伤害是「N」或「N-M」两种写法，别的一律是解析出错 */
    /* 伤害是「N」或「N-M」；**弹弓例外**——它的伤害取决于装填的弹药，Wiki 写的是说明文字 */
    if (w.damage && w.type !== "弹弓" && !/^\d+(-\d+)?$/.test(w.damage)) badWp.push(w.id + "(伤害格式异常：" + w.damage + ")");
    if (w.csc != null && !(w.csc >= 0 && w.csc <= 1)) badWp.push(w.id + "(暴击率越界：" + w.csc + ")");
    for (const s of (w.stats || [])) if (!/[\u4e00-\u9fff]/.test(s.name)) badWp.push(w.id + "(属性名未本地化：" + s.name + ")");
    if (/\{\{/.test(w.source || "")) badWp.push(w.id + "(来源残留模板)");
  }
  log(badWp.length === 0, "武器字段齐全且格式正确（类型/伤害/来源/暴击率/属性）" +
    (badWp.length ? "：" + badWp.slice(0, 6).join(",") : ""));

  /* 筛选覆盖（R17）：数据里出现过的类型必须有对应按钮，否则那类武器筛不出来 */
  const wpTypes = [...new Set(WP.map((w) => w.type))];
  const missWpType = wpTypes.filter((x) => !data.WEAPON_FILTERS.some((f) => f.value === x));
  log(missWpType.length === 0, "武器筛选覆盖全部 " + wpTypes.length + " 个类型（" + wpTypes.join("/") + "）" +
    (missWpType.length ? "：缺 " + missWpType.join(",") : ""));

  /* 暴击率是小数、界面按百分比显示：0.04 → 4%（写成 0.04% 就错了 100 倍） */
  log(data.critText(0.04) === "4%" && data.critText(0) === "0%" && data.critText(null) === "—",
    "暴击率渲染成百分比（0.04 → " + data.critText(0.04) + "）");

  const wpHtml = String(data.DETAIL_RENDERERS.weapons(WP[0].id));
  log(wpHtml.includes("战斗数值") && wpHtml.includes("获取方式"),
    "武器详情含「战斗数值」与「获取方式」（" + WP[0].name + "）");
  const statW = WP.find((w) => w.stats && w.stats.length);
  const statHtml = statW ? String(data.DETAIL_RENDERERS.weapons(statW.id)) : "";
  log(!statW || statHtml.includes(statW.stats[0].name),
    "附加属性出现在详情里（" + (statW ? statW.name + " → " + statW.stats.map((s) => s.name + s.mod).join("/") : "—") + "）");

  /* 镰刀归了工具，武器这边不该再出现（R53：一个名字只属于一个模块） */
  log(!WP.some((w) => /镰刀/.test(w.name)),
    "镰刀类不在武器模块（已归「工具」，避免同名两处）");

  /* ---------- 20. 戒指（效果 ↔ 获取） ---------- */
  console.log("\n=== 20. 戒指（效果 ↔ 获取） ===");

  const RG = arrays.rings || [];
  const rgDup = [...new Set(RG.map((r) => r.id).filter((v, i, arr) => arr.indexOf(v) !== i))];
  log(rgDup.length === 0, "戒指 id 无重复（" + RG.length + " 枚）" + (rgDup.length ? "：" + rgDup.join(",") : ""));
  const rgCross = RG.filter((r) => ownerR.get(r.id) !== "rings").map((r) => r.id + "(属" + ownerR.get(r.id) + ")");
  log(rgCross.length === 0, "戒指 id 与其它模块无冲突" + (rgCross.length ? "：" + rgCross.join(",") : ""));

  const rgNames = RG.map((r) => r.name);
  const rgNameDup = [...new Set(rgNames.filter((v, i) => rgNames.indexOf(v) !== i))];
  log(rgNameDup.length === 0, "戒指名称无重复（名字是搜索与跳转的键）" + (rgNameDup.length ? "：" + rgNameDup.join(",") : ""));

  const badRg = [];
  for (const r of RG) {
    if (!r.source) badRg.push(r.id + "(无获取方式)");
    if (r.value == null) badRg.push(r.id + "(无售价)");
    /* 效果有两个来源：infobox 的 stats 或正文首句，两者都没有才是问题 */
    if (!(r.stats || []).length && !r.effect) badRg.push(r.id + "(既无属性也无说明)");
    for (const s of (r.stats || [])) if (!/[\u4e00-\u9fff]/.test(s.name)) badRg.push(r.id + "(属性名未本地化：" + s.name + ")");
    if (/\{\{/.test(r.effect || "") || /\{\{/.test(r.source || "")) badRg.push(r.id + "(残留模板)");
  }
  log(badRg.length === 0, "戒指字段齐全（获取方式 / 售价 / 效果）" + (badRg.length ? "：" + badRg.slice(0, 6).join(",") : ""));

  /* 可打造的戒指归「打造」模块，戒指这边不该再出现（R53：一个名字只属于一个模块） */
  const craftRing = data.MODULE_DATA.CRAFTING.filter((c) => /戒指|铱环/.test(c.name)).map((c) => c.name);
  const dupRing = RG.filter((r) => craftRing.indexOf(r.name) >= 0).map((r) => r.name);
  log(dupRing.length === 0,
    "可打造的戒指不在戒指模块（" + craftRing.length + " 枚归「打造」：" + craftRing.join("、") + "）" +
    (dupRing.length ? "：重复 " + dupRing.join(",") : ""));

  const rgHtml = String(data.DETAIL_RENDERERS.rings(RG[0].id));
  log(rgHtml.includes("佩戴建议") && rgHtml.includes("获取方式"),
    "戒指详情含「获取方式」与「佩戴建议」（" + RG[0].name + "）");
  log(data.ringEffectText({ stats: [{ name: "防御", mod: "+1" }] }) === "防御 +1" &&
      data.ringEffectText({ effect: "散文说明" }) === "散文说明",
    "两种效果来源都能渲染（结构化属性 / 正文说明）");

  /* ---------- 21. 侧栏导航（模块可达性） ---------- */
  console.log("\n=== 21. 侧栏导航（模块可达性） ===");

  /* 导航从横向标签栏改成左侧竖栏（第十八轮）：横排 17 个模块需要约 1700px，
   * 只有 ≥1920 的屏幕能一眼看全。这里守住"每个模块都有一条导航入口"这件事——
   * 漏掉一个模块在视觉上只是"少了一个图标"，很容易没人发现。
   *
   * ⚠️ 按 data-module 去重后再断言：check.js 会把整站源码**求值两次**
   * （第 2 节一次、第 3 节引导一次），导航因此被建两遍。
   * 断言的是"每个模块都有入口"这个不变量，而不是元素总数——
   * 后者会随脚手架求值次数变化，是**口径错**而不是产品错。 */
  const navEl = registry.get("#nav");
  const allNavItems = allEls.filter((e) => e.className === "nav-item");
  const navByMod = new Map();
  allNavItems.forEach((e) => { if (!navByMod.has(e.dataset.module)) navByMod.set(e.dataset.module, e); });
  const navItems = [...navByMod.values()];
  const navBuilds = navEl ? Math.round(allNavItems.length / Math.max(1, data.MODULES.length)) : 1;

  log(navItems.length === data.MODULES.length,
    "每个模块都有侧栏入口（去重后 " + navItems.length + " / " + data.MODULES.length +
    "，脚手架初始化 " + navBuilds + " 次）");

  const navMissing = data.MODULES.filter((m) => !navItems.some((e) => e.dataset.module === m.id)).map((m) => m.id);
  log(navMissing.length === 0, "侧栏入口覆盖全部模块 id" + (navMissing.length ? "：缺 " + navMissing.join(",") : ""));

  /* title 在图标条模式（≤1120px，名称与计数被 CSS 隐藏）下是唯一的可读标签 */
  const noTitle = navItems.filter((e) => !e.title || !e.title.trim()).map((e) => e.dataset.module);
  log(noTitle.length === 0, "每个侧栏条目都带 title（图标条模式下唯一可读的标签）" +
    (noTitle.length ? "：" + noTitle.join(",") : ""));

  /* 条目数徽标：横排完全没有地方放的信息，竖排才排得下 */
  const badCount = [];
  for (const e of navItems) {
    const sec = data.REGISTRY.find((s) => s.id === e.dataset.module);
    const n = sec && data.MODULE_DATA[sec.dataRef] ? data.MODULE_DATA[sec.dataRef].length : 0;
    const html = String(e.innerHTML);
    if (html.indexOf('<span class="nav-count">' + n + "</span>") < 0) badCount.push(e.dataset.module + "(应为 " + n + ")");
    if (html.indexOf('class="nav-label"') < 0) badCount.push(e.dataset.module + "(缺名称)");
  }
  log(badCount.length === 0, "侧栏条目含名称与正确的条目数徽标" + (badCount.length ? "：" + badCount.slice(0, 5).join(",") : ""));

  /* 侧栏小标题：每次初始化恰好一个（多插会重复显示，漏插就没有分组标题） */
  const navTitles = allEls.filter((e) => e.className === "nav-title");
  log(navTitles.length === navBuilds,
    "侧栏小标题数 = 初始化次数（" + navTitles.length + " / " + navBuilds + "）");

  /* ensureNavVisible 必须**轴向感知**：宽屏竖栏滚 scrollTop、窄屏横排滚 scrollLeft。
   * 只认一个方向的话，另一种布局下当前模块会落在可视区外却没人管。 */
  const navVisSrc = String(data.ensureNavVisible);
  log(navVisSrc.indexOf("scrollLeft") >= 0 && navVisSrc.indexOf("scrollTop") >= 0,
    "ensureNavVisible 同时处理横向与纵向滚动（两种布局各自兜底）");

  /* ---- 侧栏几何一致性（木板缝 ↔ 条目）----
   * 侧栏背景的横向木板缝要和条目**对齐**，靠的是三个数字互相咬合：
   *   缝周期 == 条目高 + 间距，且缝的起点 == 条目高（线正好落在两条目之间）
   *   标题高 + 侧栏上内边距 == 缝周期（第一个条目也落在整格边界上）
   * 这三处写在不同的 CSS 规则里，改一处忘了另两处就"模块和线对不齐"——
   * 本轮真出过这个 bug（缝周期原写 46px，行距是 44px，越往下越错）。
   * DOM 模拟没有布局引擎、量不了真实几何，所以直接对 CSS 源码做一致性校验。 */
  const cssSrc = fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8");
  const num = (re, src) => { const m = re.exec(src); return m ? Number(m[1]) : null; };
  const itemH = num(/\.nav-item \{[\s\S]*?height: (\d+)px;/, cssSrc);
  const navGap = num(/\.nav \{[\s\S]*?gap: (\d+)px;/, cssSrc);
  const navPadTop = num(/\.nav \{[\s\S]*?padding: (\d+)px \d+px \d+px;/, cssSrc);
  const titleH = num(/\.nav-title \{[\s\S]*?height: (\d+)px;/, cssSrc);
  const seam = /repeating-linear-gradient\(0deg, transparent 0 (\d+)px, rgba\([^)]*\) (\d+)px (\d+)px\)/.exec(cssSrc);
  const seamStart = seam ? Number(seam[2]) : null;
  const seamPeriod = seam ? Number(seam[3]) : null;

  log(itemH !== null && navGap !== null && seamPeriod !== null,
    "侧栏几何参数可解析（条目高 " + itemH + " / 间距 " + navGap + " / 缝周期 " + seamPeriod + "）");
  log(seamPeriod === itemH + navGap,
    "木板缝周期 == 条目高 + 间距（" + seamPeriod + " == " + itemH + " + " + navGap + "）");
  log(seamStart === itemH,
    "木板缝起点 == 条目高（线正好落在两条目之间的空隙里：起始 " + seamStart + "）");
  /* 第一个条目的位置 = 上内边距 + 标题高 + 间距（标题与条目之间也有一道间距） */
  log(titleH !== null && navPadTop !== null && navPadTop + titleH + navGap === itemH + navGap,
    "上内边距 + 标题高 + 间距 == 缝周期，第一个条目也落在整格边界上（" +
    navPadTop + " + " + titleH + " + " + navGap + " == " + (itemH + navGap) + "）");

  /* 溢出时标题会被 flex 压缩（实测 28→18px），一缩就把下面所有条目顶离缝 */
  log(/\.nav-title \{[\s\S]*?flex: 0 0 auto;/.test(cssSrc),
    "侧栏标题有 flex: 0 0 auto（否则内容溢出时被压缩、条目整体错位）");
  /* 背景默认贴在元素的盒子上、不随内容滚动；侧栏能独立滚动，不加 local 一滚就错位 */
  log(/background-attachment: local/.test(cssSrc),
    "木板缝那层用 background-attachment: local（侧栏自身滚动时缝跟着内容走）");

  /* ---------- 22. 视觉资源 ---------- */
  console.log("\n=== 22. 视觉资源（模块图标贴图） ===");

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

  /* 图标兜底的**渲染时机**（#80）：兜底必须「默认收起、只在贴图加载失败时展开」。
   * 判据是结构标记——容器带 .has-img 时 CSS 收起兜底，onerror 打上 .icon-failed 才展开。
   * 为什么必须守住：早先的写法是「兜底常驻、压在贴图下层」，而官方贴图带 alpha 通道，
   * 兜底会从每个透明像素透出来（实测格子内平均 48.5% 面积、一半贴图超过 50%），
   * 界面上只是"有一点脏"，肉眼很难判定——正是那种只能靠断言守住的缺陷。
   * 同时要保证纯 emoji 图标**不带** .has-img，否则它自己的内容会被 CSS 收起。 */
  const iconFails = [];
  const iconProbes = [
    ["crops", "物品图标", false],
    ["npc", "NPC 头像", false],
    ["quests", "emoji 图标", true],
  ];
  for (const [mod, label, isEmoji] of iconProbes) {
    const arr = arrays[mod] || [];
    const render = data.DETAIL_RENDERERS[mod];
    if (typeof render !== "function" || !arr.length) { iconFails.push(label + "(缺渲染器/数据)"); continue; }
    const html = String((registry.get("#modalContent").innerHTML = render(arr[0].id)));
    const cls = (html.match(/class="item-icon[^"]*"/) || [""])[0];
    if (!cls) { iconFails.push(label + "(未生成图标容器)"); continue; }
    const hasImg = cls.includes("has-img");
    if (isEmoji && hasImg) iconFails.push(label + "(emoji 图标不该带 .has-img，会被 CSS 收起)");
    if (!isEmoji && !hasImg) iconFails.push(label + "(缺 .has-img，兜底会常驻并从透明区透出)");
    if (!isEmoji && !html.includes("icon-failed")) {
      iconFails.push(label + "(onerror 未标记 .icon-failed，缺图时兜底不会出现)");
    }
  }
  log(iconFails.length === 0,
    "图标兜底时机正确（贴图容器带 .has-img + onerror 标记 .icon-failed；emoji 图标不带）" +
    (iconFails.length ? "：" + iconFails.join("; ") : ""));

  /* 搜索索引：必须覆盖全部条目（漏一条就等于该条目搜不到），且关键词非空 */
  const idx = data.buildIndex();
  const idxFails = [];
  for (const [countId, label, arr] of groups) {
    const modId = String(countId).replace(/Count$/, "");
    const hit = idx.filter((e) => e.module === modId).length;
    if (hit !== arr.length) idxFails.push(label + " " + hit + "/" + arr.length);
  }
  const emptyKw = idx.filter((e) => !e.kw || !e.kw.trim()).map((e) => e.module + "/" + e.id);
  log(idxFails.length === 0 && emptyKw.length === 0,
    "搜索索引覆盖全部 " + idx.length + " 条且关键词非空" +
    (idxFails.length ? "：模块覆盖不符 " + idxFails.join(", ") : "") +
    (emptyKw.length ? "：空关键词 " + emptyKw.slice(0, 5).join(",") : ""));

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
  console.log("[INFO] 贴图格式：非 PNG 者 " + notPng.length + " 个" + (notPng.length ? "：" + notPng.join(", ") : ""));

  /* 临时文件防漏：deploy.bat 会 git add -A，根目录下遗留的 _ 开头文件会被误提交 */
  const strayTmp = fs.readdirSync(root).filter((f) => f.startsWith("_"));
  log(strayTmp.length === 0,
    "仓库根目录无临时文件残留" + (strayTmp.length ? ": " + strayTmp.join(", ") : ""));

  /* ---------- 23. 文档自一致性（R60 的执行手段） ----------
   * 为什么要有这一节：R60 早就写了「文档里的数字是数据」，但在此之前 check.js 里
   * **没有任何一条断言读文档**——规则有、执行手段没有，于是 README 的数字反复腐化
   * （第三十轮一次查出 8 处：模块列表里「树木」重复、工匠制品 26→30 项、11→15 类机器、
   * 贴图 893→897、断言 301→309、礼物 49→54、「17/14 个模块」、全 960→964 条）。
   * 判据：一条规则若只写在文档里，它就会按固定节奏腐化（R97 的同一种病）。
   *
   * 只查**能机器核对**的那几类，且正则一律锚定「描述现状」的句式——
   * README 里有历史叙述（如「项目还只有 17 个模块时就已需 ~1700px」），全文扫数字必然误报（R90）。 */
  console.log("\n=== 23. 文档自一致性（R60） ===");

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const readmeLines = readme.split("\n");
  const countByLabel = new Map(groups.map(([, label, arr]) => [label, arr.length]));
  const totalItems = groups.reduce((n, [, , arr]) => n + arr.length, 0);
  const imgOnDisk = fs.readdirSync(path.join(root, "img")).filter((f) => f.endsWith(".png")).length;
  const arMachineList = [];
  for (const a of (data.MODULE_DATA.ARTISAN || [])) {
    for (const m of (a.machines || [])) if (arMachineList.indexOf(m) < 0) arMachineList.push(m);
  }

  /* 23.1 开头的模块列表行：数量 / 重复项 / 与 REGISTRY 是否一一对应 */
  const listLine = readmeLines.reduce((best, l) => (l.split("·").length > best.split("·").length ? l : best), "");
  const listNames = listLine.split("·").map((s) => s.trim().replace(/^\S+\s*/, "")).filter(Boolean);
  const modLabels = groups.map(([, label]) => label);
  log(listNames.length === modLabels.length,
    "README 模块列表数量 == 模块数（" + listNames.length + "/" + modLabels.length + "）");
  const listDup = [...new Set(listNames.filter((v, i) => listNames.indexOf(v) !== i))];
  log(listDup.length === 0,
    "README 模块列表无重复项" + (listDup.length ? "：重复 " + listDup.join(",") : ""));
  const listDiff = [...new Set(
    modLabels.filter((m) => listNames.indexOf(m) < 0).concat(listNames.filter((n) => modLabels.indexOf(n) < 0)))];
  log(listDiff.length === 0,
    "README 模块列表与 REGISTRY 一致" + (listDiff.length ? "：差异 " + listDiff.join(",") : ""));

  /* 23.2 通用句式比对：把「某句式里的数字」与真实值逐个比。
   * 必须要求**命中数 > 0**：句式被删掉时若不报错，这条断言就等于被静默关掉了（R94 的判据）。 */
  const docNum = (name, re, real, unit) => {
    const hits = [...readme.matchAll(re)];
    const bad = hits.filter((h) => Number(h[1]) !== real);
    log(hits.length > 0 && bad.length === 0,
      name + " == " + real + unit +
      (hits.length ? "（文档 " + hits.map((h) => h[1]).join(" / ") + "）" : "：**句式已不存在，断言失效**") +
      (bad.length ? "：写错 " + bad.map((h) => h[1]).join(",") : ""));
  };
  docNum("README 模块数（N 个模块 / N 大模块）", /(\d+)\s*(?:个|大)?模块/g, modLabels.length, " 个");
  docNum("README 条目总数（全 N 条）", /全\s*(\d+)\s*条/g, totalItems, " 条");
  docNum("README 贴图张数（真实游戏贴图 N 张）", /真实游戏贴图\s*(\d+)\s*张/g, imgOnDisk, " 张");
  docNum("README 礼物可跳转数（N 个礼物可直接跳转）", /(\d+)\s*个礼物可直接跳转/g, clickableGifts.length, " 个");
  docNum("README 工匠产出机器数（N 类产出机器）", /(\d+)\s*类产出机器/g, arMachineList.length, " 类");

  /* 23.3 每个模块的条目数：README 写成 `**<标签>（N 量词）**` 的逐个比对。
   * 没有这种写法的模块跳过而不是判失败——少写一处不是错，写错才是（R90）。 */
  const docCountBad = [];
  for (const [label, n] of countByLabel) {
    const hit = new RegExp("\\*\\*" + label + "（(\\d+)\\s*[^）]*）\\*\\*").exec(readme);
    if (hit && Number(hit[1]) !== n) docCountBad.push(label + " 写 " + hit[1] + " 应为 " + n);
  }
  log(docCountBad.length === 0,
    "README 各模块条目数与数据一致（" + countByLabel.size + " 个模块）" +
    (docCountBad.length ? "：" + docCountBad.join("；") : ""));

  /* 23.4 版权与来源声明（第一版上线时全站 0 处归属，属发布安全隐患） */
  const htmlSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const dataSrc = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
  const credit = (src) => /ConcernedApe/.test(src) && /非官方粉丝攻略/.test(src);
  log(credit(htmlSrc) && credit(dataSrc),
    "归属与免责声明齐全（页脚 + data.js 头注释都写明 ConcernedApe / 非官方粉丝攻略）");
  log(/1\.6/.test(htmlSrc) && /最后更新\s*<?\s*(time|strong|\d)/.test(htmlSrc),
    "页脚写明数据对应的游戏版本与最后更新日期");

  /* 23.5 R5 / R40 的机械化守卫（这两条以前只写在文档里，靠人记得）
   * R40：index.html 带 UTF-8 BOM 会让本地与线上哈希差 3 字节，排查时极易误判成「部署没生效」。
   * R5 ：.ps1 丢了 BOM，Windows PowerShell 5.1 按 ANSI 读中文注释 → 满屏假语法错误。
   * 两条都真实发生过，且**通用文本编辑器会静默剥离 BOM**，所以必须断言而不是靠自觉。 */
  const hasBom = (p) => {
    const b = fs.readFileSync(path.join(root, p));
    return b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF;
  };
  log(!hasBom("index.html"), "index.html 无 BOM（R40）");
  const bomMiss = ["scripts/deploy.ps1", "scripts/download-images.ps1"].filter((f) => !hasBom(f));
  log(bomMiss.length === 0, "运维脚本保留 UTF-8 BOM（R5）" + (bomMiss.length ? "：丢失 " + bomMiss.join(",") : ""));

  /* 23.6 自检规模：本条**就是** R60 对「N 节 M 处断言」的执行手段。
   * 因为数的是运行时 log() 次数，而本条自己也占一次，所以期望值 = assertions + 1；
   * 本条是全文件最后一条 log()，若日后再往后追加断言，这里会立刻报错要求同步文档（这正是想要的行为）。 */
  const secCount = (fs.readFileSync(__filename, "utf8").match(/console\.log\("(?:\\n)?=== \d+\./g) || []).length;
  const expectedAssertions = assertions + 1;
  const scaleHits = [...readme.matchAll(/(\d+)\s*节\s*(\d+)\s*处断言/g)];
  const scaleBad = scaleHits.filter((h) => Number(h[1]) !== secCount || Number(h[2]) !== expectedAssertions);
  log(scaleHits.length > 0 && scaleBad.length === 0,
    "README 自检规模 == " + secCount + " 节 / " + expectedAssertions + " 处断言" +
    (scaleHits.length ? "（文档 " + scaleHits.map((h) => h[1] + " 节 " + h[2] + " 处").join(" / ") + "）"
      : "：**句式已不存在，断言失效**") +
    (scaleBad.length ? "：写错 " + scaleBad.map((h) => h[1] + " 节 " + h[2] + " 处").join(",") : ""));

  /* 自检规模：README 与接手说明都引用这两个数字，一律从这一行读，不要凭印象写（R60） */
  console.log(`[INFO] 自检规模：${secCount} 节 / ${assertions} 处断言`);
  console.log(failures ? `\n结果：失败 ${failures} 项` : "\n结果：全部通过");
  process.exit(failures ? 1 : 0);
})();
