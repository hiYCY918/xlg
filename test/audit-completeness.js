/* ============================================================
 * 攻略完备性审计（需要网络）
 * 用法：node test/audit-completeness.js
 *
 * 与 verify-wiki.js 的分工：
 *   verify-wiki.js       —— 存在性：我们收录的条目是否真实存在（防编造）
 *   audit-completeness.js —— 完备性：游戏里有的内容我们是否漏收（防遗漏）
 *
 * 口径：以中文星露谷 Wiki 的分类成员为「全集」，与 data.js 做双向差集。
 * 输出：
 *   ① 逐模块完备度表（本站 / Wiki 全集 / 缺口）
 *   ② 缺口明细（已排除分类页与跨模块重复项）
 *   ③ 整块未覆盖的游戏系统
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const ZH = "https://zh.stardewvalleywiki.com/mediawiki/api.php";

const q = (url) =>
  fetch(url, { signal: AbortSignal.timeout(25000), headers: { "User-Agent": "StardewGuide/1.0" } }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 归一化：去括号补充、去分隔符、统一大小写，便于跨来源匹配 */
const norm = (s) => String(s).replace(/[（(].*?[)）]/g, "").replace(/[\s·・,，、]/g, "").toLowerCase();

async function catMembers(c, type) {
  const url = ZH + "?action=query&list=categorymembers&cmtitle=" + encodeURIComponent("Category:" + c) +
    "&cmlimit=500&cmtype=" + type + "&format=json&formatversion=2";
  try {
    const j = await q(url);
    const ms = (j.query && j.query.categorymembers) || [];
    return type === "page" ? ms.filter((m) => m.ns === 0).map((m) => m.title)
                           : ms.map((m) => m.title.replace(/^Category:/, ""));
  } catch (e) { return []; }
}

/* 各模块对应的 Wiki 分类全集（主分类 + 需并入的子分类） */
const UNIVERSE = [
  ["农作物", ["春季作物", "夏季作物", "秋季作物", "冬季作物"], [], "CROPS"],
  ["收集物", ["采集"], ["春季采集", "夏季采集", "秋季采集", "冬季采集", "岛屿采集"], "COLLECTIBLES"],
  ["钓鱼", ["鱼"], [], "FISH"],
  ["采矿", ["宝石", "资源"], ["晶球矿物"], "MINERALS"],
  ["战斗", ["怪物"], [], "MONSTERS"],
  ["NPC", ["NPC"], [], "NPCS"],
  ["节日", ["春季节日", "夏季节日", "秋季节日", "冬季节日"], [], "FESTIVALS"],
];

/* 分类/导航页而非内容条目，比对时排除 */
const HUB_PAGES = new Set(["鱼", "怪物", "矿石", "晶球", "采集", "矿物", "节日", "NPC",
  "古物", "资源", "种子", "工具", "建筑", "树木", "果树", "动物", "武器", "工匠物品", "打造"].map(norm));

/* 整块系统盘点：本站是否有对应模块 */
const SYSTEMS = [
  ["烹饪", "料理 / 烹饪配方"],
  ["可制作物品", "打造 / 制作配方"],
  ["工匠物品", "工匠制品（酒 / 果酱 / 奶酪 / 蛋黄酱）"],
  ["果树", "果树"],
  ["动物", "牧场动物"],
  ["武器", "武器"],
  ["种子", "种子"],
  ["古物", "古物（博物馆捐赠）"],
  ["建筑", "农场建筑"],
  ["工具", "工具与升级"],
];

(async () => {
  const data = new Function(
    fs.readFileSync(path.join(root, "js/data.js"), "utf8") +
    "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS};"
  )();

  /* 跨全部模块的全局名称集合：同一物品出现在多个模块不算缺失 */
  const ALL_NAMES = new Set();
  Object.values(data).forEach((arr) => arr.forEach((x) => ALL_NAMES.add(norm(x.name))));

  console.log("=== 逐模块完备度（对照中文 Wiki 分类全集） ===");
  console.log("模块      本站   Wiki   缺口");
  const results = [];
  for (const [label, mainCats, subCats, key] of UNIVERSE) {
    const bag = new Set();
    for (const c of mainCats) { (await catMembers(c, "page")).forEach((t) => bag.add(t)); await sleep(110); }
    for (const c of subCats) { (await catMembers(c, "page")).forEach((t) => bag.add(t)); await sleep(110); }

    const missing = [];
    for (const t of bag) {
      if (HUB_PAGES.has(norm(t))) continue;
      if (ALL_NAMES.has(norm(t))) continue;
      missing.push(t);
    }
    results.push({ label, mine: data[key].length, wiki: bag.size, missing });
    console.log(
      label.padEnd(8) + String(data[key].length).padStart(4) + String(bag.size).padStart(7) +
      String(missing.length).padStart(6) + (missing.length === 0 ? "   ✓ 完整" : "")
    );
  }

  console.log("\n=== 缺口明细（已排除分类页与跨模块重复项） ===");
  let totalGap = 0;
  for (const r of results) {
    if (!r.missing.length) continue;
    totalGap += r.missing.length;
    console.log("\n【" + r.label + "】缺 " + r.missing.length + " 项");
    console.log("  " + r.missing.join("、"));
  }
  console.log("\n逐模块缺口合计：" + totalGap + " 项");

  console.log("\n=== 整块未覆盖的游戏系统 ===");
  let sysTotal = 0;
  for (const [c, label] of SYSTEMS) {
    const pages = await catMembers(c, "page");
    const subs = await catMembers(c, "subcat");
    if (!pages.length) { console.log("  " + label.padEnd(30) + "（分类「" + c + "」为空或不存在，跳过）"); continue; }
    sysTotal += pages.length;
    console.log("  " + label.padEnd(30) + "Wiki " + String(pages.length).padStart(4) + " 条" +
      (subs.length ? "（+子分类 " + subs.length + "）" : ""));
    await sleep(110);
  }
  console.log("\n整块系统条目合计：" + sysTotal + " 项（本站均无对应模块）");
  console.log("\n提示：种子与农作物、工匠制品与农作物存在重叠，合计值有重复计数，仅用于衡量量级。");
})();
