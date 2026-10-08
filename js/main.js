/* ============================================================
 * 星露谷物语 · 攻略站交互逻辑
 * ============================================================ */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- 季节工具 ---------- */
const SEASON_CLASS = { 春: "spring", 夏: "summer", 秋: "fall", 冬: "winter" };
function seasonClass(s) { return SEASON_CLASS[s] || "all"; }
function seasonBadges(seasons) {
  const set = new Set(seasons);
  if (SEASONS.every((s) => set.has(s))) return '<span class="badge all">全年</span>';
  return seasons.map((s) => `<span class="badge ${seasonClass(s)}">${s}</span>`).join(" ");
}
function seasonLabel(seasons) {
  return SEASONS.every((s) => seasons.includes(s)) ? "全年" : seasons.join(" / ");
}
function stars(n) {
  if (n <= 0) return "蟹笼";
  const s = Math.min(5, Math.max(1, Math.ceil(n / 20)));
  return '<span class="stars">' + "★".repeat(s) + "☆".repeat(5 - s) + "</span>";
}

/* 部分怪物（如金史莱姆）的属性随它所替换的本体而变，数据中以 0 表示 */
function monsterStat(v) {
  return v > 0 ? String(v) : "随本体";
}

/* ============================================================
 * 农作物经济模型
 * ------------------------------------------------------------
 * 每日净收益 =（28 天季节内总收获额 − 种子价）÷ 末次收获日
 *   单次收获：收获 1 次，末次收获日 = 成熟天数
 *   多次收获：1 + ⌊(28 − 成熟天数) ÷ 再收间隔⌋ 次
 * 该口径与玩家常用的「金/天」一致，用于横向比较作物效率。
 * ============================================================ */
const SEASON_DAYS = 28;

/* 成熟天数容错解析：数据中 growth 可能是数字，也可能是 "6-8" 这样的区间
 * （如水稻近水可提前 2 天成熟）。取区间上限，作为偏保守的收益估算。 */
function cropGrowthDays(c) {
  if (typeof c.growth === "number" && Number.isFinite(c.growth)) return c.growth;
  const nums = String(c.growth == null ? "" : c.growth).match(/\d+/g);
  return nums ? Math.max.apply(null, nums.map(Number)) : 0;
}
function cropGrowthText(c) {
  return typeof c.growth === "number" ? c.growth + " 天" : String(c.growth) + " 天";
}
function cropHarvests(c) {
  const g = cropGrowthDays(c);
  if (c.regrow > 0) {
    const extra = Math.floor((SEASON_DAYS - g) / c.regrow);
    return 1 + (extra > 0 ? extra : 0);
  }
  return 1;
}
function cropLastDay(c) {
  return cropGrowthDays(c) + (cropHarvests(c) - 1) * (c.regrow > 0 ? c.regrow : 0);
}
function cropProfit(c) {
  const last = cropLastDay(c);
  if (!(last > 0)) return 0;
  return (cropHarvests(c) * c.sell - c.seed) / last;
}
function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/* ---------- 通用渲染助手 ---------- */
function chipBar(values, active, onClick) {
  const wrap = document.createElement("div");
  wrap.className = "filter-row";
  values.forEach((v) => {
    const b = document.createElement("button");
    b.className = "filter-chip" + (v.value === active ? " is-active" : "");
    b.textContent = v.label;
    b.addEventListener("click", () => onClick(v.value));
    wrap.appendChild(b);
  });
  return wrap;
}
function emptyState(text) {
  return `<div class="empty-state"><div class="icon">🌱</div><p>${esc(text)}</p></div>`;
}

/* 安全更新计数（元素缺失时静默跳过，避免拖垮整个页面） */
function setCount(id, val) {
  const el = $("#" + id);
  if (el) el.textContent = val;
}

/* 模块标题里的「当前显示 N 条」——未筛选时留空，避免与总数重复 */
function setShown(moduleId, shown, total) {
  const el = $("#shown-" + moduleId);
  if (!el) return;
  el.textContent = shown === total ? "" : ` · 当前显示 ${shown} 条`;
}

/* 计数一律由 renderSection() 统一更新，渲染函数不再各自 setCount，
 * 从根本上消除「新增模块忘写计数」这一类漏配（R1 的机制化版本）。 */
/* 计数：默认写数据条数；注册表声明了 countText 时改用自定义文案
 * （收集包模块显示「已完成 12 / 31 包已齐」，条数对它没有意义） */
function updateModuleCount(section) {
  const total = section.data ? section.data.length : 0;
  const text = typeof section.countText === "function" ? section.countText(total) : total;
  setCount(section.id + "Count", text);
  return total;
}

function controlRow() {
  const row = document.createElement("div");
  row.className = "control-row";
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i]) row.appendChild(arguments[i]);
  }
  return row;
}
function hintNode(text) {
  if (!text) return null;
  const s = document.createElement("span");
  s.className = "toolbar-hint";
  s.textContent = text;
  return s;
}
/* 重渲染会让下拉框失焦，键盘用户每次切换排序都要重新 Tab。
 * 用 pendingFocus 标记本次重建需要归还焦点的控件。 */
let pendingFocus = null;
function sortSelect(options, active, onChange, focusKey) {
  const sel = document.createElement("select");
  sel.className = "sort-select";
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  sel.value = active;
  sel.addEventListener("change", () => onChange(sel.value));
  if (focusKey && pendingFocus === focusKey) {
    pendingFocus = null;
    if (typeof sel.focus === "function") sel.focus();
  }
  return sel;
}

/* 物品图标：真实贴图 + 备用 SVG。
 * 结构上是「贴图在前、兜底垫在后」，靠 CSS 把兜底绝对定位压在贴图下层：
 * 贴图加载成功就自然盖住兜底，失败则 remove() 自己、露出兜底。
 * 注意**不能**靠「加载成功再 remove 兜底」——那条路径依赖 onload，
 * 缓存命中时可能不触发，兜底就会一直盖住贴图（本项目曾因此全站只显示兜底图标）。 */
function itemIconHtml(id, name, svgFallback) {
  return `
      <span class="item-icon">
        <img class="icon-img" src="img/${esc(id)}.png" alt="${esc(name)}" loading="lazy" decoding="async"
             onerror="this.remove()">
        <span class="icon-fallback">${svgFallback}</span>
      </span>`;
}

/* NPC 头像：真实立绘 + emoji 兜底（同样以「立绘在上、兜底在下」保证两者只显示其一） */
function npcIconHtml(id, name, emoji) {
  return `
    <span class="item-icon npc-icon">
      <img class="icon-img" src="img/npc-${esc(id)}.png" alt="${esc(name)}" loading="lazy" decoding="async"
           onerror="this.remove()">
      <span class="icon-fallback npc-fallback">${emoji}</span>
    </span>`;
}

/* 模块图标：真实游戏贴图 + emoji 兜底 */
function moduleIconHtml(m) {
  return `<span class="mod-icon">` +
    `<img src="img/${esc(m.sprite)}.png" alt="" decoding="async" onerror="this.remove()">` +
    `<span class="mod-icon-fallback">${m.icon}</span>` +
    `</span>`;
}

/* ============================================================
 * 各模块渲染
 * ============================================================ */const state = {
  crops: "全部", cropSort: "default",
  collect: "全部",
  fishingLoc: "全部", fishingSeason: "全部",
  mining: "全部", combat: "全部",
  npc: "全部",
  quests: "全部", events: "全部",
  bundles: "全部",
  cooking: "全部", cookSort: "default",
  crafting: "全部", craftSort: "default",
  artisan: "全部",
};

/* 卡片统一带上可点击语义（详情弹窗由 #page 上的事件委托处理） */
function cardAttrs(id) {
  return `class="card clickable" data-id="${esc(id)}" role="button" tabindex="0"`;
}

/* ---- 农作物 ---- */
/* 季节筛选入口。必须覆盖 data.js 中出现过的全部季节，
 * 否则该季节的作物将永远无法通过筛选触达（冬季曾因此漏掉霜瓜）。 */
const CROP_SEASON_FILTERS = ["全部", "春", "夏", "秋", "冬"];
const CROP_SORTS = [
  { value: "default", label: "默认顺序" },
  { value: "profit", label: "每日收益 ↓" },
  { value: "growth", label: "成熟天数 ↑" },
  { value: "sell", label: "售价 ↓" },
  { value: "seed", label: "种子价 ↑" },
];
function sortCrops(list, mode) {
  const arr = list.slice();
  const by = {
    profit: (a, b) => cropProfit(b) - cropProfit(a),
    growth: (a, b) => cropGrowthDays(a) - cropGrowthDays(b),
    sell: (a, b) => b.sell - a.sell,
    seed: (a, b) => a.seed - b.seed,
  }[mode];
  return by ? arr.sort(by) : arr;
}

function renderCrops() {
  const body = $("#body-crops");
  body.innerHTML = "";
  const list = sortCrops(
    CROPS.filter((c) => state.crops === "全部" || c.season.includes(state.crops)),
    state.cropSort
  );
  const total = updateModuleCount(SECTION.crops);
  setShown("crops", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    CROP_SEASON_FILTERS.map((s) => ({ value: s, label: s === "全部" ? "全部" : s + "季" })),
    state.crops,
    (v) => { state.crops = v; renderCrops(); }
  ));
  toolbar.appendChild(controlRow(
    sortSelect(CROP_SORTS, state.cropSort, (v) => {
      state.cropSort = v;
      pendingFocus = "cropSort";
      renderCrops();
    }, "cropSort"),
    hintNode(state.cropSort === "profit" ? "按 28 天季节的每日净收益排序" : "")
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";

  grid.innerHTML = list.map((c) => {
    const harvests = cropHarvests(c);
    const profit = cropProfit(c);
    const growText = c.regrow > 0
      ? `成熟 ${cropGrowthText(c)} · 每 ${c.regrow} 天再收`
      : `成熟 ${cropGrowthText(c)}`;
    return `
      <div ${cardAttrs(c.id)}>
        ${itemIconHtml(c.id, c.name, CROP_ICONS[c.id] || GENERIC_ICON)}
        <h3>${esc(c.name)}</h3>
        <div>${seasonBadges(c.season)}</div>
        <div class="meta">${growText}</div>
        <div class="meta">种子 <span class="gold-text">${c.seed}</span> · 售价 <span class="gold-text">${c.sell}</span></div>
        <div class="foot">
          <div class="profit-row">
            <span class="profit-num${profit < 0 ? " is-negative" : ""}">${fmt1(profit)}</span>
            <span class="profit-unit">金 / 天</span>
            <span class="profit-tag">${harvests > 1 ? `28 天 ×${harvests} 收` : "单次收获"}</span>
          </div>
          <div class="muted">${profit < 0 ? "⚠️ 种子价高于售价，靠收获物回本：" : ""}${esc(c.note)}</div>
        </div>
      </div>`;
  }).join("") || emptyState("该季节暂无作物数据");
  body.appendChild(grid);
}

/* ---- 收集物 ---- */
function renderCollect() {
  const body = $("#body-collect");
  body.innerHTML = "";
  const list = COLLECTIBLES.filter((c) => state.collect === "全部" || c.season.includes(state.collect));
  const total = updateModuleCount(SECTION.collect);
  setShown("collect", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, ...SEASONS.map((s) => ({ value: s, label: s + "季" }))],
    state.collect,
    (v) => { state.collect = v; renderCollect(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((c) => `
    <div ${cardAttrs(c.id)}>
      ${itemIconHtml(c.id, c.name, COLLECT_ICONS[c.id] || GENERIC_ICON)}
      <h3>${esc(c.name)}</h3>
      <div>${seasonBadges(c.season)}</div>
      <div class="meta">📍 ${esc(c.location)}</div>
      <div class="foot">售价 <span class="gold-text">${c.sell}</span><br><span class="muted">${esc(c.use)}</span></div>
    </div>`).join("") || emptyState("该季节暂无采集物数据");
  body.appendChild(grid);
}

/* ---- 钓鱼 ---- */
const FISH_LOCS = ["全部", "山湖", "河流", "海洋", "蟹笼", "矿井", "沙漠", "姜岛", "其他"];
function renderFishing() {
  const body = $("#body-fishing");
  body.innerHTML = "";
  const list = FISH.filter((f) => {
    const okLoc = state.fishingLoc === "全部" || f.locCat === state.fishingLoc;
    const okSea = state.fishingSeason === "全部" || f.season.includes(state.fishingSeason);
    return okLoc && okSea;
  });
  const total = updateModuleCount(SECTION.fishing);
  setShown("fishing", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    chipBar(
      FISH_LOCS.map((l) => ({ value: l, label: l === "全部" ? "全部水域" : l })),
      state.fishingLoc,
      (v) => { state.fishingLoc = v; renderFishing(); }
    ),
    chipBar(
      [{ value: "全部", label: "全部季节" }, ...SEASONS.map((s) => ({ value: s, label: s + "季" }))],
      state.fishingSeason,
      (v) => { state.fishingSeason = v; renderFishing(); }
    )
  );
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((f) => `
    <div ${cardAttrs(f.id)}>
      ${itemIconHtml(f.id, f.name, typeof FISH_ICON !== "undefined" ? FISH_ICON : GENERIC_ICON)}
      <h3>${esc(f.name)}</h3>
      <div><span class="badge brown">${esc(f.location)}</span> ${seasonBadges(f.season)}</div>
      <div class="meta">⏰ ${esc(f.time)} · ☀️ ${esc(f.weather)}</div>
      <div class="meta">难度 ${stars(f.difficulty)}</div>
      <div class="foot">售价 <span class="gold-text">${f.sell}</span><br><span class="muted">${esc(f.use)}</span></div>
    </div>`).join("") || emptyState("没有符合条件的鱼");
  body.appendChild(grid);
}

/* ---- 采矿 ---- */
function renderMining() {
  const body = $("#body-mining");
  body.innerHTML = "";
  const types = [...new Set(MINERALS.map((m) => m.type))];
  const list = MINERALS.filter((m) => state.mining === "全部" || m.type === state.mining);
  const total = updateModuleCount(SECTION.mining);
  setShown("mining", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, ...types.map((t) => ({ value: t, label: t }))],
    state.mining,
    (v) => { state.mining = v; renderMining(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((m) => `
    <div ${cardAttrs(m.id)}>
      ${itemIconHtml(m.id, m.name, MINERAL_ICON)}
      <h3>${esc(m.name)}</h3>
      <div><span class="badge brown">${esc(m.type)}</span></div>
      <div class="meta">📍 ${esc(m.level)}</div>
      <div class="foot">售价 <span class="gold-text">${m.sell}</span><br><span class="muted">${esc(m.use)}</span></div>
    </div>`).join("") || emptyState("没有符合条件的矿物");
  body.appendChild(grid);
}

/* ---- 战斗 ---- */
const COMBAT_LOCS = ["全部", "矿井", "沙漠矿洞", "姜岛", "其他"];
const MAIN_LOCS = ["矿井", "沙漠矿洞", "姜岛"];
function renderCombat() {
  const body = $("#body-combat");
  body.innerHTML = "";
  const list = MONSTERS.filter((m) => {
    if (state.combat === "全部") return true;
    if (state.combat === "其他") return !MAIN_LOCS.some((l) => m.location.includes(l));
    return m.location.includes(state.combat);
  });
  const total = updateModuleCount(SECTION.combat);
  setShown("combat", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    COMBAT_LOCS.map((l) => ({ value: l, label: l })),
    state.combat,
    (v) => { state.combat = v; renderCombat(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((m) => `
    <div ${cardAttrs(m.id)}>
      ${itemIconHtml(m.id, m.name, MONSTER_ICON)}
      <h3>${esc(m.name)}</h3>
      <div><span class="badge red">${esc(m.type)}</span></div>
      <div class="meta">❤️ 生命 ${monsterStat(m.hp)} · ⚡ 伤害 ${monsterStat(m.damage)}</div>
      <div class="meta">📍 ${esc(m.location)}</div>
      <div class="foot">掉落：<span class="chip-list">${m.drops.map((d) => `<span class="chip">${esc(d)}</span>`).join("")}</span></div>
    </div>`).join("") || emptyState("没有符合条件的怪物");
  body.appendChild(grid);
}

/* ---- 任务 ---- */
function renderQuests() {
  const body = $("#body-quests");
  body.innerHTML = "";
  const types = [...new Set(QUESTS.map((q) => q.type))];
  const list = QUESTS.filter((q) => state.quests === "全部" || q.type === state.quests);
  const total = updateModuleCount(SECTION.quests);
  setShown("quests", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, ...types.map((t) => ({ value: t, label: t }))],
    state.quests,
    (v) => { state.quests = v; renderQuests(); }
  ));
  body.appendChild(toolbar);

  const wrap = document.createElement("div");
  wrap.className = "list";
  wrap.innerHTML = list.map((q) => `
    <div class="list-item clickable" data-id="${esc(q.id)}" role="button" tabindex="0">
      <h3>${esc(q.name)} <span class="badge gold">${esc(q.type)}</span></h3>
      <p class="desc">${esc(q.objective)}</p>
      <div class="kv"><span>来源：<b>${esc(q.source)}</b></span><span>奖励：<b class="gold-text">${esc(q.reward)}</b></span></div>
    </div>`).join("") || emptyState("没有符合条件的任务");
  body.appendChild(wrap);
}

/* ---- NPC ---- */
const NPC_AVATARS = ["💜", "🎨", "📚", "🔬", "✨", "📷", "🎸", "💻", "🏈", "🩺", "🖋️", "🐔", "🪚", "🔨", "🐄", "🏪", "🎣", "🏛️"];
function npcAvatar(i) { return NPC_AVATARS[i % NPC_AVATARS.length]; }

function renderNpc() {
  const body = $("#body-npc");
  body.innerHTML = "";
  const list = NPCS.filter((n) =>
    state.npc === "全部" || (state.npc === "可婚" ? n.marriageable : !n.marriageable)
  );
  const total = updateModuleCount(SECTION.npc);
  setShown("npc", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, { value: "可婚", label: "可结婚" }, { value: "不可婚", label: "不可结婚" }],
    state.npc,
    (v) => { state.npc = v; renderNpc(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((n) => {
    const idx = NPCS.indexOf(n);
    return `
      <div class="card clickable npc-card" data-id="${esc(n.id)}" role="button" tabindex="0">
        ${npcIconHtml(n.id, n.name, npcAvatar(idx))}
        <h3>${esc(n.name)}</h3>
        <p class="loc">📍 ${esc(n.location)}</p>
        <div class="meta">🎂 ${esc(n.birthday)} · ${n.marriageable ? '<span class="badge green">可结婚</span>' : '<span class="badge brown">不可结婚</span>'}</div>
        <div class="foot">最爱：${n.loves.map(giftChip).join("")}</div>
      </div>`;
  }).join("") || emptyState("没有找到匹配的 NPC");
  body.appendChild(grid);
}

/* ---- 节日 ---- */
const SEASON_ORDER = { 春: 0, 夏: 1, 秋: 2, 冬: 3 };
function renderFestivals() {
  const body = $("#body-festivals");
  const dayNum = (d) => parseInt(String(d), 10) || 0;
  const sorted = [...FESTIVALS].sort((a, b) => (SEASON_ORDER[a.season] - SEASON_ORDER[b.season]) || (dayNum(a.day) - dayNum(b.day)));
  const total = updateModuleCount(SECTION.festivals);
  setShown("festivals", sorted.length, total);
  const wrap = document.createElement("div");
  wrap.className = "list";
  wrap.innerHTML = sorted.map((f) => `
    <div class="list-item clickable" data-id="${esc(f.id)}" role="button" tabindex="0">
      <h3>🎉 ${esc(f.name)} <span class="badge ${seasonClass(f.season)}">${f.season} · ${f.day} 日</span></h3>
      <p class="desc">${esc(f.desc)}</p>
      <div class="kv"><span>地点：<b>${esc(f.location)}</b></span><span>时间：<b>${esc(f.time)}</b></span></div>
    </div>`).join("");
  body.innerHTML = "";
  body.appendChild(wrap);
}

/* ---- 收集包（社区中心） ---- */
/* 进度存 localStorage：{ 包 id: [已勾选的槽位下标] }。
 * 用「槽位下标」而非计数，才能记住玩家在「任选 N 个」包里具体选了哪几个。 */
const BUNDLE_PROGRESS_KEY = "xlg.bundleProgress.v1";
const BUNDLE_QUALITY_LABEL = { gold: "金星", silver: "银星", iridium: "铱星" };
let bundleResetArmed = false;
let bundleResetTimer = null;

/* 收集包「需要提交的格数」与「可选物品总数」是两个概念：
 * 全交包两者相等；任选包（choose>0）只需交 choose 格，物品却可能多得多。
 * 混用会导致任选包永远判不出「已完成」（曾把 9 种物品当成要交 9 格）。 */
function bundleNeeded(b) {
  if (b.price) return 0;
  const items = (b.items || []).length;
  return b.choose > 0 ? Math.min(b.choose, items) : items;
}
function bundleSlotCount(b) {
  return b.price ? 0 : (b.items || []).length;
}
function bundleItemNames(it) {
  return it.alts && it.alts.length ? it.alts : [it.name];
}
function bundleItemLabel(it) {
  const names = bundleItemNames(it);
  return names.map((n) => (it.qty > 1 ? n + " ×" + it.qty : n)).join(" / ");
}

/* localStorage 在隐私模式/沙箱下可能抛错，读写一律兜住，绝不让存储问题拖垮整页 */
function readBundleProgress() {
  try {
    const raw = localStorage.getItem(BUNDLE_PROGRESS_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (err) { return {}; }
}
function writeBundleProgress(obj) {
  try { localStorage.setItem(BUNDLE_PROGRESS_KEY, JSON.stringify(obj)); } catch (err) { /* 忽略 */ }
}
/* 进度读取：下标一律归一化为整数再返回。
 * 必须容忍字符串下标——DOM 的 dataset 取回来是 "0" 而不是 0，
 * 早期版本用 Number.isInteger 过滤会把它整条丢掉，造成「界面显示已勾选、
 * 实际进度为 0」的静默不一致（勾选看着生效，刷新后又没了）。 */
function slotIndexList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= 0 && out.indexOf(n) < 0) out.push(n);
  }
  return out;
}
/* 同时接受「包 id」与「包对象」：早期只接受 id，传入对象时会静默返回空数组
 * （查不到 key），表现为「明明勾选了却显示 0」，且不报任何错。 */
function bundleProgress(idOrBundle) {
  const id = idOrBundle && typeof idOrBundle === "object" ? idOrBundle.id : idOrBundle;
  return slotIndexList(readBundleProgress()[id]);
}
function bundleFilled(b) {
  const needed = bundleNeeded(b);
  const total = bundleSlotCount(b);
  const n = bundleProgress(b.id).filter((i) => i < total).length;
  return Math.min(n, needed);
}
function isBundleDone(b) {
  const needed = bundleNeeded(b);
  return needed > 0 && bundleFilled(b) >= needed;
}
function doneBundleCount() {
  return (SECTION.bundles ? SECTION.bundles.data : []).filter(isBundleDone).length;
}
/* 切换某个槽位的捐赠状态；返回是否发生变化。
 * 已完成的包**允许撤销**——游戏里提交后仍可取回物品，进度面板也不该比游戏更死板。 */
function toggleBundleSlot(b, index, on) {
  const total = bundleSlotCount(b);
  const slot = Number(index);            /* 收口成数字：调用方可能传 dataset 里的字符串 */
  if (!Number.isInteger(slot) || slot < 0 || slot >= total) return false;
  const next = bundleProgress(b.id).filter((i) => i < total);
  const has = next.indexOf(slot) >= 0;
  if ((on === true && has) || (on === false && !has)) return false;
  if (!has) next.push(slot);
  else if (on === false || on === undefined) next.splice(next.indexOf(slot), 1);
  const all = readBundleProgress();
  all[b.id] = next;
  writeBundleProgress(all);
  return true;
}
function clearBundleProgress() {
  writeBundleProgress({});
  pendingFocus = "bundleReset";
}

/* 收集包物品 → 站内条目（用于交叉跳转） */
function bundleItemChip(name) {
  const hit = BUNDLE_ITEM_INDEX.get(name);
  if (!hit) return `<span class="chip">${esc(name)}</span>`;
  return `<span class="chip chip-link" data-goto-module="${esc(hit.module)}" data-goto-id="${esc(hit.id)}" role="button" tabindex="0" title="查看${esc(name)}">${esc(name)}</span>`;
}
function bundleQualityTag(q) {
  return q ? ` <span class="bundle-quality">${esc(BUNDLE_QUALITY_LABEL[q] || q)}</span>` : "";
}

function renderBundles() {
  const body = $("#body-bundles");
  body.innerHTML = "";
  const list = BUNDLES.filter((b) => state.bundles === "全部" || b.room === state.bundles);
  const total = updateModuleCount(SECTION.bundles);
  setShown("bundles", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部房间" }, ...BUNDLE_ROOMS.map((r) => ({ value: r.name, label: r.name + " " + r.count }))],
    state.bundles,
    (v) => { state.bundles = v; renderBundles(); }
  ));
  body.appendChild(toolbar);

  const hint = document.createElement("p");
  hint.className = "bundle-hint";
  hint.textContent = "勾选表示已捐赠。进度保存在本机浏览器，可随时清空。";
  const resetBtn = document.createElement("button");
  resetBtn.className = "bundle-reset" + (bundleResetArmed ? " is-armed" : "");
  resetBtn.textContent = bundleResetArmed ? "再点一次确认清空" : "清空进度";
  if (pendingFocus === "bundleReset") { pendingFocus = null; if (typeof resetBtn.focus === "function") resetBtn.focus(); }
  resetBtn.addEventListener("click", () => {
    if (!bundleResetArmed) {
      bundleResetArmed = true;
      if (bundleResetTimer) clearTimeout(bundleResetTimer);
      bundleResetTimer = setTimeout(() => { bundleResetArmed = false; renderBundles(); }, 4000);
      renderBundles();
      return;
    }
    bundleResetArmed = false;
    if (bundleResetTimer) clearTimeout(bundleResetTimer);
    clearBundleProgress();
    renderBundles();
  });
  const row = document.createElement("div");
  row.className = "bundle-actions";
  row.appendChild(hint);
  row.appendChild(resetBtn);
  body.appendChild(row);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((b) => {
    const needed = bundleNeeded(b);
    const filled = bundleFilled(b);
    const done = isBundleDone(b);
    const pct = needed ? Math.round((filled / needed) * 100) : 0;
    const rew = (b.rewards || []).map((r) => r.name + (r.qty > 1 ? " ×" + r.qty : "")).join("、") || "—";

    const chips = b.price
      ? `<div class="bundle-items"><span class="bundle-price">💰 ${b.price} 金</span></div>`
      : `<div class="bundle-items">` + (b.items || []).map((it, i) => {
        const on = bundleProgress(b.id).indexOf(i) >= 0;
        const label = bundleItemLabel(it);
        return `<button class="bundle-item${on ? " is-done" : ""}" data-bundle="${esc(b.id)}" data-slot="${i}"` +
          ` role="checkbox" aria-checked="${on ? "true" : "false"}" title="${esc(label)}">` +
          `<span class="bundle-box">${on ? "✔" : ""}</span><span class="bundle-item-text">${esc(label)}</span></button>`;
      }).join("") + `</div>`;

    return `
      <div class="card clickable bundle-card${done ? " is-done" : ""}" data-id="${esc(b.id)}" role="button" tabindex="0">
        <h3>${esc(b.name)} <span class="badge brown">${esc(b.room)}</span></h3>
        <div class="bundle-progress">
          <div class="bundle-bar"><i style="width: ${pct}%"></i></div>
          <span class="bundle-count">${b.price ? "待购买" : filled + " / " + needed + (b.choose ? "（任选）" : "")}</span>
        </div>
        ${chips}
        <div class="foot">奖励 <span class="gold-text">${esc(rew)}</span></div>
      </div>`;
  }).join("") || emptyState("该房间暂无收集包数据");
  body.appendChild(grid);
}

/* ---- 料理（烹饪） ---- */
const COOK_SORTS = [
  { value: "default", label: "默认顺序" },
  { value: "sell", label: "售价 ↓" },
  { value: "energy", label: "回复体力 ↓" },
  { value: "ingredients", label: "原料数 ↑" },
];
function sortCooking(list, mode) {
  const arr = list.slice();
  const by = {
    sell: (a, b) => b.sell - a.sell,
    energy: (a, b) => b.edibility - a.edibility,
    ingredients: (a, b) => (a.ingredients || []).length - (b.ingredients || []).length,
  }[mode];
  return by ? arr.sort(by) : arr;
}
function renderCooking() {
  const body = $("#body-cooking");
  body.innerHTML = "";
  const list = sortCooking(
    COOKING.filter((c) => state.cooking === "全部" || (state.cooking === "有增益" ? (c.buffs || []).length > 0 : !(c.buffs || []).length)),
    state.cookSort
  );
  const total = updateModuleCount(SECTION.cooking);
  setShown("cooking", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, { value: "有增益", label: "有增益" }, { value: "无增益", label: "无增益" }],
    state.cooking,
    (v) => { state.cooking = v; renderCooking(); }
  ));
  toolbar.appendChild(controlRow(
    sortSelect(COOK_SORTS, state.cookSort, (v) => {
      state.cookSort = v;
      pendingFocus = "cookSort";
      renderCooking();
    }, "cookSort"),
    hintNode(state.cookSort === "sell" ? "按基础售价排序（不含品质加成）" : "")
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((c) => `
    <div ${cardAttrs(c.id)}>
      ${itemIconHtml(c.id, c.name, GENERIC_ICON)}
      <h3>${esc(c.name)}</h3>
      <div class="meta">售价 <span class="gold-text">${c.sell}</span> · 回复体力 ${c.edibility}</div>
      ${buffChips(c.buffs)}
      <div class="meta">🧺 ${(c.ingredients || []).map((i) => esc(i.name) + (i.qty > 1 ? "×" + i.qty : "")).join("、")}</div>
      <div class="foot"><span class="muted">${c.source ? "菜谱：" + esc(c.source) : "菜谱获取方式见详情"}</span></div>
    </div>`).join("") || emptyState("没有符合条件的料理");
  body.appendChild(grid);
}

/* ---- 事件 ---- */
/* ---- 打造（制造配方） ---- */
const CRAFT_SORTS = [
  { value: "default", label: "默认顺序" },
  { value: "sell", label: "售价 ↓" },
  { value: "materials", label: "材料数 ↑" },
];
function sortCrafting(list, mode) {
  const arr = list.slice();
  const by = {
    sell: (a, b) => (b.sell || 0) - (a.sell || 0),
    materials: (a, b) => (a.ingredients || []).length - (b.ingredients || []).length,
  }[mode];
  return by ? arr.sort(by) : arr;
}
/* 每次打造的产出数量（大于 1 时在名称后标出，如「顶级肥料 ×5」） */
function craftOut(r) {
  return r.count > 1 ? ` ×${r.count}` : "";
}
/* 材料 chip：能对上站内条目的可跳转（如「木材」→ 采矿） */
function craftMaterialChip(ing) {
  const hit = NAME_INDEX.get(ing.name);
  const label = esc(ing.name) + (ing.qty > 1 ? ` ×${ing.qty}` : "");
  if (!hit) return `<span class="chip">${label}</span>`;
  return `<span class="chip chip-link" data-goto-module="${esc(hit.module)}" data-goto-id="${esc(hit.id)}" role="button" tabindex="0" title="查看${esc(ing.name)}">${label}</span>`;
}
function renderCrafting() {
  const body = $("#body-crafting");
  body.innerHTML = "";
  const list = sortCrafting(
    CRAFTING.filter((c) => state.crafting === "全部" || c.cat === state.crafting),
    state.craftSort
  );
  const total = updateModuleCount(SECTION.crafting);
  setShown("crafting", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部分类" }].concat(CRAFT_CATS.map((c) => ({ value: c, label: c }))),
    state.crafting,
    (v) => { state.crafting = v; renderCrafting(); }
  ));
  toolbar.appendChild(controlRow(
    sortSelect(CRAFT_SORTS, state.craftSort, (v) => {
      state.craftSort = v;
      pendingFocus = "craftSort";
      renderCrafting();
    }, "craftSort"),
    hintNode(state.craftSort === "sell" ? "按基础售价排序（围栏/地板等无售价者排在后面）" : "")
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((c) => `
    <div ${cardAttrs(c.id)}>
      ${itemIconHtml(c.id, c.name, GENERIC_ICON)}
      <h3>${esc(c.name)}${craftOut(c)} <span class="badge brown">${esc(c.cat)}</span></h3>
      ${(c.ingredients || []).length
        ? `<div class="chip-list">${c.ingredients.map(craftMaterialChip).join("")}</div>`
        : `<div class="meta">无材料</div>`}
      <div class="foot">${c.sell ? `售价 <span class="gold-text">${c.sell}</span> · ` : ""}<span class="muted">配方：${esc(c.source || "—")}</span></div>
    </div>`).join("") || emptyState("该分类暂无配方");
  body.appendChild(grid);
}

/* ---- 工匠制品（加工品） ---- */
/* 产出机器清单：从数据派生，保证筛选入口随数据自动扩展（R17 的口径） */
function artisanMachines() {
  const set = [];
  ARTISAN.forEach((a) => (a.machines || []).forEach((m) => { if (set.indexOf(m) < 0) set.push(m); }));
  return set;
}
function renderArtisan() {
  const body = $("#body-artisan");
  body.innerHTML = "";
  const list = ARTISAN.filter((a) => state.artisan === "全部" || (a.machines || []).indexOf(state.artisan) >= 0);
  const total = updateModuleCount(SECTION.artisan);
  setShown("artisan", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部机器" }].concat(artisanMachines().map((m) => ({ value: m, label: m }))),
    state.artisan,
    (v) => { state.artisan = v; renderArtisan(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.innerHTML = list.map((a) => `
    <div ${cardAttrs(a.id)}>
      ${itemIconHtml(a.id, a.name, GENERIC_ICON)}
      <h3>${esc(a.name)}</h3>
      <div class="chip-list">${(a.machines || []).map((m) => `<span class="chip chip-machine">${esc(m)}</span>`).join("")}</div>
      <div class="foot">
        ${a.sell ? `售价 <span class="gold-text">${a.sell}</span>` : `<span class="muted">售价随原料浮动</span>`}
        ${(a.mats || []).length ? `<br><span class="muted">原料：${esc((a.mats || []).join(" / "))}</span>` : ""}
      </div>
    </div>`).join("") || emptyState("该机器暂无产物");
  body.appendChild(grid);
}

/* ---- 事件 ---- */
function renderEvents() {
  const body = $("#body-events");
  body.innerHTML = "";
  const list = EVENTS.filter((e) => state.events === "全部" || e.type === state.events);
  const total = updateModuleCount(SECTION.events);
  setShown("events", list.length, total);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, { value: "随机事件", label: "随机事件" }, { value: "心事件", label: "心事件" }],
    state.events,
    (v) => { state.events = v; renderEvents(); }
  ));
  body.appendChild(toolbar);

  const wrap = document.createElement("div");
  wrap.className = "list";
  wrap.innerHTML = list.map((e) => `
    <div class="list-item clickable" data-id="${esc(e.id)}" role="button" tabindex="0">
      <h3>✨ ${esc(e.name)} <span class="badge ${e.type === "随机事件" ? "gold" : "green"}">${esc(e.type)}</span></h3>
      <p class="desc">${esc(e.desc)}</p>
      <div class="kv"><span>触发：<b>${esc(e.trigger)}</b></span></div>
    </div>`).join("") || emptyState("没有符合条件的事件");
  body.appendChild(wrap);
}

/* ============================================================
 * 模块注册表（唯一事实来源）
 * ------------------------------------------------------------
 * 每个模块的全部能力都声明在这一处：
 *   label/sub/sprite/icon  导航与标题
 *   data                   数据数组（计数、搜索索引、自检都从这里取）
 *   render                 渲染函数
 *   stateKey/resetFilter   筛选状态与「跳转前重置」
 *   detail                 详情弹窗渲染函数
 *   indexExtra             搜索索引的附加关键词（用途、掉落、礼物…）
 * 新增模块只需在这里加一项 + 在 data.js 加一个数组，
 * 不再需要改动 FILTER_RESET / DETAIL_RENDERERS / buildIndex / check.js 四处。
 * ============================================================ */
const REGISTRY = [
  {
    id: "crops", stateKey: ["crops", "cropSort"], spriteFor: "", sprite: "parsnip", icon: "🌾", label: "农作物",
    sub: "各季节作物成熟时间、价格与收益", data: "CROPS", render: renderCrops,
    resetFilter: (s) => { s.crops = "全部"; s.cropSort = "default"; },
    detail: (c) => detailHead(
      itemIconHtml(c.id, c.name, CROP_ICONS[c.id] || GENERIC_ICON),
      c.name,
      esc(seasonLabel(c.season)) + " · " + (c.regrow > 0 ? "可多次收获" : "单次收获")
    ) +
      detailSection("经济数据", kvGrid([
        ["种子价", c.seed + " 金"],
        ["售价", c.sell + " 金"],
        ["单收净利", money(c.sell - c.seed)],
        ["每日净收益", raw(`<b class="${cropProfit(c) < 0 ? "neg-text" : "gold-text"}">${fmt1(cropProfit(c))}</b> 金/天`)],
        ["成熟天数", cropGrowthText(c)],
        ["再收间隔", c.regrow > 0 ? c.regrow + " 天" : "—"],
        ["28 天可收", cropHarvests(c) + " 次"],
        ["季节总收益", money(cropHarvests(c) * c.sell - c.seed)],
      ])) +
      detailSection("备注", `<p>${esc(c.note)}</p>`) +
      giftUsesSection(c.name) +
      bundleUsesSection(c.name) +
      cookedBySection(c.name) +
      craftedBySection(c.name) +
      detailSection("算法说明", `<p class="muted">每日净收益 =（28 天季节内总收获额 − 种子价）÷ 末次收获日（第 ${cropLastDay(c)} 天）。多季作物按单季 28 天估算。</p>`),
  },
  {
    id: "collect", stateKey: ["collect"], spriteFor: "", sprite: "common-mushroom", icon: "🍄", label: "收集物",
    sub: "野外采集物品的季节与地点", data: "COLLECTIBLES", render: renderCollect,
    resetFilter: (s) => { s.collect = "全部"; },
    indexExtra: (c) => [c.use],
    detail: (c) => detailHead(
      itemIconHtml(c.id, c.name, COLLECT_ICONS[c.id] || GENERIC_ICON),
      c.name,
      esc(seasonLabel(c.season)) + " · 野外采集"
    ) +
      detailSection("基础信息", kvGrid([
        ["季节", seasonLabel(c.season)],
        ["采集地点", c.location],
        ["售价", c.sell + " 金"],
      ])) +
      detailSection("用途", `<p>${esc(c.use)}</p>`) +
      giftUsesSection(c.name) +
      bundleUsesSection(c.name) +
      cookedBySection(c.name),
  },
  {
    id: "fishing", stateKey: ["fishingLoc", "fishingSeason"], spriteFor: "", sprite: "legend", icon: "🎣", label: "钓鱼",
    sub: "鱼类出现的水域、季节与时间", data: "FISH", render: renderFishing,
    resetFilter: (s) => { s.fishingLoc = "全部"; s.fishingSeason = "全部"; },
    indexExtra: (f) => [f.use, f.location],
    detail: (f) => detailHead(
      itemIconHtml(f.id, f.name, typeof FISH_ICON !== "undefined" ? FISH_ICON : GENERIC_ICON),
      f.name,
      esc(f.location) + " · " + esc(seasonLabel(f.season))
    ) +
      detailSection("出没条件", kvGrid([
        ["水域", f.location],
        ["季节", seasonLabel(f.season)],
        ["时间", f.time],
        ["天气", f.weather],
        ["难度", raw(stars(f.difficulty) + ` <span class="muted">(${f.difficulty})</span>`)],
      ])) +
      detailSection("经济", kvGrid([["售价", f.sell + " 金"]])) +
      detailSection("用途", `<p>${esc(f.use)}</p>`) +
      giftUsesSection(f.name) +
      bundleUsesSection(f.name) +
      cookedBySection(f.name) +
      craftedBySection(f.name),
  },
  {
    id: "mining", stateKey: ["mining"], spriteFor: "", sprite: "diamond", icon: "⛏️", label: "采矿",
    sub: "矿石与宝石的分布层级", data: "MINERALS", render: renderMining,
    indexExtra: (m) => [m.use, m.type, m.level],
    detail: (m) => detailHead(itemIconHtml(m.id, m.name, MINERAL_ICON), m.name, esc(m.type)) +
      detailSection("分布", kvGrid([
        ["类型", m.type],
        ["出现层级", m.level],
        ["售价", m.sell + " 金"],
      ])) +
      detailSection("用途", `<p>${esc(m.use)}</p>`) +
      giftUsesSection(m.name) +
      bundleUsesSection(m.name) +
      cookedBySection(m.name) +
      craftedBySection(m.name),
  },
  {
    id: "combat", stateKey: ["combat"], spriteFor: "", sprite: "green-slime", icon: "⚔️", label: "战斗",
    sub: "怪物属性、出没地点与掉落", data: "MONSTERS", render: renderCombat,
    indexExtra: (m) => [m.type, m.location].concat(m.drops || []),
    detail: (m) => detailHead(
      itemIconHtml(m.id, m.name, MONSTER_ICON),
      m.name,
      esc(m.type) + " · " + esc(m.location)
    ) +
      detailSection("属性", kvGrid([
        ["生命值", monsterStat(m.hp)],
        ["伤害", monsterStat(m.damage)],
        ["类型", m.type],
        ["出没地点", m.location],
      ])) +
      giftUsesSection(m.name) +
      bundleUsesSection(m.name) +
      cookedBySection(m.name) +
      detailSection("掉落物", `<div class="chip-list">${m.drops.map(linkChip).join("")}</div>` +
        (m.drops.some((d) => NAME_INDEX.has(d)) ? `<p class="muted">带下划线的掉落物可点击跳转。</p>` : "")),
  },
  {
    id: "quests", stateKey: ["quests"], sprite: "star-shard", icon: "📜", label: "任务",
    sub: "主线与委托任务的目标与奖励", data: "QUESTS", render: renderQuests,
    indexExtra: (q) => [q.objective, q.source, q.type],
    detail: (q) => detailHead(emojiIcon("📜"), q.name, esc(q.type)) +
      detailSection("任务目标", `<p>${esc(q.objective)}</p>`) +
      detailSection("来源与奖励", kvGrid([
        ["来源", q.source],
        ["类型", q.type],
        ["奖励", q.reward],
      ])),
  },
  {
    id: "npc", stateKey: ["npc"], spriteFor: "npc-", sprite: "npc-abigail", icon: "👤", label: "NPC",
    sub: "村民生日、最爱礼物与住址", data: "NPCS", render: renderNpc,
    indexExtra: (n) => n.loves.concat([n.birthday, n.location]),
    detail: (n) => detailHead(
      npcIconHtml(n.id, n.name, npcAvatar(NPCS.indexOf(n))),
      n.name,
      `📍 ${esc(n.location)} · ${n.marriageable ? "可结婚" : "不可结婚"}`
    ) +
      detailSection("简介", `<p>${esc(n.desc)}</p>`) +
      detailSection("生日", `<p>🎂 ${esc(n.birthday)}</p>`) +
      detailSection("最爱的礼物", `<div class="chip-list">${n.loves.map(giftChip).join("")}</div>` +
        (n.loves.some((g) => NAME_INDEX.has(g)) ? `<p class="muted">带下划线的礼物可点击查看该物品。</p>` : "")) +
      bundleUsesSection(n.name),
  },
  {
    id: "festivals", stateKey: [], sprite: "pumpkin", icon: "🎉", label: "节日",
    sub: "全年节日的日期、地点与玩法", data: "FESTIVALS", render: renderFestivals,
    indexExtra: (f) => [f.location, f.desc],
    detail: (f) => detailHead(emojiIcon("🎉"), f.name, `${esc(f.season)}季 ${esc(String(f.day))} 日`) +
      detailSection("时间地点", kvGrid([
        ["季节", f.season],
        ["日期", f.day + " 日"],
        ["地点", f.location],
        ["时间", f.time],
      ])) +
      detailSection("介绍", `<p>${esc(f.desc)}</p>`),
  },
  {
    id: "events", stateKey: ["events"], sprite: "fairy-rose", icon: "✨", label: "事件",
    sub: "随机事件与心事件的触发条件", data: "EVENTS", render: renderEvents,
    indexExtra: (e) => [e.trigger, e.type],
    detail: (e) => detailHead(emojiIcon("✨"), e.name, esc(e.type)) +
      detailSection("触发条件", `<p>${esc(e.trigger)}</p>`) +
      detailSection("说明", `<p>${esc(e.desc)}</p>`),
  },
  {
    id: "bundles", stateKey: ["bundles"], sprite: "npc-junimo", icon: "📦", label: "收集包",
    sub: "社区中心各房间的收集包物品与奖励", data: "BUNDLES", render: renderBundles,
    resetFilter: (s) => { s.bundles = "全部"; },
    /* 计数文案：收集包模块的核心信息是进度而非条数（后缀由标题模板决定，
     * 故这里自带单位，末尾不再追加「条」） */
    countText: () => doneBundleCount() + " / " + BUNDLES.length + " 包已齐",
    countSuffix: "",
    indexExtra: (b) => [b.room].concat((b.rewards || []).map((r) => r.name)),
    detail: (b) => {
      const needed = bundleNeeded(b);
      const done = isBundleDone(b);
      const filled = bundleFilled(b);
      const room = BUNDLE_ROOMS.find((r) => r.name === b.room);
      const rew = (b.rewards || []).map((r) => `${esc(r.name)} ×${r.qty}`).join("、") || "—";
      const head = detailHead(emojiIcon("📦"), b.name,
        `${esc(b.room)}${room && room.sub ? " · " + esc(room.sub) : ""}`);

      const need = b.price
        ? `<p>在社区中心金库点击「购买」按钮即可完成，需 <b class="gold-text">${b.price} 金</b>。</p>`
        : `<div class="bundle-need">` + (b.items || []).map((it, i) => {
          const on = bundleProgress(b.id).indexOf(i) >= 0;
          const links = bundleItemNames(it).map(bundleItemChip).join(` <span class="or-text">或</span> `);
          return `<div class="bundle-need-row${on ? " is-done" : ""}">` +
            `<button class="bundle-item" data-bundle-detail="${esc(b.id)}" data-slot="${i}" role="checkbox" aria-checked="${on ? "true" : "false"}">` +
            `<span class="bundle-box">${on ? "✔" : ""}</span></button>` +
            `<span class="bundle-need-name">${links}${bundleQualityTag(it.quality)}` +
            (it.qty > 1 ? ` <b class="gold-text">×${it.qty}</b>` : "") + `</span></div>`;
        }).join("") + `</div>`;

      const progress = b.price ? "" : detailSection("进度",
        `<p>${done ? "✅ 该收集包已完成" : `已捐赠 <b class="gold-text">${filled}</b> / ${needed} 格`}` +
        (b.choose ? `（共 ${(b.items || []).length} 种物品，任选 ${b.choose} 种提交即可）` : "") + `</p>`);

      return head + progress +
        detailSection(b.price ? "完成方式" : "所需物品", need) +
        detailSection("奖励", `<p>${rew}</p>`) +
        (room && room.sub ? detailSection("完成该房间", `<p>${esc(room.sub)}</p>`) : "");
    },
  },
  {
    id: "artisan", stateKey: ["artisan"], spriteFor: "", sprite: "cheese-press", icon: "🧀", label: "工匠制品",
    sub: "加工品的产出机器、原料与售价", data: "ARTISAN", render: renderArtisan,
    resetFilter: (s) => { s.artisan = "全部"; },
    indexExtra: (a) => (a.machines || []).concat(a.mats || []),
    detail: (a) => detailHead(itemIconHtml(a.id, a.name, GENERIC_ICON), a.name,
      (a.machines || []).join(" / ") + " 产出") +
      detailSection("数值", kvGrid([
        ["基础售价", a.sell ? a.sell + " 金" : "随原料浮动"],
        ["计价规则", a.priceNote || "—"],
        ["产出机器", (a.machines || []).join("、") || "—"],
        ["所需原料", (a.mats || []).join("、") || "—"],
      ])) +
      (a.priceNote ? detailSection("为什么是浮动价", `<p>${esc("这类加工品的售价取决于投入原料的价值，因此没有固定售价：" + a.priceNote + "。选贵的原料产出更值钱。")}</p>`) : "") +
      detailSection("用途", `<p>${esc("可用于送礼、完成收集包，或直接出售换取金币。")}</p>`) +
      giftUsesSection(a.name) +
      bundleUsesSection(a.name) +
      detailSection("产出机器", `<div class="chip-list">${(a.machines || []).map((m) => {
        const rec = CRAFTING.find((c) => c.name === m);
        return rec
          ? `<span class="chip chip-link" data-goto-module="crafting" data-goto-id="${esc(rec.id)}" role="button" tabindex="0" title="查看${esc(m)}">🔨 ${esc(m)}</span>`
          : `<span class="chip chip-machine">${esc(m)}</span>`;
      }).join("")}</div>` +
        ((a.machines || []).some((m) => CRAFTING.some((c) => c.name === m)) ? `<p class="muted">带下划线的机器可点击查看打造配方。</p>` : "")),
  },
  {
    id: "crafting", stateKey: ["crafting", "craftSort"], spriteFor: "", sprite: "furnace", icon: "🔨", label: "打造",
    sub: "制造配方的所需材料与获取方式", data: "CRAFTING", render: renderCrafting,
    resetFilter: (s) => { s.crafting = "全部"; s.craftSort = "default"; },
    indexExtra: (c) => [c.cat, c.source].concat((c.ingredients || []).map((i) => i.name)),
    detail: (c) => {
      const mats = (c.ingredients || []);
      return detailHead(itemIconHtml(c.id, c.name, GENERIC_ICON), c.name,
        esc(c.cat) + (c.count > 1 ? " · 每次打造产出 " + c.count + " 个" : "")) +
        detailSection("数值", kvGrid([
          ["分类", c.cat],
          ["售价", (c.sell ? c.sell + " 金" : "—")],
          ["每次产出", (c.count || 1) + " 个"],
          ["材料种类", mats.length + " 种"],
        ])) +
        detailSection("所需材料", `<div class="chip-list">${mats.map(craftMaterialChip).join("") || "<span class='muted'>—</span>"}</div>` +
          (mats.some((i) => NAME_INDEX.has(i.name)) ? `<p class="muted">带下划线的材料可点击查看。</p>` : "")) +
        (c.source ? detailSection("配方获取", `<p>${esc(c.source)}</p>`) : "") +
        detailSection("用途", `<p>${esc("打造完成后可用于农场经营、采矿或送礼。")}</p>`) +
        giftUsesSection(c.name) +
        bundleUsesSection(c.name) +
        craftedBySection(c.name);
    },
  },
  {
    id: "cooking", stateKey: ["cooking", "cookSort"], spriteFor: "", sprite: "cookout-kit", icon: "🍳", label: "料理",
    sub: "菜肴的原料、回复体力和食用增益", data: "COOKING", render: renderCooking,
    resetFilter: (s) => { s.cooking = "全部"; s.cookSort = "default"; },
    indexExtra: (c) => [c.source].concat(c.buffs || []).concat((c.ingredients || []).map((i) => i.name)),
    detail: (c) => {
      const ing = (c.ingredients || []).map(ingredientChip).join(" ");
      return detailHead(itemIconHtml(c.id, c.name, GENERIC_ICON), c.name,
        (c.buffs && c.buffs.length ? "食用有增益" : "食用无增益") + (c.duration ? " · 持续 " + esc(c.duration) : "")) +
        detailSection("数值", kvGrid([
          ["售价", c.sell + " 金"],
          ["回复体力", String(c.edibility)],
          ["增益", (c.buffs && c.buffs.length) ? c.buffs.join(" / ") : "—"],
          ["持续时间", c.duration || "—"],
        ])) +
        detailSection("所需原料", `<div class="chip-list">${ing || "<span class='muted'>—</span>"}</div>` +
          ((c.ingredients || []).some((i) => NAME_INDEX.has(i.name)) ? `<p class="muted">带下划线的原料可点击查看。</p>` : "")) +
        (c.source ? detailSection("菜谱获取", `<p>${esc(c.source)}</p>`) : "") +
        detailSection("用途", `<p>${esc("可用于送礼、完成收集包或直接食用回复体力。")}</p>`) +
        giftUsesSection(c.name) +
        bundleUsesSection(c.name) +
        cookedBySection(c.name);
    },
  },
];

/* 数据数组名 → 数组（在浏览器里等价于全局 const，自检时由数据侧驱动遍历） */
const MODULE_DATA = {
  CROPS, COLLECTIBLES, FISH, MINERALS, MONSTERS, QUESTS, NPCS, FESTIVALS, EVENTS,
  BUNDLES, BUNDLE_ROOMS, COOKING, CRAFTING, ARTISAN,
};
/* 打造的分类清单：从数据派生，新增分类自动出现在筛选栏（避免「内容存在但不可达」） */
const CRAFT_CATS = [...new Set(CRAFTING.map((c) => c.cat))];

/* 注册表自洽化：解析 data 引用、补全缺省字段、按 id 建表 */
REGISTRY.forEach((s) => {
  s.dataRef = s.data;                    /* 数组名留档（自检与调试用） */
  s.data = MODULE_DATA[s.dataRef] || [];
  if (!s.stateKey) s.stateKey = [];
  if (!s.indexExtra) s.indexExtra = () => [];
  if (typeof s.resetFilter !== "function") s.resetFilter = () => {};
  if (typeof s.detail !== "function") s.detail = () => null;
});
const SECTION = Object.fromEntries(REGISTRY.map((s) => [s.id, s]));

/* 对外保持 MODULES 形状不变（banner 导航、自检第 6 节都读它） */
const MODULES = REGISTRY.map((s) => ({
  id: s.id, sprite: s.sprite, icon: s.icon, label: s.label, sub: s.sub, render: s.render,
  /* dataRef：数据数组名。自检侧据此由注册表反查数据，做到「加模块不用改测试」 */
  dataRef: s.dataRef,
  /* countSuffix：标题里计数后面的单位，默认「条」；收集包这类自带单位的模块传空串 */
  countSuffix: s.countSuffix,
}));

/* 筛选值 → 结果集（各渲染函数共用，避免同一段 filter 抄 9 遍） */
function selectBy(sectionId, key, value) {
  const list = SECTION[sectionId].data;
  return value === "全部" ? list.slice() : list.filter((x) => (x[key] || "").includes(value));
}
/* 详情渲染器：对外仍是 id → html（不认识/不存在的 id 返回 null，保持空值安全） */
function renderDetail(moduleId, id) {
  const sec = SECTION[moduleId];
  if (!sec || !id) return null;
  const item = sec.data.find((x) => x.id === id);
  if (!item) return null;
  try { return sec.detail(item); } catch (err) { return null; }
}
const DETAIL_RENDERERS = Object.fromEntries(REGISTRY.map((s) => [s.id, (id) => renderDetail(s.id, id)]));

/* 收集包物品 → 站内条目（用于交叉跳转）。
 * 两份来源：①站内已有条目名；②收集包物品自带的「同源 id」（如 wood → mining/木材，
 * 与站内 img/wood.png 同一套命名），后者能接住「词汇不同但同一物品」的情况。 */
const BUNDLE_ITEM_INDEX = (() => {
  const map = new Map();
  REGISTRY.forEach((s) => s.data.forEach((it) => { if (!map.has(it.name)) map.set(it.name, { module: s.id, id: it.id }); }));
  BUNDLES.forEach((b) => (b.items || []).forEach((it) => {
    const names = bundleItemNames(it);
    names.forEach((n) => {
      if (map.has(n) || !it.id) return;
      const host = REGISTRY.find((s) => s.data.some((x) => x.id === it.id));
      if (host) map.set(n, { module: host.id, id: it.id });
    });
  }));
  return map;
})();

/* 反向索引：物品名 → 需要它的收集包（详情页「用于收集包」一节用） */
const BUNDLE_USES = (() => {
  const map = new Map();
  BUNDLES.forEach((b) => (b.items || []).forEach((it) => {
    bundleItemNames(it).forEach((n) => {
      if (!map.has(n)) map.set(n, []);
      map.get(n).push(b);
    });
  }));
  return map;
})();
/* 详情页附加区块：该物品用于哪些收集包 */
function bundleUsesSection(name) {
  const list = BUNDLE_USES.get(name);
  if (!list || !list.length) return "";
  return detailSection("用于收集包", `<div class="chip-list">` +
    list.map((b) => `<span class="chip chip-link" data-goto-module="bundles" data-goto-id="${esc(b.id)}" role="button" tabindex="0" title="查看${esc(b.name)}">${esc(b.name)}</span>`).join("") +
    `</div>`);
}

/* 礼物反向索引：物品名 → 最爱它的村民。
 * 「不可送礼」「（无礼物）」是数据里的占位说明，不是物品名，单独列出不参与跳转。 */
const GIFT_PLACEHOLDERS = ["不可送礼", "（无礼物）"];
const GIFT_USES = (() => {
  const map = new Map();
  const npcSec = REGISTRY.find((s) => s.id === "npc");
  if (!npcSec) return map;
  npcSec.data.forEach((n) => (n.loves || []).forEach((g) => {
    if (GIFT_PLACEHOLDERS.indexOf(g) >= 0) return;
    if (!map.has(g)) map.set(g, []);
    if (!map.get(g).some((x) => x.id === n.id)) map.get(g).push(n);
  }));
  return map;
})();
/* 村民卡片/详情里的礼物 chip：能对上条目的做成可跳转，对不上的保留纯文本 */
function giftChip(name) {
  if (GIFT_PLACEHOLDERS.indexOf(name) >= 0) return `<span class="chip chip-plain">${esc(name)}</span>`;
  const hit = NAME_INDEX.get(name);
  if (!hit) return `<span class="chip">🎁 ${esc(name)}</span>`;
  return `<span class="chip chip-link" data-goto-module="${esc(hit.module)}" data-goto-id="${esc(hit.id)}" role="button" tabindex="0" title="查看${esc(name)}">🎁 ${esc(name)}</span>`;
}
/* 详情页附加区块：该物品能送给谁 */
function giftUsesSection(name) {
  const list = GIFT_USES.get(name);
  if (!list || !list.length) return "";
  return detailSection("送礼对象", `<div class="chip-list">` +
    list.map((n) => `<span class="chip chip-link" data-goto-module="npc" data-goto-id="${esc(n.id)}" role="button" tabindex="0" title="查看${esc(n.name)}">💝 ${esc(n.name)}</span>`).join("") +
    `</div>`);
}

/* 料理反向索引：原料名 → 用得到它的菜肴（详情页「用于料理」一节用） */
const COOKED_BY = (() => {
  const map = new Map();
  COOKING.forEach((c) => (c.ingredients || []).forEach((i) => {
    if (!map.has(i.name)) map.set(i.name, []);
    if (!map.get(i.name).some((x) => x.id === c.id)) map.get(i.name).push(c);
  }));
  return map;
})();
function cookedBySection(name) {
  const list = COOKED_BY.get(name);
  if (!list || !list.length) return "";
  return detailSection("用于料理", `<div class="chip-list">` +
    list.map((c) => `<span class="chip chip-link" data-goto-module="cooking" data-goto-id="${esc(c.id)}" role="button" tabindex="0" title="查看${esc(c.name)}">🍳 ${esc(c.name)}</span>`).join("") +
    `</div>`);
}
/* 料理的原料 chip 与增益 chip：原料能对上站内条目的可跳转（如「南瓜」→ 农作物） */
function ingredientChip(ing) {
  const hit = NAME_INDEX.get(ing.name);
  const label = esc(ing.name) + (ing.qty > 1 ? ` ×${ing.qty}` : "");
  if (!hit) return `<span class="chip">${label}</span>`;
  return `<span class="chip chip-link" data-goto-module="${esc(hit.module)}" data-goto-id="${esc(hit.id)}" role="button" tabindex="0" title="查看${esc(ing.name)}">${label}</span>`;
}
function buffChips(buffs) {
  if (!buffs || !buffs.length) return "";
  return `<div class="buff-list">` + buffs.map((b) => `<span class="chip chip-buff">${esc(b)}</span>`).join("") + `</div>`;
}
/* 打造反向索引：材料名 → 用得到它的配方（详情页「用于打造」一节用） */
const CRAFTED_BY = (() => {
  const map = new Map();
  CRAFTING.forEach((r) => (r.ingredients || []).forEach((i) => {
    if (!map.has(i.name)) map.set(i.name, []);
    if (!map.get(i.name).some((x) => x.id === r.id)) map.get(i.name).push(r);
  }));
  return map;
})();
function craftedBySection(name) {
  const list = CRAFTED_BY.get(name);
  if (!list || !list.length) return "";
  return detailSection("用于打造", `<div class="chip-list">` +
    list.map((r) => `<span class="chip chip-link" data-goto-module="crafting" data-goto-id="${esc(r.id)}" role="button" tabindex="0" title="查看${esc(r.name)}">🔨 ${esc(r.name)}</span>`).join("") +
    `</div>`);
}

function buildNav() {
  const nav = $("#nav");
  MODULES.forEach((m) => {
    const b = document.createElement("button");
    b.className = "nav-item";
    b.dataset.module = m.id;
    b.innerHTML = moduleIconHtml(m) + `<span class="nav-label">${esc(m.label)}</span>`;
    b.addEventListener("click", () => gotoItem(m.id, null));
    nav.appendChild(b);
  });
}

function buildSections() {
  const page = $("#page");
  MODULES.forEach((m) => {
    const sec = document.createElement("section");
    sec.className = "module";
    sec.id = "module-" + m.id;
    sec.dataset.module = m.id;
    sec.hidden = true;
    sec.innerHTML = `
      <div class="module-head">
        <h2>${moduleIconHtml(m)}<span class="h2-label">${esc(m.label)}</span></h2>
        <p class="sub">${m.sub} · 共 <span id="${m.id}Count">0</span>${esc(m.countSuffix === undefined ? " 条" : m.countSuffix)}<span class="shown-count" id="shown-${m.id}"></span></p>
      </div>
      <div class="module-body" id="body-${m.id}"></div>`;
    page.appendChild(sec);
  });
}

/* ============================================================
 * 深链接与状态记忆（URL hash：#模块id/条目id）
 * ------------------------------------------------------------
 * 攻略站的常用入口是「搜到某条目 → 把链接发给队友」，所以刷新、分享、
 * 浏览器前进后退都要能回到同一条目。hash 只影响片段、不触发整页刷新。
 * ============================================================ */
const LAST_MODULE_KEY = "xlg.lastModule.v1";

/* routerGuard：程序化写 hash 时置位，避免 hashchange 再跑一遍造成重复跳转 */
let routerGuard = false;

function readSetting(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}
function writeSetting(key, val) {
  try { localStorage.setItem(key, val); } catch (err) { /* 隐私模式下忽略 */ }
}
/* 解析 #模块/条目；两段都要通过校验，非法输入一律安全降级 */
function parseHash(hash) {
  const raw = String(hash == null ? "" : hash).replace(/^#/, "");
  if (!raw) return { module: null, item: null };
  const parts = raw.split("/");
  let module = null, item = null;
  try { module = parts[0] ? decodeURIComponent(parts[0]) : null; } catch (err) { module = parts[0] || null; }
  try { item = parts.length > 1 && parts[1] ? decodeURIComponent(parts[1]) : null; } catch (err) { item = parts[1] || null; }
  if (module && !SECTION[module]) return { module: null, item: null };
  if (item && module && !SECTION[module].data.some((x) => x.id === item)) return { module, item: null };
  return { module, item };
}
function hashFor(moduleId, itemId) {
  return "#" + encodeURIComponent(moduleId) + (itemId ? "/" + encodeURIComponent(itemId) : "");
}
function currentHash() {
  return (typeof location !== "undefined" && location.hash) || "";
}
/* 写 URL 分两种粒度（R41）：
 *   replace（默认）——模块切换只是"就地改写"，不压历史，否则后退要按很多次；
 *   push——「打开某条目详情」才压一条，这样后退键正好关掉弹窗、回到浏览态。 */
function setRouteHash(moduleId, itemId, mode) {
  if (typeof history === "undefined") return;
  const next = hashFor(moduleId, itemId);
  if (currentHash() === next) return;
  routerGuard = true;
  try {
    if (mode === "push" && history.pushState) history.pushState(history.state, "", next);
    else if (history.replaceState) history.replaceState(history.state, "", next);
  } catch (err) { /* file:// 等场景忽略 */ }
  routerGuard = false;
}
function currentModuleId() {
  const active = MODULES.find((m) => {
    const sec = $(`#module-${m.id}`);
    return sec && !sec.hidden;
  });
  return active ? active.id : MODULES[0].id;
}
/* 默认落地模块：优先 URL，其次上次访问，最后第一个模块 */
function defaultModuleId() {
  return parseHash(currentHash()).module || readSetting(LAST_MODULE_KEY) || MODULES[0].id;
}
/* 跳到某个条目：重置目标模块筛选 → 切换 → 高亮滚动。搜索、深链接共用这一条路径。 */
function gotoItem(moduleId, itemId) {
  const sec = SECTION[moduleId];
  if (!sec) return false;
  if (itemId && !sec.data.some((x) => x.id === itemId)) itemId = null;
  resetModuleFilter(moduleId);
  switchModule(moduleId);
  writeSetting(LAST_MODULE_KEY, moduleId);
  setRouteHash(moduleId, itemId);
  const body = $(`#body-${moduleId}`);
  const el = body && itemId ? body.querySelector(`[data-id="${itemId}"]`) : null;
  if (el) {
    el.classList.remove("is-highlight");
    void el.offsetWidth;   // 重新触发动画
    el.classList.add("is-highlight");
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return true;
}
/* 启动时按 URL 落地：有 #模块 → 切过去；带条目 → 重置筛选并直接展开详情 */
function restoreRoute() {
  const route = parseHash(currentHash());
  const moduleId = route.module || defaultModuleId();
  if (!SECTION[moduleId]) return false;
  switchModule(moduleId);
  writeSetting(LAST_MODULE_KEY, moduleId);
  if (route.item) {
    resetModuleFilter(moduleId);
    switchModule(moduleId);
    openDetail(moduleId, route.item);
  }
  setRouteHash(moduleId, route.item);
  return true;
}

function switchModule(id) {
  MODULES.forEach((m) => {
    const active = m.id === id;
    const sec = $(`#module-${m.id}`);
    if (sec) sec.hidden = !active;
    const navBtn = $(`.nav-item[data-module="${m.id}"]`);
    if (navBtn) navBtn.classList.toggle("is-active", active);
  });
}

/* 全局搜索跳转前清空该模块筛选，避免目标条目被当前筛选条件挡住（R18）。
 * 重置逻辑由注册表提供，新增模块自动获得该能力。 */
function resetModuleFilter(moduleId) {
  const sec = SECTION[moduleId];
  if (!sec) return;
  sec.resetFilter(state);
  sec.render();
}

/* ============================================================
 * 全局搜索
 * ============================================================ */
/* 索引项 = 名字 + 注册表声明的附加关键词（用途/掉落/礼物/地点…），
 * 让「按用途找东西」这类攻略站最常见的查法可用。 */
function indexTerms(item) {
  if (!item) return [];
  return [item.name, item.use, item.note, item.desc, item.objective, item.location, item.type]
    .concat(Array.isArray(item.season) ? item.season : [])
    .concat(item.drops || [])
    .concat(item.loves || [])
    .filter(Boolean);
}
function buildIndex() {
  const out = [];
  REGISTRY.forEach((sec) => {
    sec.data.forEach((item) => {
      out.push({
        module: sec.id,
        id: item.id,
        name: item.name,
        kw: indexTerms(item).concat(sec.indexExtra(item) || []).filter(Boolean).join(" "),
      });
    });
  });
  return out;
}
const MODULE_LABEL = Object.fromEntries(REGISTRY.map((s) => [s.id, s.label]));

function initGlobalSearch() {
  const index = buildIndex();
  const input = $("#globalSearch");
  const drop = $("#searchDrop");
  if (!input || !drop) return;

  function searchHits(kw) {
    const q = String(kw || "").trim().toLowerCase();
    if (!q) return [];
    return index.filter((e) => e.kw.toLowerCase().includes(q));
  }

  function renderDrop(kw) {
    const q = String(kw || "").trim().toLowerCase();
    if (!q) { drop.hidden = true; drop.innerHTML = ""; return; }
    const hits = searchHits(kw).slice(0, 8);
    if (!hits.length) {
      drop.innerHTML = `<div class="search-empty">没有匹配「${esc(q)}」的结果</div>`;
    } else {
      drop.innerHTML = hits.map((h) => `
        <div class="search-item" data-module="${h.module}" data-id="${esc(h.id)}">
          <span class="mod-tag">${esc(MODULE_LABEL[h.module])}</span>
          <span class="name">${esc(h.name)}</span>
        </div>`).join("");
    }
    drop.hidden = false;
  }

  input.addEventListener("input", () => renderDrop(input.value));
  input.addEventListener("focus", () => renderDrop(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { drop.hidden = true; input.blur(); return; }
    /* 回车直达第一条结果：搜索后不必再用鼠标去点下拉项 */
    if (e.key === "Enter") {
      const hit = searchHits(input.value)[0];
      if (!hit) return;
      if (e.preventDefault) e.preventDefault();
      gotoItem(hit.module, hit.id);
      drop.hidden = true;
      input.value = "";
      input.blur();
    }
  });

  drop.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".search-item");
    if (!item) return;
    e.preventDefault();
    gotoItem(item.dataset.module, item.dataset.id);
    drop.hidden = true;
    input.value = "";
    input.blur();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".topbar-search")) drop.hidden = true;
  });
}

/* ============================================================
 * 详情弹窗（9 个模块全覆盖）
 * ============================================================ */
function raw(html) { return { __raw: html }; }

/* 金额展示：负数统一标红警示（如向日葵种子价高于售价） */
function money(n) {
  return n < 0 ? raw(`<b class="neg-text">${n} 金</b>`) : n + " 金";
}

/* 物品名 → 条目索引，用于掉落物交叉跳转 */
/* 物品名 → 条目索引：由注册表驱动，新增模块自动进入（此前是逐个模块手写，
 * 加「料理」时就被漏掉，导致菜肴无法作为礼物/原料被跳转——正是 P0 要消灭的漏配模式）。 */
const NAME_INDEX = (() => {
  const map = new Map();
  REGISTRY.forEach((sec) => sec.data.forEach((x) => {
    if (!map.has(x.name)) map.set(x.name, { module: sec.id, id: x.id });
  }));
  return map;
})();

function linkChip(name) {
  const hit = NAME_INDEX.get(name);
  if (!hit) return `<span class="chip">${esc(name)}</span>`;
  return `<span class="chip chip-link" data-goto-module="${hit.module}" data-goto-id="${esc(hit.id)}" role="button" tabindex="0" title="查看${esc(name)}">${esc(name)}</span>`;
}

function detailHead(iconHtml, name, sub) {
  return `<div class="modal-head">${iconHtml}<div><h3>${esc(name)}</h3><p class="role">${sub}</p></div></div>`;
}
function detailSection(title, inner) {
  return `<div class="modal-section"><h4>${esc(title)}</h4>${inner}</div>`;
}
function kvGrid(pairs) {
  return `<div class="detail-kv">${pairs.map(([k, v]) => {
    const val = (v && typeof v === "object" && "__raw" in v) ? v.__raw : esc(v);
    return `<div class="kv-cell"><span class="kv-k">${esc(k)}</span><span class="kv-v">${val}</span></div>`;
  }).join("")}</div>`;
}
function emojiIcon(ch) {
  return `<span class="item-icon emoji-icon"><span class="icon-fallback">${ch}</span></span>`;
}


let lastFocused = null;
function openDetail(moduleId, id) {
  const renderer = DETAIL_RENDERERS[moduleId];
  if (!renderer) return;
  let html = null;
  try { html = renderer(id); } catch (err) { html = null; }
  if (!html) return;
  const content = $("#modalContent");
  const modal = $("#modal");
  if (!content || !modal) return;
  content.innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (document.activeElement) lastFocused = document.activeElement;
  const btn = $("#modalClose");
  if (btn && typeof btn.focus === "function") btn.focus();
}
function closeModal() {
  const modal = $("#modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
}

/* ============================================================
 * 初始化
 * ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  buildSections();
  MODULES.forEach((m) => m.render());
  /* 先按 URL 落地（支持直接打开 #模块/条目 的分享链接），无 hash 时回落到上次访问的模块 */
  switchModule(defaultModuleId());
  restoreRoute();
  initGlobalSearch();

  /* 卡片 → 详情弹窗（事件委托，新渲染的卡片无需重新绑定） */
  const page = $("#page");
  /* 打开某张卡片：连同 URL 一起更新，使「点开的那一条」可分享、可前进后退 */
  function openCard(card) {
    const sec = card.closest(".module");
    if (!sec) return;
    openDetail(sec.dataset.module, card.dataset.id);
    setRouteHash(sec.dataset.module, card.dataset.id, "push");
  }
  page.addEventListener("click", (e) => {
    /* 收集包的捐赠勾选框优先于卡片点击处理，否则勾选会顺手弹出详情 */
    const box = e.target.closest("[data-bundle]");
    if (box) {
      if (e.stopPropagation) e.stopPropagation();
      const b = BUNDLES.find((x) => x.id === box.dataset.bundle);
      if (b && toggleBundleSlot(b, Number(box.dataset.slot))) renderBundles();
      return;
    }
    /* 卡片上的可跳转 chip（如 NPC 卡片里的礼物）优先于整卡点击，
     * 否则点礼物会变成打开该 NPC 自己的详情 */
    const chip = e.target.closest("[data-goto-id]");
    if (chip) {
      if (e.stopPropagation) e.stopPropagation();
      openDetail(chip.dataset.gotoModule, chip.dataset.gotoId);
      setRouteHash(chip.dataset.gotoModule, chip.dataset.gotoId, "push");
      return;
    }
    const card = e.target.closest("[data-id]");
    if (card) openCard(card);
  });
  page.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest("[data-id]");
    if (!card || !card.classList.contains("clickable")) return;
    e.preventDefault();
    openCard(card);
  });

  /* 弹窗内：收集包勾选 + 交叉跳转（如怪物掉落物 → 对应条目） */
  const content = $("#modalContent");
  content.addEventListener("click", (e) => {
    /* 弹窗里的勾选改的是同一份进度，因此要连带刷新背后的模块卡片 */
    const box = e.target.closest("[data-bundle-detail]");
    if (box) {
      const b = BUNDLES.find((x) => x.id === box.dataset.bundleDetail);
      if (b && toggleBundleSlot(b, Number(box.dataset.slot))) {
        renderBundles();
        openDetail("bundles", b.id);
        setRouteHash("bundles", b.id, "push");
      }
      return;
    }
    const link = e.target.closest("[data-goto-id]");
    if (!link) return;
    /* 交叉跳转可能跨模块（掉落物 → 采矿等），走 gotoItem 一并重置筛选与 URL */
    gotoItem(link.dataset.gotoModule, link.dataset.gotoId);
    openDetail(link.dataset.gotoModule, link.dataset.gotoId);
  });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* 浏览器前进 / 后退，或用户手改 hash：按新地址重新落地。
   * routerGuard 置位期间忽略——那是我们自己写 hash，避免重复跳转。 */
  window.addEventListener("hashchange", () => {
    if (routerGuard) return;
    const route = parseHash(currentHash());
    const moduleId = route.module || defaultModuleId();
    if (!SECTION[moduleId]) return;
    /* 换了模块才重置筛选；同模块内切换条目应保留用户当前的筛选条件 */
    if (moduleId !== currentModuleId()) resetModuleFilter(moduleId);
    switchModule(moduleId);
    writeSetting(LAST_MODULE_KEY, moduleId);
    if (route.item) openDetail(moduleId, route.item);
    else closeModal();
  });
});
