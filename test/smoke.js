/* ============================================================
 * 渲染冒烟测试（本地运行，无需网络）
 * 用法：node test/smoke.js
 * 作用：模拟 DOM 运行页面初始化，断言 9 个模块正常渲染，
 *       计数元素与数据长度一致 —— 可拦截"id 不匹配/初始化抛错"类 bug
 * 退出码：0 通过 / 1 失败
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

/* ---------- 最小 DOM 模拟 ---------- */
const registry = new Map();
const allEls = [];

class El {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this._cls = new Set();
    this.listeners = {};
    this._attrs = {};
    this._id = "";
    this.hidden = false;
    this._text = "";
    this._html = "";
  }
  set id(v) { this._id = v; if (v) registry.set("#" + v, this); }
  get id() { return this._id; }
  set innerHTML(v) {
    this._html = String(v);
    const re = /id="([^"]+)"/g;
    let m;
    while ((m = re.exec(this._html))) registry.set("#" + m[1], new El("div"));
  }
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

// 预注册 index.html 中的静态元素
for (const id of ["nav", "page", "globalSearch", "searchDrop", "modal", "modalClose", "modalContent"]) {
  registry.set("#" + id, new El("div"));
}

/* ---------- 运行页面代码 ---------- */
(async () => {
  let failures = 0;
  const src =
    fs.readFileSync(path.join(root, "js/data.js"), "utf8") + "\n" +
    fs.readFileSync(path.join(root, "js/icons.js"), "utf8") + "\n" +
    fs.readFileSync(path.join(root, "js/main.js"), "utf8") + "\n" +
    "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS};";

  let data;
  try {
    data = new Function(src)();
    await new Promise((r) => setTimeout(r, 120)); // 等 DOMContentLoaded 回调执行
  } catch (e) {
    console.log("✗ 初始化报错: " + e.message);
    console.log(e.stack.split("\n").slice(0, 3).join("\n"));
    process.exit(1);
  }

  // 期望：计数元素 = 对应数据长度（自动适应数据增减，同时拦截 id 不匹配）
  const expected = [
    ["cropsCount", data.CROPS.length],
    ["collectCount", data.COLLECTIBLES.length],
    ["fishingCount", data.FISH.length],
    ["miningCount", data.MINERALS.length],
    ["combatCount", data.MONSTERS.length],
    ["questsCount", data.QUESTS.length],
    ["npcCount", data.NPCS.length],
    ["festivalsCount", data.FESTIVALS.length],
    ["eventsCount", data.EVENTS.length],
  ];

  console.log("=== 渲染冒烟测试 ===");
  for (const [id, exp] of expected) {
    const el = registry.get("#" + id);
    const val = el ? el.textContent : "(元素缺失)";
    if (String(val) !== String(exp)) {
      console.log(`✗ #${id} = ${val}（期望 ${exp}）`);
      failures++;
    } else {
      console.log(`✓ #${id} = ${val}`);
    }
  }

  // 额外：检查模块 section 是否都创建且第一个已显示
  const modIds = ["crops", "collect", "fishing", "mining", "combat", "quests", "npc", "festivals", "events"];
  for (const m of modIds) {
    if (!registry.has("#module-" + m)) {
      console.log(`✗ 缺少模块 section #module-${m}`);
      failures++;
    }
  }
  const firstShown = registry.get("#module-crops");
  if (firstShown && firstShown.hidden !== false) {
    console.log("✗ 默认模块（crops）未显示");
    failures++;
  }

  console.log(failures ? `\n结果：失败 ${failures} 项` : "\n结果：全部通过 ✓");
  process.exit(failures ? 1 : 0);
})();
