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
  "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS};";

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

  console.log(failures ? `\n结果：失败 ${failures} 项` : "\n结果：全部通过 ✓");
  process.exit(failures ? 1 : 0);
})();
