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

/* 物品图标：真实贴图与备用 SVG 二选一（贴图加载成功移除 SVG，失败保留 SVG） */
function itemIconHtml(id, name, svgFallback) {
  return `
      <span class="item-icon">
        <span class="icon-fallback">${svgFallback}</span>
        <img class="icon-img" src="img/${esc(id)}.png" alt="${esc(name)}" loading="lazy"
             onload="this.previousElementSibling.remove()"
             onerror="this.remove()">
      </span>`;
}

/* NPC 头像：真实立绘与 emoji 兜底二选一 */
function npcIconHtml(id, name, emoji) {
  return `
    <span class="item-icon npc-icon">
      <span class="icon-fallback npc-fallback">${emoji}</span>
      <img class="icon-img" src="img/npc-${esc(id)}.png" alt="${esc(name)}" loading="lazy"
           onload="this.previousElementSibling.remove()"
           onerror="this.remove()">
    </span>`;
}

/* ============================================================
 * 各模块渲染
 * ============================================================ */
const state = {
  crops: "全部", collect: "全部",
  fishingLoc: "全部", fishingSeason: "全部",
  mining: "全部", combat: "全部",
  npc: "全部",
  quests: "全部", events: "全部",
};

/* ---- 农作物 ---- */
function renderCrops() {
  const body = $("#body-crops");
  body.innerHTML = "";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, { value: "春", label: "春季" }, { value: "夏", label: "夏季" }, { value: "秋", label: "秋季" }],
    state.crops,
    (v) => { state.crops = v; renderCrops(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  const list = CROPS.filter((c) => state.crops === "全部" || c.season.includes(state.crops));
  setCount("cropsCount", CROPS.length);

  grid.innerHTML = list.map((c) => {
    const growText = c.regrow > 0
      ? `成熟 ${c.growth} 天 · 每 ${c.regrow} 天再收`
      : `成熟 ${c.growth} 天`;
    const foot = c.regrow === 0
      ? `单收净利 <span class="gold-text">${c.sell - c.seed}</span> · ${esc(c.note)}`
      : `<span class="badge green">多次收获</span> ${esc(c.note)}`;
    return `
      <div class="card" data-id="${esc(c.id)}">
        ${itemIconHtml(c.id, c.name, CROP_ICONS[c.id] || GENERIC_ICON)}
        <h3>${esc(c.name)}</h3>
        <div>${seasonBadges(c.season)}</div>
        <div class="meta">${growText}</div>
        <div class="meta">种子 <span class="gold-text">${c.seed}</span> · 售价 <span class="gold-text">${c.sell}</span></div>
        <div class="foot">${foot}</div>
      </div>`;
  }).join("") || emptyState("该季节暂无作物数据");
  body.appendChild(grid);
}

/* ---- 收集物 ---- */
function renderCollect() {
  const body = $("#body-collect");
  body.innerHTML = "";
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
  const list = COLLECTIBLES.filter((c) => state.collect === "全部" || c.season.includes(state.collect));
  setCount("collectCount", COLLECTIBLES.length);

  grid.innerHTML = list.map((c) => `
    <div class="card" data-id="${esc(c.id)}">
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
  const list = FISH.filter((f) => {
    const okLoc = state.fishingLoc === "全部" || f.locCat === state.fishingLoc;
    const okSea = state.fishingSeason === "全部" || f.season.includes(state.fishingSeason);
    return okLoc && okSea;
  });
  setCount("fishingCount", FISH.length);

  grid.innerHTML = list.map((f) => `
    <div class="card" data-id="${esc(f.id)}">
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
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const types = [...new Set(MINERALS.map((m) => m.type))];
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, ...types.map((t) => ({ value: t, label: t }))],
    state.mining,
    (v) => { state.mining = v; renderMining(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  const list = MINERALS.filter((m) => state.mining === "全部" || m.type === state.mining);
  setCount("miningCount", MINERALS.length);

  grid.innerHTML = list.map((m) => `
    <div class="card" data-id="${esc(m.id)}">
      ${itemIconHtml(m.id, m.name, MINERAL_ICON)}
      <h3>${esc(m.name)}</h3>
      <div><span class="badge brown">${esc(m.type)}</span></div>
      <div class="meta">📍 ${esc(m.level)}</div>
      <div class="foot">售价 <span class="gold-text">${m.sell}</span><br><span class="muted">${esc(m.use)}</span></div>
    </div>`).join("") || emptyState("没有符合条件的矿物");
  body.appendChild(grid);
}

/* ---- 战斗 ---- */
function renderCombat() {
  const body = $("#body-combat");
  body.innerHTML = "";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, { value: "矿井", label: "矿井" }, { value: "沙漠矿洞", label: "沙漠矿洞" }, { value: "姜岛", label: "姜岛" }, { value: "其他", label: "其他" }],
    state.combat,
    (v) => { state.combat = v; renderCombat(); }
  ));
  body.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "grid";
  const MAIN_LOCS = ["矿井", "沙漠矿洞", "姜岛"];
  const list = MONSTERS.filter((m) => {
    if (state.combat === "全部") return true;
    if (state.combat === "其他") return !MAIN_LOCS.some((l) => m.location.includes(l));
    return m.location.includes(state.combat);
  });
  setCount("combatCount", MONSTERS.length);

  grid.innerHTML = list.map((m) => `
    <div class="card" data-id="${esc(m.id)}">
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
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const types = [...new Set(QUESTS.map((q) => q.type))];
  toolbar.appendChild(chipBar(
    [{ value: "全部", label: "全部" }, ...types.map((t) => ({ value: t, label: t }))],
    state.quests,
    (v) => { state.quests = v; renderQuests(); }
  ));
  body.appendChild(toolbar);

  const wrap = document.createElement("div");
  wrap.className = "list";
  const list = QUESTS.filter((q) => state.quests === "全部" || q.type === state.quests);
  setCount("questsCount", QUESTS.length);

  wrap.innerHTML = list.map((q) => `
    <div class="list-item" data-id="${esc(q.id)}">
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
  const list = NPCS.filter((n) =>
    state.npc === "全部" || (state.npc === "可婚" ? n.marriageable : !n.marriageable)
  );
  setCount("npcCount", NPCS.length);

  grid.innerHTML = list.map((n, i) => {
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

  grid.querySelectorAll(".npc-card").forEach((card) => {
    const open = () => openNpcModal(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  body.appendChild(grid);
}

function openNpcModal(id) {
  const n = NPCS.find((x) => x.id === id);
  if (!n) return;
  const idx = NPCS.indexOf(n);
  const modal = $("#modal");
  $("#modalContent").innerHTML = `
    <div class="modal-head">
      ${npcIconHtml(n.id, n.name, npcAvatar(idx))}
      <div>
        <h3>${esc(n.name)}</h3>
        <p class="role">📍 ${esc(n.location)} · ${n.marriageable ? "可结婚" : "不可结婚"}</p>
      </div>
    </div>
    <div class="modal-section">
      <h4>简介</h4>
      <p>${esc(n.desc)}</p>
    </div>
    <div class="modal-section">
      <h4>生日</h4>
      <p>🎂 ${esc(n.birthday)}</p>
    </div>
    <div class="modal-section">
      <h4>最爱的礼物</h4>
      <div class="chip-list">${n.loves.map((g) => `<span class="chip">🎁 ${esc(g)}</span>`).join("")}</div>
    </div>
  `;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

/* ---- 节日 ---- */
const SEASON_ORDER = { 春: 0, 夏: 1, 秋: 2, 冬: 3 };
function renderFestivals() {
  const body = $("#body-festivals");
  const sorted = [...FESTIVALS].sort((a, b) => (SEASON_ORDER[a.season] - SEASON_ORDER[b.season]) || (a.day - b.day));
  setCount("festivalsCount", FESTIVALS.length);
  const wrap = document.createElement("div");
  wrap.className = "list";
  wrap.innerHTML = sorted.map((f) => `
    <div class="list-item" data-id="${esc(f.id)}">
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
  const list = EVENTS.filter((e) => state.events === "全部" || e.type === state.events);
  setCount("eventsCount", EVENTS.length);
  wrap.innerHTML = list.map((e) => `
    <div class="list-item" data-id="${esc(e.id)}">
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
        <p class="sub">${m.sub} · 共 <span id="${m.id}Count">0</span> 条</p>
      </div>
      <div class="module-body" id="body-${m.id}"></div>`;
    page.appendChild(sec);
  });
}

function switchModule(id) {
  MODULES.forEach((m) => {
    const active = m.id === id;
    $(`#module-${m.id}`).hidden = !active;
    const navBtn = $(`.nav-item[data-module="${m.id}"]`);
    if (navBtn) navBtn.classList.toggle("is-active", active);
  });
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
 * 初始化
 * ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  buildSections();
  MODULES.forEach((m) => m.render());
  switchModule(MODULES[0].id);
  initGlobalSearch();

  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
});
