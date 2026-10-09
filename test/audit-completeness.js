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
  ["种子", ["种子"], [], "SEEDS"],
  ["果树", ["果树"], [], "FRUIT_TREES"],
  ["树木", ["树"], [], "TREES"],
  ["动物", ["动物"], [], "ANIMALS"],
];

/* 分类/导航页而非内容条目，比对时排除 */
const HUB_PAGES = new Set(["鱼", "怪物", "矿石", "晶球", "采集", "矿物", "节日", "NPC",
  "古物", "资源", "种子", "工具", "建筑", "树木", "树", "果树", "动物", "武器", "工匠物品", "打造"].map(norm));

/* 有意不收录：经核对后判定不属于对应模块范围。明确记录，避免每次审计重复排查。 */
const EXCLUDED = new Map(Object.entries({
  "咖啡豆": "同一物品已由「农作物」收录——它既是种子又是作物，重复收录会让名称索引产生二义（R53/R57）",
  "杂草": "农场杂物、不可出售，不是采集物",
  "草": "需用草籽种植，属作物类",
  "树液": "砍树的副产品，不是野外采集物",
  "史莱姆（怪物）": "Wiki 的消歧义页，不是独立怪物",
  "孩子": "泛指分类，不是具体 NPC",
  "居民": "泛指分类，不是具体 NPC",
  "大圆木": "可砍伐的资源节点，不是树本身（属「树木」分类但不产出种子/树液）",
  "大树桩": "可砍伐的资源节点，不是树本身（同上）",
}));

/* 整块系统盘点：**只列本站还没有对应模块的系统**（已收录的从本表移除，
 * 否则报告会永远显示「本站均无对应模块」，与事实不符）。 */
const SYSTEMS = [
  ["武器", "武器"],
  ["建筑", "农场建筑"],
  ["工具", "工具与升级"],
];

(async () => {
  const data = new Function(
    fs.readFileSync(path.join(root, "js/data.js"), "utf8") +
    "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS,SEEDS,FRUIT_TREES,TREES,ANIMALS};"
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
    const excluded = [];
    for (const t of bag) {
      if (HUB_PAGES.has(norm(t))) continue;
      if (EXCLUDED.has(t)) { excluded.push(t); continue; }
      if (ALL_NAMES.has(norm(t))) continue;
      missing.push(t);
    }
    results.push({ label, mine: data[key].length, wiki: bag.size, missing, excluded });
    console.log(
      label.padEnd(8) + String(data[key].length).padStart(4) + String(bag.size).padStart(7) +
      String(missing.length).padStart(6) +
      (missing.length === 0 ? "   ✓ 完整" + (excluded.length ? "（另有意排除 " + excluded.length + " 项）" : "") : "")
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
  console.log("\n逐模块缺口合计：" + totalGap + " 项" +
    (totalGap === 0 ? "（全部模块已对齐 Wiki 全集）" : ""));

  const exclTotal = results.reduce((n, r) => n + (r.excluded ? r.excluded.length : 0), 0);
  if (exclTotal) {
    console.log("\n=== 有意排除（已核对，不属于对应模块范围） ===");
    for (const r of results) {
      if (!r.excluded || !r.excluded.length) continue;
      r.excluded.forEach((t) => console.log("  " + r.label + " · " + t + " —— " + EXCLUDED.get(t)));
    }
  }

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
  console.log("\n提示：种子与农作物、工匠制品与农作物存在重叠，合计值有重复计数，仅用于衡量量级。");})();
