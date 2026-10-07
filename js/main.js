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

/* 物品图标：真实贴图与备用 SVG 二选一（贴图加载成功移除 SVG，失败保留 SVG） */
function itemIconHtml(id, name, svgFallback) {
  return `
      <span class="item-icon">
        <span class="icon-fallback">${svgFallback}</span>
        <img class="icon-img" src="img/${esc(id)}.png" alt="${esc(name)}" loading="lazy" decoding="async"
             onload="this.previousElementSibling.remove()"
             onerror="this.remove()">
      </span>`;
}

/* NPC 头像：真实立绘与 emoji 兜底二选一 */
function npcIconHtml(id, name, emoji) {
  return `
    <span class="item-icon npc-icon">
      <span class="icon-fallback npc-fallback">${emoji}</span>
      <img class="icon-img" src="img/npc-${esc(id)}.png" alt="${esc(name)}" loading="lazy" decoding="async"
           onload="this.previousElementSibling.remove()"
           onerror="this.remove()">
    </span>`;
}

/* ============================================================
 * 各模块渲染
 * ============================================================ */
const state = {
  crops: "全部", cropSort: "default",
  collect: "全部",
  fishingLoc: "全部", fishingSeason: "全部",
  mining: "全部", combat: "全部",
  npc: "全部",
  quests: "全部", events: "全部",
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
  setCount("cropsCount", CROPS.length);
  setShown("crops", list.length, CROPS.length);

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
            <span class="profit-num">${fmt1(cropProfit(c))}</span>
            <span class="profit-unit">金 / 天</span>
            <span class="profit-tag">${harvests > 1 ? `28 天 ×${harvests} 收` : "单次收获"}</span>
          </div>
          <div class="muted">${esc(c.note)}</div>
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
  setCount("collectCount", COLLECTIBLES.length);
  setShown("collect", list.length, COLLECTIBLES.length);

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
  setCount("fishingCount", FISH.length);
  setShown("fishing", list.length, FISH.length);

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
  setCount("miningCount", MINERALS.length);
  setShown("mining", list.length, MINERALS.length);

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
  setCount("combatCount", MONSTERS.length);
  setShown("combat", list.length, MONSTERS.length);

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
      <div class="meta">❤️ 生命 ${m.hp} · ⚡ 伤害 ${m.damage}</div>
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
  setCount("questsCount", QUESTS.length);
  setShown("quests", list.length, QUESTS.length);

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
  setCount("npcCount", NPCS.length);
  setShown("npc", list.length, NPCS.length);

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
        <div class="foot">最爱：${n.loves.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
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
  setCount("festivalsCount", FESTIVALS.length);
  setShown("festivals", sorted.length, FESTIVALS.length);
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

/* ---- 事件 ---- */
function renderEvents() {
  const body = $("#body-events");
  body.innerHTML = "";
  const list = EVENTS.filter((e) => state.events === "全部" || e.type === state.events);
  setCount("eventsCount", EVENTS.length);
  setShown("events", list.length, EVENTS.length);

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
 * 模块配置、导航与页面构建
 * ============================================================ */
const MODULES = [
  { id: "crops",      icon: "🌾", label: "农作物", sub: "各季节作物成熟时间、价格与收益", render: renderCrops },
  { id: "collect",    icon: "🍄", label: "收集物", sub: "野外采集物品的季节与地点",       render: renderCollect },
  { id: "fishing",    icon: "🎣", label: "钓鱼",   sub: "鱼类出现的水域、季节与时间",     render: renderFishing },
  { id: "mining",     icon: "⛏️", label: "采矿",   sub: "矿石与宝石的分布层级",           render: renderMining },
  { id: "combat",     icon: "⚔️", label: "战斗",   sub: "怪物属性、出没地点与掉落",       render: renderCombat },
  { id: "quests",     icon: "📜", label: "任务",   sub: "主线与委托任务的目标与奖励",     render: renderQuests },
  { id: "npc",        icon: "👤", label: "NPC",    sub: "村民生日、最爱礼物与住址",       render: renderNpc },
  { id: "festivals",  icon: "🎉", label: "节日",   sub: "全年节日的日期、地点与玩法",     render: renderFestivals },
  { id: "events",     icon: "✨", label: "事件",   sub: "随机事件与心事件的触发条件",     render: renderEvents },
];

function buildNav() {
  const nav = $("#nav");
  MODULES.forEach((m) => {
    const b = document.createElement("button");
    b.className = "nav-item";
    b.dataset.module = m.id;
    b.innerHTML = `<span class="ico">${m.icon}</span>${m.label}`;
    b.addEventListener("click", () => switchModule(m.id));
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
        <h2>${m.icon} ${m.label}</h2>
        <p class="sub">${m.sub} · 共 <span id="${m.id}Count">0</span> 条<span class="shown-count" id="shown-${m.id}"></span></p>
      </div>
      <div class="module-body" id="body-${m.id}"></div>`;
    page.appendChild(sec);
  });
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

/* 全局搜索跳转前清空该模块筛选，避免目标条目被当前筛选条件挡住 */
const FILTER_RESET = {
  crops: () => { state.crops = "全部"; },
  collect: () => { state.collect = "全部"; },
  fishing: () => { state.fishingLoc = "全部"; state.fishingSeason = "全部"; },
  mining: () => { state.mining = "全部"; },
  combat: () => { state.combat = "全部"; },
  quests: () => { state.quests = "全部"; },
  npc: () => { state.npc = "全部"; },
  events: () => { state.events = "全部"; },
};
function resetModuleFilter(moduleId) {
  const reset = FILTER_RESET[moduleId];
  const mod = MODULES.find((m) => m.id === moduleId);
  if (reset && mod) { reset(); mod.render(); }
}

/* ============================================================
 * 全局搜索
 * ============================================================ */
function buildIndex() {
  return [
    ...CROPS.map((c) => ({ module: "crops", id: c.id, name: c.name, kw: c.name + c.season.join("") })),
    ...COLLECTIBLES.map((c) => ({ module: "collect", id: c.id, name: c.name, kw: c.name })),
    ...FISH.map((f) => ({ module: "fishing", id: f.id, name: f.name, kw: f.name + f.location })),
    ...MINERALS.map((m) => ({ module: "mining", id: m.id, name: m.name, kw: m.name + m.type })),
    ...MONSTERS.map((m) => ({ module: "combat", id: m.id, name: m.name, kw: m.name + m.location })),
    ...QUESTS.map((q) => ({ module: "quests", id: q.id, name: q.name, kw: q.name })),
    ...NPCS.map((n) => ({ module: "npc", id: n.id, name: n.name, kw: n.name + n.loves.join("") + n.birthday })),
    ...FESTIVALS.map((f) => ({ module: "festivals", id: f.id, name: f.name, kw: f.name })),
    ...EVENTS.map((e) => ({ module: "events", id: e.id, name: e.name, kw: e.name })),
  ];
}
const MODULE_LABEL = Object.fromEntries(MODULES.map((m) => [m.id, m.label]));

function initGlobalSearch() {
  const index = buildIndex();
  const input = $("#globalSearch");
  const drop = $("#searchDrop");

  function renderDrop(kw) {
    kw = kw.trim().toLowerCase();
    if (!kw) { drop.hidden = true; drop.innerHTML = ""; return; }
    const hits = index.filter((e) => e.kw.toLowerCase().includes(kw)).slice(0, 8);
    if (!hits.length) {
      drop.innerHTML = `<div class="search-empty">没有匹配「${esc(kw)}」的结果</div>`;
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
    if (e.key === "Escape") { drop.hidden = true; input.blur(); }
  });

  drop.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".search-item");
    if (!item) return;
    e.preventDefault();
    focusItem(item.dataset.module, item.dataset.id);
    drop.hidden = true;
    input.value = "";
    input.blur();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".topbar-search")) drop.hidden = true;
  });
}

function focusItem(moduleId, id) {
  resetModuleFilter(moduleId);
  switchModule(moduleId);
  const body = $(`#body-${moduleId}`);
  const el = body.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.remove("is-highlight");
    void el.offsetWidth; // 重新触发动画
    el.classList.add("is-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ============================================================
 * 详情弹窗（9 个模块全覆盖）
 * ============================================================ */
function raw(html) { return { __raw: html }; }

/* 物品名 → 条目索引，用于掉落物交叉跳转 */
const NAME_INDEX = (() => {
  const map = new Map();
  const add = (module, arr) => arr.forEach((x) => {
    if (!map.has(x.name)) map.set(x.name, { module, id: x.id });
  });
  add("crops", CROPS);
  add("collect", COLLECTIBLES);
  add("fishing", FISH);
  add("mining", MINERALS);
  add("combat", MONSTERS);
  add("npc", NPCS);
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

const DETAIL_RENDERERS = {
  crops(id) {
    const c = CROPS.find((x) => x.id === id);
    if (!c) return null;
    const h = cropHarvests(c);
    const last = cropLastDay(c);
    return detailHead(
      itemIconHtml(c.id, c.name, CROP_ICONS[c.id] || GENERIC_ICON),
      c.name,
      esc(seasonLabel(c.season)) + " · " + (c.regrow > 0 ? "可多次收获" : "单次收获")
    ) +
      detailSection("经济数据", kvGrid([
        ["种子价", c.seed + " 金"],
        ["售价", c.sell + " 金"],
        ["单收净利", (c.sell - c.seed) + " 金"],
        ["每日净收益", raw(`<b class="gold-text">${fmt1(cropProfit(c))}</b> 金/天`)],
        ["成熟天数", cropGrowthText(c)],
        ["再收间隔", c.regrow > 0 ? c.regrow + " 天" : "—"],
        ["28 天可收", h + " 次"],
        ["季节总收益", (h * c.sell - c.seed) + " 金"],
      ])) +
      detailSection("备注", `<p>${esc(c.note)}</p>`) +
      detailSection("算法说明", `<p class="muted">每日净收益 =（28 天季节内总收获额 − 种子价）÷ 末次收获日（第 ${last} 天）。多季作物按单季 28 天估算。</p>`);
  },

  collect(id) {
    const c = COLLECTIBLES.find((x) => x.id === id);
    if (!c) return null;
    return detailHead(
      itemIconHtml(c.id, c.name, COLLECT_ICONS[c.id] || GENERIC_ICON),
      c.name,
      esc(seasonLabel(c.season)) + " · 野外采集"
    ) +
      detailSection("基础信息", kvGrid([
        ["季节", seasonLabel(c.season)],
        ["采集地点", c.location],
        ["售价", c.sell + " 金"],
      ])) +
      detailSection("用途", `<p>${esc(c.use)}</p>`);
  },

  fishing(id) {
    const f = FISH.find((x) => x.id === id);
    if (!f) return null;
    return detailHead(
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
      detailSection("用途", `<p>${esc(f.use)}</p>`);
  },

  mining(id) {
    const m = MINERALS.find((x) => x.id === id);
    if (!m) return null;
    return detailHead(itemIconHtml(m.id, m.name, MINERAL_ICON), m.name, esc(m.type)) +
      detailSection("分布", kvGrid([
        ["类型", m.type],
        ["出现层级", m.level],
        ["售价", m.sell + " 金"],
      ])) +
      detailSection("用途", `<p>${esc(m.use)}</p>`);
  },

  combat(id) {
    const m = MONSTERS.find((x) => x.id === id);
    if (!m) return null;
    return detailHead(
      itemIconHtml(m.id, m.name, MONSTER_ICON),
      m.name,
      esc(m.type) + " · " + esc(m.location)
    ) +
      detailSection("属性", kvGrid([
        ["生命值", String(m.hp)],
        ["伤害", String(m.damage)],
        ["类型", m.type],
        ["出没地点", m.location],
      ])) +
      detailSection("掉落物", `<div class="chip-list">${m.drops.map(linkChip).join("")}</div>` +
        (m.drops.some((d) => NAME_INDEX.has(d)) ? `<p class="muted">带下划线的掉落物可点击跳转。</p>` : ""));
  },

  quests(id) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q) return null;
    return detailHead(emojiIcon("📜"), q.name, esc(q.type)) +
      detailSection("任务目标", `<p>${esc(q.objective)}</p>`) +
      detailSection("来源与奖励", kvGrid([
        ["来源", q.source],
        ["类型", q.type],
        ["奖励", q.reward],
      ]));
  },

  npc(id) {
    const n = NPCS.find((x) => x.id === id);
    if (!n) return null;
    const idx = NPCS.indexOf(n);
    return detailHead(
      npcIconHtml(n.id, n.name, npcAvatar(idx)),
      n.name,
      `📍 ${esc(n.location)} · ${n.marriageable ? "可结婚" : "不可结婚"}`
    ) +
      detailSection("简介", `<p>${esc(n.desc)}</p>`) +
      detailSection("生日", `<p>🎂 ${esc(n.birthday)}</p>`) +
      detailSection("最爱的礼物", `<div class="chip-list">${n.loves.map((g) => `<span class="chip">🎁 ${esc(g)}</span>`).join("")}</div>`);
  },

  festivals(id) {
    const f = FESTIVALS.find((x) => x.id === id);
    if (!f) return null;
    return detailHead(emojiIcon("🎉"), f.name, `${esc(f.season)}季 ${esc(String(f.day))} 日`) +
      detailSection("时间地点", kvGrid([
        ["季节", f.season],
        ["日期", f.day + " 日"],
        ["地点", f.location],
        ["时间", f.time],
      ])) +
      detailSection("介绍", `<p>${esc(f.desc)}</p>`);
  },

  events(id) {
    const e = EVENTS.find((x) => x.id === id);
    if (!e) return null;
    return detailHead(emojiIcon("✨"), e.name, esc(e.type)) +
      detailSection("触发条件", `<p>${esc(e.trigger)}</p>`) +
      detailSection("说明", `<p>${esc(e.desc)}</p>`);
  },
};

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
  switchModule(MODULES[0].id);
  initGlobalSearch();

  /* 卡片 → 详情弹窗（事件委托，新渲染的卡片无需重新绑定） */
  const page = $("#page");
  page.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const sec = card.closest(".module");
    if (sec) openDetail(sec.dataset.module, card.dataset.id);
  });
  page.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest("[data-id]");
    if (!card || !card.classList.contains("clickable")) return;
    e.preventDefault();
    const sec = card.closest(".module");
    if (sec) openDetail(sec.dataset.module, card.dataset.id);
  });

  /* 弹窗内交叉跳转（如怪物掉落物 → 对应条目） */
  const content = $("#modalContent");
  content.addEventListener("click", (e) => {
    const link = e.target.closest("[data-goto-id]");
    if (!link) return;
    openDetail(link.dataset.gotoModule, link.dataset.gotoId);
  });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
});
