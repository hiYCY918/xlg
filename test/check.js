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
  "CRAFTING,CRAFT_CATS,CRAFTED_BY,craftedBySection,sortCrafting};";

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

// 图片覆盖（报告，不判失败——兜底图标是设计内）
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
console.log(`ℹ 图片覆盖：${imgIds.length - noImg.length}/${imgIds.length}（缺失 ${noImg.length} 个，将用兜底图标）` + (noImg.length ? ": " + noImg.join(",") : ""));
console.log(`ℹ 贴图模块 ${groups.length - emojiOnly.length} 个；emoji 呈现模块 ${emojiOnly.length} 个（${emojiOnly.join(" / ")}），不计入覆盖率`);

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
  console.log("ℹ 收集包 " + B.length + " 个 / 房间 " + data.BUNDLE_ROOMS.length +
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
  const BUNDLE_ITEM_GAPS = {
    "兔子的脚": "待建：后续模块",
    "动物毛": "待建：后续模块",
    "史莱姆泥": "待建：后续模块",
    "大壶牛奶": "待建：后续模块",
    "大瓶羊奶": "待建：后续模块",
    "大鸡蛋": "待建：后续模块",
    "太阳精华": "待建：后续模块",
    "奶酪": "待建：后续模块",
    "山羊奶酪": "待建：后续模块",
    "布料": "待建：后续模块",
    "干草": "待建：后续模块",
    "恐龙蛋黄酱": "待建：后续模块",
    "杏子": "待建：后续模块",
    "松焦油": "待建：后续模块",
    "松露油": "待建：后续模块",
    "果酒": "待建：后续模块",
    "果酱": "待建：后续模块",
    "枫糖浆": "待建：后续模块",
    "桃子": "待建：后续模块",
    "棕色大鸡蛋": "待建：后续模块",
    "樱桃": "待建：后续模块",
    "橙子": "待建：后续模块",
    "橡树树脂": "待建：后续模块",
    "石榴": "待建：后续模块",
    "苹果": "待建：后续模块",
    "虚空精华": "待建：后续模块",
    "蜂蜜": "待建：后续模块",
    "蝙蝠翅膀": "待建：后续模块",
    "鱼籽酱": "待建：后续模块",
    "鸭毛": "待建：后续模块",
    "鸭蛋": "待建：后续模块",
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
  console.log("ℹ 任选型收集包 " + B.filter((b) => b.choose > 0).length + " 个，用例取「" +
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
    "仙子玫瑰", "冷冻泪", "古代玩偶", "可乐", "咖啡", "啤酒", "墨鱼", "夏季紫丁香",
    "太阳精华", "宝石", "山羊奶酪", "松露油", "桃子", "橙子", "油炸鱿鱼", "泡菜",
    "海洋料理", "炖豆", "电池", "石榴", "秋季蔬菜", "绿茶", "罂粟", "羊奶酪",
    "羊毛", "葡萄酒", "蓝莓派", "蕨菜炖饭", "虚空精华", "虚空蛋", "虚空蛋黄酱", "辣鳗鱼",
    "鸵鸟蛋",
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

  /* 材料落点：可跳转 + 已知缺口必须守恒 */
  const CR_GAPS = [
    "史莱姆泥", "夏季亮片种子", "太阳精华", "布料", "松果", "松焦油", "松露油", "枫树种子",
    "枫糖浆", "树液", "橡子", "橡树树脂", "河凝胶", "油", "洞穴凝胶", "海凝胶",
    "矮人小工具", "神秘糖浆", "蓝爵士种子", "虚空精华", "虞美人种子", "虫肉", "蜂蜜", "蝙蝠翅膀",
    "郁金香球茎", "鱼", "鱼饵（物品）|鱼饵", "齐钻", "龙牙",
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

  /* ---------- 10. 视觉资源 ---------- */
  console.log("\n=== 10. 视觉资源（模块图标贴图） ===");

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
  console.log("ℹ 贴图格式：非 PNG 者 " + notPng.length + " 个" + (notPng.length ? "：" + notPng.join(", ") : ""));

  /* 临时文件防漏：deploy.bat 会 git add -A，根目录下遗留的 _ 开头文件会被误提交 */
  const strayTmp = fs.readdirSync(root).filter((f) => f.startsWith("_"));
  log(strayTmp.length === 0,
    "仓库根目录无临时文件残留" + (strayTmp.length ? ": " + strayTmp.join(", ") : ""));

  console.log(failures ? `\n结果：失败 ${failures} 项` : "\n结果：全部通过 ✓");
  process.exit(failures ? 1 : 0);
})();
